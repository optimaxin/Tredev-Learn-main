# Tredev Learn — PRD & Status

## One-liner
A credentialed digital learning platform for the Vedic knowledge systems — held to a scholarly standard its competitors don't attempt. **A place to study, not a place to buy predictions.**

## Audiences
- Diaspora seekers (USD, timezone-constrained)
- Indian enthusiasts (INR/UPI, price-sensitive)
- Practitioner-professionals (highest LTV — need a *displayable* credential)
- Academics & students (quality watchdogs)
- The undecided (served by free pathway consultation)

## Core Guarantees (do-not-break)
1. Ācharya's name never appears on content they haven't approved.
2. Only Super Admin performs irreversible actions (certificate revocation).
3. Every privileged action is written to an immutable audit log.
4. Calculators compute; they never foretell.
5. Every claim is attributed to a named school or scholar.

---

## What's Implemented (MVP — Feb 2026)

### Backend (FastAPI + MongoDB, monolithic `server.py`)
- **Auth**: JWT (HS256) via httpOnly cookie + Bearer fallback. 5 seeded accounts (learner/acharya/staff/admin/super_admin).
- **Users & Roles**: 5 roles with RBAC decorator; admin cannot appoint super_admin.
- **Offerings**: 7 types (masterclass, webinar, workshop, recorded_course, live_course, sadhana, ebook) × 3 tracks (A/B/C). Ācharya approval required before publication.
- **Verses**: first-class objects (Devanagari, IAST, word-by-word, attributed translations, attributed commentaries). Seeded 5 verses (Gītā 2.20, 2.47, 18.66, Iśa 1, Ṛgveda Nāsadīya).
- **Enrollments**: idempotent per (user, offering).
- **Sadhana**: sankalpa + japa counter + compassionate streak (missed days fade, not break). Cohort count exposed.
- **Free calculators**: Panchang, Numerology, Kundli, Shloka of the day, IAST↔Devanagari transliterator — all framed as *study objects*.
- **Consultations**: consent-gated (DPDP); auto-assigned to staff with lightest open backlog; queued fallback at capacity.
- **Quizzes**: multi-question with auto-grading; strips correct_index for learner view.
- **Doubts Q&A**: learner asks; staff/acharya answers.
- **Capability grants**: 6 capabilities (course_builder, quiz_author, grader, doubts, consultations, cohorts) — grantable per staff.
- **Live sessions**: PlugNmeet **MOCKED** — returns placeholder join URL; "Join Now" opens 5 min before start.
- **Certificates**: TDL-XXXX-YYYY code, public verification page, super-admin-only revocation.
- **Community**: verse-anchored posts.
- **Audit log**: immutable, admin+ view.
- **Payments (Razorpay)**: **MOCKED** — order-create + webhook-mock endpoints auto-enroll on "payment success."
- **Festival calendar**: 5 seeded (Maha Shivaratri, Vasant Panchami, Gita Jayanti, Navratri, Guru Purnima).

### Frontend (React 19 + Tailwind + shadcn/ui)
- **Design system**: Cormorant Garamond (headings), Manrope (body), Tiro Devanagari Sanskrit (Sanskrit) — no Inter/Roboto. Parchment light / cosmic dark. Terracotta primary, ochre accent. Light+dark theme toggle. Grain overlay.
- **Public pages**: Landing (hero + shloka-of-day + tracks + bento featured + consultation CTA), Courses (7 offerings, filter by type/track + search), Course Detail (with Shloka Player + Ācharya parampara), Calculators (5 tabs), Consultation form, Certificate verification (public), Community feed, Login, Register.
- **Learner portal** (`/learner`): My study, Live sessions ("Join Now" 5-min before), Certificates.
- **Ācharya portal** (`/acharya`): Parampara header, approval queue, published-under-my-name list, doubts assigned to me.
- **Academic Staff portal** (`/staff`): Course builder form, all offerings list, doubts inbox, consultations tab (with contacted/closed actions).
- **Admin/Super Admin portal** (`/admin`): Capability matrix (staff × 6 capabilities Switch grid), Users (role changer — super_admin only can appoint super_admin), Publishing toggles, Festival calendar, Audit log.
- **Shloka Player**: cinematic asymmetric layout with hover word-highlighting, translations/commentaries tabs, glass audio bar with speed selector and record-yourself.
- **Sadhana counter**: sankalpa vow ritual, large tap-to-count japa button, compassionate 21-day streak arc.

## Architectural Foundations
1. **Verses are first-class objects** (not text buried in lessons) — enables Shloka Player, verse-anchored community, citation search.
2. **One `Offering` model** with a `type` discriminator (7 delivery modes) on shared commerce spine.
3. **One user identity** with role + composable capability grants → four computed portals.
4. **PlugNmeet-ready** live session model (currently mocked; swap in production).

## What's Mocked / Explicitly Deferred
- **Razorpay** payments: mocked webhook. Real integration needs `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / webhook signature verification.
- **PlugNmeet**: mocked join URL. Real integration needs self-hosted PlugNmeet + API key/secret.
- **Firebase Phone OTP**: user chose email/password JWT for MVP; OTP layer optional per user's choice.
- **Per-offering capability scoping**: MVP grants at scope `*`; UI to scope grants to specific offering IDs is P1.
- **WhatsApp / email notifications**: not implemented.
- **PPP-adjusted pricing**: single INR/USD only.
- **Bandwidth-aware low-bitrate video**: depends on PlugNmeet.
- **Vedic accent marks toggle in Shloka Player**: verses seeded without accents.
- **Full e-book reader**: e-book offering type exists; reader UI is basic.

## Prioritized Backlog

### P0 — Real integrations
- Razorpay live integration (INR) + Stripe (USD) with webhook signature verification.
- PlugNmeet self-hosted deployment + real token minting.
- Firebase Phone OTP (optional layer on top of email/password).

### P1 — Depth per portal
- Per-offering capability scoping UI (grant "answer doubts on these 2 courses only").
- Quiz author UI (currently API-only); staff-side grading dashboard for open-ended answers.
- Course builder module/lesson/verse-attach UI (currently text form only).
- E-book reader with page navigation + Devanagari embedded.
- Cohort management (group chat, breakout scheduling).

### P2 — Growth / trust
- WhatsApp notifications on session-imminent, sadhana-nudge.
- Marketing calendar automation tied to festivals.
- Discussion threading in community; moderator dashboard.
- Verse-search across scriptures.
- Citation search across all commentaries.

## Test Credentials
See `/app/memory/test_credentials.md`

## Test Status (Iteration 1)
- Backend: 34/34 pytest passing
- Frontend: 100% of critical flows verified via Playwright
- No critical bugs

---

## Iteration 2 — Feb 2026 (OccultGurukul-style expansion + vibrant redesign)

### Added — content sections & pages (modelled on occultgurukul.com)
- **Rotating hero carousel** (4 slides): Live Mentorship, Gupt Navrātri Sādhana, Mahā Śivarātri Bootcamp, Foundation of the Gītā — each with price, orig-price, dual CTAs, illustration ring
- **Stats ribbon**: 620K+ Learners, 60+ Learning Paths, 4.8★ Google, 30+ Mentors, 51+ Years Legacy — from `GET /api/stats`
- **"As Featured In"** marquee: TEDx, Mid-day, Lokmat Times, The Hindu, Times of India, NDTV, Republic, HT
- **Subject marquee**: Astrology, Numerology, Panchang, Kundli, Vastu, Tarot, Gītā, Vedas, Upaniṣads, Sanskrit, Meditation, Mantras, Rāmāyaṇa, Mahābhārata, Purāṇas
- **Upcoming Webinars section** (`GET /api/webinars`, 5 seeded) — cover, live countdown chip, price/orig-price, "Only X seats left" scarcity badge, per-webinar full countdown timer on `/webinars` page
- **Trending Courses grid** — badges (Basic/Live/Practice/Advanced + festival), 4.7-4.9★ ratings, learner count, hours, "1 Yr Access · Certificate · Live Practice" chips
- **Free Tools grid** (6 cards): Numerology, Kundli, Tarot Reflection, Rāma Śalākā, Devanāgarī Translit, Shloka of the Day — each links into `/calculators`
- **Mentors carousel** (`GET /api/mentors`, 8 seeded) — auto-advancing with prev/next controls; full `/mentors` page with parampara, credentials, bios
- **Blog/Journal section** (`GET /api/blogs`, 5 seeded posts) — bento layout on landing, full `/blog` category-filterable list, `/blog/:slug` reader page with related posts
- **Testimonials** (`GET /api/testimonials`, 6 seeded) — photo + rating + quote + course-attribution
- **Community photos marquee** — infinite horizontal scroll
- **Consultation CTA banner** — deep cosmic gradient with orbs
- **Floating chat widget** — Occult-Gurukul-style; pulse-glowing bubble, teaser after 6s, opens to scripted assistant that routes queries about Gītā/Sanskrit/astrology/sadhana/free
- **Events page** — festival calendar with date badges + upcoming sessions list
- **About Us page** — 4 trust cards + editorial layout

### Added — new endpoints
- `GET /api/blogs`, `GET /api/blogs/{slug}` (with category filter)
- `GET /api/webinars` (with `starts_in_seconds`, `is_live`)
- `GET /api/mentors`, `GET /api/testimonials`, `GET /api/stats`
- `POST /api/calculators/tarot` (3-card spread — reflective, not predictive)
- `POST /api/calculators/ram-shalaka` (Śrī Rāma Śalākā prashna — reflective counsel)

### Nav — expanded (7 items)
Courses · Webinars · Mentors · Free Tools · Journal · Events · Consultation (+ mobile hamburger menu)

### Redesign — vibrant impressive theme
- **Default: dark cosmic** (deep midnight indigo `#0d0620` base) with **saffron/marigold/gold/magenta** jewel accents
- **Fraunces** (variable display serif) as new headline face — richer, more editorial than plain Cormorant
- Gradient text (`text-gradient-hot` saffron→magenta→gold) on all major headlines
- **Sacred geometry orbs** (blurred conic-gradient mandala + floating orbs) in hero, mentors, testimonials, CTA
- Floating illustrated hero ring with concentric borders + emoji sigils (🕉️ 🪔 🔱 📿)
- `card-elevated` hover — slight lift + saffron shadow glow + accent border
- Slow marquees with edge fade masks
- Pulse-glow on primary CTAs

### Test status (Iteration 2)
- **Backend: 51/51 pytest passing** (34 iter1 regression + 17 new)
- **Frontend: 100% of critical & new flows verified** (hero carousel, stats ribbon, all new sections, blog list+detail, webinars, mentors, events, about, chat widget, tarot & ram-shalaka calculators, theme toggle)
- No critical bugs; auth-me console noise noted as cosmetic only
