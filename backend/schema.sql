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
    lesson_id        text DEFAULT '',
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

-- ==================== FEATURE TOGGLES ====================
CREATE TABLE IF NOT EXISTS feature_toggles (
    key        text PRIMARY KEY,
    label      text DEFAULT '',
    enabled    boolean DEFAULT true,
    updated_by uuid,
    updated_at text
);
INSERT INTO feature_toggles (key, label) VALUES
    ('build', 'Course Builder'),
    ('offerings', 'Offerings'),
    ('sessions', 'Live Sessions'),
    ('webinars', 'Webinars'),
    ('verses', 'Verses'),
    ('mantras', 'Mantras'),
    ('content-review', 'Content Review'),
    ('doubts', 'Doubts'),
    ('certs', 'Certificates'),
    ('consultations', 'Consultations'),
    ('quizzes', 'Quizzes'),
    ('grading', 'Grading')
ON CONFLICT (key) DO NOTHING;

-- Quiz -> Event link, and typed/course-context quizzes
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS kind    text DEFAULT 'session';
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS quiz_id uuid;

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS context          text DEFAULT 'event';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS status           text DEFAULT 'published';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS unlock_rule      text DEFAULT 'always';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS approved_by      uuid;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS approved_by_name text DEFAULT '';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS approved_at      text;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS review_notes     text DEFAULT '';

-- Quiz scheduling window (drives Events auto-appear / auto-expire)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS starts_at text;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS ends_at   text;

-- Manual grading (paragraph questions)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS status        text DEFAULT 'graded';
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_by     uuid;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_at     text;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS manual_scores jsonb DEFAULT '{}'::jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS feedback      jsonb DEFAULT '{}'::jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS total_score   integer DEFAULT 0;

-- Completion-time tracking (leaderboard fastest-time ranking)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS started_at          text;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS time_taken_seconds  integer;

-- Assessments (course-context quizzes) and Journal (blog) are decoupled features with
-- their own toggle, independent of the "quizzes" (event-context) and "sessions" toggles.
INSERT INTO feature_toggles (key, label) VALUES
    ('assessments', 'Assessments'),
    ('journal', 'Journal (Blog)')
ON CONFLICT (key) DO NOTHING;

-- Assessment review audit trail (who submitted it, when) + quiz-to-festival linking
-- ("Play & Win" — a festival card launches its attached event-context quiz).
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS submitted_at text;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS festival_id   uuid;

-- Custom stream thumbnail for the Live Session cards on the Events page.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS thumbnail_url text DEFAULT '';

-- Recording attached after the live class ends (or for a session scheduled
-- purely to host a recorded lesson) — lets a missed session stay watchable
-- instead of just expiring.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS recording_url text DEFAULT '';

-- ==================== BATCHES (live-course cohorts) ====================
-- A live_course offering can run multiple batches, each with its own start
-- date and a capacity cap. A live session can optionally target one batch.
CREATE TABLE IF NOT EXISTS batches (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id  uuid NOT NULL,
    name         text NOT NULL,
    start_date   text,
    max_students integer DEFAULT 50,
    created_at   text,
    created_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_batches_offering ON batches(offering_id);

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS batch_id uuid;

-- ==================== LESSON COMMENTS (per-video discussion) ====================
-- Plain comment thread under a lesson's video — any enrolled learner can post,
-- distinct from the staff-facing doubts Q&A thread.
CREATE TABLE IF NOT EXISTS lesson_comments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id uuid NOT NULL,
    lesson_id   text NOT NULL,
    body        text NOT NULL,
    author_id   uuid,
    author_name text DEFAULT '',
    created_at  text
);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(offering_id, lesson_id);

-- Staff edits to an already-published course assessment are held here until an
-- Ācharya approves them; the live doc's top-level fields stay untouched until then.
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS pending_changes jsonb;

-- Staff reply pushed back to the learner's chat widget for a consultation request.
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS reply text DEFAULT '';

-- ==================== QUERY TICKETS (Queries/Doubts redesign — GUVI/Zen Class style) ====================
-- Ticketed chat: a learner opens a ticket, any staff member can claim it by being the
-- first to reply (exclusivity lock), and the full thread persists in query_messages.
CREATE TABLE IF NOT EXISTS query_tickets (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid,
    assigned_staff_id uuid,
    title             text,
    description       text DEFAULT '',
    category_tags     jsonb DEFAULT '[]'::jsonb,
    status            text DEFAULT 'OPEN',
    created_at        text,
    updated_at        text
);
CREATE INDEX IF NOT EXISTS idx_query_tickets_user ON query_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_query_tickets_staff ON query_tickets(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_query_tickets_status ON query_tickets(status);

CREATE TABLE IF NOT EXISTS query_messages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id    uuid,
    sender_id    uuid,
    sender_role  text,
    message_text text,
    created_at   text
);
CREATE INDEX IF NOT EXISTS idx_query_messages_ticket ON query_messages(ticket_id);

INSERT INTO feature_toggles (key, label) VALUES
    ('queries', 'Queries')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS replied_at text;

-- ==================== COMMUNITY CHAT ====================
CREATE TABLE IF NOT EXISTS chat_channels (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text NOT NULL,
    type         text NOT NULL DEFAULT 'PUBLIC',
    course_id    uuid,
    is_read_only boolean DEFAULT false,
    created_at   text,
    created_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_chat_channels_course ON chat_channels(course_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id     uuid NOT NULL,
    user_id        uuid,
    user_name      text DEFAULT '',
    user_role      text DEFAULT '',
    content        text DEFAULT '',
    attachment_url text DEFAULT '',
    is_deleted     boolean DEFAULT false,
    created_at     text
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at);

INSERT INTO feature_toggles (key, label) VALUES ('community_chat', 'Community Chat')
ON CONFLICT (key) DO NOTHING;

-- Invite-only channels: joinable only via a secret link, never listed unless joined.
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS join_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_join_token ON chat_channels(join_token) WHERE join_token IS NOT NULL;

-- Mentors showcase and Festival Calendar staff-panel tabs were previously never
-- individually toggleable from the admin panel — give them their own switch too.
INSERT INTO feature_toggles (key, label) VALUES
    ('mentors', 'Mentors'),
    ('calendar', 'Festival Calendar')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS chat_channel_members (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL,
    user_id    uuid NOT NULL,
    joined_at  text,
    UNIQUE (channel_id, user_id)
);

-- Scope a doubt to one lesson (staff Lessons tab "Questions on this lecture");
-- blank = a general course doubt, unchanged from before this column existed.
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS lesson_id text DEFAULT '';

-- ==================== HINDI AUTO-TRANSLATION ====================
ALTER TABLE blogs      ADD COLUMN IF NOT EXISTS title_hi       text;
ALTER TABLE blogs      ADD COLUMN IF NOT EXISTS excerpt_hi     text;
ALTER TABLE blogs      ADD COLUMN IF NOT EXISTS body_hi        text;
ALTER TABLE offerings  ADD COLUMN IF NOT EXISTS title_hi       text;
ALTER TABLE offerings  ADD COLUMN IF NOT EXISTS subtitle_hi    text;
ALTER TABLE offerings  ADD COLUMN IF NOT EXISTS description_hi text;

-- ==================== BUNNY STREAM ====================
-- One Bunny Stream "collection" (folder) per course, created lazily on first video upload.
ALTER TABLE offerings  ADD COLUMN IF NOT EXISTS bunny_collection_id text;
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON chat_channel_members(user_id);

-- ==================== ADMIN / SUPER-ADMIN PLATFORM ====================
-- User lifecycle: suspend (blocks login+API instantly, reversible), soft-delete
-- (blocks login, preserves FK history in payments/enrollments/audit_log), and a
-- soft force-logout marker (see docs/PERMISSIONS_AND_ACCESS.md §3.1 for the
-- real limitation this has without the Firebase Admin SDK).
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended      boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted     boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_logout_at text;

-- Course merchandising flags + archive (distinct from is_published/draft).
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_popular     boolean DEFAULT false;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_verified    boolean DEFAULT false;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_archived    boolean DEFAULT false;

-- Track how an enrollment was created (paid checkout vs a staff/admin manual grant).
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS source     text DEFAULT 'purchase';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS granted_by uuid;

-- Escalation: staff flags a ticket for admin attention (on top of the existing
-- OPEN/ASSIGNED/CLOSED status and admin's existing reassign ability).
ALTER TABLE query_tickets ADD COLUMN IF NOT EXISTS escalated       boolean DEFAULT false;
ALTER TABLE query_tickets ADD COLUMN IF NOT EXISTS escalated_at    text;
ALTER TABLE query_tickets ADD COLUMN IF NOT EXISTS escalated_by    uuid;
ALTER TABLE query_tickets ADD COLUMN IF NOT EXISTS escalation_note text DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_query_tickets_escalated ON query_tickets(escalated);

-- Coupons: admin/super_admin-managed discounts, applied at payment order creation.
CREATE TABLE IF NOT EXISTS coupons (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code           text UNIQUE NOT NULL,
    discount_type  text NOT NULL DEFAULT 'percent',
    discount_value integer NOT NULL DEFAULT 0,
    offering_id    uuid,
    max_uses       integer,
    used_count     integer DEFAULT 0,
    valid_from     text,
    valid_until    text,
    active         boolean DEFAULT true,
    is_special     boolean DEFAULT false,
    created_by     uuid,
    created_at     text
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- Cashfree Payment Gateway fields — replaces the mocked/self-reported flow.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway            text DEFAULT 'mock';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_order_id        text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency           text DEFAULT 'INR';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS signature_verified boolean DEFAULT false;

-- Which batch (cohort) of a live_course an enrollment/order is for — lets a
-- live course cap seats per batch instead of per whole course.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE payments    ADD COLUMN IF NOT EXISTS batch_id uuid;
