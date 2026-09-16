"""
Admin / Super-Admin platform — self-contained APIRouter module.

Duplicates a small slice of server.py's auth helpers (get_current_user,
require_role, sanitize_user, write_audit) instead of importing them: server.py
imports this module at startup, so importing server.py back here would be
circular. Mirrors the same pattern chat.py already uses for the same reason.
"""
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db import db
import firebase_auth
from firebase_auth import AuthError

router = APIRouter()

STAFF_ROLES = ("academic_staff", "admin", "super_admin")


async def _staff_user_ids() -> set:
    """Ids of staff/admin/super_admin accounts — these get free, un-gated
    course access by role (see CourseDetail.js) and must never count as real
    enrollments in the revenue/enrollment reports below."""
    staff = await db.users.find({"role": {"$in": list(STAFF_ROLES)}}).to_list(10000)
    return {str(u.get("_id", u.get("id", ""))) for u in staff}


def now_utc():
    return datetime.now(timezone.utc)


def ObjectId(x):
    return str(x)


def sanitize_user(u: dict) -> dict:
    if not u:
        return u
    u = dict(u)
    u["id"] = str(u.get("_id", u.get("id", "")))
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u


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


async def write_audit(actor: dict, action: str, target: str = "", meta: dict = None):
    await db.audit_log.insert_one({
        "actor_id": actor.get("id"), "actor_email": actor.get("email"),
        "actor_role": actor.get("role"), "action": action, "target": target,
        "meta": meta or {}, "created_at": now_utc().isoformat(),
    })


# ==================== MODELS ====================
class AdminCreateIn(BaseModel):
    email: str
    password: str
    name: str


class BulkOfferingActionIn(BaseModel):
    ids: List[str]
    action: str  # publish | unpublish | archive | unarchive


# ==================== USER LIFECYCLE ====================
async def _guard_super_admin_target(actor: dict, user_id: str) -> dict:
    """A plain admin must never suspend, delete, force-logout, reset the
    password of, or otherwise act on a super_admin account — only another
    super_admin can. Returns the target user doc (so callers needn't re-fetch)."""
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("role") == "super_admin" and actor["role"] != "super_admin":
        raise HTTPException(403, "Only super_admin can act on a super_admin account")
    return target


@router.patch("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    await _guard_super_admin_target(actor, user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"suspended": True}})
    await write_audit(actor, "user.suspend", user_id)
    return {"ok": True}


@router.patch("/admin/users/{user_id}/reactivate")
async def reactivate_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    await _guard_super_admin_target(actor, user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"suspended": False}})
    await write_audit(actor, "user.reactivate", user_id)
    return {"ok": True}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Soft-delete only: users.id is referenced by payments/enrollments/audit_log,
    so this blocks login rather than removing the row (see docs/PERMISSIONS_AND_ACCESS.md §3.2)."""
    await _guard_super_admin_target(actor, user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_deleted": True}})
    await write_audit(actor, "user.delete", user_id)
    return {"ok": True}


@router.post("/admin/users/{user_id}/force-logout")
async def force_logout_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Force-logout: always applies the soft check (force_logout_at), and
    additionally does a hard revoke_refresh_tokens() when the Firebase Admin
    SDK is configured — see docs/PERMISSIONS_AND_ACCESS.md §3.1."""
    await _guard_super_admin_target(actor, user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"force_logout_at": now_utc().isoformat()}})
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    hard = False
    if user and user.get("firebase_uid"):
        hard = await firebase_auth.revoke_refresh_tokens(user["firebase_uid"])
    await write_audit(actor, "user.force_logout", user_id, {"hard_revoke": hard})
    return {"ok": True, "hard_revoke": hard}


@router.post("/admin/users/{user_id}/reset-password")
async def trigger_password_reset(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    user = await _guard_super_admin_target(actor, user_id)
    await firebase_auth.send_password_reset(user["email"])
    await write_audit(actor, "user.reset_password", user_id)
    return {"ok": True}


@router.get("/admin/users/{user_id}/detail")
async def user_detail(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Profile + history for the admin Users tab "view profile & history" action —
    shaped by role, since a learner's purchase/enrollment history, a staff
    member's query-handling record, and an ācharya's teaching load are each a
    different kind of "history"."""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    role = user.get("role", "learner")

    if role == "academic_staff":
        assigned = await db.query_tickets.find({"assigned_staff_id": user_id}).to_list(2000)
        closed = [t for t in assigned if t.get("status") == "CLOSED"]
        open_now = [t for t in assigned if t.get("status") != "CLOSED"]
        escalated_by_them = await db.query_tickets.find({"escalated_by": user_id}).to_list(2000)
        return {
            "user": sanitize_user(user),
            "staff_report": {
                "queries_claimed": len(assigned),
                "queries_closed": len(closed),
                "queries_open": len(open_now),
                "queries_escalated": len(escalated_by_them),
            },
        }

    if role == "acharya":
        courses = await db.offerings.find({"acharya_id": user_id}).to_list(500)
        course_ids = {str(c.get("_id", c.get("id", ""))) for c in courses}
        all_enrollments = await db.enrollments.find({}).to_list(20000)
        all_payments = await db.payments.find({}).to_list(20000)
        total_enrollments = sum(1 for e in all_enrollments if e.get("offering_id") in course_ids)
        total_revenue = sum(p.get("amount_inr", 0) for p in all_payments
                            if p.get("status") == "paid" and p.get("offering_id") in course_ids)
        return {
            "user": sanitize_user(user),
            "acharya_report": {
                "courses_taught": len(courses),
                "courses": [{"id": str(c.get("_id", c.get("id", ""))), "title": c.get("title", ""),
                             "is_published": c.get("is_published", False)} for c in courses],
                "total_enrollments": total_enrollments,
                "total_revenue_inr": total_revenue,
            },
        }

    # learner (default): enrollments + progress + purchase history
    enrollments = await db.enrollments.find({"user_id": user_id}).to_list(500)
    payments = await db.payments.find({"user_id": user_id}).to_list(500)
    quiz_attempts = await db.quiz_attempts.find({"user_id": user_id}).to_list(500)
    titles = {}
    for e in enrollments:
        oid = e.get("offering_id")
        if oid and oid not in titles:
            o = await db.offerings.find_one({"_id": ObjectId(oid)})
            titles[oid] = o.get("title", "") if o else ""
    return {
        "user": sanitize_user(user),
        "enrollments": [{**e, "offering_title": titles.get(e.get("offering_id"), "")} for e in enrollments],
        "payments": payments,
        "quiz_performance": {
            "attempts": len(quiz_attempts),
            "average_score": round(sum(a.get("total_score", a.get("score", 0)) for a in quiz_attempts) / len(quiz_attempts), 1)
                             if quiz_attempts else None,
        },
    }


# ==================== COURSE -> ENROLLED STUDENTS DRILL-DOWN ====================
async def _roster(where: dict) -> List[dict]:
    """Enrolled-learner roster (name/email/basic detail) for a set of
    enrollments. No SQL join helper exists on this Mongo-style db shim (see
    db.py), so this is a manual per-enrollment user lookup — same style as
    user_detail's per-enrollment offering-title lookups above."""
    enrollments = await db.enrollments.find(where).sort("enrolled_at", 1).to_list(2000)
    out = []
    for e in enrollments:
        u = await db.users.find_one({"_id": ObjectId(e["user_id"])}) if e.get("user_id") else None
        out.append({
            "id": e.get("id"), "user_id": e.get("user_id"), "name": (u or {}).get("name", ""),
            "email": (u or {}).get("email", ""), "enrolled_at": e.get("enrolled_at"),
            "progress": e.get("progress", 0), "status": e.get("status", "active"),
            "suspended": e.get("suspended", False),
        })
    return out


@router.get("/admin/offerings/{offering_id}/students")
async def offering_students(offering_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Recorded-course roster — every learner enrolled in this offering."""
    return await _roster({"offering_id": offering_id})


@router.get("/admin/offerings/{offering_id}/batches-with-students")
async def offering_batches_with_students(offering_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Live-course roster, grouped by batch (cohort)."""
    batches = await db.batches.find({"offering_id": offering_id}).sort("start_date", 1).to_list(200)
    out = []
    for b in batches:
        bid = str(b.get("_id", b.get("id", "")))
        out.append({"batch_id": bid, "batch_name": b.get("name", ""),
                     "students": await _roster({"batch_id": bid})})
    return out


# ==================== ENROLLMENT LIFECYCLE (per-course/batch access) ====================
async def _guard_enrollment_actor(actor: dict, enrollment_id: str) -> dict:
    """Same super_admin-protects-super_admin rule as _guard_super_admin_target,
    applied to the enrollment's owning user instead of a user_id path param."""
    enrollment = await db.enrollments.find_one({"_id": ObjectId(enrollment_id)})
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")
    target_user = await db.users.find_one({"_id": ObjectId(enrollment["user_id"])}) if enrollment.get("user_id") else None
    if target_user and target_user.get("role") == "super_admin" and actor["role"] != "super_admin":
        raise HTTPException(403, "Only super_admin can act on a super_admin account")
    return enrollment


@router.patch("/admin/enrollments/{enrollment_id}/suspend")
async def suspend_enrollment(enrollment_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Restrict one learner's access to one course/batch — blocks lesson
    playback and progress tracking (see server.py get_lesson_playback /
    record_lesson_watch) without touching their account or other enrollments."""
    await _guard_enrollment_actor(actor, enrollment_id)
    await db.enrollments.update_one({"_id": ObjectId(enrollment_id)}, {"$set": {"suspended": True}})
    await write_audit(actor, "enrollment.suspend", enrollment_id)
    return {"ok": True}


@router.patch("/admin/enrollments/{enrollment_id}/reactivate")
async def reactivate_enrollment(enrollment_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    await _guard_enrollment_actor(actor, enrollment_id)
    await db.enrollments.update_one({"_id": ObjectId(enrollment_id)}, {"$set": {"suspended": False}})
    await write_audit(actor, "enrollment.reactivate", enrollment_id)
    return {"ok": True}


@router.delete("/admin/enrollments/{enrollment_id}")
async def remove_enrollment(enrollment_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Fully unenroll a learner from a course/batch. Unlike suspend, this is not
    reversible from this screen — re-enrolling needs a fresh purchase or a new
    manual grant."""
    await _guard_enrollment_actor(actor, enrollment_id)
    await db.enrollments.delete_one({"_id": ObjectId(enrollment_id)})
    await write_audit(actor, "enrollment.remove", enrollment_id)
    return {"ok": True}


# ==================== ADMIN CREATION (super_admin only) ====================
@router.post("/admin/create-admin")
async def create_admin(data: AdminCreateIn, actor: dict = Depends(require_role("super_admin"))):
    try:
        uid, _ = await firebase_auth.sign_up(data.email, data.password)
    except AuthError as e:
        raise HTTPException(e.status, e.message)
    doc = {
        "firebase_uid": uid, "email": data.email, "name": data.name,
        "role": "admin", "created_at": now_utc().isoformat(),
    }
    result = await db.users.insert_one(doc)
    await write_audit(actor, "admin.create", str(result.inserted_id), {"email": data.email})
    doc["id"] = str(result.inserted_id)
    return sanitize_user(doc)


# ==================== BULK COURSE ACTIONS ====================
_BULK_ACTIONS = {
    "publish": {"is_published": True},
    "unpublish": {"is_published": False},
    "archive": {"is_archived": True},
    "unarchive": {"is_archived": False},
}


@router.patch("/admin/offerings/bulk")
async def bulk_offering_action(data: BulkOfferingActionIn, actor: dict = Depends(require_role("admin", "super_admin"))):
    patch = _BULK_ACTIONS.get(data.action)
    if not patch:
        raise HTTPException(400, f"Unknown action '{data.action}'")
    for oid in data.ids:
        await db.offerings.update_one({"_id": ObjectId(oid)}, {"$set": patch})
    await write_audit(actor, f"offering.bulk_{data.action}", "", {"ids": data.ids})
    return {"ok": True, "count": len(data.ids)}


# ==================== PURCHASE LOG / DASHBOARD ====================
@router.get("/admin/purchases")
async def list_purchases(actor: dict = Depends(require_role("admin", "super_admin"))):
    payments = await db.payments.find({}).sort("created_at", -1).limit(1000).to_list(1000)
    result = []
    for p in payments:
        user = await db.users.find_one({"_id": ObjectId(p.get("user_id"))}) if p.get("user_id") else None
        offering = await db.offerings.find_one({"_id": ObjectId(p.get("offering_id"))}) if p.get("offering_id") else None
        result.append({
            **p,
            "user_email": user.get("email", "") if user else "",
            "user_name": user.get("name", "") if user else "",
            "offering_title": offering.get("title", "") if offering else "",
        })
    return result


@router.get("/admin/dashboard")
async def admin_dashboard(actor: dict = Depends(require_role("admin", "super_admin"))):
    payments = await db.payments.find({}).to_list(10000)
    paid = [p for p in payments if p.get("status") == "paid"]
    pending = [p for p in payments if p.get("status") == "created"]
    failed = [p for p in payments if p.get("status") == "failed"]
    by_course: Dict[str, int] = {}
    course_revenue_inr = 0
    webinar_revenue_inr = 0
    for p in paid:
        amt = p.get("amount_inr", 0)
        oid = p.get("offering_id")
        if oid:
            by_course[oid] = by_course.get(oid, 0) + amt
            course_revenue_inr += amt
        elif p.get("webinar_id"):
            webinar_revenue_inr += amt
    top = sorted(by_course.items(), key=lambda kv: kv[1], reverse=True)[:10]
    revenue_by_course = []
    for oid, amt in top:
        o = await db.offerings.find_one({"_id": ObjectId(oid)})
        revenue_by_course.append({"offering_id": oid, "title": o.get("title") if o else oid, "revenue_inr": amt})
    return {
        # Total = courses + webinars combined; course/webinar revenue below are
        # each individual — the dashboard shows both, never just one number.
        "revenue_inr": course_revenue_inr + webinar_revenue_inr,
        "course_revenue_inr": course_revenue_inr,
        "webinar_revenue_inr": webinar_revenue_inr,
        "transactions": len(paid),
        "pending_payments": len(pending),
        "failed_payments": len(failed),
        "revenue_by_course": revenue_by_course,
    }


@router.get("/admin/top-courses")
async def top_courses(actor: dict = Depends(require_role("admin", "super_admin"))):
    enrollments = await db.enrollments.find({}).to_list(20000)
    staff_ids = await _staff_user_ids()
    counts: Dict[str, int] = {}
    for e in enrollments:
        oid = e.get("offering_id")
        if oid and e.get("user_id") not in staff_ids:
            counts[oid] = counts.get(oid, 0) + 1
    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    result = []
    for oid, n in top:
        o = await db.offerings.find_one({"_id": ObjectId(oid)})
        result.append({"offering_id": oid, "title": o.get("title") if o else oid, "enrollments": n})
    return result


@router.get("/admin/webinars-report")
async def webinars_report(actor: dict = Depends(require_role("admin", "super_admin"))):
    """Webinar equivalent of the course dashboard: per-webinar session time,
    cost, attendance and revenue, plus a per-month rollup (webinars conducted,
    people joined, revenue) for the monthly bar chart."""
    webinars = await db.webinars.find({}).to_list(1000)
    payments = await db.payments.find({}).to_list(20000)
    revenue_by_webinar: Dict[str, int] = {}
    for p in payments:
        wid = p.get("webinar_id")
        if wid and p.get("status") == "paid":
            revenue_by_webinar[wid] = revenue_by_webinar.get(wid, 0) + p.get("amount_inr", 0)

    rows = []
    monthly: Dict[str, Dict[str, int]] = {}
    for w in webinars:
        wid = str(w.get("_id", w.get("id", "")))
        registered_count = len(w.get("registered_user_ids") or [])
        revenue = revenue_by_webinar.get(wid, 0)
        rows.append({
            "webinar_id": wid,
            "title": w.get("title", ""),
            "starts_at": w.get("starts_at", ""),
            "duration_min": w.get("duration_min", 0),
            "price_inr": w.get("price_inr", 0),
            "registered_count": registered_count,
            "revenue_inr": revenue,
        })
        mk = _month_key(w.get("starts_at", ""))
        if mk:
            monthly.setdefault(mk, {"webinars_conducted": 0, "registered_count": 0, "revenue_inr": 0})
            monthly[mk]["webinars_conducted"] += 1
            monthly[mk]["registered_count"] += registered_count
            monthly[mk]["revenue_inr"] += revenue
    rows.sort(key=lambda r: r["starts_at"], reverse=True)
    return {
        "webinars": rows,
        "monthly": [{"month": mk, **vals} for mk, vals in sorted(monthly.items())],
        "total_registered": sum(r["registered_count"] for r in rows),
        "total_revenue_inr": sum(r["revenue_inr"] for r in rows),
    }


@router.get("/admin/webinar/{webinar_id}/report")
async def webinar_detail_report(webinar_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Drill-down behind one webinar row: its own numbers plus who actually
    registered — the "who joined" list the dashboard links out to."""
    w = await db.webinars.find_one({"_id": ObjectId(webinar_id)})
    if not w:
        raise HTTPException(404, "Webinar not found")
    payments = await db.payments.find({}).to_list(20000)
    revenue = sum(p.get("amount_inr", 0) for p in payments
                  if p.get("webinar_id") == webinar_id and p.get("status") == "paid")
    attendee_ids = w.get("registered_user_ids") or []
    attendees = []
    for uid in attendee_ids:
        u = await db.users.find_one({"_id": ObjectId(uid)})
        if u:
            attendees.append({"user_id": uid, "name": u.get("name", ""), "email": u.get("email", "")})
    return {
        "webinar_id": webinar_id,
        "title": w.get("title", ""),
        "starts_at": w.get("starts_at", ""),
        "duration_min": w.get("duration_min", 0),
        "price_inr": w.get("price_inr", 0),
        "registered_count": len(attendee_ids),
        "revenue_inr": revenue,
        "attendees": attendees,
    }


@router.get("/admin/enrollments-index")
async def enrollments_index(actor: dict = Depends(require_role("admin", "super_admin"))):
    """Minimal (user_id, offering_id, batch_id) rows for every enrollment —
    lets the Users tab filter learners by course/batch without an N+1 fetch
    per row."""
    enrollments = await db.enrollments.find({}).to_list(20000)
    return [
        {"user_id": e.get("user_id"), "offering_id": e.get("offering_id"), "batch_id": e.get("batch_id")}
        for e in enrollments
    ]


# ==================== PER-COURSE DASHBOARD DRILL-DOWN ====================
def _month_key(iso_ts: str) -> str:
    """'2026-03-14T...' -> '2026-03'; blank/unparseable timestamps are dropped
    by the caller, never grouped under a fake key."""
    return (iso_ts or "")[:7]


@router.get("/admin/course/{offering_id}/report")
async def course_report(offering_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Detail behind a dashboard donut-chart slice: this course's total revenue
    and enrollments, its rank among all courses by each, and a 12-month trend —
    everything the "click a course, see its numbers" dashboard requirement needs."""
    offering = await db.offerings.find_one({"_id": ObjectId(offering_id)})
    if not offering:
        raise HTTPException(404, "Course not found")

    all_payments = await db.payments.find({}).to_list(20000)
    all_enrollments = await db.enrollments.find({}).to_list(20000)
    staff_ids = await _staff_user_ids()

    revenue_by_course: Dict[str, int] = {}
    enrollments_by_course: Dict[str, int] = {}
    monthly: Dict[str, Dict[str, int]] = {}
    for p in all_payments:
        if p.get("status") != "paid":
            continue
        oid = p.get("offering_id")
        if not oid:
            continue
        revenue_by_course[oid] = revenue_by_course.get(oid, 0) + p.get("amount_inr", 0)
        if oid == offering_id:
            mk = _month_key(p.get("paid_at") or p.get("created_at"))
            if mk:
                monthly.setdefault(mk, {"revenue_inr": 0, "enrollments": 0})
                monthly[mk]["revenue_inr"] += p.get("amount_inr", 0)
    for e in all_enrollments:
        oid = e.get("offering_id")
        if not oid or e.get("user_id") in staff_ids:
            continue
        enrollments_by_course[oid] = enrollments_by_course.get(oid, 0) + 1
        if oid == offering_id:
            mk = _month_key(e.get("enrolled_at"))
            if mk:
                monthly.setdefault(mk, {"revenue_inr": 0, "enrollments": 0})
                monthly[mk]["enrollments"] += 1

    def rank_of(by_course: Dict[str, int]) -> int:
        ordered = sorted(by_course.items(), key=lambda kv: kv[1], reverse=True)
        for i, (oid, _) in enumerate(ordered):
            if oid == offering_id:
                return i + 1
        return len(ordered) + 1  # this course has zero revenue/enrollments — ranks last

    return {
        "offering_id": offering_id,
        "title": offering.get("title", ""),
        "total_revenue_inr": revenue_by_course.get(offering_id, 0),
        "total_enrollments": enrollments_by_course.get(offering_id, 0),
        "revenue_rank": rank_of(revenue_by_course),
        "revenue_rank_of": len(revenue_by_course),
        "enrollment_rank": rank_of(enrollments_by_course),
        "enrollment_rank_of": len(enrollments_by_course),
        "monthly": [
            {"month": mk, **vals} for mk, vals in sorted(monthly.items())
        ],
    }
