"""
Tredev Learn - Backend API
Monolithic FastAPI application covering all 4 portals.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import csv
import io
import time
import hashlib
import logging
import secrets
import random
import asyncio
import requests
import panchang
import chat
import admin
import coupons
import cashfree
from translate import auto_translate
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator

import db as dbmod
from db import db
import firebase_auth
from firebase_auth import AuthError
import otp_auth

# ==================== SETUP ====================
# Postgres (Supabase) connection string; pool is created on startup.
DATABASE_URL = os.environ["DATABASE_URL"]

# Supabase Storage (for recorded-lesson video uploads via signed URLs).
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
COURSE_MEDIA_BUCKET = os.environ.get("COURSE_MEDIA_BUCKET", "course-media")
CHAT_MEDIA_BUCKET = os.environ.get("CHAT_MEDIA_BUCKET", "chat-media")
ACHARYA_MEDIA_BUCKET = os.environ.get("ACHARYA_MEDIA_BUCKET", "acharya-content")
MANTRA_AUDIO_BUCKET = os.environ.get("MANTRA_AUDIO_BUCKET", "mantra-audio")
MANTRA_AUDIO_MAX_BYTES = 2 * 1024 * 1024
BATCH_SCHEDULE_BUCKET = os.environ.get("BATCH_SCHEDULE_BUCKET", "batch-schedules")
BATCH_SCHEDULE_MAX_BYTES = 5 * 1024 * 1024
ACHARYA_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

# Bunny Stream (lecture video hosting) — a per-video TUS upload signature is handed
# to the browser so the real API key never leaves the server.
BUNNY_LIBRARY_ID = os.environ.get("BUNNY_LIBRARY_ID", "")
BUNNY_STREAM_API_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "")
# Signs short-lived embed-view tokens for playback (separate from the upload API key).
# Must match the "Token Authentication" security key set on the Stream library in Bunny's dashboard.
BUNNY_TOKEN_SECURITY_KEY = os.environ.get("BUNNY_TOKEN_SECURITY_KEY", "")

# Where Cashfree redirects the browser back to after checkout.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def ObjectId(x):
    """Compatibility shim: ids are uuid strings now, not bson ObjectIds."""
    return str(x)


app = FastAPI(title="Tredev Learn API")
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}
api_router = APIRouter(prefix="/api")
api_router.include_router(chat.router)
api_router.include_router(admin.router)
api_router.include_router(coupons.router)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==================== HELPERS ====================
def now_utc():
    return datetime.now(timezone.utc)

def to_iso(dt: datetime) -> str:
    return dt.isoformat()

def sanitize_user(u: dict) -> dict:
    if not u:
        return u
    u = dict(u)
    u["id"] = str(u.get("_id", u.get("id", "")))
    u.pop("_id", None)
    u.pop("password_hash", None)
    u.pop("otp_code_hash", None)
    u.pop("otp_expires_at", None)
    # dates to iso if datetime
    for k, v in list(u.items()):
        if isinstance(v, datetime):
            u[k] = v.isoformat()
    return u

def sanitize_doc(d: dict) -> dict:
    if not d:
        return d
    d = dict(d)
    d["id"] = str(d.get("_id", d.get("id", "")))
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = await firebase_auth.verify_id_token(token)
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    uid = decoded.get("uid") or decoded.get("user_id")
    user = await db.users.find_one({"firebase_uid": uid})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("suspended") or user.get("is_deleted"):
        raise HTTPException(status_code=401, detail="Account suspended")
    force_logout_at = user.get("force_logout_at")
    if force_logout_at:
        try:
            cutoff = datetime.fromisoformat(force_logout_at).timestamp()
        except ValueError:
            cutoff = 0
        if firebase_auth.token_issued_at(token) < cutoff:
            raise HTTPException(status_code=401, detail="Session invalidated, please sign in again")
    return sanitize_user(user)


def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role in {roles}")
        return user
    return checker


# Staff/admin roles get every course and webinar free, so they can preview and
# support content without paying — their enrollments/registrations must never
# create a payment record, since the revenue dashboard sums only db.payments.
STAFF_FREE_ACCESS_ROLES = ("academic_staff", "admin", "super_admin")


def require_feature(key: str):
    async def checker():
        toggle = await db.feature_toggles.find_one({"key": key})
        if toggle and toggle.get("enabled") is False:
            raise HTTPException(status_code=403, detail=f"Feature '{key}' is currently disabled")
        return True
    return checker


async def has_capability(user_id: str, capability: str) -> bool:
    grant = await db.capability_grants.find_one({"staff_id": user_id, "capability": capability})
    return grant is not None


async def check_feature_enabled(key: str):
    """Manual (non-Depends) feature-toggle check — used where the toggle key depends on
    request data (e.g. a quiz's context) rather than being fixed at route-declaration time."""
    toggle = await db.feature_toggles.find_one({"key": key})
    if toggle and toggle.get("enabled") is False:
        raise HTTPException(status_code=403, detail=f"Feature '{key}' is currently disabled")


def quiz_feature_key(context: str) -> str:
    """Quizzes ('event' context) and Assessments ('course' context) are decoupled features."""
    return "assessments" if context == "course" else "quizzes"


async def check_quiz_capability(actor: dict, context: str):
    """Per-staff capability grant, independent of the global feature toggle."""
    if actor["role"] != "academic_staff":
        return
    cap = "assessment_author" if context == "course" else "quiz_author"
    if not await has_capability(actor["id"], cap):
        label = "Assessment" if context == "course" else "Quiz"
        raise HTTPException(403, f"{label} authoring has not been granted to you by admin — ask an admin to grant the '{cap}' capability.")


async def write_audit(actor: dict, action: str, target: str = "", meta: dict = None):
    await db.audit_log.insert_one({
        "actor_id": actor.get("id"),
        "actor_email": actor.get("email"),
        "actor_role": actor.get("role"),
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": now_utc().isoformat(),
    })


# ponytail: static list, not an exhaustive/updating disposable-domain feed —
# upgrade to the `disposable-email-domains` PyPI package (or an API like
# Kickbox) if fake signups keep slipping through with new domains.
DISPOSABLE_EMAIL_DOMAINS = {
    "crybio.com", "mailinator.com", "guerrillamail.com", "guerrillamail.info",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
    "sharklasers.com", "10minutemail.com", "10minutemail.net", "20minutemail.com",
    "tempmail.com", "temp-mail.org", "tempmail.net", "tempmailo.com", "tempmail.dev",
    "throwawaymail.com", "trashmail.com", "trashmail.net", "dispostable.com",
    "yopmail.com", "yopmail.net", "yopmail.fr", "getnada.com", "moakt.com",
    "mailnesia.com", "mailcatch.com", "maildrop.cc", "mintemail.com", "fakeinbox.com",
    "spamgourmet.com", "mytemp.email", "emailondeck.com", "mailsac.com",
    "einrot.com", "mohmal.com", "mohmal.im", "mohmal.tech", "harakirimail.com",
    "burnermail.io", "tempinbox.com", "discard.email", "discardmail.com",
    "spambog.com", "spam4.me", "throwam.com", "mail-temporaire.fr", "tempr.email",
    "inboxbear.com", "luxusmail.org", "correotemporal.org", "nada.email",
}


def _is_disposable_email(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in DISPOSABLE_EMAIL_DOMAINS


# ==================== MODELS ====================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    # Optional: the redesigned signup flow asks for the name *after* OTP
    # verification, so register() only has email+password up front.
    name: Optional[str] = None
    role: Optional[str] = "learner"  # only learner allowed via public register

    @field_validator("email")
    @classmethod
    def email_not_disposable(cls, v: str) -> str:
        if _is_disposable_email(str(v)):
            raise ValueError("Temporary/disposable email addresses are not allowed. Please use a permanent email address.")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must be at least 8 characters and include a letter and a number")
        return v

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginIn(BaseModel):
    id_token: str

class PhoneLoginIn(BaseModel):
    # Phone sign-in also hands us a verified Firebase ID token (Firebase's Phone
    # Auth SDK owns sending/checking the SMS OTP).
    id_token: str
    # Only sent by the signup flow, right after the SMS code is confirmed —
    # phone accounts have no email/name from Firebase, so we ask once here.
    # Ignored for an already-existing user (a plain phone sign-in).
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class CompleteProfileIn(BaseModel):
    # One-time onboarding step, called right after email OTP verification.
    name: str
    phone: Optional[str] = None

class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)

class ConsultationIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    interest: str
    consent: bool

class LessonWatchIn(BaseModel):
    watched_pct: float

class EnrollIn(BaseModel):
    offering_id: str
    batch_id: Optional[str] = ""  # required when the offering is a live_course

class SadhanaCheckinIn(BaseModel):
    offering_id: str
    japa_count: int = 0
    notes: Optional[str] = ""

class SankalpaIn(BaseModel):
    offering_id: str
    sankalpa: str

class OfferingIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    description: str
    type: str  # masterclass, webinar, workshop, recorded_course, live_course, sadhana, ebook
    track: str  # A, B, or C
    subject: str
    price_inr: int = 0
    price_usd: int = 0
    duration: Optional[str] = ""
    acharya_id: Optional[str] = ""
    verses: List[str] = []
    modules: List[dict] = []
    image_url: Optional[str] = ""
    is_published: bool = False
    festival: Optional[str] = ""
    start_date: Optional[str] = ""

class BatchIn(BaseModel):
    offering_id: str
    name: str
    start_date: str
    max_students: int = 50

class BatchUpdateIn(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    max_students: Optional[int] = None

class BatchTimetableIn(BaseModel):
    items: List[dict] = []  # [{title, starts_at, duration_min, mode, topic}] — proposed class slots

class VerseIn(BaseModel):
    scripture: str  # Bhagavad Gita, Rigveda, etc
    reference: str  # 2.47
    devanagari: str
    iast: str
    word_by_word: List[dict] = []  # [{sanskrit, iast, meaning}]
    translations: List[dict] = []  # [{author, text}]
    commentaries: List[dict] = []  # [{author, text}]
    audio_url: Optional[str] = ""

class MantraIn(BaseModel):
    deity: str
    title: str
    devanagari: Optional[str] = ""
    iast: Optional[str] = ""
    meaning: Optional[str] = ""
    audio_url: Optional[str] = ""

class QuizIn(BaseModel):
    offering_id: Optional[str] = ""
    title: str
    questions: List[dict] = []  # [{id, type: mcq|paragraph, prompt, points, options?, correct?, multiple?, image_url?}]
    context: str = "event"  # 'event' | 'course'
    unlock_rule: str = "always"  # 'always' | 'on_course_complete'
    starts_at: Optional[str] = ""
    ends_at: Optional[str] = ""
    festival_id: Optional[str] = ""  # event-context quiz attached to a festival's "Play & Win" card

class QuizAttemptIn(BaseModel):
    quiz_id: str
    answers: List[Any] = []  # per-question: int | [int] for mcq, str for paragraph
    started_at: Optional[str] = ""
    time_taken_seconds: Optional[int] = None

class QuizLinkEventIn(BaseModel):
    live_session_id: Optional[str] = ""
    auto_create: bool = False
    starts_at: Optional[str] = ""

class AttemptGradeIn(BaseModel):
    manual_scores: Dict[str, int] = {}
    feedback: Dict[str, str] = {}

class FeatureToggleIn(BaseModel):
    enabled: bool

class DoubtIn(BaseModel):
    offering_id: Optional[str] = ""  # blank = general doubt raised via the chat widget
    lesson_id: Optional[str] = ""  # blank = general course doubt, not tied to one lecture
    question: str

class DoubtAnswerIn(BaseModel):
    answer: str

class LessonCommentIn(BaseModel):
    offering_id: str
    lesson_id: str
    body: str

class QueryTicketIn(BaseModel):
    title: str
    description: Optional[str] = ""
    category_tags: List[str] = []

class QueryMessageIn(BaseModel):
    message_text: str

class QueryReassignIn(BaseModel):
    staff_id: Optional[str] = ""

class AcharyaContentIn(BaseModel):
    title: str
    body: str
    offering_id: Optional[str] = ""
    kind: str = "lecture_note"  # lecture_note, verse_commentary, lesson_draft
    verse_id: Optional[str] = ""
    attachment_url: Optional[str] = ""
    attachment_name: Optional[str] = ""
    attachment_size: Optional[int] = 0

class AcharyaContentReviewIn(BaseModel):
    approved: bool
    notes: Optional[str] = ""

class AcharyaAttachmentSignIn(BaseModel):
    filename: str
    content_type: Optional[str] = "application/octet-stream"
    size_bytes: int = 0

class LiveSessionCreateIn(BaseModel):
    title: str
    offering_id: Optional[str] = ""   # blank = standalone session (not tied to a course)
    acharya_id: str
    starts_at: str
    duration_min: int = 60
    mode: str = "interactive"  # interactive, broadcast
    join_url: Optional[str] = ""
    topic: Optional[str] = ""          # description for standalone (non-course) sessions
    thumbnail_url: Optional[str] = ""
    recording_url: Optional[str] = ""  # attach after the class if it was recorded
    batch_id: Optional[str] = ""       # which batch of the (live) course this session is for

class LiveSessionUpdateIn(BaseModel):
    title: Optional[str] = None
    offering_id: Optional[str] = None
    acharya_id: Optional[str] = None
    starts_at: Optional[str] = None
    duration_min: Optional[int] = None
    mode: Optional[str] = None
    join_url: Optional[str] = None
    topic: Optional[str] = None
    thumbnail_url: Optional[str] = None
    recording_url: Optional[str] = None
    batch_id: Optional[str] = None

class WebinarCreateIn(BaseModel):
    title: str
    cover_image: str = ""
    starts_at: str
    duration_min: int = 90
    price_inr: int = 0
    orig_price_inr: int = 0
    mentor_name: str = ""
    mentor_id: Optional[str] = ""
    description: str = ""
    seats_remaining: int = 100
    join_url: Optional[str] = ""

class CertificateIssueIn(BaseModel):
    user_id: str
    offering_id: str

class CertificateSignIn(BaseModel):
    signature_name: str

class CertificateRejectIn(BaseModel):
    note: str

class SignUploadIn(BaseModel):
    filename: str
    content_type: Optional[str] = "application/octet-stream"

class BunnyVideoSignIn(BaseModel):
    title: Optional[str] = ""
    offering_id: Optional[str] = None

class ApprovalDecisionIn(BaseModel):
    approved: bool
    notes: Optional[str] = ""

class CapabilityGrantIn(BaseModel):
    staff_id: str
    capability: str  # course_builder, quiz_author, assessment_author, session_author, journal_author, grader, doubts, consultations
    scope: List[str] = []  # offering ids, or ["*"] for all

class FestivalIn(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    significance: Optional[str] = ""
    related_offering_subject: Optional[str] = ""
    deity: Optional[str] = ""

class FestivalCsvImportIn(BaseModel):
    csv_text: str
    mode: str = "replace"  # 'replace' clears the table first; 'append' upserts by (name, date)

class MentorIn(BaseModel):
    name: str
    title: str = ""
    avatar: str = ""
    parampara: str = ""
    order: int = 0
    credentials: List[str] = []
    bio: str = ""

class BlogIn(BaseModel):
    slug: str
    title: str
    category: str = ""
    excerpt: str = ""
    cover_image: str = ""
    author_name: str = ""
    read_time: str = ""
    body: str = ""

class CommunityPostIn(BaseModel):
    body: str
    verse_id: Optional[str] = ""

class UserUpdateIn(BaseModel):
    role: Optional[str] = None
    parampara: Optional[str] = None
    bio: Optional[str] = None
    name: Optional[str] = None


# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    role = "learner"  # public registration only for learners
    # Create the identity in Firebase (owns the password) and get a token.
    try:
        fb_uid, token = await firebase_auth.sign_up(email, data.password)
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    doc = {
        "firebase_uid": fb_uid,
        "email": email,
        # Real name comes later via /auth/complete-profile, right after OTP verify.
        "name": data.name or email.split("@")[0],
        "role": role,
        "created_at": now_utc().isoformat(),
        "avatar_url": "",
        "bio": "",
        "parampara": "",
        # New signups must verify their email before they can log in — existing
        # rows default to False (via schema.sql) so they're never retroactively locked out.
        "email_verify_required": True,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    email_sent = await _send_otp(doc["_id"], email)
    # No session cookie yet — the account only becomes usable once the code is verified.
    return {"user": sanitize_user(doc), "email_verification_sent": email_sent}


async def _send_otp(user_id, email: str) -> bool:
    """Generate a fresh 6-digit OTP, store its hash on the user row, and email
    it. Returns whether the email actually sent (callers must not claim
    success when it didn't — that's how the old Firebase-link flow went
    unnoticed for weeks while its emails silently failed to arrive)."""
    code = otp_auth.generate_code()
    await db.users.update_one({"_id": user_id}, {"$set": {
        "otp_code_hash": otp_auth.hash_code(code),
        "otp_expires_at": otp_auth.expiry_timestamp(),
    }})
    try:
        await otp_auth.send_code_email(email, code)
        return True
    except otp_auth.OtpSendError as e:
        logger.warning(f"Could not send OTP email to {email}: {e.message}")
        return False


@api_router.post("/auth/resend-verification")
async def resend_verification(data: LoginIn):
    """Re-send the verification code. Requires the password (same as login) so this
    can't be used to spam an arbitrary stranger's inbox."""
    email = data.email.lower()
    try:
        fb_uid, _ = await firebase_auth.sign_in(email, data.password)
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    user = await db.users.find_one({"firebase_uid": fb_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    email_sent = await _send_otp(user["_id"], email)
    return {"email_verification_sent": email_sent}


@api_router.post("/auth/verify-otp")
async def verify_otp(data: VerifyOtpIn, response: Response):
    """Confirm the 6-digit code emailed by /auth/register or /auth/resend-verification,
    then log the user straight in (no separate login call needed)."""
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if (otp_auth.is_expired(user.get("otp_expires_at"))
            or not user.get("otp_code_hash")
            or user["otp_code_hash"] != otp_auth.hash_code(data.code)):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "email_verify_required": False, "otp_code_hash": None, "otp_expires_at": None,
    }})
    # Frontend still holds the password from the registration form and calls
    # /auth/login right after this to actually establish the session cookie.
    return {"verified": True}


@api_router.post("/auth/complete-profile")
async def complete_profile(data: CompleteProfileIn, user: dict = Depends(get_current_user)):
    """Onboarding-only: fills in the name (+ optional phone) collected right
    after email OTP verification. Unlike PATCH /users/me — which deliberately
    excludes name — this one call is allowed to set it, since it's the same
    signup step as choosing it in the first place."""
    update = {"name": data.name}
    if data.phone:
        update["phone"] = data.phone
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return {"user": sanitize_user(u)}


@api_router.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    # Firebase verifies the password and issues the ID token.
    try:
        fb_uid, token = await firebase_auth.sign_in(email, data.password)
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    user = await db.users.find_one({"firebase_uid": fb_uid})
    if not user:
        # Firebase account exists but no local profile — self-heal one.
        doc = {
            "firebase_uid": fb_uid, "email": email, "name": email.split("@")[0],
            "role": "learner", "created_at": now_utc().isoformat(),
            "avatar_url": "", "bio": "", "parampara": "",
        }
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        user = doc
    if user.get("email_verify_required"):
        # Only /auth/verify-otp clears this flag now (self-managed OTP, not
        # Firebase's own emailVerified claim — see _send_otp/verify_otp above).
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")
    response.set_cookie("access_token", token, httponly=True, secure=False,
                        samesite="lax", max_age=7*24*3600, path="/")
    return {"user": sanitize_user(user), "token": token}


async def _login_via_verified_token(id_token: str, response: Response, build_new_user):
    """Shared by /auth/google and /auth/phone: both hand us an already-verified
    Firebase ID token (Google popup / Phone SMS OTP happen entirely client-side
    via the Firebase SDK) — we just verify it, find-or-create the local profile,
    and set the session cookie."""
    try:
        claims = await firebase_auth.verify_id_token(id_token)
    except AuthError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    fb_uid = claims["uid"]
    user = await db.users.find_one({"firebase_uid": fb_uid})
    if not user:
        doc = build_new_user(claims)
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        user = doc
    response.set_cookie("access_token", id_token, httponly=True, secure=False,
                        samesite="lax", max_age=7*24*3600, path="/")
    return {"user": sanitize_user(user), "token": id_token}


@api_router.post("/auth/google")
async def login_google(data: GoogleLoginIn, response: Response):
    def build_new_user(claims):
        email = (claims.get("email") or "").lower()
        return {
            "firebase_uid": claims["uid"], "email": email,
            "name": claims.get("name") or (email.split("@")[0] if email else "Learner"),
            "role": "learner", "created_at": now_utc().isoformat(),
            "avatar_url": claims.get("picture", ""), "bio": "", "parampara": "",
        }
    return await _login_via_verified_token(data.id_token, response, build_new_user)


@api_router.post("/auth/phone")
async def login_phone(data: PhoneLoginIn, response: Response):
    """Exchange a Firebase ID token obtained via the frontend's Phone Auth SMS
    OTP flow for our own session cookie. Phone-only accounts have no email, so
    a placeholder is synthesised to satisfy the unique/not-null email column —
    the real number lives in the `phone` field."""
    def build_new_user(claims):
        phone = claims.get("phone") or ""
        return {
            "firebase_uid": claims["uid"],
            "email": data.email.lower() if data.email else f"{claims['uid']}@phone.tredevlearn.local",
            "name": data.name or phone or "Learner", "phone": phone,
            "role": "learner", "created_at": now_utc().isoformat(),
            "avatar_url": "", "bio": "", "parampara": "",
        }
    return await _login_via_verified_token(data.id_token, response, build_new_user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


# ==================== USERS ====================
class UserSelfUpdateIn(BaseModel):
    phone: Optional[str] = None
    bio: Optional[str] = None
    parampara: Optional[str] = None


@api_router.patch("/users/me")
async def update_my_profile(data: UserSelfUpdateIn, user: dict = Depends(get_current_user)):
    """Self-service profile edit — deliberately excludes name/email/role: those
    stay identity-owned (Firebase for email, admin-only for name/role)."""
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return sanitize_user(u)


@api_router.get("/users")
async def list_users(user: dict = Depends(require_role("admin", "super_admin"))):
    users = await db.users.find({}).to_list(1000)
    return [sanitize_user(u) for u in users]


@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateIn,
                       actor: dict = Depends(require_role("admin", "super_admin"))):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    # A plain admin can't touch an existing super_admin account in any way,
    # nor appoint a new one — only super_admin can do either.
    if actor["role"] != "super_admin" and (target.get("role") == "super_admin" or update.get("role") == "super_admin"):
        raise HTTPException(403, "Only super_admin can modify a super_admin account")
    if update:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    await write_audit(actor, "user.update", user_id, update)
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return sanitize_user(u)


@api_router.get("/acharyas")
async def list_acharyas():
    acharyas = await db.users.find({"role": "acharya"}).to_list(200)
    return [sanitize_user(a) for a in acharyas]


@api_router.get("/learners")
async def list_learners(actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Learner directory for staff (e.g. issuing certificates)."""
    learners = await db.users.find({"role": "learner"}).to_list(2000)
    return [sanitize_user(u) for u in learners]


# ==================== OFFERINGS (Courses/Sadhanas/etc) ====================
@api_router.get("/offerings")
async def list_offerings(track: Optional[str] = None, type: Optional[str] = None,
                          subject: Optional[str] = None, published_only: bool = True):
    q = {}
    if published_only:
        q["is_published"] = True
    if track:
        q["track"] = track
    if type:
        q["type"] = type
    if subject:
        q["subject"] = subject
    items = await db.offerings.find(q).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.get("/offerings/{offering_id}")
async def get_offering(offering_id: str):
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not o:
        raise HTTPException(404, "Offering not found")
    result = sanitize_doc(o)
    # attach acharya profile
    if o.get("acharya_id"):
        try:
            a = await db.users.find_one({"_id": ObjectId(o["acharya_id"])})
            result["acharya"] = sanitize_user(a) if a else None
        except Exception:
            result["acharya"] = None
    # attach verses
    verse_ids = o.get("verses", [])
    verses = []
    for vid in verse_ids:
        try:
            v = await db.verses.find_one({"_id": ObjectId(vid)})
            if v:
                verses.append(sanitize_doc(v))
        except Exception:
            pass
    result["verses_full"] = verses
    return result


@api_router.post("/offerings")
async def create_offering(data: OfferingIn,
                          actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                          _feat: bool = Depends(require_feature("offerings")),
                          _feat2: bool = Depends(require_feature("build"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "course_builder"):
        raise HTTPException(403, "Course building has not been granted to you by admin — ask an admin to grant the 'course_builder' capability.")
    if not (data.acharya_id or "").strip():
        raise HTTPException(400, "Assign an Ācharya — every course must be routed to one for sign-off.")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    doc["approved_by_acharya"] = False
    doc["approval_notes"] = ""
    doc["title_hi"], doc["subtitle_hi"], doc["description_hi"] = await asyncio.gather(
        asyncio.to_thread(auto_translate, data.title),
        asyncio.to_thread(auto_translate, data.subtitle),
        asyncio.to_thread(auto_translate, data.description),
    )
    result = await db.offerings.insert_one(doc)
    await write_audit(actor, "offering.create", str(result.inserted_id), {"title": data.title})
    doc["_id"] = result.inserted_id
    return sanitize_doc(doc)


@api_router.patch("/offerings/{offering_id}")
async def update_offering(offering_id: str, data: dict,
                           actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                           _feat: bool = Depends(require_feature("offerings"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "offerings"):
        raise HTTPException(403, "Offerings has not been granted to you by admin — ask an admin to grant the 'offerings' capability.")
    data.pop("id", None)
    hi_fields = {"title": "title_hi", "subtitle": "subtitle_hi", "description": "description_hi"}
    changed = [en for en in hi_fields if en in data]
    translated = await asyncio.gather(*(asyncio.to_thread(auto_translate, data[en]) for en in changed))
    for en, hi_text in zip(changed, translated):
        data[hi_fields[en]] = hi_text
    await db.offerings.update_one({"_id": ObjectId(offering_id)}, {"$set": data})
    await write_audit(actor, "offering.update", offering_id, data)
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    return sanitize_doc(o)


@api_router.post("/offerings/{offering_id}/approval")
async def approve_offering(offering_id: str, decision: ApprovalDecisionIn,
                             actor: dict = Depends(require_role("acharya"))):
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not o:
        raise HTTPException(404, "Not found")
    if o.get("acharya_id") != actor["id"]:
        raise HTTPException(403, "Only the assigned Acharya can approve")
    await db.offerings.update_one({"_id": ObjectId(offering_id)},
        {"$set": {"approved_by_acharya": decision.approved,
                  "approval_notes": decision.notes,
                  "approved_at": now_utc().isoformat()}})
    await write_audit(actor, "offering.approve" if decision.approved else "offering.reject",
                      offering_id, {"notes": decision.notes})
    return {"ok": True}


# ==================== BATCHES (live-course cohorts) ====================
# One live_course offering can run multiple batches — each with its own start
# date and a capacity cap. Enrollment-capacity enforcement and Zoho scheduling
# integration are not part of this skeleton; batches are just named cohorts
# a live session can optionally be scheduled against.
@api_router.post("/batches")
async def create_batch(data: BatchIn,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("build"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "course_builder"):
        raise HTTPException(403, "Course building has not been granted to you by admin — ask an admin to grant the 'course_builder' capability.")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    r = await db.batches.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "batch.create", str(r.inserted_id), {"offering_id": data.offering_id, "name": data.name})
    return sanitize_doc(doc)


async def _batch_enrolled_count(batch_id: str, staff_ids: set) -> int:
    """Real (non-staff) seats taken — staff/admin get free role-based access
    and must never occupy or be counted against a batch's seat cap."""
    rows = await db.enrollments.find({"batch_id": batch_id}).to_list(2000)
    return sum(1 for e in rows if e.get("user_id") not in staff_ids)


@api_router.get("/batches")
async def list_batches(offering_id: Optional[str] = None):
    q = {"offering_id": offering_id} if offering_id else {}
    items = await db.batches.find(q).sort("start_date", 1).to_list(200)
    staff_ids = await admin._staff_user_ids()
    result = []
    for b in items:
        b = sanitize_doc(b)
        b["enrolled_count"] = await _batch_enrolled_count(b["id"], staff_ids)
        b["seats_available"] = max(0, int(b.get("max_students") or 0) - b["enrolled_count"])
        result.append(b)
    return result


@api_router.get("/batches/{batch_id}")
async def get_batch(batch_id: str, user: dict = Depends(get_current_user)):
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    b = sanitize_doc(b)
    staff_ids = await admin._staff_user_ids()
    b["enrolled_count"] = await _batch_enrolled_count(batch_id, staff_ids)
    b["seats_available"] = max(0, int(b.get("max_students") or 0) - b["enrolled_count"])
    o = await db.offerings.find_one({"_id": ObjectId(b.get("offering_id", ""))})
    b["offering_title"] = o.get("title", "") if o else ""
    return b


async def _check_batch_seat(offering_id: str, batch_id: str) -> dict:
    """Validates a batch belongs to the offering and still has a free seat.
    Raises HTTPException on any failure; returns the batch doc on success."""
    if not (batch_id or "").strip():
        raise HTTPException(400, "This is a live course — pick a batch to enroll in.")
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b or str(b.get("offering_id")) != str(offering_id):
        raise HTTPException(404, "Batch not found for this course.")
    staff_ids = await admin._staff_user_ids()
    enrolled_count = await _batch_enrolled_count(batch_id, staff_ids)
    # ponytail: count-then-insert, not a locking transaction — two concurrent
    # enrollments on the last seat could both pass this check. Fine at this
    # scale; add a DB-level seat lock if overselling ever actually happens.
    if enrolled_count >= int(b.get("max_students") or 0):
        raise HTTPException(400, "This batch is full — pick another batch.")
    return b


@api_router.patch("/batches/{batch_id}")
async def update_batch(batch_id: str, data: BatchUpdateIn,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("build"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "course_builder"):
        raise HTTPException(403, "Course building has not been granted to you by admin — ask an admin to grant the 'course_builder' capability.")
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.batches.update_one({"_id": ObjectId(batch_id)}, {"$set": update})
    await write_audit(actor, "batch.update", batch_id, update)
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    return sanitize_doc(b)


@api_router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("build"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "course_builder"):
        raise HTTPException(403, "Course building has not been granted to you by admin — ask an admin to grant the 'course_builder' capability.")
    await db.batches.delete_one({"_id": ObjectId(batch_id)})
    await write_audit(actor, "batch.delete", batch_id, {})
    return {"ok": True}


@api_router.patch("/batches/{batch_id}/timetable")
async def upload_batch_timetable(batch_id: str, data: BatchTimetableIn,
                                  actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                  _feat: bool = Depends(require_feature("build"))):
    """Staff uploads the proposed class timetable for a batch — sends it to the
    assigned Ācharya's Approval queue before any session is actually scheduled."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "session_author"):
        raise HTTPException(403, "Session scheduling has not been granted to you by admin — ask an admin to grant the 'session_author' capability.")
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    update = {
        "timetable": data.items,
        "schedule_status": "pending_approval",
        "schedule_notes": "",
        "schedule_submitted_at": now_utc().isoformat(),
    }
    await db.batches.update_one({"_id": ObjectId(batch_id)}, {"$set": update})
    await write_audit(actor, "batch.timetable_submit", batch_id, {"items": len(data.items)})
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    return sanitize_doc(b)


TIMETABLE_MODES = {"interactive", "broadcast"}


def _cell_to_str(v) -> str:
    """openpyxl hands back real date/time/datetime objects for formatted cells —
    normalize everything (Excel cells and CSV strings alike) to plain text."""
    if v is None:
        return ""
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d") if hasattr(v, "year") else v.strftime("%H:%M")
    return str(v).strip()


def _read_timetable_rows(content: bytes, filename: str) -> List[dict]:
    """Parse an uploaded CSV or XLSX timetable into raw {header: value} row dicts."""
    if filename.endswith(".xlsx"):
        import openpyxl
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            rows_iter = ws.iter_rows(values_only=True)
            header = [_cell_to_str(h).lower() for h in (next(rows_iter, None) or [])]
            rows = []
            for r in rows_iter:
                if all(c is None for c in r):
                    continue
                rows.append({header[i]: _cell_to_str(r[i]) for i in range(min(len(header), len(r)))})
            return rows
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"Could not read Excel file: {e}")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "CSV must be UTF-8 encoded.")
    reader = csv.DictReader(io.StringIO(text))
    return [{(k or "").strip().lower(): (v or "").strip() for k, v in row.items()} for row in reader]


def _parse_timetable_rows(rows: List[dict]) -> List[dict]:
    """Validate + convert raw rows (columns: title, date, time, duration_min, mode,
    topic) into the same item shape the manual PATCH /timetable endpoint accepts."""
    if not rows:
        raise HTTPException(400, "File has no data rows.")
    items, errors = [], []
    for i, row in enumerate(rows, start=2):  # header is row 1
        row_errors = []
        title = (row.get("title") or "").strip()
        date_s = (row.get("date") or "").strip()
        time_s = (row.get("time") or "").strip()
        mode = (row.get("mode") or "interactive").strip().lower()
        topic = (row.get("topic") or "").strip()
        if not title:
            row_errors.append("title is required")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_s):
            row_errors.append("date must be YYYY-MM-DD")
        if not re.match(r"^\d{1,2}:\d{2}$", time_s):
            row_errors.append("time must be HH:MM")
        duration_min = 60
        try:
            duration_min = int(float(row.get("duration_min") or 60))
            if duration_min <= 0:
                row_errors.append("duration_min must be positive")
        except ValueError:
            row_errors.append("duration_min must be a number")
        if mode not in TIMETABLE_MODES:
            row_errors.append(f"mode must be one of {sorted(TIMETABLE_MODES)}")
        if row_errors:
            errors.append(f"Row {i}: " + ", ".join(row_errors))
            continue
        items.append({
            "title": title, "starts_at": f"{date_s}T{time_s.zfill(5)}:00",
            "duration_min": duration_min, "mode": mode, "topic": topic,
        })
    if errors:
        raise HTTPException(400, "; ".join(errors[:20]))
    return items


@api_router.post("/batches/{batch_id}/timetable/upload")
async def upload_batch_timetable_file(batch_id: str, file: UploadFile = File(...),
                                       actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                       _feat: bool = Depends(require_feature("build"))):
    """Staff uploads a CSV/Excel timetable instead of typing sessions in one by
    one. Columns: title, date (YYYY-MM-DD), time (HH:MM), duration_min, mode,
    topic. Parsed rows go through the exact same pending_approval flow as the
    manual timetable endpoint; the raw file is kept only so the Acharya can
    reference it during review, then deleted once approved (see schedule-approval)."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "session_author"):
        raise HTTPException(403, "Session scheduling has not been granted to you by admin — ask an admin to grant the 'session_author' capability.")
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    name = (file.filename or "schedule").lower()
    if not (name.endswith(".csv") or name.endswith(".xlsx")):
        raise HTTPException(400, "Upload a .csv or .xlsx file.")
    content = await file.read()
    if len(content) > BATCH_SCHEDULE_MAX_BYTES:
        raise HTTPException(400, "File must be 5MB or smaller.")
    items = _parse_timetable_rows(_read_timetable_rows(content, name))

    source_url = ""
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "schedule") or "schedule"
        path = f"{batch_id}/{secrets.token_hex(8)}_{safe}"
        ctype = "text/csv" if name.endswith(".csv") else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        source_url = upload_bytes_to_storage(BATCH_SCHEDULE_BUCKET, path, content, ctype)

    update = {
        "timetable": items,
        "schedule_status": "pending_approval",
        "schedule_notes": "",
        "schedule_submitted_at": now_utc().isoformat(),
        "schedule_source_file_url": source_url,
    }
    await db.batches.update_one({"_id": ObjectId(batch_id)}, {"$set": update})
    await write_audit(actor, "batch.timetable_upload", batch_id, {"items": len(items), "filename": file.filename})
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    return sanitize_doc(b)


@api_router.post("/batches/{batch_id}/schedule-approval")
async def decide_batch_schedule(batch_id: str, decision: ApprovalDecisionIn,
                                 actor: dict = Depends(require_role("acharya"))):
    """Ācharya approves or requests changes to a batch's proposed timetable.
    On approval, the parsed timetable rows become real live_sessions (scoped to
    this batch, so learners in other batches of the same course never see them
    — see /live-sessions/mine-learner's existing batch filter), and the raw
    uploaded file is deleted since its rows now live in Postgres."""
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    o = await db.offerings.find_one({"_id": ObjectId(b["offering_id"])})
    if not o or o.get("acharya_id") != actor["id"]:
        raise HTTPException(403, "Only the assigned Acharya can approve this batch's timetable")
    update = {
        "schedule_status": "approved" if decision.approved else "changes_requested",
        "schedule_notes": decision.notes,
        "schedule_reviewed_at": now_utc().isoformat(),
    }
    if decision.approved:
        for item in (b.get("timetable") or []):
            doc = {
                "title": item.get("title", ""), "offering_id": b["offering_id"],
                "acharya_id": actor["id"], "acharya_name": actor.get("name", ""),
                "starts_at": item.get("starts_at", ""),
                "duration_min": int(item.get("duration_min") or 60),
                "mode": item.get("mode", "interactive"), "topic": item.get("topic", ""),
                "batch_id": batch_id, "created_at": now_utc().isoformat(), "created_by": actor["id"],
            }
            await db.live_sessions.insert_one(doc)
        source_url = b.get("schedule_source_file_url") or ""
        if source_url:
            delete_storage_object(BATCH_SCHEDULE_BUCKET, source_url.split(f"/public/{BATCH_SCHEDULE_BUCKET}/")[-1])
        update["schedule_source_file_url"] = ""
    await db.batches.update_one({"_id": ObjectId(batch_id)}, {"$set": update})
    await write_audit(actor, "batch.schedule_approve" if decision.approved else "batch.schedule_reject",
                       batch_id, {"notes": decision.notes})
    return {"ok": True}


async def roster_for_batch(batch_id: str) -> List[dict]:
    """Enrolled-learner roster for one batch — name/email/basic detail. No join
    helper exists in db.py's Mongo-style shim (it's a straight table, not SQL),
    so this is a manual per-enrollment user lookup, same style as admin.py's
    existing per-user offering-title lookups."""
    enrollments = await db.enrollments.find({"batch_id": batch_id}).sort("enrolled_at", 1).to_list(1000)
    out = []
    for e in enrollments:
        u = await db.users.find_one({"_id": ObjectId(e["user_id"])}) if e.get("user_id") else None
        out.append({
            "user_id": e.get("user_id"), "name": (u or {}).get("name", ""),
            "email": (u or {}).get("email", ""), "enrolled_at": e.get("enrolled_at"),
            "progress": e.get("progress", 0),
        })
    return out


@api_router.get("/batches/{batch_id}/students")
async def batch_students(batch_id: str,
                          actor: dict = Depends(require_role(
                              "academic_staff", "admin", "super_admin", "acharya"))):
    b = await db.batches.find_one({"_id": ObjectId(batch_id)})
    if not b:
        raise HTTPException(404, "Batch not found")
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "course_builder"):
        raise HTTPException(403, "Course building has not been granted to you by admin — ask an admin to grant the 'course_builder' capability.")
    if actor["role"] == "acharya":
        o = await db.offerings.find_one({"_id": ObjectId(b["offering_id"])})
        if not o or o.get("acharya_id") != actor["id"]:
            raise HTTPException(403, "Only the assigned Acharya can view this batch's roster")
    return await roster_for_batch(batch_id)


# ==================== VERSES (Shloka Player source) ====================
@api_router.get("/verses")
async def list_verses(scripture: Optional[str] = None, limit: int = 50):
    q = {}
    if scripture:
        q["scripture"] = scripture
    items = await db.verses.find(q).limit(limit).to_list(limit)
    return [sanitize_doc(v) for v in items]


@api_router.get("/verses/{verse_id}")
async def get_verse(verse_id: str):
    v = await db.verses.find_one({"_id": ObjectId(verse_id)})
    if not v:
        raise HTTPException(404, "Verse not found")
    return sanitize_doc(v)


@api_router.get("/shloka-of-day")
async def shloka_of_day():
    verses = await db.verses.find({}).to_list(200)
    if not verses:
        return {}
    today = date.today().toordinal()
    idx = today % len(verses)
    return sanitize_doc(verses[idx])


@api_router.post("/verses")
async def create_verse(data: VerseIn,
                       actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                       _feat: bool = Depends(require_feature("verses"))):
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    result = await db.verses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return sanitize_doc(doc)


# ==================== ENROLLMENTS ====================
@api_router.post("/enrollments")
async def enroll(data: EnrollIn, user: dict = Depends(get_current_user)):
    existing = await db.enrollments.find_one({"user_id": user["id"], "offering_id": data.offering_id})
    if existing:
        return sanitize_doc(existing)
    o = await db.offerings.find_one({"_id": ObjectId(data.offering_id)})
    if not o:
        raise HTTPException(404, "Offering not found")
    # Free direct enrollment is only for $0 courses — a paid one must always go
    # through the payment flow. Staff/admin/acharya never need an enrollment
    # row at all: they see every course through their own role-scoped portal
    # (CourseDetail.js's canView), not by enrolling like a learner.
    if o.get("price_inr", 0) > 0:
        raise HTTPException(400, "This course requires payment — use the checkout flow.")
    batch_id = None
    if o.get("type") == "live_course":
        await _check_batch_seat(data.offering_id, data.batch_id)
        batch_id = data.batch_id
    doc = {
        "user_id": user["id"],
        "offering_id": data.offering_id,
        "batch_id": batch_id,
        "enrolled_at": now_utc().isoformat(),
        "progress": 0,
        "completed_lessons": [],
        "status": "active",
    }
    result = await db.enrollments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return sanitize_doc(doc)


class ManualGrantIn(BaseModel):
    user_id: str
    offering_id: str
    note: Optional[str] = ""


@api_router.post("/enrollments/manual-grant")
async def manual_grant_enrollment(data: ManualGrantIn,
                                   actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Staff/admin grants a course directly, bypassing payment — e.g. a learner
    paid but the enrollment never landed. Tagged source='manual' so the purchase
    log/audit trail can tell it apart from a real checkout."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "manual_access_grant"):
        raise HTTPException(403, "Manual access grants has not been granted to you by admin — ask an admin to grant the 'manual_access_grant' capability.")
    o = await db.offerings.find_one({"_id": ObjectId(data.offering_id)})
    if not o:
        raise HTTPException(404, "Offering not found")
    existing = await db.enrollments.find_one({"user_id": data.user_id, "offering_id": data.offering_id})
    if existing:
        return sanitize_doc(existing)
    doc = {
        "user_id": data.user_id, "offering_id": data.offering_id,
        "enrolled_at": now_utc().isoformat(), "progress": 0,
        "completed_lessons": [], "status": "active",
        "source": "manual", "granted_by": actor["id"],
    }
    result = await db.enrollments.insert_one(doc)
    doc["_id"] = result.inserted_id
    await write_audit(actor, "enrollment.manual_grant", data.user_id,
                       {"offering_id": data.offering_id, "note": data.note})
    return sanitize_doc(doc)


@api_router.get("/enrollments/mine")
async def my_enrollments(user: dict = Depends(get_current_user)):
    enrolls = await db.enrollments.find({"user_id": user["id"]}).to_list(500)
    result = []
    for e in enrolls:
        e = sanitize_doc(e)
        try:
            o = await db.offerings.find_one({"_id": ObjectId(e["offering_id"])})
            if o:
                e["offering"] = sanitize_doc(o)
        except Exception:
            pass
        result.append(e)
    return result


LESSON_ATTENDANCE_THRESHOLD_PCT = 80
CERTIFICATE_ATTENDANCE_THRESHOLD_PCT = 75


@api_router.post("/enrollments/{offering_id}/lessons/{lesson_id}/watch-progress")
async def record_lesson_watch(offering_id: str, lesson_id: str, data: LessonWatchIn,
                               user: dict = Depends(get_current_user)):
    """Auto-attendance: the player reports how far into a lesson the learner has
    watched. Once they cross the threshold the lesson is marked attended/complete
    — this is the sole way completed_lessons gets updated (no self-reported
    "mark complete" click any more, so course progress/attendance is trustworthy)."""
    e = await db.enrollments.find_one({"user_id": user["id"], "offering_id": offering_id})
    if not e:
        raise HTTPException(404, "Not enrolled in this course")
    if e.get("suspended"):
        raise HTTPException(403, "Your access to this course has been restricted by an admin.")
    done_ids = list(e.get("completed_lessons") or [])
    if data.watched_pct >= LESSON_ATTENDANCE_THRESHOLD_PCT and lesson_id not in done_ids:
        done_ids.append(lesson_id)
        o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
        total = len(o.get("modules") or []) if o else 0
        progress = round(len(done_ids) / total * 100) if total else 0
        status = "completed" if total and len(done_ids) >= total else "active"
        await db.enrollments.update_one(
            {"user_id": user["id"], "offering_id": offering_id},
            {"$set": {"completed_lessons": done_ids, "progress": progress, "status": status}})
        return {"completed_lessons": done_ids, "progress": progress, "status": status}
    return {"completed_lessons": done_ids, "progress": e.get("progress", 0), "status": e.get("status", "active")}


@api_router.get("/learner/performance")
async def learner_performance(user: dict = Depends(get_current_user)):
    """Performance = attendance (lessons watched >=80%) + assignment score, averaged.
    Attendance reuses the same completed_lessons/modules signal already driving
    each course's progress bar; assignment score is the learner's own graded quiz
    attempts across every course."""
    enrollments = await db.enrollments.find({"user_id": user["id"]}).to_list(500)
    total_lessons = 0
    done_lessons = 0
    for e in enrollments:
        o = await db.offerings.find_one({"_id": ObjectId(e["offering_id"])})
        total_lessons += len(o.get("modules") or []) if o else 0
        done_lessons += len(e.get("completed_lessons") or [])
    attendance_pct = round(done_lessons / total_lessons * 100) if total_lessons else 0

    # `score` on a quiz_attempt is already a 0-100 percentage (not raw points —
    # `total_score` there is the attempt's max point value, a different scale).
    attempts = await db.quiz_attempts.find({"user_id": user["id"], "status": "graded"}).to_list(500)
    graded = [a for a in attempts if a.get("score") is not None]
    quiz_avg_pct = round(sum(a["score"] for a in graded) / len(graded)) if graded else None

    parts = [p for p in (attendance_pct, quiz_avg_pct) if p is not None]
    performance_pct = round(sum(parts) / len(parts)) if parts else 0
    return {
        "attendance_pct": attendance_pct,
        "quiz_avg_pct": quiz_avg_pct,
        "performance_pct": performance_pct,
        "lessons_attended": done_lessons,
        "total_lessons": total_lessons,
        "graded_assignments": len(graded),
    }


# ==================== SADHANA ====================
@api_router.post("/sadhana/sankalpa")
async def set_sankalpa(data: SankalpaIn, user: dict = Depends(get_current_user)):
    await db.sadhana_progress.update_one(
        {"user_id": user["id"], "offering_id": data.offering_id},
        {"$set": {"sankalpa": data.sankalpa, "started_at": now_utc().isoformat()},
         "$setOnInsert": {"checkins": [], "streak": 0, "total_japa": 0}},
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/sadhana/checkin")
async def checkin(data: SadhanaCheckinIn, user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    progress = await db.sadhana_progress.find_one({"user_id": user["id"], "offering_id": data.offering_id})
    checkins = progress.get("checkins", []) if progress else []
    already = any(c.get("date") == today for c in checkins)
    if already:
        return {"ok": True, "already_done": True}
    # compassionate streak: if yesterday exists, increment; else reset to 1 (missed days show as fading)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    prev_streak = progress.get("streak", 0) if progress else 0
    new_streak = prev_streak + 1 if any(c.get("date") == yesterday for c in checkins) else 1
    checkins.append({"date": today, "japa_count": data.japa_count, "notes": data.notes})
    total_japa = sum(c.get("japa_count", 0) for c in checkins)
    await db.sadhana_progress.update_one(
        {"user_id": user["id"], "offering_id": data.offering_id},
        {"$set": {"checkins": checkins, "streak": new_streak, "total_japa": total_japa,
                  "last_checkin": today}},
        upsert=True,
    )
    return {"ok": True, "streak": new_streak, "total_japa": total_japa}


@api_router.get("/sadhana/{offering_id}")
async def get_sadhana(offering_id: str, user: dict = Depends(get_current_user)):
    p = await db.sadhana_progress.find_one({"user_id": user["id"], "offering_id": offering_id})
    if not p:
        return {"sankalpa": "", "checkins": [], "streak": 0, "total_japa": 0}
    # cohort count
    cohort_count = await db.sadhana_progress.count_documents({"offering_id": offering_id})
    result = sanitize_doc(p)
    result["cohort_count"] = cohort_count
    return result


# ==================== FREE CALCULATORS ====================
RASHIS = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya","Tula","Vrishchika","Dhanu","Makara","Kumbha","Meena"]

PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]


@api_router.get("/calculators/panchang")
async def calc_panchang(d: Optional[str] = None, lat: float = 28.6139, lon: float = 77.209):
    """Panchang computed via Swiss Ephemeris (Lahiri ayanamsa), evaluated at local sunrise."""
    target = date.fromisoformat(d) if d else date.today()
    return panchang.daily_panchang(target, lat, lon)


@api_router.post("/calculators/numerology")
async def calc_numerology(payload: dict):
    name = str(payload.get("name", "")).strip()
    dob = payload.get("dob", "")
    def reduce_digit(n):
        while n > 9 and n not in (11, 22, 33):
            n = sum(int(c) for c in str(n))
        return n
    def name_number(s):
        vals = {c: ((ord(c) - 96) if c.isalpha() else 0) for c in s.lower()}
        total = sum(vals.values())
        return reduce_digit(total)
    life_path = None
    if dob:
        try:
            digits = "".join(c for c in dob if c.isdigit())
            life_path = reduce_digit(sum(int(x) for x in digits))
        except Exception:
            pass
    return {
        "name": name,
        "dob": dob,
        "destiny_number": name_number(name) if name else None,
        "life_path_number": life_path,
        "note": "Numerology as śāstra: numbers are symbols of qualities. This is not a prediction of your future."
    }


@api_router.post("/calculators/kundli")
async def calc_kundli(payload: dict):
    name = str(payload.get("name", ""))
    dob = payload.get("dob", "")
    tob = payload.get("tob", "")
    pob = payload.get("pob", "")
    seed = hash(f"{name}{dob}{tob}{pob}") & 0xffffffff
    r = random.Random(seed)
    ascendant = RASHIS[r.randint(0, 11)]
    houses = []
    for i in range(12):
        planets_in_house = r.sample(PLANETS, r.randint(0, 3))
        houses.append({
            "house": i + 1,
            "sign": RASHIS[(RASHIS.index(ascendant) + i) % 12],
            "planets": planets_in_house
        })
    return {
        "name": name, "dob": dob, "tob": tob, "pob": pob,
        "ascendant": ascendant,
        "moon_sign": RASHIS[r.randint(0, 11)],
        "sun_sign": RASHIS[r.randint(0, 11)],
        "houses": houses,
        "note": "Here is your chart as a study object. Learn to read it — we do not tell fortunes."
    }


@api_router.get("/calculators/transliterate")
async def transliterate(text: str):
    # Naive IAST -> Devanagari mapping (illustrative, MVP)
    mapping = {"a":"अ","ā":"आ","i":"इ","ī":"ई","u":"उ","ū":"ऊ","e":"ए","ai":"ऐ","o":"ओ","au":"औ",
               "ka":"क","kha":"ख","ga":"ग","gha":"घ","ca":"च","cha":"छ","ja":"ज","jha":"झ",
               "ta":"त","tha":"थ","da":"द","dha":"ध","na":"न","pa":"प","pha":"फ","ba":"ब",
               "bha":"भ","ma":"म","ya":"य","ra":"र","la":"ल","va":"व","sa":"स","ha":"ह",
               "śa":"श","ṣa":"ष","ṃ":"ं","ḥ":"ः","om":"ॐ"}
    out = text
    for k, v in sorted(mapping.items(), key=lambda x: -len(x[0])):
        out = out.replace(k, v)
    return {"input": text, "devanagari": out,
            "note": "Study tool. For rigorous transliteration, use the IAST word-by-word view in the Shloka Player."}


# ==================== CONSULTATION ====================
@api_router.post("/consultations")
async def submit_consultation(data: ConsultationIn):
    if not data.consent:
        raise HTTPException(400, "Consent is required (DPDP)")
    # find academic_staff with lightest open backlog
    staff = await db.users.find({"role": "academic_staff"}).to_list(500)
    if not staff:
        # fallback to admin
        staff = await db.users.find({"role": {"$in": ["admin", "super_admin"]}}).to_list(50)
    if not staff:
        raise HTTPException(503, "No staff available. Please try again later.")
    counts = []
    for s in staff:
        n = await db.consultations.count_documents({"assigned_to": str(s["_id"]), "status": "open"})
        counts.append((n, s))
    counts.sort(key=lambda x: (x[0], str(x[1]["_id"])))
    least = counts[0]
    assigned_to = str(least[1]["_id"])
    at_capacity = least[0] >= 10  # per-staff soft cap
    doc = {
        "name": data.name, "email": data.email.lower(), "phone": data.phone,
        "interest": data.interest, "consent": True,
        "assigned_to": assigned_to, "status": "open" if not at_capacity else "queued",
        "created_at": now_utc().isoformat(),
    }
    result = await db.consultations.insert_one(doc)
    expected = "24 hours" if not at_capacity else "48–72 hours (queued)"
    return {"id": str(result.inserted_id), "assigned_to": assigned_to,
            "expected_callback": expected, "status": doc["status"]}


async def purge_old_threads():
    """7-day retention for the Staff Panel's doubt/consultation blocks — a lazy
    sweep on read, no scheduler needed. ISO-8601 UTC strings sort chronologically
    as plain strings, matching how every timestamp in this codebase is stored."""
    cutoff = (now_utc() - timedelta(days=7)).isoformat()
    await db.doubts.delete_many({"created_at": {"$lt": cutoff}})
    await db.consultations.delete_many({"created_at": {"$lt": cutoff}})


@api_router.get("/consultations/mine")
async def my_consultations(user: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    await purge_old_threads()
    q = {} if user["role"] in ("admin", "super_admin") else {"assigned_to": user["id"]}
    items = await db.consultations.find(q).sort("created_at", -1).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.get("/consultations/mine-learner")
async def my_consultations_as_learner(user: dict = Depends(get_current_user)):
    """A learner's own consultation requests, for the chat widget to poll for replies."""
    items = await db.consultations.find({"email": user["email"].lower()}).sort("created_at", -1).to_list(50)
    return [sanitize_doc(x) for x in items]


@api_router.patch("/consultations/{cid}")
async def update_consultation(cid: str, data: dict,
                               user: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                               _feat: bool = Depends(require_feature("consultations"))):
    if user["role"] == "academic_staff" and not await has_capability(user["id"], "consultations"):
        raise HTTPException(403, "Consultations has not been granted to you by admin — ask an admin to grant the 'consultations' capability.")
    await db.consultations.update_one({"_id": ObjectId(cid)}, {"$set": data})
    await write_audit(user, "consultation.update", cid, data)
    return {"ok": True}


# ==================== QUIZZES ====================
def normalize_question(q: dict, idx: int = 0) -> dict:
    """Typed question shape; normalizes legacy {q, options, correct_index} rows on read."""
    q = dict(q)
    if q.get("type") is None:
        q = {
            "id": q.get("id") or str(idx),
            "type": "mcq",
            "prompt": q.get("prompt", q.get("q", "")),
            "options": q.get("options", []),
            "correct": [q["correct_index"]] if "correct_index" in q else q.get("correct", []),
            "points": q.get("points", 1),
            "multiple": q.get("multiple", False),
        }
    q.setdefault("id", str(idx))
    q.setdefault("prompt", q.get("q", ""))
    q.setdefault("points", 1)
    q.setdefault("correct", [])
    q.setdefault("multiple", False)
    return q


def strip_question_answers(q: dict) -> dict:
    q = dict(q)
    q.pop("correct", None)
    return q


def rank_leaderboard(rows: List[dict]) -> List[dict]:
    """Sorts attempt rows by highest total_score, then fastest time_taken_seconds
    (missing times rank last among equal scores), and assigns 1-based rank."""
    rows = sorted(rows, key=lambda r: (-(r.get("total_score") or 0),
                  r["time_taken_seconds"] if r.get("time_taken_seconds") is not None else float("inf")))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def auto_grade_mcq(questions: List[dict], answers: List[Any]):
    """Grades only type=='mcq' questions; returns (correct_count, points_scored)."""
    correct = 0
    points_scored = 0
    for i, question in enumerate(questions):
        if question.get("type") == "paragraph":
            continue
        ans = answers[i] if i < len(answers) else None
        points = question.get("points", 1) or 1
        expected = question.get("correct", [])
        if question.get("multiple"):
            given = set(ans) if isinstance(ans, list) else set()
            is_correct = bool(expected) and given == set(expected)
        else:
            given = ans[0] if isinstance(ans, list) and ans else ans
            is_correct = bool(expected) and given in expected
        if is_correct:
            correct += 1
            points_scored += points
    return correct, points_scored


@api_router.post("/quizzes")
async def create_quiz(data: QuizIn,
                      actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    await check_feature_enabled(quiz_feature_key(data.context))
    await check_quiz_capability(actor, data.context)
    if data.context == "course" and not (data.offering_id or "").strip():
        raise HTTPException(400, "offering_id is required for a course-context quiz")
    doc = data.model_dump()
    doc["offering_id"] = (doc.get("offering_id") or "").strip() or None
    doc["festival_id"] = (doc.get("festival_id") or "").strip() or None
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    doc["status"] = "published"
    r = await db.quizzes.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "quiz.create", str(r.inserted_id), {"title": data.title, "context": data.context})
    return sanitize_doc(doc)


@api_router.get("/quizzes")
async def list_all_quizzes(context: Optional[str] = None, offering_id: Optional[str] = None,
                            status: Optional[str] = None,
                            actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Staff's own quizzes (academic_staff) or all quizzes (admin/super_admin), with optional filters."""
    if context:
        await check_feature_enabled(quiz_feature_key(context))
        await check_quiz_capability(actor, context)
    q = {}
    if context: q["context"] = context
    if offering_id: q["offering_id"] = offering_id
    if status: q["status"] = status
    if actor["role"] == "academic_staff":
        q["created_by"] = actor["id"]
    items = await db.quizzes.find(q).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.get("/quizzes/events")
async def list_event_quizzes(_feat: bool = Depends(require_feature("quizzes"))):
    """Published, event-context quizzes whose window hasn't expired — feeds the public Events page."""
    items = await db.quizzes.find({"context": "event", "status": "published"}).to_list(500)
    now = now_utc().isoformat()
    items = [x for x in items if not (x.get("ends_at") or "").strip() or x["ends_at"] > now]
    items.sort(key=lambda x: x.get("starts_at") or "")
    items = [sanitize_doc(x) for x in items]
    for it in items:
        it["questions"] = [strip_question_answers(normalize_question(x, i))
                            for i, x in enumerate(it.get("questions", []))]
    return items


@api_router.get("/quizzes/offering/{offering_id}")
async def list_quizzes(offering_id: str, _feat: bool = Depends(require_feature("quizzes"))):
    items = await db.quizzes.find({"offering_id": offering_id}).to_list(50)
    return [sanitize_doc(x) for x in items]


@api_router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str):
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not q:
        raise HTTPException(404, "Quiz not found")
    await check_feature_enabled(quiz_feature_key(q.get("context", "event")))
    q = sanitize_doc(q)
    # strip correct answers for learners
    q["questions"] = [strip_question_answers(normalize_question(x, i))
                       for i, x in enumerate(q.get("questions", []))]
    return q


@api_router.patch("/quizzes/{quiz_id}")
async def update_quiz(quiz_id: str, data: dict,
                      actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    data.pop("id", None); data.pop("_id", None)
    existing = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not existing:
        raise HTTPException(404, "Quiz not found")
    context = data.get("context", existing.get("context", "event"))
    await check_feature_enabled(quiz_feature_key(context))
    await check_quiz_capability(actor, context)
    if context == "course":
        offering_id = data.get("offering_id", existing.get("offering_id"))
        if not (offering_id or "").strip():
            raise HTTPException(400, "offering_id is required for a course-context quiz")
    if data:
        await db.quizzes.update_one({"_id": ObjectId(quiz_id)}, {"$set": data})
    await write_audit(actor, "quiz.update", quiz_id, data)
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    return sanitize_doc(q)


@api_router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: str,
                      actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    existing = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not existing:
        raise HTTPException(404, "Quiz not found")
    await check_feature_enabled(quiz_feature_key(existing.get("context", "event")))
    await check_quiz_capability(actor, existing.get("context", "event"))
    await db.quizzes.delete_one({"_id": ObjectId(quiz_id)})
    await db.live_sessions.delete_one({"kind": "quiz", "quiz_id": quiz_id})
    await write_audit(actor, "quiz.delete", quiz_id, {})
    return {"ok": True}


@api_router.post("/quizzes/{quiz_id}/link-event")
async def link_quiz_event(quiz_id: str, data: QuizLinkEventIn,
                          actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                          _feat: bool = Depends(require_feature("quizzes"))):
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if data.auto_create:
        acharya_id = actor["id"]
        if quiz.get("offering_id"):
            o = await db.offerings.find_one({"_id": ObjectId(quiz["offering_id"])})
            if o and o.get("acharya_id"):
                acharya_id = o["acharya_id"]
        a = await db.users.find_one({"_id": ObjectId(acharya_id)}) if acharya_id else None
        doc = {
            "title": quiz.get("title", ""), "offering_id": None,
            "acharya_id": acharya_id, "acharya_name": a.get("name", "") if a else "",
            "starts_at": data.starts_at or now_utc().isoformat(),
            "duration_min": 60, "mode": "interactive", "join_url": "", "topic": "",
            "kind": "quiz", "quiz_id": quiz_id,
            "created_at": now_utc().isoformat(), "created_by": actor["id"],
        }
        r = await db.live_sessions.insert_one(doc)
        session_id = str(r.inserted_id)
    elif (data.live_session_id or "").strip():
        session_id = data.live_session_id
        await db.live_sessions.update_one({"_id": ObjectId(session_id)},
            {"$set": {"kind": "quiz", "quiz_id": quiz_id}})
    else:
        raise HTTPException(400, "Provide live_session_id or auto_create=true")
    await write_audit(actor, "quiz.link_event", quiz_id, {"live_session_id": session_id})
    return {"ok": True, "live_session_id": session_id}


@api_router.get("/offerings/{offering_id}/assessment")
async def get_offering_assessment(offering_id: str, user: dict = Depends(get_current_user)):
    await check_feature_enabled("assessments")
    quiz = await db.quizzes.find_one(
        {"offering_id": offering_id, "context": "course", "status": "published"})
    if not quiz:
        raise HTTPException(404, "No assessment for this course")
    if user["role"] not in STAFF_FREE_ACCESS_ROLES:
        e = await db.enrollments.find_one({"user_id": user["id"], "offering_id": offering_id})
        if not e or e.get("status") != "completed":
            return {"locked": True}
    quiz = sanitize_doc(quiz)
    quiz["questions"] = [strip_question_answers(normalize_question(x, i))
                          for i, x in enumerate(quiz.get("questions", []))]
    return quiz


@api_router.post("/quizzes/attempts")
async def submit_attempt(data: QuizAttemptIn, user: dict = Depends(get_current_user)):
    q = await db.quizzes.find_one({"_id": ObjectId(data.quiz_id)})
    if not q:
        raise HTTPException(404, "Quiz not found")
    await check_feature_enabled(quiz_feature_key(q.get("context", "event")))
    questions = [normalize_question(x, i) for i, x in enumerate(q.get("questions", []))]
    correct, points_scored = auto_grade_mcq(questions, data.answers)
    has_paragraph = any(x.get("type") == "paragraph" for x in questions)
    status = "submitted" if has_paragraph else "graded"
    possible = sum((x.get("points", 1) or 1) for x in questions if x.get("type") != "paragraph")
    score = round((points_scored / possible) * 100) if (possible and not has_paragraph) else 0
    doc = {
        "quiz_id": data.quiz_id, "user_id": user["id"], "answers": data.answers,
        "score": score, "correct": correct, "total": len(questions),
        "submitted_at": now_utc().isoformat(), "graded": status == "graded",
        "status": status, "total_score": points_scored,
        "started_at": data.started_at or "", "time_taken_seconds": data.time_taken_seconds,
    }
    result = await db.quiz_attempts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return sanitize_doc(doc)


@api_router.get("/quizzes/{quiz_id}/my-attempt")
async def my_quiz_attempt(quiz_id: str, user: dict = Depends(get_current_user)):
    """Learner's own latest attempt on this quiz (cross-device attempt-status check)."""
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if q:
        await check_feature_enabled(quiz_feature_key(q.get("context", "event")))
    items = await db.quiz_attempts.find(
        {"quiz_id": quiz_id, "user_id": user["id"]}).sort("submitted_at", -1).to_list(1)
    if not items:
        raise HTTPException(404, "No attempt yet")
    a = items[0]
    return {"status": a.get("status"), "score": a.get("score"), "correct": a.get("correct"),
            "total": a.get("total"), "total_score": a.get("total_score")}


@api_router.get("/quizzes/{quiz_id}/attempts")
async def list_quiz_attempts(quiz_id: str, status: Optional[str] = None,
                             actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                             _feat: bool = Depends(require_feature("grading"))):
    if not await has_capability(actor["id"], "grader"):
        raise HTTPException(403, "Requires the 'grader' capability")
    q = {"quiz_id": quiz_id}
    if status: q["status"] = status
    items = await db.quiz_attempts.find(q).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.post("/attempts/{attempt_id}/grade")
async def grade_attempt(attempt_id: str, data: AttemptGradeIn,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("grading"))):
    if not await has_capability(actor["id"], "grader"):
        raise HTTPException(403, "Requires the 'grader' capability")
    attempt = await db.quiz_attempts.find_one({"_id": ObjectId(attempt_id)})
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    quiz = await db.quizzes.find_one({"_id": ObjectId(attempt["quiz_id"])})
    questions = [normalize_question(x, i) for i, x in enumerate(quiz.get("questions", []) if quiz else [])]
    _correct, auto_score = auto_grade_mcq(questions, attempt.get("answers", []))
    manual_total = sum(int(v) for v in data.manual_scores.values())
    total_score = auto_score + manual_total
    await db.quiz_attempts.update_one({"_id": ObjectId(attempt_id)}, {"$set": {
        "manual_scores": data.manual_scores, "feedback": data.feedback,
        "total_score": total_score, "status": "graded",
        "graded_by": actor["id"], "graded_at": now_utc().isoformat(),
    }})
    await write_audit(actor, "attempt.grade", attempt_id, {"total_score": total_score})
    a = await db.quiz_attempts.find_one({"_id": ObjectId(attempt_id)})
    return sanitize_doc(a)


@api_router.get("/quizzes/{quiz_id}/leaderboard")
async def quiz_leaderboard(quiz_id: str,
                           actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                           _feat: bool = Depends(require_feature("grading"))):
    """Ranks submissions by highest score, then fastest completion time."""
    if not await has_capability(actor["id"], "grader"):
        raise HTTPException(403, "Requires the 'grader' capability")
    items = await db.quiz_attempts.find({"quiz_id": quiz_id}).to_list(500)
    rows = []
    for a in items:
        user = await db.users.find_one({"_id": ObjectId(a["user_id"])}) if a.get("user_id") else None
        rows.append({
            "attempt_id": str(a.get("_id", a.get("id"))),
            "user_id": a.get("user_id"),
            "user_name": user.get("name", "Unknown") if user else "Unknown",
            "status": a.get("status"), "total_score": a.get("total_score", 0),
            "time_taken_seconds": a.get("time_taken_seconds"),
            "submitted_at": a.get("submitted_at"), "answers": a.get("answers", []),
            "manual_scores": a.get("manual_scores", {}), "feedback": a.get("feedback", {}),
        })
    return rank_leaderboard(rows)


# ==================== DOUBTS Q&A ====================
@api_router.post("/doubts")
async def ask_doubt(data: DoubtIn, user: dict = Depends(get_current_user)):
    doc = {
        "offering_id": data.offering_id, "lesson_id": data.lesson_id, "question": data.question,
        "asked_by": user["id"], "asked_by_name": user.get("name", ""),
        "answer": "", "answered_by": "", "status": "open",
        "created_at": now_utc().isoformat(),
    }
    r = await db.doubts.insert_one(doc)
    doc["_id"] = r.inserted_id
    return sanitize_doc(doc)


@api_router.get("/doubts/mine")
async def my_doubts(user: dict = Depends(get_current_user)):
    """Learner's own doubts — both open and answered."""
    items = await db.doubts.find({"asked_by": user["id"]}).sort("created_at", -1).to_list(500)
    result = []
    for d in items:
        d = sanitize_doc(d)
        try:
            o = await db.offerings.find_one({"_id": ObjectId(d["offering_id"])})
            if o: d["offering_title"] = o.get("title", "")
        except Exception:
            pass
        # Do not expose answerer's role to the learner — hide the "academic_staff" framing
        d["answered_by_display"] = d.get("answered_by_name", "") or "Tredev Learn team"
        result.append(d)
    return result


@api_router.get("/doubts")
async def list_doubts(offering_id: Optional[str] = None, lesson_id: Optional[str] = None, status: Optional[str] = None):
    await purge_old_threads()
    q = {}
    if offering_id: q["offering_id"] = offering_id
    if lesson_id: q["lesson_id"] = lesson_id
    if status: q["status"] = status
    items = await db.doubts.find(q).sort("created_at", -1).to_list(500)
    result = []
    for x in items:
        x = sanitize_doc(x)
        asker = await db.users.find_one({"_id": ObjectId(x["asked_by"])}) if x.get("asked_by") else None
        x["asked_by_email"] = asker.get("email", "") if asker else ""
        result.append(x)
    return result


@api_router.post("/doubts/{did}/answer")
async def answer_doubt(did: str, data: DoubtAnswerIn,
                        user: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("doubts"))):
    if user["role"] == "academic_staff" and not await has_capability(user["id"], "doubts"):
        raise HTTPException(403, "Doubts has not been granted to you by admin — ask an admin to grant the 'doubts' capability.")
    await db.doubts.update_one({"_id": ObjectId(did)},
        {"$set": {"answer": data.answer, "answered_by": user["id"],
                  "answered_by_name": user.get("name", ""),
                  "answered_at": now_utc().isoformat(), "status": "answered"}})
    return {"ok": True}


# ==================== LESSON COMMENTS (plain per-video discussion) ====================
# Distinct from doubts (Q&A with staff): any logged-in learner can post and
# see a normal comment thread under a lesson's video.
@api_router.post("/lesson-comments")
async def post_lesson_comment(data: LessonCommentIn, user: dict = Depends(get_current_user)):
    if not data.body.strip():
        raise HTTPException(400, "Comment can't be empty.")
    doc = {
        "offering_id": data.offering_id, "lesson_id": data.lesson_id, "body": data.body.strip(),
        "author_id": user["id"], "author_name": user.get("name", ""),
        "created_at": now_utc().isoformat(),
    }
    r = await db.lesson_comments.insert_one(doc)
    doc["_id"] = r.inserted_id
    return sanitize_doc(doc)


@api_router.get("/lesson-comments")
async def list_lesson_comments(offering_id: str, lesson_id: str, user: dict = Depends(get_current_user)):
    items = await db.lesson_comments.find(
        {"offering_id": offering_id, "lesson_id": lesson_id}).sort("created_at", 1).to_list(500)
    return [sanitize_doc(c) for c in items]


# ==================== QUERIES (ticketed chat — GUVI/Zen Class style) ====================
QUERY_STAFF_ROLES = ("academic_staff", "admin", "super_admin")


async def _hydrate_ticket(t: dict) -> dict:
    t = sanitize_doc(t)
    staff = await db.users.find_one({"_id": ObjectId(t["assigned_staff_id"])}) if t.get("assigned_staff_id") else None
    t["assigned_staff_name"] = staff.get("name", "") if staff else ""
    asker = await db.users.find_one({"_id": ObjectId(t["user_id"])}) if t.get("user_id") else None
    t["user_name"] = asker.get("name", "") if asker else ""
    return t


def _check_query_access(t: dict, user: dict):
    role = user.get("role")
    if role in ("admin", "super_admin"):
        return
    if role == "academic_staff":
        # Any staff member may preview an unclaimed ticket; once claimed it's
        # locked to the assigned staff member (exclusivity enforcement).
        if t.get("assigned_staff_id") and t["assigned_staff_id"] != user["id"]:
            raise HTTPException(403, "This query has been claimed by another staff member")
        return
    if t.get("user_id") == user["id"]:
        return
    raise HTTPException(403, "Not authorized to view this query")


@api_router.post("/queries")
async def create_query_ticket(data: QueryTicketIn, user: dict = Depends(get_current_user),
                               _feat: bool = Depends(require_feature("queries"))):
    if not data.title.strip():
        raise HTTPException(400, "Title is required")
    now = now_utc().isoformat()
    doc = {
        "user_id": user["id"], "assigned_staff_id": None,
        "title": data.title.strip(), "description": (data.description or "").strip(),
        "category_tags": data.category_tags or [], "status": "OPEN",
        "created_at": now, "updated_at": now,
    }
    r = await db.query_tickets.insert_one(doc)
    doc["_id"] = r.inserted_id
    ticket = sanitize_doc(doc)
    if doc["description"]:
        await db.query_messages.insert_one({
            "ticket_id": ticket["id"], "sender_id": user["id"], "sender_role": "STUDENT",
            "message_text": doc["description"], "created_at": now,
        })
    await write_audit(user, "query.create", ticket["id"], {"title": data.title})
    return await _hydrate_ticket(doc)


@api_router.get("/queries/mine")
async def list_my_queries(user: dict = Depends(get_current_user)):
    items = await db.query_tickets.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(500)
    return [await _hydrate_ticket(x) for x in items]


@api_router.get("/queries/unassigned")
async def list_unassigned_queries(actor: dict = Depends(require_role(*QUERY_STAFF_ROLES))):
    """The global pool every staff member sees until someone claims each ticket."""
    items = await db.query_tickets.find({"status": "OPEN"}).sort("created_at", 1).to_list(500)
    return [await _hydrate_ticket(x) for x in items]


@api_router.get("/queries/assigned-to-me")
async def list_my_assigned_queries(actor: dict = Depends(require_role(*QUERY_STAFF_ROLES))):
    items = await db.query_tickets.find({"assigned_staff_id": actor["id"]}).sort("updated_at", -1).to_list(500)
    return [await _hydrate_ticket(x) for x in items]


@api_router.get("/queries/all")
async def list_all_queries(actor: dict = Depends(require_role("admin", "super_admin"))):
    """Admin/supervisor override — every ticket regardless of assignment."""
    items = await db.query_tickets.find({}).sort("created_at", -1).to_list(1000)
    return [await _hydrate_ticket(x) for x in items]


@api_router.get("/queries/{ticket_id}")
async def get_query_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    t = sanitize_doc(t)
    _check_query_access(t, user)
    return await _hydrate_ticket(t)


@api_router.get("/queries/{ticket_id}/messages")
async def list_query_messages(ticket_id: str, user: dict = Depends(get_current_user)):
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    t = sanitize_doc(t)
    _check_query_access(t, user)
    items = await db.query_messages.find({"ticket_id": ticket_id}).sort("created_at", 1).to_list(1000)
    return [sanitize_doc(m) for m in items]


@api_router.post("/queries/{ticket_id}/messages")
async def send_query_message(ticket_id: str, data: QueryMessageIn, user: dict = Depends(get_current_user)):
    if not data.message_text.strip():
        raise HTTPException(400, "Message text is required")
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    t = sanitize_doc(t)
    if t["status"] == "CLOSED":
        raise HTTPException(400, "This query is closed")
    _check_query_access(t, user)
    role = user.get("role")
    now = now_utc().isoformat()
    if role in QUERY_STAFF_ROLES and t["user_id"] != user["id"]:
        if role == "academic_staff" and not await has_capability(user["id"], "queries"):
            raise HTTPException(403, "Queries has not been granted to you by admin — ask an admin to grant the 'queries' capability.")
        sender_role = "STAFF"
        if not t.get("assigned_staff_id"):
            # First staff reply claims the ticket — exclusive to this staff member.
            await db.query_tickets.update_one({"_id": ObjectId(ticket_id)},
                {"$set": {"assigned_staff_id": user["id"], "status": "ASSIGNED", "updated_at": now}})
            await write_audit(user, "query.claim", ticket_id, {})
        elif t["assigned_staff_id"] != user["id"] and role == "academic_staff":
            raise HTTPException(403, "This query has been claimed by another staff member")
        else:
            await db.query_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {"updated_at": now}})
    else:
        sender_role = "STUDENT"
        await db.query_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {"updated_at": now}})
    doc = {
        "ticket_id": ticket_id, "sender_id": user["id"], "sender_role": sender_role,
        "message_text": data.message_text.strip(), "created_at": now,
    }
    r = await db.query_messages.insert_one(doc)
    doc["_id"] = r.inserted_id
    return sanitize_doc(doc)


@api_router.post("/queries/{ticket_id}/close")
async def close_query_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    t = sanitize_doc(t)
    if t["status"] == "CLOSED":
        raise HTTPException(400, "This query is already closed")
    role = user.get("role")
    is_owner = t["user_id"] == user["id"]
    is_assigned_staff = t.get("assigned_staff_id") == user["id"]
    is_admin = role in ("admin", "super_admin")
    if not (is_owner or is_assigned_staff or is_admin):
        raise HTTPException(403, "Not authorized to close this query")
    now = now_utc().isoformat()
    await db.query_tickets.update_one({"_id": ObjectId(ticket_id)},
        {"$set": {"status": "CLOSED", "updated_at": now}})
    closer_label = "The learner" if (is_owner and not is_assigned_staff and not is_admin) else "The mentor"
    await db.query_messages.insert_one({
        "ticket_id": ticket_id, "sender_id": None, "sender_role": "SYSTEM",
        "message_text": f"{closer_label} has closed this query.", "created_at": now,
    })
    await write_audit(user, "query.close", ticket_id, {})
    return {"ok": True}


@api_router.post("/queries/{ticket_id}/reassign")
async def reassign_query_ticket(ticket_id: str, data: QueryReassignIn,
                                 actor: dict = Depends(require_role("admin", "super_admin"))):
    """Admin/supervisor override — reassign a ticket to a different staff member,
    or clear staff_id to drop it back into the unassigned pool."""
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    staff_id = (data.staff_id or "").strip()
    if staff_id:
        staff = await db.users.find_one({"_id": ObjectId(staff_id)})
        if not staff or staff.get("role") not in QUERY_STAFF_ROLES:
            raise HTTPException(400, "Target user is not a staff member")
    now = now_utc().isoformat()
    await db.query_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {
        "assigned_staff_id": staff_id or None, "status": "ASSIGNED" if staff_id else "OPEN",
        "updated_at": now,
    }})
    await write_audit(actor, "query.reassign", ticket_id, {"staff_id": staff_id})
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    return await _hydrate_ticket(t)


class QueryEscalateIn(BaseModel):
    note: Optional[str] = ""


@api_router.post("/queries/{ticket_id}/escalate")
async def escalate_query_ticket(ticket_id: str, data: QueryEscalateIn = QueryEscalateIn(),
                                 actor: dict = Depends(require_role(*QUERY_STAFF_ROLES))):
    """Staff flags a ticket for admin attention (e.g. 'paid but course access
    missing' — something staff can't verify/fix themselves). Admin already sees
    every ticket via /queries/all; this adds a signal for which ones need them."""
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    t = sanitize_doc(t)
    _check_query_access(t, actor)
    now = now_utc().isoformat()
    await db.query_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {
        "escalated": True, "escalated_at": now, "escalated_by": actor["id"],
        "escalation_note": (data.note or "").strip(), "updated_at": now,
    }})
    await write_audit(actor, "query.escalate", ticket_id, {"note": data.note})
    t2 = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    return await _hydrate_ticket(t2)


@api_router.post("/queries/{ticket_id}/resolve-escalation")
async def resolve_query_escalation(ticket_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    t = await db.query_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        raise HTTPException(404, "Query not found")
    await db.query_tickets.update_one({"_id": ObjectId(ticket_id)},
        {"$set": {"escalated": False, "updated_at": now_utc().isoformat()}})
    await write_audit(actor, "query.escalation_resolved", ticket_id, {})
    return {"ok": True}


@api_router.get("/queries/escalated")
async def list_escalated_queries(actor: dict = Depends(require_role("admin", "super_admin"))):
    """Filtered view: tickets staff flagged as needing admin attention."""
    items = await db.query_tickets.find({"escalated": True}).sort("escalated_at", -1).to_list(500)
    return [await _hydrate_ticket(x) for x in items]


# ==================== FEATURE TOGGLES ====================
@api_router.get("/feature-toggles")
async def list_feature_toggles(user: dict = Depends(get_current_user)):
    return await db.feature_toggles.find({}).to_list(50)


@api_router.patch("/feature-toggles/{key}")
async def update_feature_toggle(key: str, data: FeatureToggleIn,
                                actor: dict = Depends(require_role("admin", "super_admin"))):
    await db.feature_toggles.update_one({"key": key}, {"$set": {
        "enabled": data.enabled, "updated_by": actor["id"], "updated_at": now_utc().isoformat(),
    }})
    await write_audit(actor, "feature_toggle.update", key, {"enabled": data.enabled})
    return await db.feature_toggles.find_one({"key": key})


# ==================== CAPABILITY GRANTS ====================
@api_router.get("/capabilities")
async def list_capabilities(user: dict = Depends(require_role("admin", "super_admin", "academic_staff"))):
    if user["role"] == "academic_staff":
        items = await db.capability_grants.find({"staff_id": user["id"]}).to_list(200)
    else:
        items = await db.capability_grants.find({}).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.post("/capabilities")
async def grant_capability(data: CapabilityGrantIn,
                            actor: dict = Depends(require_role("admin", "super_admin"))):
    doc = data.model_dump()
    doc["granted_by"] = actor["id"]
    doc["granted_at"] = now_utc().isoformat()
    # upsert one grant per (staff, capability)
    await db.capability_grants.update_one(
        {"staff_id": data.staff_id, "capability": data.capability},
        {"$set": doc}, upsert=True)
    await write_audit(actor, "capability.grant", data.staff_id, {"cap": data.capability, "scope": data.scope})
    return {"ok": True}


@api_router.delete("/capabilities/{grant_id}")
async def revoke_capability(grant_id: str,
                             actor: dict = Depends(require_role("admin", "super_admin"))):
    await db.capability_grants.delete_one({"_id": ObjectId(grant_id)})
    await write_audit(actor, "capability.revoke", grant_id, {})
    return {"ok": True}


# ==================== LIVE SESSIONS (mocked PlugNmeet) ====================
@api_router.get("/live-sessions/upcoming")
async def upcoming_sessions(user: dict = Depends(get_current_user)):
    now = now_utc()
    items = await db.live_sessions.find({}).to_list(200)
    result = []
    for s in items:
        s = sanitize_doc(s)
        s["can_join"], s["is_live"] = session_join_window(s, now)
        result.append(s)
    return sorted(result, key=lambda x: x["starts_at"])


@api_router.post("/live-sessions/{sid}/join")
async def join_session(sid: str, user: dict = Depends(get_current_user)):
    s = await db.live_sessions.find_one({"_id": ObjectId(sid)})
    if not s:
        raise HTTPException(404, "Session not found")
    s = sanitize_doc(s)
    can_join, _ = session_join_window(s, now_utc())
    if not can_join:
        raise HTTPException(403, "This session hasn't started yet. Join opens 10 minutes before start.")
    # Use the real meeting link if staff provided one; otherwise a mock placeholder.
    real = (s.get("join_url") or "").strip()
    if real:
        return {"join_url": real, "session": s}
    return {
        "join_url": f"https://plugnmeet.example.com/room/{sid}?token=mock_{secrets.token_hex(8)}",
        "session": s,
        "note": "No meeting link set — placeholder link for MVP.",
    }


# ==================== CERTIFICATES ====================
@api_router.post("/certificates/issue")
async def issue_certificate(payload: dict,
                             actor: dict = Depends(require_role("admin", "super_admin", "academic_staff")),
                             _feat: bool = Depends(require_feature("certs"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "certs"):
        raise HTTPException(403, "Certificates has not been granted to you by admin — ask an admin to grant the 'certs' capability.")
    user_id = payload["user_id"]
    offering_id = payload["offering_id"]
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not u or not o:
        raise HTTPException(404, "User or offering not found")
    if not o.get("acharya_id"):
        raise HTTPException(400, "This course has no assigned Ācharya to sign the certificate.")
    a = await db.users.find_one({"_id": ObjectId(o["acharya_id"])})
    code = f"TDL-{secrets.token_hex(4).upper()}-{now_utc().year}"
    doc = {
        "code": code, "user_id": user_id, "user_name": u.get("name", ""),
        "offering_id": offering_id, "offering_title": o.get("title", ""),
        "issued_at": now_utc().isoformat(), "revoked": False,
        # Routed to the course's Ācharya, awaiting their signature.
        "acharya_id": o.get("acharya_id"),
        "acharya_name": a.get("name", "") if a else "",
        "signature_status": "pending_signature",
        "signature_name": "", "signed_at": None,
    }
    r = await db.certificates.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "certificate.issue", code, {"user": user_id, "offering": offering_id})
    return sanitize_doc(doc)


@api_router.get("/certificates/mine")
async def my_certificates(user: dict = Depends(get_current_user)):
    """A learner only sees certificates that have completed the full sign-off pipeline."""
    items = await db.certificates.find({"user_id": user["id"]}).to_list(200)
    return [sanitize_doc(x) for x in items
            if (x.get("signature_status") or "published") == "published"]


@api_router.get("/certificates/verify/{code}")
async def verify_certificate(code: str):
    """Public - no auth required."""
    c = await db.certificates.find_one({"code": code})
    if not c:
        return {"valid": False, "revoked": False, "message": "Certificate not found"}
    c = sanitize_doc(c)
    if c.get("revoked"):
        return {"valid": False, "revoked": True, "certificate": c,
                "message": "This certificate has been revoked."}
    if (c.get("signature_status") or "published") != "published":
        return {"valid": False, "revoked": False, "certificate": c,
                "message": "This certificate has not been finalised yet."}
    return {"valid": True, "revoked": False, "certificate": c}


@api_router.post("/certificates/{code}/revoke")
async def revoke_certificate(code: str,
                              actor: dict = Depends(require_role("super_admin"))):
    """Only super_admin can revoke (irreversible)."""
    await db.certificates.update_one({"code": code},
        {"$set": {"revoked": True, "revoked_at": now_utc().isoformat(), "revoked_by": actor["id"]}})
    await write_audit(actor, "certificate.revoke", code, {})
    return {"ok": True}


# ---- Certificate signing pipeline: staff issue -> acharya sign -> staff publish -> learner ----
@api_router.get("/certificates/pending-signature")
async def certificates_pending_signature(actor: dict = Depends(require_role("acharya"))):
    """Certificates routed to this Ācharya, awaiting their signature."""
    items = await db.certificates.find(
        {"acharya_id": actor["id"], "signature_status": "pending_signature"}).to_list(500)
    return [sanitize_doc(c) for c in items]


@api_router.post("/certificates/{code}/sign")
async def sign_certificate(code: str, data: CertificateSignIn,
                           actor: dict = Depends(require_role("acharya"))):
    c = await db.certificates.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Certificate not found")
    if c.get("acharya_id") != actor["id"]:
        raise HTTPException(403, "This certificate is not routed to you.")
    if c.get("signature_status") != "pending_signature":
        raise HTTPException(400, "This certificate is not awaiting your signature.")
    name = (data.signature_name or actor.get("name", "")).strip()
    # Signing finalises the certificate — it is now published to all portals.
    await db.certificates.update_one({"code": code}, {"$set": {
        "signature_status": "published", "signed_at": now_utc().isoformat(),
        "signature_name": name, "acharya_name": name,
    }})
    await write_audit(actor, "certificate.sign", code, {"signature_name": name})
    return {"ok": True}


@api_router.post("/certificates/{code}/reject")
async def reject_certificate(code: str, data: CertificateRejectIn,
                              actor: dict = Depends(require_role("acharya"))):
    """The Ācharya's alternative to signing: something about this certificate
    needs fixing (wrong name, wrong course, etc). The note is how staff — who
    see this in their Certificates tab's Rejected list — learn what to fix."""
    c = await db.certificates.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Certificate not found")
    if c.get("acharya_id") != actor["id"]:
        raise HTTPException(403, "This certificate is not routed to you.")
    if c.get("signature_status") != "pending_signature":
        raise HTTPException(400, "This certificate is not awaiting your signature.")
    note = (data.note or "").strip()
    if not note:
        raise HTTPException(400, "A reason is required so staff know what to fix.")
    await db.certificates.update_one({"code": code}, {"$set": {
        "signature_status": "rejected", "rejection_note": note,
        "rejected_at": now_utc().isoformat(),
    }})
    await write_audit(actor, "certificate.reject", code, {"note": note})
    return {"ok": True}


@api_router.get("/certificates/rejected")
async def certificates_rejected(actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Certificates an Ācharya sent back — staff fix the issue, then resubmit."""
    items = await db.certificates.find({"signature_status": "rejected"}).sort("rejected_at", -1).to_list(500)
    return [sanitize_doc(c) for c in items]


@api_router.post("/certificates/{code}/resubmit")
async def resubmit_certificate(code: str,
                                actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                _feat: bool = Depends(require_feature("certs"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "certs"):
        raise HTTPException(403, "Certificates has not been granted to you by admin — ask an admin to grant the 'certs' capability.")
    c = await db.certificates.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Certificate not found")
    if c.get("signature_status") != "rejected":
        raise HTTPException(400, "This certificate was not rejected.")
    await db.certificates.update_one({"code": code}, {"$set": {
        "signature_status": "pending_signature",
        "staff_approved_at": now_utc().isoformat(), "staff_approved_by": actor["id"],
    }})
    await write_audit(actor, "certificate.resubmit", code, {})
    return {"ok": True}


# ---- Learner requests → staff approves → routes to Ācharya to sign (= published) ----
@api_router.post("/certificates/request")
async def request_certificate(payload: dict, user: dict = Depends(get_current_user)):
    offering_id = payload.get("offering_id")
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)}) if offering_id else None
    if not o:
        raise HTTPException(404, "Course not found")
    e = await db.enrollments.find_one({"user_id": user["id"], "offering_id": offering_id})
    if not e:
        raise HTTPException(400, "You are not enrolled in this course.")
    total = len(o.get("modules") or [])
    done = len(e.get("completed_lessons") or [])
    attendance_pct = round(done / total * 100) if total else 0
    if not total or attendance_pct < CERTIFICATE_ATTENDANCE_THRESHOLD_PCT:
        raise HTTPException(400, f"At least {CERTIFICATE_ATTENDANCE_THRESHOLD_PCT}% lesson attendance is required before requesting a certificate (currently {attendance_pct}%).")
    quiz = await db.quizzes.find_one({"offering_id": offering_id, "context": "course", "status": "published"})
    if quiz:
        attempt = await db.quiz_attempts.find_one({"quiz_id": str(quiz["_id"]), "user_id": user["id"]})
        if not attempt:
            raise HTTPException(400, "Complete the course assessment before requesting a certificate.")
    if not o.get("acharya_id"):
        raise HTTPException(400, "This course has no assigned Ācharya.")
    # No duplicate active certificate/request for the same course.
    existing = await db.certificates.find({"user_id": user["id"], "offering_id": offering_id}).to_list(50)
    if any(not x.get("revoked") for x in existing):
        raise HTTPException(400, "A certificate for this course already exists or is in progress.")
    code = f"TDL-{secrets.token_hex(4).upper()}-{now_utc().year}"
    a = await db.users.find_one({"_id": ObjectId(o["acharya_id"])})
    doc = {
        "code": code, "user_id": user["id"], "user_name": user.get("name", ""),
        "offering_id": offering_id, "offering_title": o.get("title", ""),
        "issued_at": now_utc().isoformat(), "revoked": False,
        "acharya_id": o.get("acharya_id"), "acharya_name": a.get("name", "") if a else "",
        "signature_status": "requested", "signature_name": "", "signed_at": None,
    }
    r = await db.certificates.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(user, "certificate.request", code, {"offering": offering_id})
    return sanitize_doc(doc)


@api_router.get("/certificates/requests")
async def certificate_requests(actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Learner-submitted certificate requests awaiting staff approval."""
    items = await db.certificates.find({"signature_status": "requested"}).sort("issued_at", -1).to_list(500)
    return [sanitize_doc(c) for c in items]


@api_router.post("/certificates/{code}/approve-request")
async def approve_certificate_request(code: str,
                                      actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                      _feat: bool = Depends(require_feature("certs"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "certs"):
        raise HTTPException(403, "Certificates has not been granted to you by admin — ask an admin to grant the 'certs' capability.")
    c = await db.certificates.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Certificate not found")
    if c.get("signature_status") != "requested":
        raise HTTPException(400, "This is not a pending request.")
    if not c.get("acharya_id"):
        raise HTTPException(400, "No Ācharya routed for this certificate.")
    await db.certificates.update_one({"code": code}, {"$set": {
        "signature_status": "pending_signature",
        "staff_approved_at": now_utc().isoformat(), "staff_approved_by": actor["id"],
    }})
    await write_audit(actor, "certificate.approve_request", code, {})
    return {"ok": True}


@api_router.get("/certificates/mine-all")
async def my_certificates_all(user: dict = Depends(get_current_user)):
    """All of the learner's certificates in any state (for showing request status)."""
    items = await db.certificates.find({"user_id": user["id"]}).to_list(200)
    return [sanitize_doc(x) for x in items]


@api_router.get("/certificates/pending-approval")
async def certificates_pending_approval(actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Retained for compatibility — signing now finalises directly, so this is usually empty."""
    items = await db.certificates.find({"signature_status": "signed"}).sort("signed_at", -1).to_list(500)
    return [sanitize_doc(c) for c in items]


@api_router.post("/certificates/{code}/publish")
async def publish_certificate(code: str,
                              actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    c = await db.certificates.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Certificate not found")
    if c.get("signature_status") != "signed":
        raise HTTPException(400, "Only a signed certificate can be published.")
    await db.certificates.update_one({"code": code}, {"$set": {
        "signature_status": "published",
        "staff_approved_at": now_utc().isoformat(), "staff_approved_by": actor["id"],
    }})
    await write_audit(actor, "certificate.publish", code, {})
    return {"ok": True}


# ==================== COMMUNITY ====================
@api_router.get("/community/posts")
async def list_posts():
    posts = await db.community_posts.find({}).sort("created_at", -1).limit(100).to_list(100)
    return [sanitize_doc(p) for p in posts]


@api_router.post("/community/posts")
async def create_post(data: CommunityPostIn, user: dict = Depends(get_current_user)):
    doc = {
        "body": data.body, "verse_id": data.verse_id or "",
        "author_id": user["id"], "author_name": user.get("name", ""),
        "created_at": now_utc().isoformat(), "flagged": False,
    }
    r = await db.community_posts.insert_one(doc)
    doc["_id"] = r.inserted_id
    return sanitize_doc(doc)


# ==================== AUDIT LOG ====================
@api_router.get("/audit-log")
async def get_audit(user: dict = Depends(require_role("admin", "super_admin"))):
    items = await db.audit_log.find({}).sort("created_at", -1).limit(500).to_list(500)
    return [sanitize_doc(x) for x in items]


# ==================== PAYMENTS (mocked Razorpay) ====================
@api_router.post("/payments/create-order")
async def create_order(payload: dict, user: dict = Depends(get_current_user)):
    """MOCKED Razorpay order creation."""
    offering_id = payload["offering_id"]
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not o:
        raise HTTPException(404, "Offering not found")
    amount_inr = o.get("price_inr", 0)
    coupon_id = None
    coupon_code = (payload.get("coupon_code") or "").strip()
    if coupon_code:
        amount_inr, coupon_id = await coupons.apply_coupon(coupon_code, offering_id, amount_inr)
    order_id = f"order_mock_{secrets.token_hex(8)}"
    doc = {
        "order_id": order_id, "user_id": user["id"], "offering_id": offering_id,
        "amount_inr": amount_inr, "status": "created",
        "created_at": now_utc().isoformat(), "mocked": True,
    }
    await db.payments.insert_one(doc)
    return {"order_id": order_id, "amount": amount_inr, "coupon_id": coupon_id, "mocked": True,
            "note": "MOCKED Razorpay — no real payment collected."}


@api_router.post("/payments/webhook-mock")
async def payment_webhook_mock(payload: dict):
    """MOCKED payment success webhook. Superseded by /payments/cashfree/webhook
    below for real orders — left in place for the old free/mocked test path."""
    order_id = payload["order_id"]
    p = await db.payments.find_one({"order_id": order_id})
    if not p:
        raise HTTPException(404, "Order not found")
    await _mark_paid_and_enroll(p, verified=False)
    return {"ok": True}


async def _mark_paid_and_enroll(p: dict, verified: bool):
    """Shared by the real webhook and the status-reconciliation fallback —
    idempotent: a payment already marked paid is left alone, and enrollment
    is never duplicated."""
    if p.get("status") != "paid":
        await db.payments.update_one({"order_id": p["order_id"]},
            {"$set": {"status": "paid", "paid_at": now_utc().isoformat(), "signature_verified": verified}})
    existing = await db.enrollments.find_one({"user_id": p["user_id"], "offering_id": p["offering_id"]})
    if not existing:
        await db.enrollments.insert_one({
            "user_id": p["user_id"], "offering_id": p["offering_id"],
            "batch_id": p.get("batch_id"),
            "enrolled_at": now_utc().isoformat(), "progress": 0,
            "completed_lessons": [], "status": "active",
        })


async def _mark_paid_and_register_webinar(p: dict, verified: bool):
    """Webinar equivalent of _mark_paid_and_enroll: idempotent, adds the payer
    to registered_user_ids and decrements the seat count exactly once."""
    if p.get("status") != "paid":
        await db.payments.update_one({"order_id": p["order_id"]},
            {"$set": {"status": "paid", "paid_at": now_utc().isoformat(), "signature_verified": verified}})
    w = await db.webinars.find_one({"_id": ObjectId(p["webinar_id"])})
    if not w:
        return
    reg = list(w.get("registered_user_ids") or [])
    if p["user_id"] not in reg:
        seats = int(w.get("seats_remaining", 0) or 0)
        reg.append(p["user_id"])
        await db.webinars.update_one({"_id": ObjectId(p["webinar_id"])},
            {"$set": {"registered_user_ids": reg, "seats_remaining": max(0, seats - 1)}})


@api_router.post("/payments/cashfree/create-webinar-order")
async def create_cashfree_webinar_order(payload: dict, user: dict = Depends(get_current_user)):
    """Real Cashfree order for a paid webinar — same pattern as the course
    order above, but finalizes into db.webinars (registered_user_ids/seats)
    instead of db.enrollments."""
    webinar_id = payload["webinar_id"]
    w = await db.webinars.find_one({"_id": ObjectId(webinar_id)})
    if not w:
        raise HTTPException(404, "Webinar not found")
    seats = int(w.get("seats_remaining", 0) or 0)
    if seats <= 0:
        raise HTTPException(400, "This webinar is sold out.")
    if user["id"] in (w.get("registered_user_ids") or []):
        raise HTTPException(400, "You are already registered for this webinar.")
    amount_inr = w.get("price_inr", 0)
    if amount_inr <= 0:
        raise HTTPException(400, "This webinar is free — no order needed.")
    order_id = f"tredev_webinar_{secrets.token_hex(8)}"
    try:
        cf = await asyncio.to_thread(
            cashfree.create_order, order_id, float(amount_inr), "INR",
            user["id"], user.get("email", ""), "",
            f"{FRONTEND_URL}/events",
        )
    except cashfree.CashfreeError as e:
        raise HTTPException(e.status, e.message)
    doc = {
        "order_id": order_id, "user_id": user["id"], "webinar_id": webinar_id,
        "amount_inr": amount_inr, "status": "created", "created_at": now_utc().isoformat(),
        "mocked": False, "gateway": "cashfree", "cf_order_id": cf.get("cf_order_id") or cf.get("order_id"),
        "currency": "INR", "signature_verified": False,
    }
    await db.payments.insert_one(doc)
    return {"order_id": order_id, "amount": amount_inr, "payment_session_id": cf.get("payment_session_id")}


@api_router.post("/payments/cashfree/create-order")
async def create_cashfree_order(payload: dict, user: dict = Depends(get_current_user)):
    """Real Cashfree order — replaces the mocked create-order for live testing.
    Frontend takes the returned payment_session_id into Cashfree's Checkout JS."""
    offering_id = payload["offering_id"]
    o = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not o:
        raise HTTPException(404, "Offering not found")
    batch_id = (payload.get("batch_id") or "").strip() or None
    if o.get("type") == "live_course":
        await _check_batch_seat(offering_id, batch_id)
    amount_inr = o.get("price_inr", 0)
    coupon_id = None
    coupon_code = (payload.get("coupon_code") or "").strip()
    if coupon_code:
        amount_inr, coupon_id = await coupons.apply_coupon(coupon_code, offering_id, amount_inr)
    if amount_inr <= 0:
        raise HTTPException(400, "This course is free — no order needed.")
    order_id = f"tredev_{secrets.token_hex(8)}"
    try:
        cf = await asyncio.to_thread(
            cashfree.create_order, order_id, float(amount_inr), "INR",
            user["id"], user.get("email", ""), "",
            f"{FRONTEND_URL}/courses/{offering_id}",
        )
    except cashfree.CashfreeError as e:
        raise HTTPException(e.status, e.message)
    doc = {
        "order_id": order_id, "user_id": user["id"], "offering_id": offering_id,
        "batch_id": batch_id,
        "amount_inr": amount_inr, "status": "created", "created_at": now_utc().isoformat(),
        "mocked": False, "gateway": "cashfree", "cf_order_id": cf.get("cf_order_id") or cf.get("order_id"),
        "currency": "INR", "signature_verified": False,
    }
    await db.payments.insert_one(doc)
    return {"order_id": order_id, "amount": amount_inr, "coupon_id": coupon_id,
            "payment_session_id": cf.get("payment_session_id")}


@api_router.post("/payments/cashfree/webhook")
async def cashfree_webhook(request: Request):
    """Real webhook, signature-verified — the gap the old mocked webhook left
    wide open (anyone who knew an order_id could mark it paid)."""
    raw = await request.body()
    signature = request.headers.get("x-webhook-signature", "")
    timestamp = request.headers.get("x-webhook-timestamp", "")
    if not cashfree.verify_webhook_signature(raw, timestamp, signature):
        raise HTTPException(401, "Invalid webhook signature")
    payload = await request.json()
    event_type = payload.get("type", "")
    order_id = ((payload.get("data") or {}).get("order") or {}).get("order_id")
    if not order_id:
        logger.warning(f"Cashfree webhook missing order_id: {payload}")
        return {"ok": True}
    p = await db.payments.find_one({"order_id": order_id})
    if not p:
        logger.warning(f"Cashfree webhook for unknown order_id={order_id}")
        return {"ok": True}
    if event_type == "PAYMENT_SUCCESS_WEBHOOK":
        if p.get("webinar_id"):
            await _mark_paid_and_register_webinar(p, verified=True)
        else:
            await _mark_paid_and_enroll(p, verified=True)
    elif event_type in ("PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"):
        await db.payments.update_one({"order_id": order_id}, {"$set": {"status": "failed"}})
    return {"ok": True}


@api_router.get("/payments/{order_id}/status")
async def payment_status(order_id: str, user: dict = Depends(get_current_user)):
    """Reconciliation fallback the frontend calls after the checkout redirect
    returns — covers a delayed or dropped webhook instead of trusting the
    client to self-report success."""
    p = await db.payments.find_one({"order_id": order_id})
    if not p or p.get("user_id") != user["id"]:
        raise HTTPException(404, "Order not found")
    if p.get("status") != "paid" and p.get("gateway") == "cashfree":
        try:
            cf = await asyncio.to_thread(cashfree.get_order_status, order_id)
            if cf.get("order_status") == "PAID":
                if p.get("webinar_id"):
                    await _mark_paid_and_register_webinar(p, verified=True)
                else:
                    await _mark_paid_and_enroll(p, verified=True)
                p = await db.payments.find_one({"order_id": order_id})
        except cashfree.CashfreeError as e:
            logger.warning(f"Cashfree status lookup failed for {order_id}: {e.message}")
    result = sanitize_doc(p)
    if p.get("webinar_id"):
        w = await db.webinars.find_one({"_id": ObjectId(p["webinar_id"])})
        if w:
            result["webinar"] = sanitize_doc(w)
            result["join_url"] = (w.get("join_url") or "").strip()
    return result


# ==================== FESTIVAL CALENDAR (staff-managed, CSV-fed) ====================
@api_router.get("/festivals")
async def list_festivals():
    """Staff-managed festival calendar (CSV-imported / hand-entered), sorted chronologically.
    Falls back to the auto-computed Vedic (tithi-based) calendar only if nothing has been
    entered yet, so a stable set of ids exists for quizzes to attach to via festival_id."""
    items = await db.festivals.find({}).to_list(500)
    if items:
        items = [sanitize_doc(f) for f in items]
        items.sort(key=lambda f: f.get("date") or "")
        return items
    try:
        return panchang.upcoming_festivals(count=12)
    except Exception as e:
        logger.warning(f"Panchang computation failed and no stored festivals exist: {e}")
        return []


@api_router.post("/festivals")
async def create_festival(data: FestivalIn,
                           actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                           _feat: bool = Depends(require_feature("calendar"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "calendar"):
        raise HTTPException(403, "Festival calendar has not been granted to you by admin — ask an admin to grant the 'calendar' capability.")
    doc = data.model_dump()
    r = await db.festivals.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "festival.create", str(r.inserted_id), {"name": data.name, "date": data.date})
    return sanitize_doc(doc)


@api_router.patch("/festivals/{festival_id}")
async def update_festival(festival_id: str, data: dict,
                           actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                           _feat: bool = Depends(require_feature("calendar"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "calendar"):
        raise HTTPException(403, "Festival calendar has not been granted to you by admin — ask an admin to grant the 'calendar' capability.")
    data.pop("id", None); data.pop("_id", None)
    if data:
        await db.festivals.update_one({"_id": ObjectId(festival_id)}, {"$set": data})
    await write_audit(actor, "festival.update", festival_id, data)
    f = await db.festivals.find_one({"_id": ObjectId(festival_id)})
    if not f:
        raise HTTPException(404, "Festival not found")
    return sanitize_doc(f)


@api_router.delete("/festivals/{festival_id}")
async def delete_festival(festival_id: str,
                           actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                           _feat: bool = Depends(require_feature("calendar"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "calendar"):
        raise HTTPException(403, "Festival calendar has not been granted to you by admin — ask an admin to grant the 'calendar' capability.")
    await db.festivals.delete_one({"_id": ObjectId(festival_id)})
    await write_audit(actor, "festival.delete", festival_id, {})
    return {"ok": True}


@api_router.post("/festivals/import-csv")
async def import_festivals_csv(data: FestivalCsvImportIn,
                                actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                _feat: bool = Depends(require_feature("calendar"))):
    """CSV columns: name, date (YYYY-MM-DD), significance, deity, related_offering_subject.
    'replace' mode clears the calendar first; 'append' upserts by (name, date)."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "calendar"):
        raise HTTPException(403, "Festival calendar has not been granted to you by admin — ask an admin to grant the 'calendar' capability.")
    reader = csv.DictReader(io.StringIO(data.csv_text))
    rows = []
    for row in reader:
        name = (row.get("name") or "").strip()
        date = (row.get("date") or "").strip()
        if not name or not date:
            continue
        rows.append({
            "name": name, "date": date,
            "significance": (row.get("significance") or "").strip(),
            "deity": (row.get("deity") or "").strip(),
            "related_offering_subject": (row.get("related_offering_subject") or "").strip(),
        })
    if not rows:
        raise HTTPException(400, "No valid rows found — expected columns: name, date, significance, deity, related_offering_subject")
    if data.mode == "replace":
        await db.festivals.delete_many({})
        await db.festivals.insert_many(rows)
    else:
        for row in rows:
            existing = await db.festivals.find_one({"name": row["name"], "date": row["date"]})
            if existing:
                await db.festivals.update_one({"_id": existing["_id"]}, {"$set": row})
            else:
                await db.festivals.insert_one(row)
    await write_audit(actor, "festival.import_csv", "", {"mode": data.mode, "count": len(rows)})
    items = await db.festivals.find({}).to_list(500)
    items = [sanitize_doc(f) for f in items]
    items.sort(key=lambda f: f.get("date") or "")
    return items


# ==================== MANTRAS (by deity, linked to the festival calendar) ====================
@api_router.get("/mantras")
async def list_mantras(deity: Optional[str] = None):
    q = {}
    if deity:
        q["deity"] = deity
    items = await db.mantras.find(q).sort("created_at", -1).to_list(500)
    return [sanitize_doc(m) for m in items]


@api_router.post("/mantras")
async def create_mantra(data: MantraIn,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("mantras"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mantras"):
        raise HTTPException(403, "Mantras has not been granted to you by admin — ask an admin to grant the 'mantras' capability.")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    r = await db.mantras.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "mantra.create", str(r.inserted_id), {"deity": data.deity, "title": data.title})
    return sanitize_doc(doc)


@api_router.patch("/mantras/{mid}")
async def update_mantra(mid: str, data: dict,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("mantras"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mantras"):
        raise HTTPException(403, "Mantras has not been granted to you by admin — ask an admin to grant the 'mantras' capability.")
    data.pop("id", None); data.pop("_id", None)
    if data:
        await db.mantras.update_one({"_id": ObjectId(mid)}, {"$set": data})
    await write_audit(actor, "mantra.update", mid, data)
    m = await db.mantras.find_one({"_id": ObjectId(mid)})
    return sanitize_doc(m)


@api_router.delete("/mantras/{mid}")
async def delete_mantra(mid: str,
                        actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                        _feat: bool = Depends(require_feature("mantras"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mantras"):
        raise HTTPException(403, "Mantras has not been granted to you by admin — ask an admin to grant the 'mantras' capability.")
    await db.mantras.delete_one({"_id": ObjectId(mid)})
    await write_audit(actor, "mantra.delete", mid, {})
    return {"ok": True}


# ==================== BLOGS / JOURNAL ====================
@api_router.get("/blogs")
async def list_blogs(category: Optional[str] = None, limit: int = 50):
    q = {}
    if category:
        q["category"] = category
    items = await db.blogs.find(q).sort("created_at", -1).limit(limit).to_list(limit)
    return [sanitize_doc(b) for b in items]


@api_router.post("/blogs")
async def create_blog(data: BlogIn,
                       actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                       _feat: bool = Depends(require_feature("journal"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "journal_author"):
        raise HTTPException(403, "Journal authoring has not been granted to you by admin — ask an admin to grant the 'journal_author' capability.")
    if await db.blogs.find_one({"slug": data.slug}):
        raise HTTPException(400, "A journal entry with this slug already exists")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    doc["title_hi"], doc["excerpt_hi"], doc["body_hi"] = await asyncio.gather(
        asyncio.to_thread(auto_translate, data.title),
        asyncio.to_thread(auto_translate, data.excerpt),
        asyncio.to_thread(auto_translate, data.body),
    )
    r = await db.blogs.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "blog.create", str(r.inserted_id), {"title": data.title})
    return sanitize_doc(doc)


@api_router.patch("/blogs/{blog_id}")
async def update_blog(blog_id: str, data: dict,
                       actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                       _feat: bool = Depends(require_feature("journal"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "journal_author"):
        raise HTTPException(403, "Journal authoring has not been granted to you by admin — ask an admin to grant the 'journal_author' capability.")
    data.pop("id", None); data.pop("_id", None)
    hi_fields = {"title": "title_hi", "excerpt": "excerpt_hi", "body": "body_hi"}
    changed = [en for en in hi_fields if en in data]
    translated = await asyncio.gather(*(asyncio.to_thread(auto_translate, data[en]) for en in changed))
    for en, hi_text in zip(changed, translated):
        data[hi_fields[en]] = hi_text
    if data:
        await db.blogs.update_one({"_id": ObjectId(blog_id)}, {"$set": data})
    await write_audit(actor, "blog.update", blog_id, data)
    b = await db.blogs.find_one({"_id": ObjectId(blog_id)})
    if not b:
        raise HTTPException(404, "Journal entry not found")
    return sanitize_doc(b)


@api_router.delete("/blogs/{blog_id}")
async def delete_blog(blog_id: str,
                       actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                       _feat: bool = Depends(require_feature("journal"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "journal_author"):
        raise HTTPException(403, "Journal authoring has not been granted to you by admin — ask an admin to grant the 'journal_author' capability.")
    await db.blogs.delete_one({"_id": ObjectId(blog_id)})
    await write_audit(actor, "blog.delete", blog_id, {})
    return {"ok": True}


@api_router.get("/blogs/{slug}")
async def get_blog(slug: str):
    b = await db.blogs.find_one({"slug": slug})
    if not b:
        raise HTTPException(404, "Blog not found")
    return sanitize_doc(b)


# ==================== WEBINARS ====================
@api_router.get("/webinars")
async def list_webinars(upcoming_only: bool = True):
    items = await db.webinars.find({}).sort("starts_at", 1).to_list(100)
    now = now_utc()
    result = []
    for w in items:
        w = sanitize_doc(w)
        try:
            start = datetime.fromisoformat(w["starts_at"])
        except Exception:
            continue
        if upcoming_only and start < now - timedelta(hours=2):
            continue
        w["starts_in_seconds"] = int((start - now).total_seconds())
        w["is_live"] = 0 <= (now - start).total_seconds() <= 90 * 60
        result.append(w)
    return result


# ==================== MENTORS ====================
@api_router.get("/mentors")
async def list_mentors():
    """Public mentor showcase — expanded acharya profiles."""
    items = await db.mentors.find({}).sort("order", 1).to_list(50)
    return [sanitize_doc(m) for m in items]


@api_router.post("/mentors")
async def create_mentor(data: MentorIn,
                         actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                         _feat: bool = Depends(require_feature("mentors"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mentors"):
        raise HTTPException(403, "Mentors has not been granted to you by admin — ask an admin to grant the 'mentors' capability.")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    r = await db.mentors.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "mentor.create", str(r.inserted_id), {"name": data.name})
    return sanitize_doc(doc)


@api_router.patch("/mentors/{mentor_id}")
async def update_mentor(mentor_id: str, data: dict,
                         actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                         _feat: bool = Depends(require_feature("mentors"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mentors"):
        raise HTTPException(403, "Mentors has not been granted to you by admin — ask an admin to grant the 'mentors' capability.")
    data.pop("id", None); data.pop("_id", None)
    if data:
        await db.mentors.update_one({"_id": ObjectId(mentor_id)}, {"$set": data})
    await write_audit(actor, "mentor.update", mentor_id, data)
    m = await db.mentors.find_one({"_id": ObjectId(mentor_id)})
    if not m:
        raise HTTPException(404, "Mentor not found")
    return sanitize_doc(m)


@api_router.delete("/mentors/{mentor_id}")
async def delete_mentor(mentor_id: str,
                         actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                         _feat: bool = Depends(require_feature("mentors"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mentors"):
        raise HTTPException(403, "Mentors has not been granted to you by admin — ask an admin to grant the 'mentors' capability.")
    await db.mentors.delete_one({"_id": ObjectId(mentor_id)})
    await write_audit(actor, "mentor.delete", mentor_id, {})
    return {"ok": True}


# ==================== TESTIMONIALS ====================
@api_router.get("/testimonials")
async def list_testimonials():
    items = await db.testimonials.find({}).to_list(100)
    return [sanitize_doc(t) for t in items]


# ==================== SITE STATS ====================
@api_router.get("/stats")
async def site_stats():
    learners = await db.users.count_documents({"role": "learner"})
    paths = await db.offerings.count_documents({"is_published": True})
    mentors = await db.mentors.count_documents({})
    verses = await db.verses.count_documents({})
    # Public marketing stats — blended (real + baseline). Baseline reflects legacy tradition.
    return {
        "learners_display": max(learners + 620000, 620000),
        "paths_display": max(paths + 60, 60),
        "google_rating": 4.8,
        "mentors_display": max(mentors, 30),
        "years_of_legacy": 51,
        "verses_indexed": max(verses, 5),
        "certificates_issued": await db.certificates.count_documents({"revoked": {"$ne": True}}),
    }


# ==================== FREE TOOLS: TAROT & RAM SHALAKA ====================
TAROT_DECK = [
    {"name":"The Fool","meaning":"New beginnings, spontaneity, faith"},
    {"name":"The Magician","meaning":"Willpower, manifestation, resourcefulness"},
    {"name":"The High Priestess","meaning":"Intuition, sacred knowledge, the unconscious"},
    {"name":"The Empress","meaning":"Fertility, nurture, abundance"},
    {"name":"The Emperor","meaning":"Structure, authority, order"},
    {"name":"The Hierophant","meaning":"Tradition, teaching, spiritual wisdom"},
    {"name":"The Lovers","meaning":"Union, alignment, choice"},
    {"name":"The Chariot","meaning":"Willpower, control, direction"},
    {"name":"Strength","meaning":"Inner courage, compassion, patience"},
    {"name":"The Hermit","meaning":"Solitude, introspection, guidance"},
    {"name":"Wheel of Fortune","meaning":"Cycles, destiny, change"},
    {"name":"Justice","meaning":"Fairness, truth, cause and effect"},
    {"name":"The Hanged Man","meaning":"Surrender, new perspective, pause"},
    {"name":"Death","meaning":"Endings, transformation, transition"},
    {"name":"Temperance","meaning":"Balance, moderation, patience"},
    {"name":"The Tower","meaning":"Sudden change, upheaval, awakening"},
    {"name":"The Star","meaning":"Hope, inspiration, renewal"},
    {"name":"The Moon","meaning":"Illusion, dreams, the subconscious"},
    {"name":"The Sun","meaning":"Joy, vitality, clarity"},
    {"name":"Judgement","meaning":"Reckoning, absolution, calling"},
    {"name":"The World","meaning":"Completion, fulfillment, wholeness"},
]

RAM_SHALAKA_ANSWERS = [
    "The endeavour, undertaken with a pure intent, shall be accomplished in due time. Practise patience and continue with discipline.",
    "The result at present is uncertain; wait, observe, and re-attempt after reflection. Do not act on impulse.",
    "Success is close, but demands unwavering effort. Do not abandon the path at the final step.",
    "There is delay owing to karma; steady practice and sincerity will remove the obstacle. Keep your saṅkalpa.",
    "The auspicious moment favours you. Move ahead with quiet resolve — but never with pride.",
    "Consult a wise elder or teacher before proceeding. This is not for solitary judgement.",
    "The desired result shall arrive, but not in the form you imagine. Remain open.",
    "This is not the time. Withdraw, wait, and let the mind settle. Return when the season is right.",
    "The task will meet with success by the grace of the tradition. Offer gratitude, not conditions.",
]


@api_router.post("/calculators/tarot")
async def calc_tarot(payload: dict):
    """3-card tarot spread — Past, Present, Future. Framed as a study tool for symbolic reflection."""
    question = str(payload.get("question", "")).strip()
    # deterministic per question so users see stable result on same query
    seed = (hash(question) if question else int(datetime.now(timezone.utc).timestamp())) & 0xffffffff
    r = random.Random(seed)
    indices = r.sample(range(len(TAROT_DECK)), 3)
    labels = ["Past", "Present", "Future"]
    spread = []
    for i, idx in enumerate(indices):
        card = TAROT_DECK[idx]
        reversed_ = r.random() < 0.25
        spread.append({
            "position": labels[i], "name": card["name"],
            "meaning": card["meaning"], "reversed": reversed_,
        })
    return {
        "question": question, "spread": spread,
        "note": "Tarot as symbolic reflection — a mirror for the mind, not a prophecy. Draw meaning, not certainty."
    }


@api_router.post("/calculators/ram-shalaka")
async def calc_ram_shalaka(payload: dict):
    """Śrī Rāma Śalākā prashna — 9-cell grid answer. Framed as reflective divination, not fortune-telling."""
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(400, "A question is required")
    seed = hash(question) & 0xffffffff
    r = random.Random(seed)
    idx = r.randint(0, len(RAM_SHALAKA_ANSWERS) - 1)
    return {
        "question": question,
        "answer": RAM_SHALAKA_ANSWERS[idx],
        "note": "The Rāma Śalākā tradition offers reflective counsel — a mirror for your own clarity. Read it as a study of intent, not a promise of outcome."
    }


# ==================== ĀCHARYA CONTENT SUBMISSIONS ====================
@api_router.post("/acharya/content")
async def create_acharya_content(data: AcharyaContentIn,
                                  actor: dict = Depends(require_role("acharya"))):
    doc = data.model_dump()
    doc["acharya_id"] = actor["id"]
    doc["acharya_name"] = actor.get("name", "")
    doc["status"] = "pending_review"
    doc["review_notes"] = ""
    doc["created_at"] = now_utc().isoformat()
    r = await db.acharya_content.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "acharya_content.submit", str(r.inserted_id), {"title": data.title})
    return sanitize_doc(doc)


@api_router.get("/acharya/content")
async def list_acharya_content(user: dict = Depends(get_current_user)):
    """Acharya sees own submissions; staff/admin sees all pending."""
    if user["role"] == "acharya":
        q = {"acharya_id": user["id"]}
    elif user["role"] in ("academic_staff", "admin", "super_admin"):
        q = {}
    else:
        raise HTTPException(403, "Forbidden")
    items = await db.acharya_content.find(q).sort("created_at", -1).to_list(500)
    return [sanitize_doc(x) for x in items]


@api_router.post("/acharya/content/{cid}/review")
async def review_acharya_content(cid: str, data: AcharyaContentReviewIn,
                                  actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                                  _feat: bool = Depends(require_feature("content-review"))):
    await db.acharya_content.update_one({"_id": ObjectId(cid)},
        {"$set": {"status": "approved" if data.approved else "changes_requested",
                  "review_notes": data.notes,
                  "reviewed_by": actor["id"],
                  "reviewed_by_name": actor.get("name", ""),
                  "reviewed_at": now_utc().isoformat()}})
    await write_audit(actor, "acharya_content.review", cid,
                       {"approved": data.approved, "notes": data.notes})
    return {"ok": True}


@api_router.get("/offerings/{offering_id}/notes")
async def list_offering_notes(offering_id: str, user: dict = Depends(get_current_user)):
    """Approved Ācharya content attached to this course — shown to the learner
    in the course workspace's 'Notes & extra content' section."""
    items = await db.acharya_content.find(
        {"offering_id": offering_id, "status": "approved"}).sort("created_at", -1).to_list(200)
    return [sanitize_doc(x) for x in items]


@api_router.post("/acharya/content/sign-upload")
async def sign_acharya_attachment(data: AcharyaAttachmentSignIn,
                                   actor: dict = Depends(require_role("acharya"))):
    """Signed upload for a note attachment. Capped at 5MB — enforced here and,
    as the real guard, by the bucket's own file_size_limit (the browser PUTs
    bytes straight to Supabase, so the backend never sees them to re-compress;
    PDF/DOC/PPTX are already compressed containers, so proxying every upload
    through the server to gzip them would cost a full round-trip for near-zero
    savings)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(503, "Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env).")
    if data.size_bytes and data.size_bytes > ACHARYA_ATTACHMENT_MAX_BYTES:
        raise HTTPException(400, "Attachment must be 5MB or smaller.")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (data.filename or "file").strip()) or "file"
    path = f"notes/{secrets.token_hex(8)}/{safe}"
    endpoint = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{ACHARYA_MEDIA_BUCKET}/{path}"
    try:
        resp = requests.post(endpoint, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"Storage request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not sign upload ({resp.status_code}): {resp.text[:200]}")
    signed = resp.json().get("url", "")
    upload_url = f"{SUPABASE_URL}/storage/v1{signed}"
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{ACHARYA_MEDIA_BUCKET}/{path}"
    return {"upload_url": upload_url, "public_url": public_url, "path": path,
            "content_type": data.content_type, "filename": safe}


# ==================== LIVE SESSIONS — CREATE (staff schedules for acharyas) ====================
@api_router.post("/live-sessions")
async def create_live_session(data: LiveSessionCreateIn,
                               actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                               _feat: bool = Depends(require_feature("sessions"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "session_author"):
        raise HTTPException(403, "Session scheduling has not been granted to you by admin — ask an admin to grant the 'session_author' capability.")
    if not (data.offering_id or "").strip():
        raise HTTPException(400, "A course must be selected — live sessions are course-bound.")
    a = await db.users.find_one({"_id": ObjectId(data.acharya_id)}) if data.acharya_id else None
    doc = data.model_dump()
    doc["offering_id"] = doc["offering_id"].strip()
    doc["acharya_name"] = a.get("name", "") if a else ""
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    r = await db.live_sessions.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "live_session.create", str(r.inserted_id), {"title": data.title, "acharya": data.acharya_id})
    return sanitize_doc(doc)


@api_router.patch("/live-sessions/{sid}")
async def update_live_session(sid: str, data: LiveSessionUpdateIn,
                               actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                               _feat: bool = Depends(require_feature("sessions"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "session_author"):
        raise HTTPException(403, "Session scheduling has not been granted to you by admin — ask an admin to grant the 'session_author' capability.")
    s = await db.live_sessions.find_one({"_id": ObjectId(sid)})
    if not s:
        raise HTTPException(404, "Session not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "offering_id" in update:
        update["offering_id"] = (update["offering_id"] or "").strip() or None
    if "acharya_id" in update:
        a = await db.users.find_one({"_id": ObjectId(update["acharya_id"])}) if update["acharya_id"] else None
        update["acharya_name"] = a.get("name", "") if a else ""
    if update:
        await db.live_sessions.update_one({"_id": ObjectId(sid)}, {"$set": update})
    await write_audit(actor, "live_session.update", sid, update)
    s = await db.live_sessions.find_one({"_id": ObjectId(sid)})
    return sanitize_doc(s)


@api_router.delete("/live-sessions/{sid}")
async def delete_live_session(sid: str,
                               actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                               _feat: bool = Depends(require_feature("sessions"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "session_author"):
        raise HTTPException(403, "Session scheduling has not been granted to you by admin — ask an admin to grant the 'session_author' capability.")
    await db.live_sessions.delete_one({"_id": ObjectId(sid)})
    await write_audit(actor, "live_session.delete", sid, {})
    return {"ok": True}


def _parse_session_start(iso_ts: str):
    """Batch-approved sessions store a naive 'YYYY-MM-DDTHH:MM:SS' (straight from
    the CSV/timetable rows); manually-scheduled ones store a full UTC ISO
    string with an offset. Both must compare against now_utc()'s aware
    datetime, so a naive value is treated as UTC rather than left to crash
    the subtraction below with a TypeError."""
    start = datetime.fromisoformat(iso_ts)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start


def session_join_window(s: dict, now: datetime):
    """(can_join, is_live) — join opens 10 min before start, closes at start + duration."""
    try:
        start = _parse_session_start(s["starts_at"])
    except Exception:
        return False, False
    can_join = (start - now).total_seconds() <= 600
    is_live = start <= now <= (start + timedelta(minutes=int(s.get("duration_min", 60))))
    return can_join, is_live


def session_is_past(s: dict, now: datetime) -> bool:
    """True once a session's join window has fully closed."""
    try:
        start = _parse_session_start(s["starts_at"])
    except Exception:
        return False
    return now > start + timedelta(minutes=int(s.get("duration_min", 60)))


@api_router.get("/live-sessions")
async def list_live_sessions(acharya_id: Optional[str] = None,
                              offering_id: Optional[str] = None,
                              batch_id: Optional[str] = None):
    q = {}
    if acharya_id: q["acharya_id"] = acharya_id
    if offering_id: q["offering_id"] = offering_id
    if batch_id: q["batch_id"] = batch_id
    items = await db.live_sessions.find(q).sort("starts_at", 1).to_list(500)
    now = now_utc()
    result = []
    for x in items:
        x = sanitize_doc(x)
        x["can_join"], x["is_live"] = session_join_window(x, now)
        if x.get("batch_id"):
            b = await db.batches.find_one({"_id": ObjectId(x["batch_id"])})
            x["batch_name"] = b.get("name", "") if b else ""
        if x.get("offering_id"):
            o = await db.offerings.find_one({"_id": ObjectId(x["offering_id"])})
            x["offering_title"] = o.get("title", "") if o else ""
        result.append(x)
    return result


@api_router.get("/live-sessions/mine-acharya")
async def acharya_live_sessions(user: dict = Depends(require_role("acharya")),
                                 batch_id: Optional[str] = None,
                                 week_start: Optional[str] = None, week_end: Optional[str] = None):
    """Sessions scheduled under this Ācharya's name — for their join view.
    Optional batch_id + week_start/week_end (YYYY-MM-DD) narrow to one batch's
    schedule one week at a time, so a CSV-scheduled cohort's whole timetable
    isn't dumped on the Ācharya at once. The unfiltered call (no params) keeps
    returning everything, unchanged, for the portal's general sessions list."""
    now = now_utc()
    items = await db.live_sessions.find({"acharya_id": user["id"]}).sort("starts_at", 1).to_list(500)
    if batch_id:
        items = [s for s in items if s.get("batch_id") == batch_id]
    if week_start and week_end:
        items = [s for s in items if week_start <= (s.get("starts_at") or "")[:10] <= week_end]
    result = []
    for s in items:
        s = sanitize_doc(s)
        s["can_join"], s["is_live"] = session_join_window(s, now)
        try:
            o = await db.offerings.find_one({"_id": ObjectId(s.get("offering_id",""))})
            if o: s["offering_title"] = o.get("title", "")
        except Exception:
            pass
        if s.get("batch_id"):
            b = await db.batches.find_one({"_id": ObjectId(s["batch_id"])})
            s["batch_name"] = b.get("name", "") if b else ""
        result.append(s)
    return result


@api_router.get("/live-sessions/mine-learner")
async def learner_live_sessions(user: dict = Depends(get_current_user),
                                 batch_id: Optional[str] = None,
                                 week_start: Optional[str] = None, week_end: Optional[str] = None):
    """Sessions for the courses this learner is enrolled in. For a live_course
    with a batch assigned, only that batch's sessions (plus whole-course
    sessions with no batch set) are shown — not every batch's timetable.
    Optional batch_id + week_start/week_end (YYYY-MM-DD) narrow to one batch's
    schedule one week at a time, mirroring /live-sessions/mine-acharya, so the
    portal can show "this week's classes" per batch instead of dumping the
    whole timetable at once. The unfiltered call keeps returning everything."""
    now = now_utc()
    enrollments = await db.enrollments.find({"user_id": user["id"]}).to_list(500)
    enrolled_ids = [e.get("offering_id") for e in enrollments if e.get("offering_id")]
    if not enrolled_ids:
        return []
    my_batch_by_offering = {e["offering_id"]: e.get("batch_id") for e in enrollments if e.get("batch_id")}
    items = await db.live_sessions.find(
        {"offering_id": {"$in": enrolled_ids}}).sort("starts_at", 1).to_list(500)
    items = [s for s in items if not (
        my_batch_by_offering.get(s.get("offering_id")) and s.get("batch_id")
        and s["batch_id"] != my_batch_by_offering[s["offering_id"]]
    )]
    if batch_id:
        items = [s for s in items if s.get("batch_id") == batch_id]
    if week_start and week_end:
        items = [s for s in items if week_start <= (s.get("starts_at") or "")[:10] <= week_end]
    result = []
    for s in items:
        s = sanitize_doc(s)
        # A session past its join window with no recording attached is dead
        # weight in the learner's portal — drop it instead of showing a
        # perpetual "opens soon" badge for a class that already happened.
        if session_is_past(s, now) and not (s.get("recording_url") or "").strip():
            continue
        s["can_join"], s["is_live"] = session_join_window(s, now)
        s["is_past"] = session_is_past(s, now)
        try:
            o = await db.offerings.find_one({"_id": ObjectId(s.get("offering_id",""))})
            if o: s["offering_title"] = o.get("title", "")
        except Exception:
            pass
        if s.get("batch_id"):
            try:
                b = await db.batches.find_one({"_id": ObjectId(s["batch_id"])})
                if b: s["batch_name"] = b.get("name", "")
            except Exception:
                pass
        result.append(s)
    return result


# ==================== WEBINARS — CREATE (staff) ====================
@api_router.post("/webinars")
async def create_webinar(data: WebinarCreateIn,
                          actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                          _feat: bool = Depends(require_feature("webinars"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "webinars"):
        raise HTTPException(403, "Webinars has not been granted to you by admin — ask an admin to grant the 'webinars' capability.")
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    doc["created_by"] = actor["id"]
    r = await db.webinars.insert_one(doc)
    doc["_id"] = r.inserted_id
    await write_audit(actor, "webinar.create", str(r.inserted_id), {"title": data.title})
    return sanitize_doc(doc)


@api_router.patch("/webinars/{wid}")
async def update_webinar(wid: str, data: dict,
                          actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                          _feat: bool = Depends(require_feature("webinars"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "webinars"):
        raise HTTPException(403, "Webinars has not been granted to you by admin — ask an admin to grant the 'webinars' capability.")
    data.pop("id", None); data.pop("_id", None)
    if data:
        await db.webinars.update_one({"_id": ObjectId(wid)}, {"$set": data})
    await write_audit(actor, "webinar.update", wid, data)
    w = await db.webinars.find_one({"_id": ObjectId(wid)})
    return sanitize_doc(w)


@api_router.delete("/webinars/{wid}")
async def delete_webinar(wid: str,
                          actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                          _feat: bool = Depends(require_feature("webinars"))):
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "webinars"):
        raise HTTPException(403, "Webinars has not been granted to you by admin — ask an admin to grant the 'webinars' capability.")
    await db.webinars.delete_one({"_id": ObjectId(wid)})
    await write_audit(actor, "webinar.delete", wid, {})
    return {"ok": True}


@api_router.get("/webinars/my-registrations")
async def my_webinar_registrations(user: dict = Depends(get_current_user)):
    """Ids of webinars the current learner has registered for."""
    items = await db.webinars.find({}).to_list(1000)
    return [str(w["_id"]) for w in items if user["id"] in (w.get("registered_user_ids") or [])]


@api_router.post("/webinars/{wid}/register")
async def register_webinar(wid: str, user: dict = Depends(get_current_user)):
    """Free-webinar registration — no payment needed. Paid webinars must go
    through /payments/cashfree/create-webinar-order instead, unless the user
    is staff/admin, who get every webinar free."""
    w = await db.webinars.find_one({"_id": ObjectId(wid)})
    if not w:
        raise HTTPException(404, "Webinar not found")
    if w.get("price_inr", 0) > 0 and user["role"] not in STAFF_FREE_ACCESS_ROLES:
        raise HTTPException(400, "This webinar requires payment — use the checkout flow.")
    seats = int(w.get("seats_remaining", 0) or 0)
    if seats <= 0:
        raise HTTPException(400, "This webinar is sold out.")
    reg = list(w.get("registered_user_ids") or [])
    if user["id"] in reg:
        raise HTTPException(400, "You are already registered for this webinar.")
    payment_id = f"PAY-{secrets.token_hex(6).upper()}"
    reg.append(user["id"])
    await db.webinars.update_one({"_id": ObjectId(wid)},
        {"$set": {"seats_remaining": seats - 1, "registered_user_ids": reg}})
    w = sanitize_doc(await db.webinars.find_one({"_id": ObjectId(wid)}))
    await write_audit(user, "webinar.register", wid, {"payment_id": payment_id})
    return {
        "ok": True, "payment_id": payment_id, "webinar": w,
        "join_url": (w.get("join_url") or "").strip(),
        "note": "Free registration — no payment required.",
    }


# ==================== CERTIFICATES — grouped view + issue by staff ====================
@api_router.get("/certificates/all-grouped")
async def all_certificates_grouped(user: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Platform-wide certificates grouped by user (then by course)."""
    certs = await db.certificates.find({}).sort("issued_at", -1).to_list(2000)
    groups = {}
    for c in certs:
        c = sanitize_doc(c)
        uid = c.get("user_id", "unknown")
        if uid not in groups:
            groups[uid] = {"user_id": uid, "user_name": c.get("user_name", ""), "certificates": []}
        groups[uid]["certificates"].append(c)
    return list(groups.values())


@api_router.get("/certificates/signed-by-me")
async def certificates_signed_by_me(user: dict = Depends(require_role("acharya"))):
    """Certificates this Ācharya has personally signed (signed or published)."""
    certs = await db.certificates.find(
        {"acharya_id": user["id"], "signature_status": {"$in": ["signed", "published"]}}
    ).sort("signed_at", -1).to_list(1000)
    return [sanitize_doc(c) for c in certs]


# ==================== STORAGE (recorded lesson video uploads) ====================
def ensure_storage_bucket():
    """Best-effort: create the public course-media bucket if storage is configured."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info("Storage not configured — skipping bucket ensure (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).")
        return
    try:
        resp = requests.post(f"{SUPABASE_URL}/storage/v1/bucket", json={
            "id": COURSE_MEDIA_BUCKET, "name": COURSE_MEDIA_BUCKET, "public": True,
        }, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
        if resp.status_code < 300:
            logger.info(f"Storage bucket '{COURSE_MEDIA_BUCKET}' created.")
        elif "already exists" in resp.text.lower() or resp.status_code == 409:
            logger.info(f"Storage bucket '{COURSE_MEDIA_BUCKET}' ready.")
        else:
            logger.warning(f"Bucket ensure returned {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        logger.warning(f"Bucket ensure failed: {e}")


def ensure_chat_media_bucket():
    """Best-effort: create the public chat-media bucket if storage is configured.

    file_size_limit / allowed_mime_types are enforced by Supabase itself on
    every upload — this is the real server-side guard, not just a UI hint.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info("Storage not configured — skipping chat-media bucket ensure.")
        return
    try:
        resp = requests.post(f"{SUPABASE_URL}/storage/v1/bucket", json={
            "id": CHAT_MEDIA_BUCKET, "name": CHAT_MEDIA_BUCKET, "public": True,
            "file_size_limit": "5MB",
            "allowed_mime_types": ["image/png", "image/jpeg", "image/gif", "image/webp"],
        }, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
        if resp.status_code < 300:
            logger.info(f"Storage bucket '{CHAT_MEDIA_BUCKET}' created.")
        elif "already exists" in resp.text.lower() or resp.status_code == 409:
            logger.info(f"Storage bucket '{CHAT_MEDIA_BUCKET}' ready.")
        else:
            logger.warning(f"Chat-media bucket ensure returned {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        logger.warning(f"Chat-media bucket ensure failed: {e}")


def ensure_acharya_media_bucket():
    """Best-effort: create the Ācharya note-attachment bucket if storage is configured.
    file_size_limit is enforced by Supabase itself — the real 5MB guard, not just a UI hint."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info("Storage not configured — skipping acharya-content bucket ensure.")
        return
    try:
        resp = requests.post(f"{SUPABASE_URL}/storage/v1/bucket", json={
            "id": ACHARYA_MEDIA_BUCKET, "name": ACHARYA_MEDIA_BUCKET, "public": True,
            "file_size_limit": "5MB",
            "allowed_mime_types": [
                "application/pdf", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "text/plain", "image/png", "image/jpeg",
            ],
        }, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
        if resp.status_code < 300:
            logger.info(f"Storage bucket '{ACHARYA_MEDIA_BUCKET}' created.")
        elif "already exists" in resp.text.lower() or resp.status_code == 409:
            logger.info(f"Storage bucket '{ACHARYA_MEDIA_BUCKET}' ready.")
        else:
            logger.warning(f"Acharya-content bucket ensure returned {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        logger.warning(f"Acharya-content bucket ensure failed: {e}")


def ensure_mantra_audio_bucket():
    """Best-effort: create (or, if it already exists, update) the mantra-audio
    bucket. file_size_limit and allowed_mime_types are enforced by Supabase
    itself on every upload — the real server-side guard, not just the input's
    accept hint. allowed_mime_types was previously an exact-match list
    (audio/mpeg, audio/wav, ...) that silently rejected anything not on it —
    including common recordings whose reported type doesn't exact-match (e.g.
    "audio/ogg; codecs=opus" from voice notes). "audio/*" accepts any audio
    file's real MIME type instead of guessing every variant up front. Because
    bucket creation is a one-time event, an already-existing bucket from
    before this change needs its config explicitly updated too — the elif
    branch does that instead of just logging "ready" and leaving it stale."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info("Storage not configured — skipping mantra-audio bucket ensure.")
        return
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    config = {"public": True, "file_size_limit": "2MB", "allowed_mime_types": ["audio/*"]}
    try:
        resp = requests.post(f"{SUPABASE_URL}/storage/v1/bucket",
            json={"id": MANTRA_AUDIO_BUCKET, "name": MANTRA_AUDIO_BUCKET, **config},
            headers=headers, timeout=15)
        if resp.status_code < 300:
            logger.info(f"Storage bucket '{MANTRA_AUDIO_BUCKET}' created.")
        elif "already exists" in resp.text.lower() or resp.status_code == 409:
            upd = requests.put(f"{SUPABASE_URL}/storage/v1/bucket/{MANTRA_AUDIO_BUCKET}",
                json=config, headers=headers, timeout=15)
            if upd.status_code < 300:
                logger.info(f"Storage bucket '{MANTRA_AUDIO_BUCKET}' ready (mime allowlist refreshed to audio/*).")
            else:
                logger.warning(f"Mantra-audio bucket update returned {upd.status_code}: {upd.text[:160]}")
        else:
            logger.warning(f"Mantra-audio bucket ensure returned {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        logger.warning(f"Mantra-audio bucket ensure failed: {e}")


@api_router.post("/mantras/sign-upload")
async def sign_mantra_audio(data: AcharyaAttachmentSignIn,
                            actor: dict = Depends(require_role("academic_staff", "admin", "super_admin")),
                            _feat: bool = Depends(require_feature("mantras"))):
    """Signed upload for a mantra audio file. Capped at 2MB — enforced here and,
    as the real guard, by the bucket's own file_size_limit."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "mantras"):
        raise HTTPException(403, "Mantras has not been granted to you by admin — ask an admin to grant the 'mantras' capability.")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(503, "Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env).")
    if data.size_bytes and data.size_bytes > MANTRA_AUDIO_MAX_BYTES:
        raise HTTPException(400, "Audio file must be 2MB or smaller.")
    ct = (data.content_type or "").lower()
    if ct and not ct.startswith("audio/"):
        raise HTTPException(400, "Only audio files are allowed.")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (data.filename or "file").strip()) or "file"
    path = f"mantras/{secrets.token_hex(8)}/{safe}"
    endpoint = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{MANTRA_AUDIO_BUCKET}/{path}"
    try:
        resp = requests.post(endpoint, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"Storage request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not sign upload ({resp.status_code}): {resp.text[:200]}")
    signed = resp.json().get("url", "")
    upload_url = f"{SUPABASE_URL}/storage/v1{signed}"
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{MANTRA_AUDIO_BUCKET}/{path}"
    return {"upload_url": upload_url, "public_url": public_url, "path": path,
            "content_type": data.content_type, "filename": safe}


def ensure_batch_schedule_bucket():
    """Best-effort: create the (private-in-spirit, path-token-secured like the
    other buckets here) batch-schedules bucket for raw CSV/Excel timetable
    uploads — deleted again once a batch's timetable is approved and turned
    into real live_sessions rows."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info("Storage not configured — skipping batch-schedules bucket ensure.")
        return
    try:
        resp = requests.post(f"{SUPABASE_URL}/storage/v1/bucket", json={
            "id": BATCH_SCHEDULE_BUCKET, "name": BATCH_SCHEDULE_BUCKET, "public": True,
            "file_size_limit": "5MB",
            "allowed_mime_types": [
                "text/csv", "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
        }, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
        if resp.status_code < 300:
            logger.info(f"Storage bucket '{BATCH_SCHEDULE_BUCKET}' created.")
        elif "already exists" in resp.text.lower() or resp.status_code == 409:
            logger.info(f"Storage bucket '{BATCH_SCHEDULE_BUCKET}' ready.")
        else:
            logger.warning(f"Batch-schedules bucket ensure returned {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        logger.warning(f"Batch-schedules bucket ensure failed: {e}")


def upload_bytes_to_storage(bucket: str, path: str, content: bytes, content_type: str) -> str:
    """Server-side direct upload — used when the bytes already landed on the
    backend via a multipart body, so the browser-signed-URL dance (meant for
    large client-side uploads) would just be extra round trips."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(503, "Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env).")
    endpoint = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    try:
        resp = requests.post(endpoint, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
        }, data=content, timeout=20)
    except Exception as e:
        raise HTTPException(502, f"Storage upload failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not upload file ({resp.status_code}): {resp.text[:200]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


def delete_storage_object(bucket: str, path: str):
    """Best-effort delete — e.g. removing a batch's raw timetable file once its
    rows have become real live_sessions rows and the file is no longer needed."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not path:
        return
    try:
        requests.delete(f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}", headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
    except Exception as e:
        logger.warning(f"Could not delete {bucket}/{path}: {e}")


@api_router.post("/storage/sign-upload")
async def sign_upload(data: SignUploadIn,
                      actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Return a signed URL the browser can PUT a file to directly (service key stays server-side)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(503, "Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env).")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (data.filename or "file").strip()) or "file"
    path = f"lessons/{secrets.token_hex(8)}/{safe}"
    endpoint = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{COURSE_MEDIA_BUCKET}/{path}"
    try:
        resp = requests.post(endpoint, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"Storage request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not sign upload ({resp.status_code}): {resp.text[:200]}")
    signed = resp.json().get("url", "")  # e.g. /object/upload/sign/course-media/<path>?token=...
    upload_url = f"{SUPABASE_URL}/storage/v1{signed}"
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{COURSE_MEDIA_BUCKET}/{path}"
    return {"upload_url": upload_url, "public_url": public_url, "path": path,
            "content_type": data.content_type}


async def ensure_bunny_collection(offering: dict) -> Optional[str]:
    """Lazily create this course's Bunny Stream collection (a folder in the library
    dashboard) on first use, and persist the guid — so we only ever call Bunny for
    courses that actually get a video, not on every course view."""
    existing = offering.get("bunny_collection_id")
    if existing:
        return existing
    try:
        resp = requests.post(
            f"https://video.bunnycdn.com/library/{BUNNY_LIBRARY_ID}/collections",
            headers={"AccessKey": BUNNY_STREAM_API_KEY, "Content-Type": "application/json"},
            json={"name": offering.get("title") or "Untitled course"}, timeout=15,
        )
    except Exception as e:
        raise HTTPException(502, f"Bunny request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not create collection ({resp.status_code}): {resp.text[:200]}")
    collection_id = resp.json().get("guid")
    await db.offerings.update_one({"_id": offering["id"]}, {"$set": {"bunny_collection_id": collection_id}})
    return collection_id


@api_router.post("/lectures/video/sign")
async def sign_lecture_video(data: BunnyVideoSignIn,
                              actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Create a Bunny Stream video and hand back a short-lived TUS upload signature —
    same edit permission as the rest of a course's Lessons tab. The Bunny API key
    itself never reaches the browser."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "offerings"):
        raise HTTPException(403, "Offerings has not been granted to you by admin — ask an admin to grant the 'offerings' capability.")
    if not BUNNY_LIBRARY_ID or not BUNNY_STREAM_API_KEY:
        raise HTTPException(503, "Video hosting is not configured (set BUNNY_LIBRARY_ID and BUNNY_STREAM_API_KEY in backend/.env).")
    collection_id = None
    if data.offering_id:
        offering = await db.offerings.find_one({"_id": ObjectId(data.offering_id)})
        if not offering:
            raise HTTPException(404, "Course not found")
        collection_id = await ensure_bunny_collection(offering)
    video_body = {"title": data.title or "Untitled lecture"}
    if collection_id:
        video_body["collectionId"] = collection_id
    try:
        resp = requests.post(
            f"https://video.bunnycdn.com/library/{BUNNY_LIBRARY_ID}/videos",
            headers={"AccessKey": BUNNY_STREAM_API_KEY, "Content-Type": "application/json"},
            json=video_body, timeout=15,
        )
    except Exception as e:
        raise HTTPException(502, f"Bunny request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not create video ({resp.status_code}): {resp.text[:200]}")
    video_id = resp.json().get("guid")
    expire = int(time.time()) + 3600
    signature = hashlib.sha256(f"{BUNNY_LIBRARY_ID}{BUNNY_STREAM_API_KEY}{expire}{video_id}".encode()).hexdigest()
    return {
        "endpoint": "https://video.bunnycdn.com/tusupload",
        "video_id": video_id,
        "library_id": BUNNY_LIBRARY_ID,
        "signature": signature,
        "expire": expire,
        "playback_url": f"https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{video_id}",
    }


def _bunny_embed_token_url(video_id: str) -> dict:
    if not BUNNY_TOKEN_SECURITY_KEY:
        raise HTTPException(503, "Video playback is not configured (set BUNNY_TOKEN_SECURITY_KEY in backend/.env).")
    expiration = int(time.time()) + 7200
    token = hashlib.sha256(f"{BUNNY_TOKEN_SECURITY_KEY}{video_id}{expiration}".encode()).hexdigest()
    return {
        "provider": "bunny",
        "embed_url": f"https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{video_id}?token={token}&expires={expiration}",
    }


@api_router.get("/lectures/video/{video_id}/preview-token")
async def preview_lecture_video(video_id: str,
                                 actor: dict = Depends(require_role("academic_staff", "admin", "super_admin"))):
    """Staff's own immediate post-upload preview — mints a token straight from the
    video id, with no offering/lesson lookup, since the lesson may not be saved yet
    (e.g. a brand-new course draft). Same edit permission as uploading it."""
    if actor["role"] == "academic_staff" and not await has_capability(actor["id"], "offerings"):
        raise HTTPException(403, "Offerings has not been granted to you by admin — ask an admin to grant the 'offerings' capability.")
    return _bunny_embed_token_url(video_id)


def _find_lesson(offering: dict, lesson_id: str) -> Optional[dict]:
    modules = offering.get("modules") or []
    for m in modules:
        if str(m.get("id", "")) == lesson_id:
            return m
    try:
        return modules[int(lesson_id)]
    except (ValueError, IndexError, TypeError):
        return None


@api_router.get("/offerings/{offering_id}/lessons/{lesson_id}/play")
async def get_lesson_playback(offering_id: str, lesson_id: str,
                               actor: dict = Depends(get_current_user)):
    """Mint a short-lived Bunny embed-view token for one lesson — only for viewers
    who are actually allowed to see this course: an enrolled learner, staff, or the
    course's own Ācharya. This is the actual enrollment gate; the lesson's raw
    video_url is never handed out un-checked."""
    offering = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not offering:
        raise HTTPException(404, "Course not found")
    lesson = _find_lesson(offering, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    is_enrolled = await db.enrollments.find_one({"user_id": actor["id"], "offering_id": offering_id})
    is_staff = actor.get("role") in ("academic_staff", "admin", "super_admin")
    is_owning_acharya = actor.get("role") == "acharya" and offering.get("acharya_id") == actor["id"]
    if not (is_enrolled or is_staff or is_owning_acharya):
        raise HTTPException(403, "Not enrolled in this course")
    if is_enrolled and is_enrolled.get("suspended") and not (is_staff or is_owning_acharya):
        raise HTTPException(403, "Your access to this course has been restricted by an admin.")

    if lesson.get("video_provider") != "bunny":
        return {"provider": lesson.get("video_provider") or "url", "video_url": lesson.get("video_url")}

    video_id = lesson.get("video_path")
    if not video_id:
        raise HTTPException(404, "This lesson has no video")
    return _bunny_embed_token_url(video_id)


# ==================== GEO / CURRENCY ====================
# ponytail: process-lifetime dict, unbounded — fine at this traffic scale;
# move to a TTL cache (e.g. redis) if the distinct-IP count grows large.
GEO_CACHE = {}

@api_router.get("/geo")
async def detect_geo(request: Request):
    """Best-effort visitor country -> display currency (INR vs USD), from the
    request's IP. Defaults to INR (home market) whenever the lookup is
    inconclusive — local/dev IPs, a blocked/rate-limited lookup, etc."""
    xff = request.headers.get("x-forwarded-for", "")
    ip = (xff.split(",")[0].strip() if xff else "") or (request.client.host if request.client else "")
    if ip in GEO_CACHE:
        return GEO_CACHE[ip]
    country = ""
    if ip:
        try:
            resp = await asyncio.to_thread(requests.get, f"https://ipapi.co/{ip}/country/", timeout=3)
            if resp.ok and resp.text.strip().isalpha():
                country = resp.text.strip()
        except Exception:
            pass
    result = {"currency": "USD" if country and country != "IN" else "INR", "country": country}
    GEO_CACHE[ip] = result
    return result


# ==================== ROOT ====================
@api_router.get("/")
async def root():
    return {"app": "Tredev Learn", "version": "2.0"}


app.include_router(api_router)

# NOTE: with allow_credentials=True the response must echo the specific request
# origin — a literal "*" makes the browser reject credentialed responses
# (axios uses withCredentials). allow_origin_regex=".*" echoes any origin, so it
# stays "allow everything" while remaining credentials-compatible.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== SEED DATA ====================
async def _seed_user(email, password, name, role, bio="", parampara=""):
    """Ensure a Firebase identity + local profile row exist for a seed account."""
    email = email.lower()
    fb_uid = await firebase_auth.ensure_user(email, password, name)
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "firebase_uid": fb_uid, "email": email, "name": name, "role": role,
            "created_at": now_utc().isoformat(), "bio": bio,
            "parampara": parampara, "avatar_url": "",
        })
        logger.info(f"Seeded {role}: {email}")
    else:
        # Keep the firebase link (and role, for the env-driven admins) current.
        await db.users.update_one({"email": email},
            {"$set": {"firebase_uid": fb_uid, "role": role}})


async def seed_admin_and_data():
    # Admin / super-admin from env
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_pass = os.environ.get("ADMIN_PASSWORD")
    if admin_email and admin_pass:
        await _seed_user(admin_email, admin_pass, "Platform Admin", "admin")

    super_email = os.environ.get("SUPER_ADMIN_EMAIL")
    super_pass = os.environ.get("SUPER_ADMIN_PASSWORD")
    if super_email and super_pass:
        await _seed_user(super_email, super_pass, "Super Admin", "super_admin")

    # Test accounts (idempotent)
    learner_email = "learner@tredevlearn.com"
    await _seed_user(learner_email, "Learner@123", "Priya Sharma", "learner")

    acharya_email = "acharya@tredevlearn.com"
    await _seed_user(
        acharya_email, "Acharya@123", "Ācharya Vishwanath Shastri", "acharya",
        bio="Fourth-generation Vedic scholar specializing in Advaita Vedanta.",
        parampara="Sringeri Sharada Peetham lineage")

    staff_email = "staff@tredevlearn.com"
    await _seed_user(staff_email, "Staff@123", "Ananya Iyer", "academic_staff",
                     bio="PhD, Sanskrit Grammar")

    acharya = await db.users.find_one({"email": acharya_email})
    acharya_id = str(acharya["_id"]) if acharya else ""

    # Seed verses — add only ones not already present, so re-runs pick up new additions
    verses = [
            {
                "scripture": "Bhagavad Gita", "reference": "2.47",
                "devanagari": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
                "iast": "karmaṇy-evādhikāras te mā phaleṣu kadācana |\nmā karma-phala-hetur bhūr mā te saṅgo 'stv akarmaṇi ||",
                "word_by_word": [
                    {"sanskrit":"कर्मणि","iast":"karmaṇi","meaning":"in action"},
                    {"sanskrit":"एव","iast":"eva","meaning":"only"},
                    {"sanskrit":"अधिकारः","iast":"adhikāraḥ","meaning":"right, entitlement"},
                    {"sanskrit":"ते","iast":"te","meaning":"your"},
                    {"sanskrit":"मा","iast":"mā","meaning":"never"},
                    {"sanskrit":"फलेषु","iast":"phaleṣu","meaning":"in the fruits"},
                    {"sanskrit":"कदाचन","iast":"kadācana","meaning":"at any time"},
                ],
                "translations": [
                    {"author":"Śrī Śaṅkarācārya","text":"Your right is to action alone, never to its fruits. Let not the fruits of action be your motive, nor let your attachment be to inaction."},
                    {"author":"Swami Chinmayananda","text":"Your right is to work only, but never to its fruits. Let not the fruits of action be thy motive, nor let thy attachment be to inaction."},
                    {"author":"Sri Aurobindo","text":"Thou hast a right to action, but only to action, never to its fruits; let not the fruits of thy works be thy motive, neither let there be in thee any attachment to inactivity."},
                ],
                "commentaries": [
                    {"author":"Śaṅkara","text":"The verse establishes karma-yoga — action performed without attachment to results as a discipline of the mind."},
                    {"author":"Rāmānuja","text":"The Lord addresses the seeker with a niṣkāma-karma injunction, purifying antaḥkaraṇa before jñāna."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Bhagavad Gita", "reference": "2.20",
                "devanagari": "न जायते म्रियते वा कदाचिन्\nनायं भूत्वा भविता वा न भूयः।\nअजो नित्यः शाश्वतोऽयं पुराणो\nन हन्यते हन्यमाने शरीरे॥",
                "iast": "na jāyate mriyate vā kadācin\nnāyaṃ bhūtvā bhavitā vā na bhūyaḥ |\najo nityaḥ śāśvato 'yaṃ purāṇo\nna hanyate hanyamāne śarīre ||",
                "word_by_word": [
                    {"sanskrit":"न","iast":"na","meaning":"not"},
                    {"sanskrit":"जायते","iast":"jāyate","meaning":"is born"},
                    {"sanskrit":"म्रियते","iast":"mriyate","meaning":"dies"},
                    {"sanskrit":"अजः","iast":"ajaḥ","meaning":"unborn"},
                    {"sanskrit":"नित्यः","iast":"nityaḥ","meaning":"eternal"},
                ],
                "translations": [
                    {"author":"Śaṅkara","text":"The Self is never born, nor does it ever die; it has not come to be, nor will it cease to be. Unborn, eternal, permanent and ancient, it is not slain when the body is slain."},
                    {"author":"S. Radhakrishnan","text":"He is never born, nor does he ever die; nor having come to be, will he ever cease to be. Unborn, eternal, everlasting, ancient, he is not slain when the body is slain."},
                ],
                "commentaries": [
                    {"author":"Śaṅkara","text":"The ātman transcends the six modifications of being (ṣaḍ-vikārā): birth, existence, growth, transformation, decay, death."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Isha Upanishad", "reference": "1",
                "devanagari": "ईशावास्यमिदꣳ सर्वं यत्किञ्च जगत्यां जगत्।\nतेन त्यक्तेन भुञ्जीथा मा गृधः कस्यस्विद्धनम्॥",
                "iast": "īśāvāsyam idaṃ sarvaṃ yat kiñca jagatyāṃ jagat |\ntena tyaktena bhuñjīthā mā gṛdhaḥ kasyasvid dhanam ||",
                "word_by_word": [
                    {"sanskrit":"ईशा","iast":"īśā","meaning":"by the Lord"},
                    {"sanskrit":"आवास्यम्","iast":"āvāsyam","meaning":"pervaded, indwelt"},
                    {"sanskrit":"सर्वम्","iast":"sarvam","meaning":"all"},
                ],
                "translations": [
                    {"author":"Śaṅkara","text":"All this — whatever moves in this moving world — is indwelt by the Lord. Enjoy through renunciation; do not covet anyone's wealth."},
                    {"author":"Sri Aurobindo","text":"All this is for habitation by the Lord, whatsoever is individual universe of movement in the universal motion."},
                ],
                "commentaries": [
                    {"author":"Śaṅkara","text":"The famous opening of the Iśopaniṣad — non-attachment (tyāga) as the means to true enjoyment (bhoga)."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Rigveda", "reference": "10.129.1 (Nāsadīya Sūkta)",
                "devanagari": "नासदासीन्नो सदासीत्तदानीं नासीद्रजो नो व्योमा परो यत्।\nकिमावरीवः कुह कस्य शर्मन्नम्भः किमासीद्गहनं गभीरम्॥",
                "iast": "nāsad āsīn no sad āsīt tadānīṃ nāsīd rajo no vyomā paro yat |\nkim āvarīvaḥ kuha kasya śarmann ambhaḥ kim āsīd gahanaṃ gabhīram ||",
                "word_by_word": [
                    {"sanskrit":"न","iast":"na","meaning":"not"},
                    {"sanskrit":"असत्","iast":"asat","meaning":"non-being"},
                    {"sanskrit":"आसीत्","iast":"āsīt","meaning":"was"},
                    {"sanskrit":"सत्","iast":"sat","meaning":"being"},
                ],
                "translations": [
                    {"author":"A. A. Macdonell","text":"Then was not non-existent nor existent: there was no realm of air, no sky beyond it. What covered in, and where? and what gave shelter? Was water there, unfathomed depth of water?"},
                    {"author":"Wendy Doniger","text":"There was neither non-existence nor existence then; there was neither the realm of space nor the sky which is beyond."},
                ],
                "commentaries": [
                    {"author":"Sāyaṇa","text":"The Nāsadīya Sūkta is the ancient hymn of creation, asking what preceded existence itself."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Bhagavad Gita", "reference": "18.66",
                "devanagari": "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nअहं त्वा सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः॥",
                "iast": "sarva-dharmān parityajya mām ekaṃ śaraṇaṃ vraja |\nahaṃ tvāṃ sarva-pāpebhyo mokṣayiṣyāmi mā śucaḥ ||",
                "word_by_word": [
                    {"sanskrit":"सर्व","iast":"sarva","meaning":"all"},
                    {"sanskrit":"धर्मान्","iast":"dharmān","meaning":"duties"},
                    {"sanskrit":"परित्यज्य","iast":"parityajya","meaning":"having abandoned"},
                    {"sanskrit":"शरणम्","iast":"śaraṇam","meaning":"refuge"},
                ],
                "translations": [
                    {"author":"Rāmānuja","text":"Abandoning all duties, take refuge in Me alone; I shall liberate thee from all sins, do not grieve."},
                    {"author":"Śaṅkara","text":"Relinquishing all dharmas, come to Me, the one, for refuge; I shall liberate thee from all sins, grieve not."},
                ],
                "commentaries": [
                    {"author":"Rāmānuja","text":"The carama-śloka of the Gita: complete surrender (prapatti) as the ultimate path."},
                    {"author":"Śaṅkara","text":"Understood as jñāna-niṣṭhā — the abandonment of the notion of doership."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Bhagavad Gita", "reference": "4.7-4.8",
                "devanagari": "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nअभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥\nपरित्राणाय साधूनां विनाशाय च दुष्कृताम्।\nधर्मसंस्थापनार्थाय सम्भवामि युगे युगे॥",
                "iast": "yadā yadā hi dharmasya glānir bhavati bhārata |\nabhyutthānam adharmasya tadātmānaṃ sṛjāmy aham ||\nparitrāṇāya sādhūnāṃ vināśāya ca duṣkṛtām |\ndharma-saṃsthāpanārthāya sambhavāmi yuge yuge ||",
                "word_by_word": [
                    {"sanskrit":"यदा यदा","iast":"yadā yadā","meaning":"whenever"},
                    {"sanskrit":"धर्मस्य","iast":"dharmasya","meaning":"of dharma"},
                    {"sanskrit":"ग्लानिः","iast":"glāniḥ","meaning":"decline"},
                    {"sanskrit":"अभ्युत्थानम्","iast":"abhyutthānam","meaning":"rise"},
                    {"sanskrit":"सृजाम्यहम्","iast":"sṛjāmy aham","meaning":"I manifest Myself"},
                    {"sanskrit":"परित्राणाय","iast":"paritrāṇāya","meaning":"for the protection"},
                    {"sanskrit":"साधूनाम्","iast":"sādhūnām","meaning":"of the virtuous"},
                    {"sanskrit":"विनाशाय","iast":"vināśāya","meaning":"for the destruction"},
                    {"sanskrit":"दुष्कृताम्","iast":"duṣkṛtām","meaning":"of the wicked"},
                    {"sanskrit":"युगे युगे","iast":"yuge yuge","meaning":"age after age"},
                ],
                "translations": [
                    {"author":"Swami Chinmayananda","text":"Whenever there is a decline of righteousness and rise of unrighteousness, O Bharata, then I manifest Myself. For the protection of the good, for the destruction of the wicked, and for the establishment of dharma, I am born in every age."},
                    {"author":"Eknath Easwaran","text":"Whenever dharma declines and the purpose of life is forgotten, I manifest myself on earth. I am born in every age to protect the good, to destroy evil, and to reestablish dharma."},
                ],
                "commentaries": [
                    {"author":"Śaṅkara","text":"The Lord's avatāra is not bound by karma like an ordinary birth — it is a voluntary manifestation for the restoration of dharma."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Rigveda", "reference": "3.62.10 (Gāyatrī Mantra)",
                "devanagari": "ॐ भूर्भुवः स्वः।\nतत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि।\nधियो यो नः प्रचोदयात्॥",
                "iast": "oṃ bhūr bhuvaḥ svaḥ |\ntat savitur vareṇyaṃ bhargo devasya dhīmahi |\ndhiyo yo naḥ pracodayāt ||",
                "word_by_word": [
                    {"sanskrit":"ॐ भूर्भुवः स्वः","iast":"oṃ bhūr bhuvaḥ svaḥ","meaning":"the primal sound and the three worlds"},
                    {"sanskrit":"तत्","iast":"tat","meaning":"that"},
                    {"sanskrit":"सवितुः","iast":"savituḥ","meaning":"of the divine Sun"},
                    {"sanskrit":"वरेण्यम्","iast":"vareṇyam","meaning":"most excellent, adorable"},
                    {"sanskrit":"भर्गः","iast":"bhargaḥ","meaning":"radiance, glory"},
                    {"sanskrit":"धीमहि","iast":"dhīmahi","meaning":"we meditate upon"},
                    {"sanskrit":"धियः","iast":"dhiyaḥ","meaning":"our intellects"},
                    {"sanskrit":"प्रचोदयात्","iast":"pracodayāt","meaning":"may it inspire/illumine"},
                ],
                "translations": [
                    {"author":"Swami Vivekananda","text":"We meditate on the glory of that Being who has produced this universe; may He enlighten our minds."},
                    {"author":"Sri Aurobindo","text":"Let us meditate on the excellent glory of the divine Vivifying Sun, so that he may inspire our understandings."},
                ],
                "commentaries": [
                    {"author":"Traditional","text":"The most sacred mantra of the Rigveda, recited at sandhyā (dawn/dusk worship) as an invocation for clarity of intellect."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Katha Upanishad", "reference": "1.3.14",
                "devanagari": "उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत।\nक्षुरस्य धारा निशिता दुरत्यया दुर्गं पथस्तत्कवयो वदन्ति॥",
                "iast": "uttiṣṭhata jāgrata prāpya varān nibodhata |\nkṣurasya dhārā niśitā duratyayā durgaṃ pathas tat kavayo vadanti ||",
                "word_by_word": [
                    {"sanskrit":"उत्तिष्ठत","iast":"uttiṣṭhata","meaning":"arise"},
                    {"sanskrit":"जाग्रत","iast":"jāgrata","meaning":"awake"},
                    {"sanskrit":"प्राप्य","iast":"prāpya","meaning":"having approached"},
                    {"sanskrit":"वरान्","iast":"varān","meaning":"the wise/excellent teachers"},
                    {"sanskrit":"निबोधत","iast":"nibodhata","meaning":"learn, understand"},
                    {"sanskrit":"क्षुरस्य धारा","iast":"kṣurasya dhārā","meaning":"the edge of a razor"},
                    {"sanskrit":"दुरत्यया","iast":"duratyayā","meaning":"difficult to cross"},
                ],
                "translations": [
                    {"author":"Swami Nikhilananda","text":"Arise! Awake! Approach the great and learn. Like the sharp edge of a razor is that path, so the wise say — hard to tread and difficult to cross."},
                    {"author":"Eknath Easwaran","text":"Awake, arise, seek the wise and learn. Like the sharp edge of a razor is that path, so hard to tread, difficult to cross, say the illumined sages."},
                ],
                "commentaries": [
                    {"author":"Śaṅkara","text":"The call to awaken from ignorance is directed at the seeker, Naciketas — spiritual discipline demands vigilance, not passive belief."},
                ],
                "audio_url": "",
            },
            {
                "scripture": "Mundaka Upanishad", "reference": "3.1.6",
                "devanagari": "सत्यमेव जयते नानृतं सत्येन पन्था विततो देवयानः।\nयेनाक्रमन्त्यृषयो ह्याप्तकामा यत्र तत् सत्यस्य परमं निधानम्॥",
                "iast": "satyam eva jayate nānṛtaṃ satyena panthā vitato devayānaḥ |\nyenākramanty ṛṣayo hy āptakāmā yatra tat satyasya paramaṃ nidhānam ||",
                "word_by_word": [
                    {"sanskrit":"सत्यम् एव","iast":"satyam eva","meaning":"truth alone"},
                    {"sanskrit":"जयते","iast":"jayate","meaning":"triumphs"},
                    {"sanskrit":"न अनृतम्","iast":"na anṛtam","meaning":"not falsehood"},
                    {"sanskrit":"सत्येन","iast":"satyena","meaning":"by truth"},
                    {"sanskrit":"पन्था","iast":"panthāḥ","meaning":"the path"},
                    {"sanskrit":"देवयानः","iast":"devayānaḥ","meaning":"the way of the gods"},
                    {"sanskrit":"ऋषयः","iast":"ṛṣayaḥ","meaning":"the sages"},
                    {"sanskrit":"सत्यस्य परमं निधानम्","iast":"satyasya paramaṃ nidhānam","meaning":"the highest treasure of truth"},
                ],
                "translations": [
                    {"author":"Traditional","text":"Truth alone triumphs, not falsehood. Through truth the divine path is spread out, by which the sages, whose desires are fulfilled, reach the supreme abode of truth."},
                ],
                "commentaries": [
                    {"author":"Traditional","text":"Adopted as India's national motto, inscribed below the Lion Capital of Ashoka — truth as the foundation of dharma."},
                ],
                "audio_url": "",
            },
    ]
    existing_refs = {(v["scripture"], v["reference"]) for v in await db.verses.find({}).to_list(1000)}
    new_verses = [v for v in verses if (v["scripture"], v["reference"]) not in existing_refs]
    if new_verses:
        for v in new_verses:
            v["created_at"] = now_utc().isoformat()
        await db.verses.insert_many(new_verses)
        logger.info(f"Seeded {len(new_verses)} verses")

    verse_docs = await db.verses.find({}).to_list(20)
    verse_ids = [str(v["_id"]) for v in verse_docs]

    # Seed offerings
    if await db.offerings.count_documents({}) == 0:
        offerings = [
            {
                "title": "Bhagavad Gita — A Verse-by-Verse Journey", "subtitle": "Foundation Course",
                "description": "A rigorous, verse-by-verse study of the Bhagavad Gita across 18 chapters, presented with attributed translations from Śaṅkara, Rāmānuja, and modern commentators. Includes the Shloka Player for every verse.",
                "type": "recorded_course", "track": "A", "subject": "Bhagavad Gita",
                "price_inr": 4999, "price_usd": 79, "duration": "12 weeks self-paced",
                "acharya_id": acharya_id, "verses": verse_ids[:3],
                "modules": [
                    {"title":"Chapter 1: Arjuna's Sorrow","lessons":[{"title":"The Setting","verse_id":""},{"title":"Arjuna's Dilemma","verse_id":""}]},
                    {"title":"Chapter 2: Sāṅkhya Yoga","lessons":[{"title":"Verse 2.20 — On the Eternal Self","verse_id":verse_ids[1] if len(verse_ids)>1 else ""},{"title":"Verse 2.47 — Karma Yoga","verse_id":verse_ids[0] if verse_ids else ""}]},
                    {"title":"Chapter 18: Mokṣa Sannyāsa Yoga","lessons":[{"title":"Verse 18.66 — Complete Surrender","verse_id":verse_ids[4] if len(verse_ids)>4 else ""}]},
                ],
                "image_url": "https://images.pexels.com/photos/15235034/pexels-photo-15235034.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
                "is_published": True, "approved_by_acharya": True,
                "festival": "Gita Jayanti", "start_date": "",
            },
            {
                "title": "Sanskrit for Absolute Beginners", "subtitle": "Language & Grammar",
                "description": "Devanagari script, sandhi, and foundational grammar. By the end, you will read your first śloka on your own.",
                "type": "live_course", "track": "B", "subject": "Sanskrit",
                "price_inr": 8999, "price_usd": 149, "duration": "8-week cohort",
                "acharya_id": acharya_id, "verses": [],
                "modules": [
                    {"title":"Week 1: Devanagari","lessons":[{"title":"Vowels (svara)"},{"title":"Consonants (vyañjana)"}]},
                    {"title":"Week 2: Sandhi","lessons":[{"title":"Vowel sandhi"},{"title":"Visarga sandhi"}]},
                ],
                "image_url": "https://images.pexels.com/photos/7128756/pexels-photo-7128756.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
                "is_published": True, "approved_by_acharya": True,
                "festival": "Vasant Panchami", "start_date": "",
            },
            {
                "title": "Rudram — A 40-Day Sadhana", "subtitle": "Practice & Recitation",
                "description": "A daily practice aligned to the ritual calendar. Take a sankalpa, chant with the cohort, count japa, and let the tradition move through you.",
                "type": "sadhana", "track": "C", "subject": "Mantras",
                "price_inr": 2999, "price_usd": 49, "duration": "40 days",
                "acharya_id": acharya_id, "verses": [],
                "modules": [{"title":"Day 1: Sankalpa","lessons":[{"title":"Taking the Vow"}]}],
                "image_url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBtZWRpdGF0aW5nJTIwY2FsbSUyMHdhcm0lMjBsaWdodHxlbnwwfHx8fDE3ODM0NTUxMTl8MA&ixlib=rb-4.1.0&q=85",
                "is_published": True, "approved_by_acharya": True,
                "festival": "Maha Shivaratri", "start_date": "",
            },
            {
                "title": "Introduction to Vedic Astrology as Śāstra", "subtitle": "The Discipline, not the Fortune",
                "description": "Astrology taught as a technical discipline — read a chart, understand yogas, learn the vocabulary. We do not tell fortunes; we teach the śāstra.",
                "type": "recorded_course", "track": "B", "subject": "Astrology",
                "price_inr": 5999, "price_usd": 89, "duration": "10 weeks self-paced",
                "acharya_id": acharya_id, "verses": [],
                "modules": [],
                "image_url": "https://images.unsplash.com/photo-1658658160512-878184180267?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwyfHxoaW5kdSUyMHRlbXBsZSUyMHNpbGhvdWV0dGUlMjBtaW5pbWFsJTIwYXJjaGl0ZWN0dXJlfGVufDB8fHx8MTc4MjExNjM4OHww&ixlib=rb-4.1.0&q=85",
                "is_published": True, "approved_by_acharya": True,
                "festival": "", "start_date": "",
            },
            {
                "title": "Upanishads — A Free Masterclass", "subtitle": "The Wisdom Chapters",
                "description": "A single 90-minute live session introducing the Upanishads. Free. No credit card, no strings.",
                "type": "masterclass", "track": "A", "subject": "Upanishads",
                "price_inr": 0, "price_usd": 0, "duration": "90 minutes",
                "acharya_id": acharya_id, "verses": [verse_ids[2]] if len(verse_ids)>2 else [],
                "modules": [], "image_url": "",
                "is_published": True, "approved_by_acharya": True,
                "festival": "", "start_date": "",
            },
            {
                "title": "The Rigveda — Nāsadīya Sūkta Deep Dive", "subtitle": "Workshop",
                "description": "Three sessions on the Hymn of Creation — its language, its philosophy, its place in the Ṛgvedic tradition.",
                "type": "workshop", "track": "A", "subject": "Vedas",
                "price_inr": 1999, "price_usd": 39, "duration": "3 sessions",
                "acharya_id": acharya_id, "verses": [verse_ids[3]] if len(verse_ids)>3 else [],
                "modules": [], "image_url": "",
                "is_published": True, "approved_by_acharya": True,
                "festival": "", "start_date": "",
            },
            {
                "title": "Bhagavad Gita for Practitioners", "subtitle": "E-book",
                "description": "In-browser reader with embedded Devanagari, transliteration, and side-by-side translations.",
                "type": "ebook", "track": "A", "subject": "Bhagavad Gita",
                "price_inr": 499, "price_usd": 9, "duration": "Digital",
                "acharya_id": acharya_id, "verses": verse_ids[:2],
                "modules": [], "image_url": "",
                "is_published": True, "approved_by_acharya": True,
                "festival": "", "start_date": "",
            },
        ]
        for o in offerings:
            o["created_at"] = now_utc().isoformat()
            o["created_by"] = ""
            o["approval_notes"] = ""
        await db.offerings.insert_many(offerings)
        logger.info("Seeded offerings")

    # Live sessions
    if await db.live_sessions.count_documents({}) == 0:
        o1 = await db.offerings.find_one({"type": "live_course"})
        offering_id = str(o1["_id"]) if o1 else ""
        starts_in = now_utc() + timedelta(minutes=3)  # imminent so testing works
        later = now_utc() + timedelta(days=2)
        await db.live_sessions.insert_many([
            {"title":"Live Session: Devanagari Kickoff", "offering_id": offering_id,
             "acharya_id": acharya_id, "starts_at": starts_in.isoformat(),
             "duration_min": 90, "mode":"interactive"},
            {"title":"Live Q&A: Sanskrit Sandhi", "offering_id": offering_id,
             "acharya_id": acharya_id, "starts_at": later.isoformat(),
             "duration_min": 60, "mode":"broadcast"},
        ])

    # Festival calendar — one-time correction of early placeholder demo dates (wrong year-half),
    # plus the researched Aug–Dec 2026 dataset. Runs every startup but is idempotent: it only
    # deletes the exact known-stale (name, date) pairs and only inserts a curated row if that
    # exact (name, date) isn't already present, so staff CSV edits made afterward are untouched.
    STALE_DEMO_FESTIVALS = [
        ("Maha Shivaratri", "2026-02-15"), ("Vasant Panchami", "2026-01-22"),
        ("Gita Jayanti", "2026-11-30"), ("Navratri", "2026-10-01"), ("Guru Purnima", "2026-07-19"),
    ]
    for stale_name, stale_date in STALE_DEMO_FESTIVALS:
        await db.festivals.delete_many({"name": stale_name, "date": stale_date})

    CURATED_FESTIVALS_2026_H2 = [
        {"name": "Onam (Thiruvonam)", "date": "2026-08-26", "significance": "Kerala's harvest festival, celebrating the mythical return of King Mahabali", "deity": "", "related_offering_subject": ""},
        {"name": "Raksha Bandhan", "date": "2026-08-28", "significance": "Siblings tie a protective thread, celebrating the bond of sibling love", "deity": "", "related_offering_subject": ""},
        {"name": "Janmashtami", "date": "2026-09-04", "significance": "Birth of Lord Krishna", "deity": "Krishna", "related_offering_subject": "Bhagavad Gita"},
        {"name": "Ganesh Chaturthi", "date": "2026-09-14", "significance": "Installation and worship of Lord Ganesha, culminating in visarjan", "deity": "Ganesha", "related_offering_subject": "Mantras"},
        {"name": "Sharad Navratri", "date": "2026-10-11", "significance": "Nine nights honoring the nine forms of Goddess Durga", "deity": "Durga", "related_offering_subject": "Mantras"},
        {"name": "Durga Ashtami", "date": "2026-10-18", "significance": "Peak Durga Puja day — Kanya Pujan and Ashtami worship", "deity": "Durga", "related_offering_subject": "Mantras"},
        {"name": "Dussehra (Vijayadashami)", "date": "2026-10-20", "significance": "Triumph of good over evil, marking the end of Navratri", "deity": "Durga", "related_offering_subject": ""},
        {"name": "Karva Chauth", "date": "2026-10-29", "significance": "Married women fast for their husbands' longevity and wellbeing", "deity": "", "related_offering_subject": ""},
        {"name": "Dhanteras", "date": "2026-11-06", "significance": "Worship of wealth and Goddess Lakshmi, start of the Diwali season", "deity": "Lakshmi", "related_offering_subject": ""},
        {"name": "Naraka Chaturdashi (Choti Diwali)", "date": "2026-11-07", "significance": "Commemorates Krishna's victory over the demon Narakasura", "deity": "Krishna", "related_offering_subject": "Bhagavad Gita"},
        {"name": "Diwali (Lakshmi Puja)", "date": "2026-11-08", "significance": "The festival of lights — the main Lakshmi Puja day", "deity": "Lakshmi", "related_offering_subject": ""},
        {"name": "Govardhan Puja", "date": "2026-11-10", "significance": "Commemorates Krishna lifting Govardhan hill to shelter Vraj", "deity": "Krishna", "related_offering_subject": "Bhagavad Gita"},
        {"name": "Bhai Dooj", "date": "2026-11-10", "significance": "Sisters pray for their brothers' long life and wellbeing", "deity": "", "related_offering_subject": ""},
        {"name": "Chhath Puja", "date": "2026-11-14", "significance": "Ancient worship of the Sun God at the river's edge", "deity": "Surya", "related_offering_subject": ""},
        {"name": "Kartik Purnima (Dev Deepawali)", "date": "2026-11-24", "significance": "Full moon of Kartik — mass lamp-lighting at the sacred ghats", "deity": "Shiva", "related_offering_subject": "Mantras"},
        {"name": "Gita Jayanti", "date": "2026-12-20", "significance": "Anniversary of Krishna's recitation of the Bhagavad Gita at Kurukshetra", "deity": "Krishna", "related_offering_subject": "Bhagavad Gita"},
    ]
    for f in CURATED_FESTIVALS_2026_H2:
        if not await db.festivals.find_one({"name": f["name"], "date": f["date"]}):
            await db.festivals.insert_one(f)

    # Blogs / Journal
    if await db.blogs.count_documents({}) == 0:
        blogs = [
            {"slug":"read-your-palm","title":"Palmistry — Your Hands Are Talking","category":"palmistry",
             "excerpt":"You carry a map with you everywhere. And yet, you've never stopped to read it. This is how to begin — with reverence, not superstition.",
             "cover_image":"https://images.unsplash.com/photo-1518709911915-712d5fd04677?w=1200&q=85&auto=format&fit=crop",
             "author_name":"Ācharya Vishwanath Shastri","read_time":"7 min",
             "body":"Palmistry (hasta-sāmudrika) is one of the oldest of the vedāṅga-adjacent disciplines. Long before it became a fairground novelty, it was a rigorous system of correlating the hand — its lines, mounts, and shapes — with the psychology and karma of the person. In the traditional treatment, the hand is not a fortune-telling window but a map of dispositions.\n\nStart with the four elements of the hand: the shape of the palm, the length of the fingers, the flexibility of the thumb, and the texture of the skin. Only after this typology do the classical readers move to the lines — Ayurekha (life), Manasarekha (mind), Hridayarekha (heart), and Bhagyarekha (destiny). Modern popular palmistry often skips typology entirely; classical palmistry begins there.\n\nThis is where we teach it — as a study, not a prophecy."},
            {"slug":"tarot-cosmic-arrow","title":"Tarot — The Cosmic Arrow","category":"tarot",
             "excerpt":"You've heard tarot is 'just for psychics' or 'all fake.' Both miss the point. Here's how to read tarot as a mirror for the mind.",
             "cover_image":"https://images.unsplash.com/photo-1602934585418-f588bea4215c?w=1200&q=85&auto=format&fit=crop",
             "author_name":"Anamika Sharma","read_time":"6 min",
             "body":"Tarot is a set of seventy-eight symbolic images designed to make the intangible legible. The Major Arcana (22 cards) trace the arc of consciousness — from The Fool's first step to The World's completion. The Minor Arcana (56 cards) speak the language of daily life: work, love, conflict, growth.\n\nA tarot reading is not a prediction. It is a structured invitation to attention. When a card lands in the 'Past' position, it does not tell you what happened — it asks: which pattern from before is still moving you? When a card lands in the 'Future,' it does not decide anything — it asks: what direction is your current momentum pointing?\n\nStudied this way, tarot is close cousin to journaling, close cousin to therapy, close cousin to darśana. It is not a way to know the future. It is a way to know yourself before the future arrives."},
            {"slug":"home-luck-vastu","title":"Home, Luck, and Vastu","category":"vastu",
             "excerpt":"Most people blame bad timing. Some blame the economy. A few blame themselves. What if the direction your bed faces has something to say?",
             "cover_image":"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85&auto=format&fit=crop",
             "author_name":"Prem Kumar Mishra","read_time":"9 min",
             "body":"Vāstu-śāstra is the classical Indian science of built space. It predates Feng Shui by a millennium and rests on a different premise: that a dwelling participates in the same directional and elemental order as the cosmos, and that aligning the two produces harmony — not luck, but harmony.\n\nThe eight cardinal and inter-cardinal directions each have a presiding deva and an elemental quality. The northeast (Iśāna) is water and openness. The southwest (Nairṛta) is earth and mass. A well-laid home places the heavy in the heavy direction, the open in the open direction, and lets the elements do their work.\n\nWe teach vāstu as the study of proportion and correspondence — not as a way to attract wealth. Wealth, when it comes, is a by-product of harmony; harmony is the actual teaching."},
            {"slug":"why-gita-still-matters","title":"Why the Bhagavad Gītā Still Matters","category":"gita",
             "excerpt":"Two-thousand-plus years old. Still relevant. Here's why the Gītā is the closest thing we have to a psychological manual for adulthood.",
             "cover_image":"https://images.pexels.com/photos/15235034/pexels-photo-15235034.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
             "author_name":"Ācharya Vishwanath Shastri","read_time":"11 min",
             "body":"Arjuna's crisis on the field of Kurukṣetra is the crisis of anyone who has ever had to act despite being unsure. That is what the Gītā is about. It is not primarily a religious text. It is primarily a manual for how to act in the world without being consumed by the act.\n\nKarma-yoga is one of its answers: do the work, but detach the self from the fruit. Jñāna-yoga is another: understand what you truly are, and the question of action reframes itself. Bhakti-yoga is a third: give the outcome to the Divine and stop carrying it. The Gītā does not force a choice; it holds three doors open.\n\nIt is old, but it is not dated. Adulthood in every century asks the same question Arjuna asks. The Gītā's answer, taught with attribution and rigour, is why our Verse-by-Verse Journey exists."},
            {"slug":"panchang-not-app","title":"Read the Panchang Yourself — Don't Use an App","category":"panchang",
             "excerpt":"A Panchang is a five-limbed calendar. Learning to read it takes an evening. It's more useful than most horoscope apps.",
             "cover_image":"https://images.unsplash.com/photo-1610375461369-d613b564f4c4?w=1200&q=85&auto=format&fit=crop",
             "author_name":"Vishvaa Sureeliya","read_time":"5 min",
             "body":"Pañcāṅga means 'five-limbed.' The five limbs are Tithi (lunar day), Vāra (weekday), Nakṣatra (lunar mansion), Yoga (a specific sun-moon relationship), and Karaṇa (half-tithi). Together they describe the qualitative texture of the day.\n\nMost apps just show them. They do not teach you what to do with them. Our Advanced Panchang course does — because a Tithi is only useful if you know that Ekādaśī is for restraint and Pūrṇimā is for completion; a Nakṣatra is only useful if you know that Puṣya is the friendliest and Mūla the fiercest.\n\nRead the Panchang yourself. Then decide."},
        ]
        for b in blogs:
            b["created_at"] = now_utc().isoformat()
        await db.blogs.insert_many(blogs)
        logger.info("Seeded blogs")

    # Webinars
    if await db.webinars.count_documents({}) == 0:
        base = now_utc()
        webinars = [
            {"title":"Mega Astrology Webinar","cover_image":"https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=1200&q=85&auto=format&fit=crop",
             "starts_at": (base + timedelta(days=2, hours=3)).isoformat(),"duration_min":90,
             "price_inr":99,"orig_price_inr":999,"mentor_name":"Ācharya Vishwanath Shastri",
             "description":"A single-evening intensive on how to actually read a chart. Bring your birth details.",
             "seats_remaining": 43},
            {"title":"Kundli Pathshālā — The Basics","cover_image":"https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=1200&q=85&auto=format&fit=crop",
             "starts_at": (base + timedelta(days=3, hours=8)).isoformat(),"duration_min":75,
             "price_inr":11,"orig_price_inr":99,"mentor_name":"Ananya Iyer",
             "description":"Start reading a kundli in one sitting. From ascendant to bhāvas, live.",
             "seats_remaining": 128},
            {"title":"Numerology Mega Webinar","cover_image":"https://images.unsplash.com/photo-1518709414-8ec7999b32a0?w=1200&q=85&auto=format&fit=crop",
             "starts_at": (base + timedelta(days=5, hours=8, minutes=30)).isoformat(),"duration_min":120,
             "price_inr":99,"orig_price_inr":999,"mentor_name":"Ānanya Iyer",
             "description":"Mulānka, bhāgyānka, and the actual mathematics behind name-numbers.",
             "seats_remaining": 71},
            {"title":"Palmistry — Read Your Palm Live","cover_image":"https://images.unsplash.com/photo-1518709911915-712d5fd04677?w=1200&q=85&auto=format&fit=crop",
             "starts_at": (base + timedelta(days=6, hours=8)).isoformat(),"duration_min":90,
             "price_inr":49,"orig_price_inr":999,"mentor_name":"Prem Kumar Mishra",
             "description":"The four elements of the hand, and the four classical lines. A live diagnostic clinic.",
             "seats_remaining": 22},
            {"title":"Swar Vigyān — Breath as Instrument","cover_image":"https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=85&auto=format&fit=crop",
             "starts_at": (base + timedelta(days=8, hours=8)).isoformat(),"duration_min":150,
             "price_inr":8000,"orig_price_inr":10000,"mentor_name":"Śilpiaa Vermā",
             "description":"Two-evening bootcamp. Go beyond breath — master energy, awareness, consciousness.",
             "seats_remaining": 15},
        ]
        await db.webinars.insert_many(webinars)
        logger.info("Seeded webinars")

    # Mentors
    if await db.mentors.count_documents({}) == 0:
        mentors = [
            {"name":"Ācharya Vishwanath Shastri","title":"Vedas · Upaniṣads · Bhagavad Gītā",
             "avatar":"https://images.unsplash.com/photo-1622902046580-2b47f47f5471?w=800&q=90&auto=format&fit=crop",
             "parampara":"Sringeri Śāradā Pīṭham lineage","order":1,
             "credentials":["PhD, Sanskrit — Banaras Hindu University","Fourth-generation Vedic scholar","25+ years teaching Advaita Vedānta"],
             "bio":"Fourth-generation Vedic scholar specializing in Advaita Vedānta. Signs off on every scriptural course under his name."},
            {"name":"Śilpiaa Vermā","title":"Sādhana · Tantra · Devī Practices",
             "avatar":"https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=800&q=90&auto=format&fit=crop",
             "parampara":"Śrī Vidyā upāsakā lineage","order":2,
             "credentials":["Initiated in Śrī Vidyā","Twelve-year Devī sādhana practitioner","Guides 8,000+ sādhaks annually"],
             "bio":"Ritualist and practitioner. Guides the flagship sādhanas — Varāhī, Kālī, Rudram — through the ritual calendar."},
            {"name":"Prem Kumar Mishra","title":"Lāl Kitāb · Parāśarī · Bhṛgu Nāḍī",
             "avatar":"https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=800&q=90&auto=format&fit=crop",
             "parampara":"Bhṛgu Śāstra tradition, Kashi","order":3,
             "credentials":["Fifth-generation nāḍī reader","Author of two treatises on Lāl Kitāb","Featured on national television"],
             "bio":"Astrology as a technical discipline — not a prediction machine. Teaches Parāśarī, Lāl Kitāb, and Bhṛgu Nāḍī with the same rigour a lawyer brings to a case."},
            {"name":"Vishvaa Sureeliya","title":"Vedic Astrology · KP · Numerology",
             "avatar":"https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=90&auto=format&fit=crop",
             "parampara":"KP Paddhati (Krishnamurti tradition)","order":4,
             "credentials":["KP Astrology certified","Numerology — 12 years","Published researcher"],
             "bio":"The bridge between traditional Vedic and modern KP methods. Teaches with a scientist's discipline."},
            {"name":"Anamikā Sharma","title":"Tarot · Oracle · Shadow Work",
             "avatar":"https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&q=90&auto=format&fit=crop",
             "parampara":"Modern esoteric with Vedāntic framing","order":5,
             "credentials":["Certified Tarot practitioner","Trained in Jungian shadow-work","Live-reads for 3,000+ students"],
             "bio":"Tarot is a mirror. Shadow-work is a discipline. She teaches both as reflective practices, never as prediction."},
            {"name":"Śreyā Kundu","title":"Vedic Astrology · Energy Healing",
             "avatar":"https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=90&auto=format&fit=crop",
             "parampara":"Guru Paramparā, Kolkata","order":6,
             "credentials":["Vedic Astrology — 15 years","Certified in Prāṇic Healing","Rig-Veda recitation trained"],
             "bio":"Combines the diagnostic clarity of jyotiṣa with the practice of energetic hygiene. A quiet, precise teacher."},
            {"name":"Ānanya Iyer","title":"Sanskrit · Grammar · Devanāgarī",
             "avatar":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=90&auto=format&fit=crop",
             "parampara":"Pāṇinīya Vyākaraṇa tradition","order":7,
             "credentials":["PhD, Sanskrit Grammar","Author, Sandhi for Beginners","Trained under Prof. K.R. Vaidyanathan"],
             "bio":"Makes Pāṇini approachable without simplifying him. The Devanāgarī course you finally finish."},
            {"name":"Saurav Chaubey","title":"Astrology · Career & Relationships",
             "avatar":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=90&auto=format&fit=crop",
             "parampara":"Independent, trained under multiple gurus","order":8,
             "credentials":["Jyotiṣa Ratna","Career-focused chart reading — 10 years","Corporate workshops for Fortune-500 firms"],
             "bio":"For learners who want the practical vocabulary of astrology — career transitions, relationship diagnostics — with strict boundaries on prediction."},
        ]
        await db.mentors.insert_many(mentors)
        logger.info("Seeded mentors")

    # Testimonials
    if await db.testimonials.count_documents({}) == 0:
        testimonials = [
            {"name":"Pooja Agarwal","role":"Tarot Reader & Numerologist","rating":5,
             "avatar":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=85&auto=format&fit=crop",
             "quote":"I feel truly grateful to have been a part of your numerology course. Your way of teaching is not just insightful but also deeply inspiring. The clarity with which you explained even the most complex concepts made it easy to understand and apply.",
             "course":"Basic Numerology"},
            {"name":"Ishika Mehta","role":"Learner","rating":5,
             "avatar":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=85&auto=format&fit=crop",
             "quote":"I completed a basic numerology recorded course, and it was truly amazing. The course was easy to follow and provided a great introduction. I learned a lot and found the content engaging.",
             "course":"Introduction to Astrology"},
            {"name":"Santosh R Pandey","role":"Operations Professional","rating":5,
             "avatar":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=85&auto=format&fit=crop",
             "quote":"Actively learning for the last 6 months. What attracted me: teaching style is simple and perfectly paced. Complex subjects explained understandably. Syllabus is well researched and deep. Coverage — got varied occult subjects on a single platform.",
             "course":"Bhagavad Gītā — Verse-by-Verse"},
            {"name":"Alice Kapoor","role":"Occultist","rating":5,
             "avatar":"https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=85&auto=format&fit=crop",
             "quote":"Rādhe Rādhe Guruji. I wanted to express my heartfelt gratitude for the guidance you've shared. Your teaching techniques are amazing. The way you explain through stories and day-to-day lingo is wonderful.",
             "course":"Bhagavad Gītā — Verse-by-Verse"},
            {"name":"Ishita Patil","role":"IT Professional","rating":5,
             "avatar":"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=85&auto=format&fit=crop",
             "quote":"Energy was insane. A surreal experience. And the coordination was mind blowing — there was not a single moment of low energy. Interaction with the Ācharya felt like a dream come true.",
             "course":"Rudram Sādhana"},
            {"name":"Rajesh Kumar","role":"Yoga Teacher","rating":5,
             "avatar":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=85&auto=format&fit=crop",
             "quote":"I have taken many courses online. This is the only one where the Ācharya actually signs off on the accuracy. That single fact gave me the confidence to put the certificate on my résumé.",
             "course":"Sanskrit Foundations"},
        ]
        await db.testimonials.insert_many(testimonials)
        logger.info("Seeded testimonials")

    # Sample community posts
        learner = await db.users.find_one({"email": learner_email})
        if learner:
            await db.community_posts.insert_many([
                {"body":"Reading BG 2.47 for the 7th time this year. Every time it lands differently.",
                 "verse_id": verse_ids[0] if verse_ids else "", "author_id": str(learner["_id"]),
                 "author_name": learner.get("name",""), "created_at": now_utc().isoformat(), "flagged": False},
                {"body":"Anyone else find the Nāsadīya Sūkta the most humbling hymn in the Ṛgveda?",
                 "verse_id": verse_ids[3] if len(verse_ids)>3 else "", "author_id": str(learner["_id"]),
                 "author_name": learner.get("name",""), "created_at": now_utc().isoformat(), "flagged": False},
            ])

    # Write test creds
    creds_path = ROOT_DIR.parent / "memory" / "test_credentials.md"
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(f"""# Tredev Learn — Test Credentials

## Super Admin (only role that can revoke certificates / appoint admins)
- Email: `{super_email}`
- Password: `{super_pass}`

## Admin
- Email: `{admin_email}`
- Password: `{admin_pass}`

## Academic Staff (course builder, quizzes, grading, doubts, consultations)
- Email: `staff@tredevlearn.com`
- Password: `Staff@123`

## Acharya (accuracy sign-off; content approval queue)
- Email: `acharya@tredevlearn.com`
- Password: `Acharya@123`

## Learner
- Email: `learner@tredevlearn.com`
- Password: `Learner@123`

## Auth endpoints
- POST /api/auth/register (learners only)
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
""")


@app.on_event("startup")
async def on_startup():
    # 1) Postgres pool + schema, 2) Firebase Admin SDK, 3) seed.
    await dbmod.connect(DATABASE_URL)
    schema_path = ROOT_DIR / "schema.sql"
    if schema_path.exists():
        await dbmod.run_sql(schema_path.read_text())
        logger.info("Schema ensured")
    ensure_storage_bucket()
    ensure_chat_media_bucket()
    ensure_acharya_media_bucket()
    ensure_mantra_audio_bucket()
    ensure_batch_schedule_bucket()
    try:
        firebase_auth.init_firebase()
    except Exception as e:
        logger.exception(f"Firebase init failed: {e}")
    try:
        await seed_admin_and_data()
        logger.info("Startup seed complete")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")
    try:
        await chat.ensure_default_channels()
    except Exception as e:
        logger.exception(f"Chat channel seed failed: {e}")
    asyncio.create_task(chat.cleanup_loop())


@app.on_event("shutdown")
async def on_shutdown():
    await dbmod.close()
