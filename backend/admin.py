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
@router.patch("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"suspended": True}})
    await write_audit(actor, "user.suspend", user_id)
    return {"ok": True}


@router.patch("/admin/users/{user_id}/reactivate")
async def reactivate_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"suspended": False}})
    await write_audit(actor, "user.reactivate", user_id)
    return {"ok": True}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Soft-delete only: users.id is referenced by payments/enrollments/audit_log,
    so this blocks login rather than removing the row (see docs/PERMISSIONS_AND_ACCESS.md §3.2)."""
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_deleted": True}})
    await write_audit(actor, "user.delete", user_id)
    return {"ok": True}


@router.post("/admin/users/{user_id}/force-logout")
async def force_logout_user(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Soft force-logout — see docs/PERMISSIONS_AND_ACCESS.md §3.1 for the real
    limitation (a silent Firebase token refresh can outrun this without the Admin SDK)."""
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"force_logout_at": now_utc().isoformat()}})
    await write_audit(actor, "user.force_logout", user_id)
    return {"ok": True}


@router.post("/admin/users/{user_id}/reset-password")
async def trigger_password_reset(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    await firebase_auth.send_password_reset(user["email"])
    await write_audit(actor, "user.reset_password", user_id)
    return {"ok": True}


@router.get("/admin/users/{user_id}/detail")
async def user_detail(user_id: str, actor: dict = Depends(require_role("admin", "super_admin"))):
    """Profile + purchase/progress history for the admin Users tab."""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    enrollments = await db.enrollments.find({"user_id": user_id}).to_list(500)
    payments = await db.payments.find({"user_id": user_id}).to_list(500)
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
    }


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
async def list_purchases(actor: dict = Depends(require_role("super_admin"))):
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
async def admin_dashboard(actor: dict = Depends(require_role("super_admin"))):
    payments = await db.payments.find({}).to_list(10000)
    paid = [p for p in payments if p.get("status") == "paid"]
    pending = [p for p in payments if p.get("status") == "created"]
    failed = [p for p in payments if p.get("status") == "failed"]
    by_course: Dict[str, int] = {}
    for p in paid:
        oid = p.get("offering_id")
        if oid:
            by_course[oid] = by_course.get(oid, 0) + p.get("amount_inr", 0)
    top = sorted(by_course.items(), key=lambda kv: kv[1], reverse=True)[:10]
    revenue_by_course = []
    for oid, amt in top:
        o = await db.offerings.find_one({"_id": ObjectId(oid)})
        revenue_by_course.append({"offering_id": oid, "title": o.get("title") if o else oid, "revenue_inr": amt})
    return {
        "revenue_inr": sum(p.get("amount_inr", 0) for p in paid),
        "transactions": len(paid),
        "pending_payments": len(pending),
        "failed_payments": len(failed),
        "revenue_by_course": revenue_by_course,
    }


@router.get("/admin/top-courses")
async def top_courses(actor: dict = Depends(require_role("super_admin"))):
    enrollments = await db.enrollments.find({}).to_list(20000)
    counts: Dict[str, int] = {}
    for e in enrollments:
        oid = e.get("offering_id")
        if oid:
            counts[oid] = counts.get(oid, 0) + 1
    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    result = []
    for oid, n in top:
        o = await db.offerings.find_one({"_id": ObjectId(oid)})
        result.append({"offering_id": oid, "title": o.get("title") if o else oid, "enrollments": n})
    return result
