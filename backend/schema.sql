-- Tredev Learn — Supabase/Postgres schema
-- Relational port of the original 21 MongoDB collections.
-- Date/time fields are stored as text ISO-8601 strings (exactly as the app
-- produces them via datetime.isoformat()), preserving the original behaviour
-- and keeping chronological == lexicographic sort order.
-- Nested/variable structures (arrays of objects) use jsonb.

-- gen_random_uuid() is built into Postgres 13+ (Supabase is PG15).

-- ==================== USERS ====================
-- Identity (email + password) lives in Firebase Auth; this table holds the
-- profile + role. firebase_uid links the two.
CREATE TABLE IF NOT EXISTS users (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid text UNIQUE,
    email        text UNIQUE NOT NULL,
    name         text NOT NULL DEFAULT '',
    role         text NOT NULL DEFAULT 'learner',
    avatar_url   text DEFAULT '',
    bio          text DEFAULT '',
    parampara    text DEFAULT '',
    created_at   text
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================== VERSES ====================
CREATE TABLE IF NOT EXISTS verses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scripture    text,
    reference    text,
    devanagari   text,
    iast         text,
    word_by_word jsonb DEFAULT '[]'::jsonb,
    translations jsonb DEFAULT '[]'::jsonb,
    commentaries jsonb DEFAULT '[]'::jsonb,
    audio_url    text DEFAULT '',
    created_at   text
);
CREATE INDEX IF NOT EXISTS idx_verses_scripture ON verses(scripture);

-- ==================== OFFERINGS ====================
CREATE TABLE IF NOT EXISTS offerings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               text NOT NULL,
    subtitle            text DEFAULT '',
    description         text DEFAULT '',
    type                text,
    track               text,
    subject             text,
    price_inr           integer DEFAULT 0,
    price_usd           integer DEFAULT 0,
    duration            text DEFAULT '',
    acharya_id          uuid,
    verses              jsonb DEFAULT '[]'::jsonb,
    modules             jsonb DEFAULT '[]'::jsonb,
    image_url           text DEFAULT '',
    is_published        boolean DEFAULT false,
    festival            text DEFAULT '',
    start_date          text DEFAULT '',
    created_at          text,
    created_by          uuid,
    approved_by_acharya boolean DEFAULT false,
    approval_notes      text DEFAULT '',
    approved_at         text
);
CREATE INDEX IF NOT EXISTS idx_offerings_published ON offerings(is_published);
CREATE INDEX IF NOT EXISTS idx_offerings_acharya ON offerings(acharya_id);

-- ==================== ENROLLMENTS ====================
CREATE TABLE IF NOT EXISTS enrollments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid,
    offering_id       uuid,
    enrolled_at       text,
    progress          integer DEFAULT 0,
    completed_lessons jsonb DEFAULT '[]'::jsonb,
    status            text DEFAULT 'active',
    UNIQUE (user_id, offering_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);

-- ==================== SADHANA PROGRESS ====================
CREATE TABLE IF NOT EXISTS sadhana_progress (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid,
    offering_id  uuid,
    sankalpa     text DEFAULT '',
    started_at   text,
    checkins     jsonb DEFAULT '[]'::jsonb,
    streak       integer DEFAULT 0,
    total_japa   integer DEFAULT 0,
    last_checkin text,
    UNIQUE (user_id, offering_id)
);
CREATE INDEX IF NOT EXISTS idx_sadhana_offering ON sadhana_progress(offering_id);

-- ==================== CONSULTATIONS ====================
CREATE TABLE IF NOT EXISTS consultations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text,
    email       text,
    phone       text,
    interest    text,
    consent     boolean DEFAULT false,
    assigned_to uuid,
    status      text,
    created_at  text
);
CREATE INDEX IF NOT EXISTS idx_consultations_assigned ON consultations(assigned_to);

-- ==================== QUIZZES ====================
CREATE TABLE IF NOT EXISTS quizzes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id uuid,
    title       text,
    questions   jsonb DEFAULT '[]'::jsonb,
    created_at  text,
    created_by  uuid
);
CREATE INDEX IF NOT EXISTS idx_quizzes_offering ON quizzes(offering_id);

-- ==================== QUIZ ATTEMPTS ====================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id      uuid,
    user_id      uuid,
    answers      jsonb DEFAULT '[]'::jsonb,
    score        integer DEFAULT 0,
    correct      integer DEFAULT 0,
    total        integer DEFAULT 0,
    submitted_at text,
    graded       boolean DEFAULT true
);

-- ==================== DOUBTS ====================
CREATE TABLE IF NOT EXISTS doubts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id      uuid,
    question         text,
    asked_by         uuid,
    asked_by_name    text DEFAULT '',
    answer           text DEFAULT '',
    answered_by      uuid,
    answered_by_name text DEFAULT '',
    answered_at      text,
    status           text DEFAULT 'open',
    created_at       text
);
CREATE INDEX IF NOT EXISTS idx_doubts_asked_by ON doubts(asked_by);
CREATE INDEX IF NOT EXISTS idx_doubts_offering ON doubts(offering_id);

-- ==================== CAPABILITY GRANTS ====================
CREATE TABLE IF NOT EXISTS capability_grants (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   uuid,
    capability text,
    scope      jsonb DEFAULT '[]'::jsonb,
    granted_by uuid,
    granted_at text,
    UNIQUE (staff_id, capability)
);

-- ==================== LIVE SESSIONS ====================
CREATE TABLE IF NOT EXISTS live_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title        text,
    offering_id  uuid,
    acharya_id   uuid,
    starts_at    text,
    duration_min integer DEFAULT 60,
    mode         text DEFAULT 'interactive',
    acharya_name text DEFAULT '',
    created_at   text,
    created_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_acharya ON live_sessions(acharya_id);

-- ==================== CERTIFICATES ====================
CREATE TABLE IF NOT EXISTS certificates (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code           text UNIQUE,
    user_id        uuid,
    user_name      text DEFAULT '',
    offering_id    uuid,
    offering_title text DEFAULT '',
    issued_at      text,
    revoked        boolean DEFAULT false,
    acharya_name   text DEFAULT '',
    revoked_at     text,
    revoked_by     uuid
);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- ==================== COMMUNITY POSTS ====================
CREATE TABLE IF NOT EXISTS community_posts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    body        text,
    verse_id    text DEFAULT '',
    author_id   uuid,
    author_name text DEFAULT '',
    created_at  text,
    flagged     boolean DEFAULT false
);

-- ==================== AUDIT LOG ====================
CREATE TABLE IF NOT EXISTS audit_log (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    uuid,
    actor_email text,
    actor_role  text,
    action      text,
    target      text,
    meta        jsonb DEFAULT '{}'::jsonb,
    created_at  text
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ==================== PAYMENTS ====================
CREATE TABLE IF NOT EXISTS payments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    text UNIQUE,
    user_id     uuid,
    offering_id uuid,
    amount_inr  integer DEFAULT 0,
    status      text,
    created_at  text,
    mocked      boolean DEFAULT true,
    paid_at     text
);

-- ==================== FESTIVALS ====================
CREATE TABLE IF NOT EXISTS festivals (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                      text,
    date                      text,
    significance              text,
    related_offering_subject  text
);

-- ==================== BLOGS ====================
CREATE TABLE IF NOT EXISTS blogs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text UNIQUE,
    title       text,
    category    text,
    excerpt     text,
    cover_image text,
    author_name text,
    read_time   text,
    body        text,
    created_at  text
);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON blogs(category);

-- ==================== WEBINARS ====================
CREATE TABLE IF NOT EXISTS webinars (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text,
    cover_image     text,
    starts_at       text,
    duration_min    integer DEFAULT 90,
    price_inr       integer DEFAULT 0,
    orig_price_inr  integer DEFAULT 0,
    mentor_name     text DEFAULT '',
    mentor_id       text DEFAULT '',
    description     text DEFAULT '',
    seats_remaining integer DEFAULT 100,
    created_at      text,
    created_by      uuid
);

-- ==================== MENTORS ====================
CREATE TABLE IF NOT EXISTS mentors (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text,
    title       text,
    avatar      text,
    parampara   text,
    "order"     integer DEFAULT 0,
    credentials jsonb DEFAULT '[]'::jsonb,
    bio         text
);

-- ==================== TESTIMONIALS ====================
CREATE TABLE IF NOT EXISTS testimonials (
    id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name   text,
    role   text,
    rating integer DEFAULT 5,
    avatar text,
    quote  text,
    course text
);

-- ==================== ACHARYA CONTENT ====================
CREATE TABLE IF NOT EXISTS acharya_content (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title            text,
    body             text,
    offering_id      text DEFAULT '',
    kind             text DEFAULT 'lecture_note',
    verse_id         text DEFAULT '',
    acharya_id       uuid,
    acharya_name     text DEFAULT '',
    status           text DEFAULT 'pending_review',
    review_notes     text DEFAULT '',
    reviewed_by      uuid,
    reviewed_by_name text DEFAULT '',
    reviewed_at      text,
    created_at       text
);
CREATE INDEX IF NOT EXISTS idx_acharya_content_acharya ON acharya_content(acharya_id);

-- ==================== MIGRATIONS (idempotent; run every startup) ====================
-- Certificate signing pipeline: pending_signature -> signed -> published
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS acharya_id       uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signature_status text DEFAULT 'published';
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signature_name   text DEFAULT '';
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signed_at        text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS staff_approved_at text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS staff_approved_by uuid;
-- Sessions & webinars: join link + standalone (non-course) sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS join_url text DEFAULT '';
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS topic    text DEFAULT '';
ALTER TABLE webinars      ADD COLUMN IF NOT EXISTS join_url text DEFAULT '';
ALTER TABLE webinars      ADD COLUMN IF NOT EXISTS registered_user_ids jsonb DEFAULT '[]'::jsonb;
-- Mantras linked to the festival calendar by deity
ALTER TABLE festivals     ADD COLUMN IF NOT EXISTS deity text DEFAULT '';
UPDATE festivals SET deity='Shiva'     WHERE name='Maha Shivaratri' AND (deity IS NULL OR deity='');
UPDATE festivals SET deity='Saraswati' WHERE name='Vasant Panchami' AND (deity IS NULL OR deity='');
UPDATE festivals SET deity='Krishna'   WHERE name='Gita Jayanti'    AND (deity IS NULL OR deity='');
UPDATE festivals SET deity='Durga'     WHERE name='Navratri'        AND (deity IS NULL OR deity='');
UPDATE festivals SET deity='Guru'      WHERE name='Guru Purnima'    AND (deity IS NULL OR deity='');

CREATE TABLE IF NOT EXISTS mantras (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deity       text,
    title       text,
    devanagari  text DEFAULT '',
    iast        text DEFAULT '',
    meaning     text DEFAULT '',
    audio_url   text DEFAULT '',
    created_at  text,
    created_by  uuid
);
CREATE INDEX IF NOT EXISTS idx_mantras_deity ON mantras(deity);
