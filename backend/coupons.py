"""
Coupons — self-contained APIRouter module. See admin.py's docstring for why
auth helpers are duplicated here instead of imported from server.py.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple

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
class CouponIn(BaseModel):
    code: str
    discount_type: str = "percent"  # percent | flat_inr
    discount_value: int
    offering_id: Optional[str] = None  # None = applies to any course
    max_uses: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_special: bool = False


# ==================== CRUD (admin/super_admin) ====================
@router.get("/coupons")
async def list_coupons(actor: dict = Depends(require_role("super_admin"))):
    return await db.coupons.find({}).sort("created_at", -1).to_list(500)


@router.post("/coupons")
async def create_coupon(data: CouponIn, actor: dict = Depends(require_role("super_admin"))):
    doc = data.model_dump()
    doc["code"] = doc["code"].strip().upper()
    doc["used_count"] = 0
    doc["active"] = True
    doc["created_by"] = actor["id"]
    doc["created_at"] = now_utc().isoformat()
    result = await db.coupons.insert_one(doc)
    await write_audit(actor, "coupon.create", str(result.inserted_id), {"code": doc["code"]})
    doc["id"] = str(result.inserted_id)
    return doc


@router.patch("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, data: dict, actor: dict = Depends(require_role("super_admin"))):
    data.pop("id", None)
    if "code" in data:
        data["code"] = data["code"].strip().upper()
    await db.coupons.update_one({"_id": ObjectId(coupon_id)}, {"$set": data})
    await write_audit(actor, "coupon.update", coupon_id, data)
    return await db.coupons.find_one({"_id": ObjectId(coupon_id)})


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, actor: dict = Depends(require_role("super_admin"))):
    await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    await write_audit(actor, "coupon.delete", coupon_id)
    return {"ok": True}


# ==================== CHECKOUT HOOK (called from server.py's create_order) ====================
async def apply_coupon(code: str, offering_id: str, amount_inr: int) -> Tuple[int, Optional[str]]:
    """Validate + apply a coupon at checkout. Returns (discounted_amount_inr, coupon_id).
    Raises HTTPException(400) with a user-facing message if the coupon can't be used."""
    if not code:
        return amount_inr, None
    c = await db.coupons.find_one({"code": code.strip().upper()})
    if not c or not c.get("active"):
        raise HTTPException(400, "Invalid coupon code")
    if c.get("offering_id") and c["offering_id"] != offering_id:
        raise HTTPException(400, "This coupon does not apply to this course")
    now = now_utc().isoformat()
    if c.get("valid_from") and now < c["valid_from"]:
        raise HTTPException(400, "This coupon is not active yet")
    if c.get("valid_until") and now > c["valid_until"]:
        raise HTTPException(400, "This coupon has expired")
    if c.get("max_uses") is not None and c.get("used_count", 0) >= c["max_uses"]:
        raise HTTPException(400, "This coupon has reached its usage limit")
    discount = (amount_inr * c["discount_value"] // 100) if c["discount_type"] == "percent" else c["discount_value"]
    new_amount = max(0, amount_inr - discount)
    # ponytail: read-then-write increment, single mocked-payment process — add a
    # DB-side atomic increment if this ever needs to survive real concurrent checkouts.
    await db.coupons.update_one({"_id": ObjectId(c["id"])}, {"$set": {"used_count": c.get("used_count", 0) + 1}})
    return new_amount, c["id"]
