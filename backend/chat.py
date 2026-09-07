"""
Community Chat — self-contained APIRouter module.

Duplicates a small slice of server.py's auth helpers (get_current_user,
sanitize_user) instead of importing them: server.py imports this module at
startup, so importing server.py back here would be circular.
"""
import logging
import asyncio
import os
import re
import secrets
import time
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from db import db
import firebase_auth
from firebase_auth import AuthError

logger = logging.getLogger(__name__)

STAFF_ROLES = ("academic_staff", "admin", "super_admin")
RETENTION_DAYS = 60
CHAT_MEDIA_BUCKET = os.environ.get("CHAT_MEDIA_BUCKET", "chat-media")
CHAT_MEDIA_MIME_TYPES = ("image/png", "image/jpeg", "image/gif", "image/webp")

# ponytail: default list is a small, easily-extended starting set, not exhaustive
_BLOCKED_WORDS = {
    "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "piss",
    "slut", "whore", "nigger", "faggot", "retard",
}
_BLOCKED_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in _BLOCKED_WORDS) + r")\b", re.IGNORECASE)

# ponytail: in-memory, single-process only — this app runs one uvicorn
# process; move to Redis (or similar) if this ever runs multi-process/scaled.
_recent_sends: dict[str, list[float]] = {}
_last_message: dict[str, str] = {}
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW_SECS = 10


def now_utc():
    return datetime.now(timezone.utc)


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
    if _is_locked_out(user, token):
        raise HTTPException(status_code=401, detail="Account suspended")
    return sanitize_user(user)


def _is_locked_out(user: dict, token: str) -> bool:
    """Mirrors server.py's suspend/soft-delete/force-logout check (duplicated
    here, not imported, to avoid a circular import with server.py)."""
    if user.get("suspended") or user.get("is_deleted"):
        return True
    force_logout_at = user.get("force_logout_at")
    if force_logout_at:
        try:
            cutoff = datetime.fromisoformat(force_logout_at).timestamp()
        except ValueError:
            cutoff = 0
        if firebase_auth.token_issued_at(token) < cutoff:
            return True
    return False


async def get_current_user_optional(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except Exception:
        return None


async def check_chat_enabled():
    toggle = await db.feature_toggles.find_one({"key": "community_chat"})
    if toggle and toggle.get("enabled") is False:
        raise HTTPException(status_code=403, detail="Community Chat is currently disabled")


def is_staff(user: Optional[dict]) -> bool:
    return bool(user) and user.get("role") in STAFF_ROLES


async def is_locked(channel: dict, user: Optional[dict]) -> bool:
    if channel["type"] == "PUBLIC":
        return False
    if is_staff(user):
        return False
    if not user:
        return True
    if channel["type"] == "COURSE_PRIVATE":
        return not await db.enrollments.find_one({"user_id": user["id"], "offering_id": channel["course_id"]})
    if channel["type"] == "INVITE_ONLY":
        return not await db.chat_channel_members.find_one({"channel_id": channel["id"], "user_id": user["id"]})
    return True


async def can_write(channel: dict, user: Optional[dict]) -> bool:
    if not user:
        return False
    if is_staff(user):
        return True  # staff can always post, in any channel, regardless of the read-only toggle
    if channel["type"] != "PUBLIC" and await is_locked(channel, user):
        return False
    return not channel.get("is_read_only")


async def can_read(channel: dict, user: Optional[dict]) -> bool:
    if channel["type"] == "PUBLIC":
        return True
    return not await is_locked(channel, user)


async def channel_view(channel: dict, user: Optional[dict]) -> dict:
    course_title = None
    if channel.get("course_id"):
        course = await db.offerings.find_one({"_id": channel["course_id"]})
        course_title = course["title"] if course else None
    locked = await is_locked(channel, user)
    return {
        "id": channel["id"],
        "name": channel["name"],
        "type": channel["type"],
        "course_id": channel.get("course_id"),
        "course_title": course_title,
        "is_read_only": channel.get("is_read_only", False),
        "locked": locked,
        "can_write": await can_write(channel, user),
        "join_token": channel.get("join_token") if is_staff(user) else None,
    }


CONNECTIONS: dict = {}


async def broadcast(channel_id: str, payload: dict):
    for ws in list(CONNECTIONS.get(channel_id, set())):
        try:
            await ws.send_json(payload)
        except Exception:
            CONNECTIONS.get(channel_id, set()).discard(ws)


async def broadcast_channels_changed():
    """Tell every socket connected to ANY channel that the channel list changed
    (one created/updated/deleted), so listeners re-fetch GET /channels instead of
    needing a page reload. Carries no channel data itself — list_channels already
    applies the per-viewer visibility rules (INVITE_ONLY membership, etc.), so
    re-fetching there is what stays safe rather than broadcasting a channel_view
    computed for one viewer to every connected socket."""
    for ws in list({ws for conns in CONNECTIONS.values() for ws in conns}):
        try:
            await ws.send_json({"type": "channels_changed"})
        except Exception:
            pass


class ChannelCreate(BaseModel):
    name: str
    type: str = "PUBLIC"
    course_id: Optional[str] = None
    is_read_only: bool = False


class ChannelUpdate(BaseModel):
    is_read_only: Optional[bool] = None


router = APIRouter()


@router.get("/channels")
async def list_channels(user: Optional[dict] = Depends(get_current_user_optional)):
    await check_chat_enabled()
    where = {"type": "PUBLIC"} if not user else {}
    channels = await db.chat_channels.find(where).sort("created_at", 1).to_list(1000)
    visible = []
    for c in channels:
        if c["type"] == "INVITE_ONLY" and not is_staff(user):
            is_member = bool(user) and await db.chat_channel_members.find_one(
                {"channel_id": c["id"], "user_id": user["id"]})
            if not is_member:
                continue
        visible.append(c)
    return {"channels": [await channel_view(c, user) for c in visible]}


@router.post("/channels", status_code=201)
async def create_channel(data: ChannelCreate, user: dict = Depends(get_current_user)):
    await check_chat_enabled()
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff only")
    if data.type not in ("PUBLIC", "COURSE_PRIVATE", "INVITE_ONLY"):
        raise HTTPException(status_code=400, detail="Invalid channel type")
    name = data.name.strip().lstrip("#").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    if data.type == "COURSE_PRIVATE":
        if not data.course_id:
            raise HTTPException(status_code=400, detail="course_id required for COURSE_PRIVATE")
        if not await db.offerings.find_one({"_id": data.course_id}):
            raise HTTPException(status_code=404, detail="Course not found")
    doc = {
        "name": name, "type": data.type,
        "course_id": data.course_id if data.type == "COURSE_PRIVATE" else None,
        "is_read_only": data.is_read_only, "created_at": now_utc().isoformat(),
        "created_by": user["id"],
    }
    if data.type == "INVITE_ONLY":
        doc["join_token"] = secrets.token_urlsafe(16)
    res = await db.chat_channels.insert_one(doc)
    channel = await db.chat_channels.find_one({"_id": res.inserted_id})
    await broadcast_channels_changed()
    return await channel_view(channel, user)


@router.post("/channels/join/{token}")
async def join_channel(token: str, user: dict = Depends(get_current_user)):
    channel = await db.chat_channels.find_one({"join_token": token})
    if not channel or channel["type"] != "INVITE_ONLY":
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    already = await db.chat_channel_members.find_one({"channel_id": channel["id"], "user_id": user["id"]})
    if not already and not is_staff(user):
        await db.chat_channel_members.insert_one({
            "channel_id": channel["id"], "user_id": user["id"], "joined_at": now_utc().isoformat(),
        })
    return await channel_view(channel, user)


@router.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate, user: dict = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff only")
    channel = await db.chat_channels.find_one({"_id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if data.is_read_only is not None:
        await db.chat_channels.update_one({"_id": channel_id}, {"$set": {"is_read_only": data.is_read_only}})
    updated = await db.chat_channels.find_one({"_id": channel_id})
    view = await channel_view(updated, None)
    await broadcast(channel_id, {"type": "channel_updated", "channel": view})
    await broadcast_channels_changed()
    return view


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, user: dict = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff only")
    channel = await db.chat_channels.find_one({"_id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.chat_messages.delete_many({"channel_id": channel_id})
    await db.chat_channel_members.delete_many({"channel_id": channel_id})
    await db.chat_channels.delete_many({"_id": channel_id})
    await broadcast(channel_id, {"type": "channel_deleted", "channel_id": channel_id})
    for ws in list(CONNECTIONS.get(channel_id, set())):
        await ws.close(code=4404)
    await broadcast_channels_changed()
    CONNECTIONS.pop(channel_id, None)
    return {"ok": True}


@router.get("/channels/{channel_id}/messages")
async def list_messages(channel_id: str, before: Optional[str] = None, limit: int = 50,
                         user: Optional[dict] = Depends(get_current_user_optional)):
    await check_chat_enabled()
    channel = await db.chat_channels.find_one({"_id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if not await can_read(channel, user):
        raise HTTPException(status_code=403, detail="Not permitted")
    limit = min(max(limit, 1), 100)
    where = {"channel_id": channel_id, "is_deleted": False}
    if before:
        where["created_at"] = {"$lt": before}
    rows = await db.chat_messages.find(where).sort("created_at", -1).limit(limit).to_list(limit)
    rows.reverse()
    messages = [_message_view(r, user) for r in rows]
    return {"messages": messages, "has_more": len(rows) == limit}


def _message_view(row: dict, user: Optional[dict]) -> dict:
    can_delete = is_staff(user) or bool(user and row["user_id"] == user["id"])
    return {
        "id": row["id"], "channel_id": row["channel_id"], "user_id": row.get("user_id"),
        "user_name": row.get("user_name", ""), "user_role": row.get("user_role", ""),
        "content": row.get("content", ""), "attachment_url": row.get("attachment_url", ""),
        "created_at": row.get("created_at"), "can_delete": can_delete,
    }


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"_id": message_id})
    if not msg or msg.get("is_deleted"):
        raise HTTPException(status_code=404, detail="Message not found")
    if not is_staff(user) and msg.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not permitted")
    await db.chat_messages.update_one({"_id": message_id}, {"$set": {"is_deleted": True}})
    await broadcast(msg["channel_id"], {"type": "message_deleted", "channel_id": msg["channel_id"], "message_id": message_id})
    return {"ok": True}


@router.get("/messages/{message_id}/sender")
async def message_sender(message_id: str, user: dict = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff only")
    msg = await db.chat_messages.find_one({"_id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    sender = await db.users.find_one({"_id": msg["user_id"]})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    return {"name": sender.get("name", ""), "email": sender.get("email", ""), "role": sender.get("role", "")}


class SignUploadIn(BaseModel):
    channel_id: str
    filename: str
    content_type: str


@router.post("/chat/sign-upload")
async def sign_chat_upload(data: SignUploadIn, user: dict = Depends(get_current_user)):
    channel = await db.chat_channels.find_one({"_id": data.channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if not await can_write(channel, user):
        raise HTTPException(status_code=403, detail="Not permitted to post in this channel")
    if data.content_type not in CHAT_MEDIA_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {data.content_type}")
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        raise HTTPException(503, "Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env).")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (data.filename or "file").strip()) or "file"
    path = f"{data.channel_id}/{secrets.token_hex(8)}/{safe}"
    endpoint = f"{supabase_url}/storage/v1/object/upload/sign/{CHAT_MEDIA_BUCKET}/{path}"
    try:
        resp = requests.post(endpoint, headers={
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
        }, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"Storage request failed: {e}")
    if resp.status_code >= 300:
        raise HTTPException(502, f"Could not sign upload ({resp.status_code}): {resp.text[:200]}")
    signed = resp.json().get("url", "")
    upload_url = f"{supabase_url}/storage/v1{signed}"
    public_url = f"{supabase_url}/storage/v1/object/public/{CHAT_MEDIA_BUCKET}/{path}"
    return {"upload_url": upload_url, "public_url": public_url, "path": path,
            "content_type": data.content_type}


async def _resolve_ws_user(websocket: WebSocket) -> Optional[dict]:
    token = websocket.query_params.get("token") or websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        decoded = await firebase_auth.verify_id_token(token)
        uid = decoded.get("uid") or decoded.get("user_id")
        user = await db.users.find_one({"firebase_uid": uid})
        if not user or _is_locked_out(user, token):
            return None
        return sanitize_user(user)
    except Exception:
        return None


@router.websocket("/ws/chat/{channel_id}")
async def chat_ws(websocket: WebSocket, channel_id: str):
    await websocket.accept()
    channel = await db.chat_channels.find_one({"_id": channel_id})
    if not channel:
        await websocket.send_json({"type": "error", "reason": "channel not found"})
        await websocket.close(code=4404)
        return
    user = await _resolve_ws_user(websocket)
    if not await can_read(channel, user):
        await websocket.send_json({"type": "error", "reason": "forbidden"})
        await websocket.close(code=4403)
        return
    CONNECTIONS.setdefault(channel_id, set()).add(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue
            channel = await db.chat_channels.find_one({"_id": channel_id})
            if not channel or not await can_write(channel, user):
                await websocket.send_json({"type": "error", "reason": "read-only or not permitted"})
                continue
            content = str(data.get("content", "")).strip()[:4000]
            attachment_url = str(data.get("attachment_url", ""))[:1000]
            if not content and not attachment_url:
                await websocket.send_json({"type": "error", "reason": "empty message"})
                continue
            if _BLOCKED_RE.search(content):
                await websocket.send_json({"type": "error", "reason": "Message blocked — please keep the chat respectful."})
                continue
            uid = user["id"]
            now = time.time()
            recent = [t for t in _recent_sends.get(uid, []) if now - t < RATE_LIMIT_WINDOW_SECS]
            if len(recent) >= RATE_LIMIT_MAX:
                _recent_sends[uid] = recent
                await websocket.send_json({"type": "error", "reason": "You're sending messages too fast — please slow down."})
                continue
            if content and _last_message.get(uid) == content:
                await websocket.send_json({"type": "error", "reason": "You just sent that — please avoid repeating messages."})
                continue
            recent.append(now)
            _recent_sends[uid] = recent
            doc = {
                "channel_id": channel_id, "user_id": user["id"], "user_name": user.get("name", ""),
                "user_role": user.get("role", ""), "content": content, "attachment_url": attachment_url,
                "created_at": now_utc().isoformat(), "is_deleted": False,
            }
            res = await db.chat_messages.insert_one(doc)
            msg_row = await db.chat_messages.find_one({"_id": res.inserted_id})
            msg_dict = _message_view(msg_row, user)
            msg_dict["can_delete"] = True
            await broadcast(channel_id, {"type": "message", "message": msg_dict})
            if content:
                _last_message[uid] = content
    except WebSocketDisconnect:
        pass
    finally:
        CONNECTIONS.get(channel_id, set()).discard(websocket)
        if not CONNECTIONS.get(channel_id):
            CONNECTIONS.pop(channel_id, None)


async def ensure_default_channels():
    if await db.chat_channels.count_documents({}) == 0:
        await db.chat_channels.insert_one({
            "name": "general", "type": "PUBLIC", "is_read_only": False,
            "created_at": now_utc().isoformat(),
        })
        await db.chat_channels.insert_one({
            "name": "announcements", "type": "PUBLIC", "is_read_only": True,
            "created_at": now_utc().isoformat(),
        })


async def _delete_chat_attachment(attachment_url: str):
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        return
    prefix = f"{supabase_url}/storage/v1/object/public/{CHAT_MEDIA_BUCKET}/"
    if not attachment_url.startswith(prefix):
        return
    path = attachment_url[len(prefix):]
    try:
        requests.delete(f"{supabase_url}/storage/v1/object/{CHAT_MEDIA_BUCKET}/{path}", headers={
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
        }, timeout=15)
    except Exception as e:
        logger.warning(f"Chat attachment delete failed for {path}: {e}")


async def purge_old_messages():
    cutoff = (now_utc() - timedelta(days=RETENTION_DAYS)).isoformat()
    where = {"created_at": {"$lt": cutoff}}
    expiring = await db.chat_messages.find(where).to_list(10000)
    for row in expiring:
        url = row.get("attachment_url")
        if url:
            await _delete_chat_attachment(url)
    await db.chat_messages.delete_many(where)


async def cleanup_loop():
    while True:
        try:
            await purge_old_messages()
        except Exception as e:
            logger.exception(f"Chat message purge failed: {e}")
        await asyncio.sleep(24 * 3600)
