# Running Tredev Learn locally

The app now uses **Supabase (Postgres)** for data and **Firebase Auth** for
identity. The Emergent platform tooling has been removed.

## 1. Backend

```bash
cd backend
cp .env.example .env        # then fill in the real values (see below)
python3 -m venv .venv       # already created for you
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

On startup the backend:
1. connects to Postgres and applies `schema.sql` (idempotent — safe to re-run),
2. initialises the Firebase Admin SDK,
3. seeds the demo accounts + sample content (creates the Firebase users too).

### backend/.env values you must provide
- `DATABASE_URL` — Supabase → Connect → **Session pooler** connection string
  (`postgresql://postgres.<ref>:<db-password>@<host>:5432/postgres`).
  This project's ref is `tjvzrwxedjzculsnxumt`; you just need the DB password.
- `FIREBASE_WEB_API_KEY` — Firebase console → Project settings → General → Web API Key.
- Service account for the Admin SDK — either `GOOGLE_APPLICATION_CREDENTIALS`
  pointing at the downloaded `firebase-service-account.json`, or the JSON inline
  as `FIREBASE_SERVICE_ACCOUNT_JSON`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
  — optional seed admins.

> Firebase note: enable **Email/Password** sign-in under Firebase console →
> Authentication → Sign-in method, or register/login will fail.

## 2. Frontend

```bash
cd frontend
corepack yarn install        # (uses the bundled yarn 1.22)
corepack yarn start          # serves on http://localhost:3000
```

`frontend/.env` is already set to `REACT_APP_BACKEND_URL=http://localhost:8000`.
The frontend needs **no** Firebase keys — auth is brokered by the backend.

## Demo accounts (seeded on first backend start)
| Role | Email | Password |
|---|---|---|
| Learner | learner@tredevlearn.com | Learner@123 |
| Acharya | acharya@tredevlearn.com | Acharya@123 |
| Academic staff | staff@tredevlearn.com | Staff@123 |
| Admin / Super admin | from your `.env` | from your `.env` |

## What changed
- `backend/schema.sql` — 21-table relational schema (was 21 Mongo collections).
- `backend/db.py` — async Postgres data layer (asyncpg) with a Mongo-style shim.
- `backend/firebase_auth.py` — Firebase identity (Admin SDK + REST sign-in).
- `backend/server.py` — auth endpoints + startup rewired; endpoint logic unchanged.
- Mongo/bcrypt/JWT deps removed; `asyncpg` + `firebase-admin` added.
