"""
Postgres (Supabase) data-access layer for Tredev Learn.

Provides a tiny async shim that mirrors the subset of the Motor/PyMongo API the
application uses (find_one, find().sort().limit().to_list(), insert_one,
insert_many, update_one with $set/$setOnInsert + upsert, delete_one,
count_documents). This lets the endpoint logic remain a faithful port of the
original MongoDB implementation while running on a fully typed relational schema.

Query dicts accept the small Mongo operator subset the app relies on:
  {"field": value}                  -> field = value
  {"field": {"$in": [...]}}          -> field IN (...)
  {"field": {"$ne": value}}          -> field IS DISTINCT FROM value
The special key "_id" maps to the "id" column. Rows are returned as plain dicts
with both "id" and "_id" set to the uuid string, uuid columns stringified, and
jsonb columns decoded to Python objects.
"""
import json
import ssl
import uuid as uuidlib
from datetime import datetime

import asyncpg

# ---- Column type registry (must match schema.sql) -------------------------
# type ∈ {"uuid", "jsonb", "int", "bool", "text"}. Any column not listed for a
# table is ignored on write (keeps arbitrary-dict PATCH endpoints safe).
COLUMNS = {
    "users": {
        "id": "uuid", "firebase_uid": "text", "email": "text", "name": "text",
        "role": "text", "avatar_url": "text", "bio": "text", "parampara": "text",
        "created_at": "text",
    },
    "verses": {
        "id": "uuid", "scripture": "text", "reference": "text", "devanagari": "text",
        "iast": "text", "word_by_word": "jsonb", "translations": "jsonb",
        "commentaries": "jsonb", "audio_url": "text", "created_at": "text",
    },
    "offerings": {
        "id": "uuid", "title": "text", "subtitle": "text", "description": "text",
        "type": "text", "track": "text", "subject": "text", "price_inr": "int",
        "price_usd": "int", "duration": "text", "acharya_id": "uuid", "verses": "jsonb",
        "modules": "jsonb", "image_url": "text", "is_published": "bool", "festival": "text",
        "start_date": "text", "created_at": "text", "created_by": "uuid",
        "approved_by_acharya": "bool", "approval_notes": "text", "approved_at": "text",
    },
    "enrollments": {
        "id": "uuid", "user_id": "uuid", "offering_id": "uuid", "enrolled_at": "text",
        "progress": "int", "completed_lessons": "jsonb", "status": "text",
    },
    "sadhana_progress": {
        "id": "uuid", "user_id": "uuid", "offering_id": "uuid", "sankalpa": "text",
        "started_at": "text", "checkins": "jsonb", "streak": "int", "total_japa": "int",
        "last_checkin": "text",
    },
    "consultations": {
        "id": "uuid", "name": "text", "email": "text", "phone": "text", "interest": "text",
        "consent": "bool", "assigned_to": "uuid", "status": "text", "created_at": "text",
        "reply": "text", "replied_at": "text",
    },
    "quizzes": {
        "id": "uuid", "offering_id": "uuid", "title": "text", "questions": "jsonb",
        "created_at": "text", "created_by": "uuid",
        "context": "text", "status": "text", "unlock_rule": "text",
        "approved_by": "uuid", "approved_by_name": "text", "approved_at": "text",
        "review_notes": "text", "starts_at": "text", "ends_at": "text",
        "submitted_at": "text", "festival_id": "uuid", "pending_changes": "jsonb",
    },
    "quiz_attempts": {
        "id": "uuid", "quiz_id": "uuid", "user_id": "uuid", "answers": "jsonb",
        "score": "int", "correct": "int", "total": "int", "submitted_at": "text",
        "graded": "bool",
        "status": "text", "graded_by": "uuid", "graded_at": "text",
        "manual_scores": "jsonb", "feedback": "jsonb", "total_score": "int",
        "started_at": "text", "time_taken_seconds": "int",
    },
    "doubts": {
        "id": "uuid", "offering_id": "uuid", "question": "text", "asked_by": "uuid",
        "asked_by_name": "text", "answer": "text", "answered_by": "uuid",
        "answered_by_name": "text", "answered_at": "text", "status": "text",
        "created_at": "text",
    },
    "capability_grants": {
        "id": "uuid", "staff_id": "uuid", "capability": "text", "scope": "jsonb",
        "granted_by": "uuid", "granted_at": "text",
    },
    "live_sessions": {
        "id": "uuid", "title": "text", "offering_id": "uuid", "acharya_id": "uuid",
        "starts_at": "text", "duration_min": "int", "mode": "text", "acharya_name": "text",
        "created_at": "text", "created_by": "uuid", "join_url": "text", "topic": "text",
        "kind": "text", "quiz_id": "uuid", "thumbnail_url": "text",
    },
    "certificates": {
        "id": "uuid", "code": "text", "user_id": "uuid", "user_name": "text",
        "offering_id": "uuid", "offering_title": "text", "issued_at": "text",
        "revoked": "bool", "acharya_name": "text", "revoked_at": "text", "revoked_by": "uuid",
        "acharya_id": "uuid", "signature_status": "text", "signature_name": "text",
        "signed_at": "text", "staff_approved_at": "text", "staff_approved_by": "uuid",
    },
    "community_posts": {
        "id": "uuid", "body": "text", "verse_id": "text", "author_id": "uuid",
        "author_name": "text", "created_at": "text", "flagged": "bool",
    },
    "audit_log": {
        "id": "uuid", "actor_id": "uuid", "actor_email": "text", "actor_role": "text",
        "action": "text", "target": "text", "meta": "jsonb", "created_at": "text",
    },
    "payments": {
        "id": "uuid", "order_id": "text", "user_id": "uuid", "offering_id": "uuid",
        "amount_inr": "int", "status": "text", "created_at": "text", "mocked": "bool",
        "paid_at": "text",
    },
    "festivals": {
        "id": "uuid", "name": "text", "date": "text", "significance": "text",
        "related_offering_subject": "text", "deity": "text",
    },
    "mantras": {
        "id": "uuid", "deity": "text", "title": "text", "devanagari": "text",
        "iast": "text", "meaning": "text", "audio_url": "text",
        "created_at": "text", "created_by": "uuid",
    },
    "blogs": {
        "id": "uuid", "slug": "text", "title": "text", "category": "text", "excerpt": "text",
        "cover_image": "text", "author_name": "text", "read_time": "text", "body": "text",
        "created_at": "text",
    },
    "webinars": {
        "id": "uuid", "title": "text", "cover_image": "text", "starts_at": "text",
        "duration_min": "int", "price_inr": "int", "orig_price_inr": "int",
        "mentor_name": "text", "mentor_id": "text", "description": "text",
        "seats_remaining": "int", "created_at": "text", "created_by": "uuid",
        "join_url": "text", "registered_user_ids": "jsonb",
    },
    "mentors": {
        "id": "uuid", "name": "text", "title": "text", "avatar": "text", "parampara": "text",
        "order": "int", "credentials": "jsonb", "bio": "text",
    },
    "testimonials": {
        "id": "uuid", "name": "text", "role": "text", "rating": "int", "avatar": "text",
        "quote": "text", "course": "text",
    },
    "acharya_content": {
        "id": "uuid", "title": "text", "body": "text", "offering_id": "text", "kind": "text",
        "verse_id": "text", "acharya_id": "uuid", "acharya_name": "text", "status": "text",
        "review_notes": "text", "reviewed_by": "uuid", "reviewed_by_name": "text",
        "reviewed_at": "text", "created_at": "text",
    },
    "feature_toggles": {
        "key": "text", "label": "text", "enabled": "bool", "updated_by": "uuid",
        "updated_at": "text",
    },
    "query_tickets": {
        "id": "uuid", "user_id": "uuid", "assigned_staff_id": "uuid",
        "title": "text", "description": "text", "category_tags": "jsonb",
        "status": "text", "created_at": "text", "updated_at": "text",
    },
    "query_messages": {
        "id": "uuid", "ticket_id": "uuid", "sender_id": "uuid", "sender_role": "text",
        "message_text": "text", "created_at": "text",
    },
}

_pool: asyncpg.Pool = None


class _Impossible(Exception):
    """Raised internally to signal a WHERE clause that can never match."""


async def _init_conn(conn):
    # Decode/encode jsonb as native Python objects.
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


async def connect(dsn: str):
    global _pool
    # Supabase (and most hosted Postgres) require TLS. Use an encrypted-but-
    # unverified context (equivalent to libpq sslmode=require) unless the target
    # is an explicitly local/insecure host.
    ssl_ctx = None
    lowered = dsn.lower()
    is_local = "@localhost" in lowered or "@127.0.0.1" in lowered
    if not is_local and "sslmode=disable" not in lowered:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
    _pool = await asyncpg.create_pool(
        dsn=dsn, init=_init_conn, min_size=1, max_size=10, ssl=ssl_ctx
    )
    return _pool


async def close():
    if _pool:
        await _pool.close()


async def run_sql(sql: str):
    """Execute a raw SQL script (used to apply schema.sql at startup)."""
    async with _pool.acquire() as conn:
        await conn.execute(sql)


def _q(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


def _coerce(table: str, col: str, value):
    t = COLUMNS[table].get(col, "text")
    if t == "uuid":
        if value is None or value == "":
            return None
        if isinstance(value, uuidlib.UUID):
            return value
        try:
            return uuidlib.UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            # Invalid uuid: store NULL rather than raising.
            return None
    if t == "jsonb":
        return value
    if t == "int":
        return None if value is None else int(value)
    if t == "bool":
        return None if value is None else bool(value)
    # text
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _coerce_for_where(table: str, col: str, value):
    """Like _coerce but a bad uuid means 'match nothing' rather than NULL."""
    t = COLUMNS[table].get(col, "text")
    if t == "uuid":
        if value is None:
            return None
        if value == "":
            raise _Impossible()
        if isinstance(value, uuidlib.UUID):
            return value
        try:
            return uuidlib.UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            raise _Impossible()
    return _coerce(table, col, value)


_RANGE_OPS = {"$lt": "<", "$lte": "<=", "$gt": ">", "$gte": ">="}


def _build_clauses(table: str, where: dict, start: int):
    """Return (clauses_list, params, next_param_index). Raises _Impossible."""
    clauses = []
    params = []
    i = start
    for key, cond in where.items():
        if key == "$or":
            or_clauses = []
            for sub in cond:
                try:
                    sub_clauses, sub_params, i = _build_clauses(table, sub, i)
                except _Impossible:
                    continue
                if not sub_clauses:
                    continue
                or_clauses.append("(" + " AND ".join(sub_clauses) + ")")
                params.extend(sub_params)
            if not or_clauses:
                raise _Impossible()
            clauses.append("(" + " OR ".join(or_clauses) + ")")
            continue
        col = "id" if key == "_id" else key
        qcol = _q(col)
        if isinstance(cond, dict):
            matched_op = False
            if "$in" in cond:
                vals = [_coerce_for_where_safe(table, col, v) for v in cond["$in"]]
                vals = [v for v in vals if v is not _MISS]
                if not vals:
                    raise _Impossible()
                placeholders = ", ".join(f"${i + n}" for n in range(len(vals)))
                clauses.append(f"{qcol} IN ({placeholders})")
                params.extend(vals)
                i += len(vals)
                matched_op = True
            if "$ne" in cond:
                v = _coerce(table, col, cond["$ne"])
                clauses.append(f"{qcol} IS DISTINCT FROM ${i}")
                params.append(v)
                i += 1
                matched_op = True
            for op, sql_op in _RANGE_OPS.items():
                if op in cond:
                    v = _coerce(table, col, cond[op])
                    clauses.append(f"{qcol} {sql_op} ${i}")
                    params.append(v)
                    i += 1
                    matched_op = True
            if not matched_op:
                raise ValueError(f"Unsupported operator in {cond!r}")
        else:
            v = _coerce_for_where(table, col, cond)
            if v is None:
                clauses.append(f"{qcol} IS NULL")
            else:
                clauses.append(f"{qcol} = ${i}")
                params.append(v)
                i += 1
    return clauses, params, i


def _build_where(table: str, where: dict, start: int = 1):
    """Return (sql_fragment, params, next_param_index). Raises _Impossible."""
    if not where:
        return "", [], start
    clauses, params, i = _build_clauses(table, where, start)
    if not clauses:
        return "", [], i
    return "WHERE " + " AND ".join(clauses), params, i


_MISS = object()


def _coerce_for_where_safe(table, col, v):
    try:
        return _coerce_for_where(table, col, v)
    except _Impossible:
        return _MISS


def _row_to_dict(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    for k, v in list(d.items()):
        if isinstance(v, uuidlib.UUID):
            d[k] = str(v)
    if "id" in d and d["id"] is not None:
        d["_id"] = d["id"]
    return d


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _Cursor:
    def __init__(self, collection, where):
        self.c = collection
        self.where = where or {}
        self._sort = None
        self._limit = None

    def sort(self, field, direction=1):
        self._sort = (field, direction)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, length=None):
        table = self.c.name
        try:
            where_sql, params, _ = _build_where(table, self.where)
        except _Impossible:
            return []
        sql = f"SELECT * FROM {_q(table)} {where_sql}"
        if self._sort:
            field, direction = self._sort
            col = "id" if field == "_id" else field
            sql += f" ORDER BY {_q(col)} {'ASC' if direction >= 0 else 'DESC'}"
        lim = self._limit if self._limit is not None else length
        if lim is not None:
            sql += f" LIMIT {int(lim)}"
        async with _pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
        return [_row_to_dict(r) for r in rows]


class Collection:
    def __init__(self, name):
        self.name = name

    async def find_one(self, where=None):
        try:
            where_sql, params, _ = _build_where(self.name, where or {})
        except _Impossible:
            return None
        sql = f"SELECT * FROM {_q(self.name)} {where_sql} LIMIT 1"
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(sql, *params)
        return _row_to_dict(row)

    def find(self, where=None):
        return _Cursor(self, where or {})

    async def insert_one(self, doc: dict):
        cols, params = self._insert_columns(doc)
        placeholders = ", ".join(f"${n + 1}" for n in range(len(params)))
        collist = ", ".join(_q(c) for c in cols)
        sql = f"INSERT INTO {_q(self.name)} ({collist}) VALUES ({placeholders}) RETURNING id"
        async with _pool.acquire() as conn:
            new_id = await conn.fetchval(sql, *params)
        return _InsertResult(str(new_id))

    async def insert_many(self, docs: list):
        ids = []
        async with _pool.acquire() as conn:
            async with conn.transaction():
                for doc in docs:
                    cols, params = self._insert_columns(doc)
                    placeholders = ", ".join(f"${n + 1}" for n in range(len(params)))
                    collist = ", ".join(_q(c) for c in cols)
                    sql = (f"INSERT INTO {_q(self.name)} ({collist}) "
                           f"VALUES ({placeholders}) RETURNING id")
                    new_id = await conn.fetchval(sql, *params)
                    ids.append(str(new_id))
        return _InsertResult(ids[-1] if ids else None)

    def _insert_columns(self, doc):
        known = COLUMNS[self.name]
        cols, params = [], []
        for k, v in doc.items():
            col = "id" if k == "_id" else k
            if col not in known:
                continue
            cols.append(col)
            params.append(_coerce(self.name, col, v))
        return cols, params

    async def update_one(self, where: dict, update: dict, upsert: bool = False):
        set_doc = update.get("$set", {})
        set_on_insert = update.get("$setOnInsert", {})
        known = COLUMNS[self.name]

        if upsert:
            # INSERT ... ON CONFLICT (where-cols) DO UPDATE SET <set_doc>
            insert_doc = {}
            insert_doc.update({k: v for k, v in where.items() if k != "_id"})
            insert_doc.update(set_on_insert)
            insert_doc.update(set_doc)
            cols, params = [], []
            for k, v in insert_doc.items():
                col = "id" if k == "_id" else k
                if col not in known:
                    continue
                cols.append(col)
                params.append(_coerce(self.name, col, v))
            placeholders = ", ".join(f"${n + 1}" for n in range(len(params)))
            collist = ", ".join(_q(c) for c in cols)
            conflict_cols = ", ".join(_q("id" if k == "_id" else k) for k in where.keys())
            set_cols = [c for c in (("id" if k == "_id" else k) for k in set_doc.keys())
                        if c in known]
            if set_cols:
                do_update = ", ".join(f"{_q(c)} = EXCLUDED.{_q(c)}" for c in set_cols)
            else:
                # No-op update to satisfy DO UPDATE requirement
                first = cols[0]
                do_update = f"{_q(first)} = EXCLUDED.{_q(first)}"
            sql = (f"INSERT INTO {_q(self.name)} ({collist}) VALUES ({placeholders}) "
                   f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {do_update}")
            async with _pool.acquire() as conn:
                await conn.execute(sql, *params)
            return

        # Plain UPDATE
        set_cols, set_params = [], []
        idx = 1
        for k, v in set_doc.items():
            col = "id" if k == "_id" else k
            if col not in known:
                continue
            set_cols.append(f"{_q(col)} = ${idx}")
            set_params.append(_coerce(self.name, col, v))
            idx += 1
        if not set_cols:
            return
        try:
            where_sql, where_params, _ = _build_where(self.name, where, start=idx)
        except _Impossible:
            return
        sql = f"UPDATE {_q(self.name)} SET {', '.join(set_cols)} {where_sql}"
        async with _pool.acquire() as conn:
            await conn.execute(sql, *set_params, *where_params)

    async def delete_one(self, where: dict):
        try:
            where_sql, params, _ = _build_where(self.name, where)
        except _Impossible:
            return
        # Delete a single matching row.
        sql = (f"DELETE FROM {_q(self.name)} WHERE id = "
               f"(SELECT id FROM {_q(self.name)} {where_sql} LIMIT 1)")
        async with _pool.acquire() as conn:
            await conn.execute(sql, *params)

    async def delete_many(self, where: dict):
        try:
            where_sql, params, _ = _build_where(self.name, where)
        except _Impossible:
            return
        sql = f"DELETE FROM {_q(self.name)} {where_sql}"
        async with _pool.acquire() as conn:
            await conn.execute(sql, *params)

    async def count_documents(self, where: dict = None):
        try:
            where_sql, params, _ = _build_where(self.name, where or {})
        except _Impossible:
            return 0
        sql = f"SELECT COUNT(*) FROM {_q(self.name)} {where_sql}"
        async with _pool.acquire() as conn:
            return await conn.fetchval(sql, *params)

    async def create_index(self, *args, **kwargs):
        # Indexes/uniqueness are declared in schema.sql; no-op for API parity.
        return None


class Database:
    def __getattr__(self, name):
        if name in COLUMNS:
            return Collection(name)
        raise AttributeError(name)


db = Database()
