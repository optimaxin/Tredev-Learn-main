import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { fetchDailyVerse } from "@/lib/dailyVerse";
import { Button } from "@/components/ui/button";
import { HOME } from "@/constants/testIds";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import CourseCard from "@/components/CourseCard";
import MentorCard from "@/components/MentorCard";
import {
  Star, Clock, Sparkles, Play,
  Calculator, Compass, Hand, Languages, ScrollText, Wand2, ArrowRight, CheckCircle2, Quote,
  CalendarDays, Spade
} from "lucide-react";

const PORTRAIT = "/assets/person.png";

const FREE_TOOLS = [
  { id: "panchang", icon: CalendarDays, to: "/calculators?tab=panchang", accent: "from-sky-500 to-blue-600" },
  { id: "numerology", icon: Calculator, to: "/calculators?tab=numerology", accent: "from-amber-500 to-orange-500" },
  { id: "kundli", icon: Compass, to: "/calculators?tab=kundli", accent: "from-primary to-secondary" },
  { id: "tarot", icon: Spade, to: "/calculators?tab=tarot", accent: "from-primary/80 to-secondary" },
  { id: "shalaka", icon: Hand, to: "/calculators?tab=shalaka", accent: "from-orange-600 to-amber-500" },
  { id: "translit", icon: Languages, to: "/calculators?tab=translit", accent: "from-secondary to-primary" },
  { id: "shlokaOfDay", icon: ScrollText, to: "/shloka-of-the-day", accent: "from-amber-400 to-yellow-500" },
];

const HERO_MANTRA = "ॐ सह नाववतु । सह नौ भुनक्तु । सह वीर्यं करवावहै । • ";

const SUBJECTS = ["Astrology", "Numerology", "Panchang", "Kundli", "Vastu", "Tarot", "Bhagavad Gītā", "Vedas", "Upaniṣads", "Sanskrit", "Meditation", "Mantras", "Rāmāyaṇa", "Mahābhārata", "Purāṇas"];

const FEATURED_IN = [
  "TEDx", "Mid-day", "Lokmat Times", "The Hindu", "Times of India", "NDTV", "Republic", "Hindustan Times"
];

function Hero({ stats }) {
  const { t } = useTranslation();
  const rating = stats?.google_rating || 4.8;
  const learners = Math.round((stats?.learners_display || 620000) / 1000);
  return (
    <section className="relative overflow-hidden pt-8 md:pt-14 pb-14 md:pb-20">
      {/* Orbs */}
      {/* <div className="orb orb-saffron w-[480px] h-[480px] top-4 left-4 animate-float" />
      <div className="orb orb-magenta w-[520px] h-[520px] top-12 right-4" />
      <div className="orb orb-gold w-[380px] h-[380px] bottom-4 left-[35%]" />
      <div className="mandala top-4 right-4" />  */}

      <div className="relative site-container">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center min-h-[560px]">
          <div className="fade-in-up">
            <span className="chip bg-card/90 text-secondary border border-secondary/40 shadow-sm" data-testid="hero-tag">
              <Sparkles className="w-3 h-3" /> {t("landing.hero.badge", { rating, learners })}
            </span>
            <h1 className="mt-6 font-hero text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight text-foreground" data-testid="landing-hero">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-6 text-lg text-foreground/80 leading-relaxed max-w-xl">{t("landing.hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/courses" data-testid={HOME.ctaExplore}>
                <Button size="lg" className="rounded-full h-14 px-10 bg-primary text-primary-foreground border-0 hover:opacity-95">
                  {t("landing.hero.exploreCourses")}
                </Button>
              </Link>
              <Link to="/events">
                <Button size="lg" variant="outline" className="rounded-full h-14 px-10 border-primary/40 hover:border-primary">
                  <Play className="w-4 h-4 mr-2" /> {t("landing.hero.joinWebinar")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Portrait column — Brand ambassador ringed by a revolving mantra */}
          <div className="relative hidden lg:block">
            <div className="relative w-full aspect-square max-w-[500px] mx-auto">
              {/* Revolving ring, clipped to a circle so the text glow never
                  shows its square bounding-box edge past the ring itself */}
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                {/* Revolving golden mantra ring */}
                <svg className="absolute inset-0 w-full h-full animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100" aria-hidden="true">
                  <defs>
                    <path id="hero-mantra-circle" d="M50,50 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
                  </defs>
                  <text
                    fontSize="4"
                    letterSpacing="1.5"
                    className="font-hero"
                    style={{ fill: "var(--color-secondary)", textShadow: "0 0 10px var(--color-secondary), 0 0 20px #e67e22" }}
                  >
                    <textPath href="#hero-mantra-circle">{HERO_MANTRA.repeat(3)}</textPath>
                  </text>
                </svg>
              </div>

              {/* Portrait */}
              <div className="absolute inset-14 rounded-full overflow-hidden border-2 border-secondary/50 shadow-[0_20px_60px_-10px_hsl(22_92%_40%/0.35)]">
                <img
                  src={PORTRAIT}
                  alt="Brand ambassador"
                  data-testid="hero-portrait"
                  className="w-full h-full object-cover object-[center_15%]"
                />
              </div>

              {/* Floating badges */}
              <div className="absolute top-2 -left-6 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "1s" }}>
                <div className="text-xs font-medium">✨ Ācharya-signed</div>
              </div>
              <div className="absolute bottom-10 -right-6 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "2s" }}>
                <div className="text-xs font-medium">📜 Certificate issued</div>
              </div>
              <div className="absolute bottom-0 left-8 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "3s" }}>
                <div className="text-xs font-medium">🎓 4.8★ Google</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats ribbon */}
      <div className="mt-16 site-container">
        <div className="glass rounded-2xl p-6 md:p-8 grid grid-cols-2 md:grid-cols-5 gap-6 border border-accent/30" data-testid="stats-ribbon">
          {[
            { n: `${Math.round((stats?.learners_display || 620000) / 1000)}K+`, l: t("landing.stats.learners") },
            { n: `${stats?.paths_display || 60}+`, l: t("landing.stats.learningPaths") },
            { n: `${stats?.google_rating || 4.8}★`, l: t("landing.stats.googleRating") },
            { n: `${stats?.mentors_display || 30}+`, l: t("landing.stats.expertMentors") },
            { n: `${stats?.years_of_legacy || 51}+`, l: t("landing.stats.yearsLegacy") },
          ].map((s, i) => (
            <div key={i} className={`text-center md:text-left ${i > 0 ? "md:border-l md:border-border md:pl-6" : ""}`}>
              <div className="font-display text-3xl md:text-4xl font-bold tabular text-gradient-cosmic">{s.n}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SubjectMarquee() {
  return (
    <section className="py-8">
      <div className="site-container">
        <div className="marquee-fade overflow-hidden rounded-2xl border border-border bg-muted/40 py-4">
          <div className="flex gap-10 marquee-track w-max px-6">
            {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
              <div key={i} className="flex items-center gap-3 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-hot" />
                <span className="font-display italic text-lg text-accent">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedIn() {
  const { t } = useTranslation();
  return (
    <section className="py-8 border-b border-border">
      <div className="site-container">
        <div className="eyebrow text-center mb-5 opacity-70">{t("landing.featuredIn.eyebrow")}</div>
        <div className="marquee-fade overflow-hidden">
          <div className="flex gap-14 marquee-track-slow w-max items-center px-4">
            {[...FEATURED_IN, ...FEATURED_IN].map((n, i) => (
              <div key={i} className="font-editorial italic text-2xl md:text-3xl text-primary/60 whitespace-nowrap">{n}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CountdownChip({ startsInSeconds }) {
  const { t } = useTranslation();
  const [remain, setRemain] = useState(startsInSeconds);
  useEffect(() => {
    setRemain(startsInSeconds);
    const timer = setInterval(() => setRemain((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [startsInSeconds]);
  if (remain <= 0) return <span className="chip bg-secondary text-secondary-foreground">{t("landing.webinars.liveNow")}</span>;
  const d = Math.floor(remain / 86400), h = Math.floor((remain % 86400) / 3600),
        m = Math.floor((remain % 3600) / 60);
  const label = d >= 1 ? `${d}d ${h}h` : `${h}h ${m}m`;
  return <span className="chip bg-primary/15 text-primary border border-primary/30"><Clock className="w-3 h-3" /> {t("landing.webinars.startsIn", { label })}</span>;
}

function WebinarsSection({ webinars }) {
  const { t } = useTranslation();
  if (!webinars?.length) return null;
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-magenta w-96 h-96 -left-32 top-40" />
      <div className="site-container relative">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-secondary/15 text-secondary border border-secondary/30 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> {t("landing.webinars.badge")}
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{t("landing.webinars.heading")}</h2>
            <p className="mt-3 text-muted-foreground max-w-xl">{t("landing.webinars.subtext")}</p>
          </div>
          <Link to="/events" className="text-primary link-underline text-sm font-medium">{t("landing.webinars.seeAll")}</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {webinars.slice(0, 4).map((w) => (
            <Link to="/events" key={w.id} className="group rounded-2xl border border-border overflow-hidden bg-card card-elevated block" data-testid={`webinar-${w.id}`}>
              <div className="relative aspect-[16/10] overflow-hidden">
                <img src={w.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute top-3 left-3">
                  <CountdownChip startsInSeconds={w.starts_in_seconds} />
                </div>
                {w.seats_remaining && w.seats_remaining < 30 && (
                  <div className="absolute top-3 right-3 chip bg-destructive text-destructive-foreground">
                    {t("landing.webinars.seatsLeft", { count: w.seats_remaining })}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 chip bg-card/95 text-primary">
                  <Clock className="w-3 h-3" /> {new Date(w.starts_at).toLocaleString(undefined, { day: "numeric", month: "short" })}
                </div>
              </div>
              <div className="p-5">
                <div className="font-display text-lg font-semibold leading-snug text-primary">{w.title}</div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-xl text-accent tabular">₹{w.price_inr}</span>
                    {w.orig_price_inr > w.price_inr && <span className="text-xs text-primary/50 line-through tabular">₹{w.orig_price_inr}</span>}
                  </div>
                  <Button size="sm" className="rounded-full bg-primary text-primary-foreground border-0" data-testid={`webinar-register-${w.id}`}>
                    {t("landing.webinars.enrollNow")}
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PopularCoursesSection({ courses }) {
  const { t } = useTranslation();
  if (!courses?.length) return null;
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-violet w-96 h-96 -right-32 top-10" />
      <div className="site-container relative">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">{t("landing.courses.badge")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              {t("landing.courses.headingPlain")}<span className="text-gradient-hot">{t("landing.courses.headingHighlight")}</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">{t("landing.courses.subtext")}</p>
          </div>
          <Link to="/courses" data-testid="popular-courses-view-all" className="text-primary link-underline text-sm font-medium">{t("landing.courses.viewAll")}</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 3).map((o) => <CourseCard key={o.id} course={o} />)}
        </div>
      </div>
    </section>
  );
}

function FreeToolsSection() {
  const { t } = useTranslation();
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-gold w-96 h-96 right-[10%] top-20" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">
            <Wand2 className="w-3 h-3" /> {t("landing.tools.badge")}
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            {t("landing.tools.headingPlain")}<span className="text-gradient-hot">{t("landing.tools.headingHighlight")}</span>{t("landing.tools.headingSuffix")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{t("landing.tools.subtext")}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FREE_TOOLS.map((tool, i) => (
            <Link to={tool.to} key={i} data-testid={`free-tool-${i}`}
              className="group rounded-2xl border border-border p-6 bg-card card-elevated flex items-start gap-5 relative overflow-hidden">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.accent} flex items-center justify-center shrink-0 shadow-lg`}>
                <tool.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-semibold">{t(`landing.tools.${tool.id}.name`)}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(`landing.tools.${tool.id}.desc`)}</p>
                <div className="mt-3 text-xs text-primary font-medium flex items-center gap-1">
                  {t("landing.tools.tryFree")} <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function MentorsSection({ mentors }) {
  const { t } = useTranslation();
  if (!mentors?.length) return null;
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-transparent via-muted/30 to-transparent relative overflow-hidden">
      <div className="mandala top-10 -left-40" />
      <div className="site-container relative">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-accent/15 text-accent border border-accent/30 mb-3">{t("landing.mentors.badge")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">
              {t("landing.mentors.headingPlain")}<span className="text-gradient-hot">{t("landing.mentors.headingHighlight")}</span>{t("landing.mentors.headingSuffix")}
            </h2>
          </div>
          <Link to="/mentors" className="text-sm text-primary link-underline font-medium">{t("landing.mentors.seeAll")}</Link>
        </div>
      </div>
      <div className="marquee-fade overflow-hidden">
        <div className="flex gap-6 marquee-track w-max px-6">
          {[...mentors, ...mentors].map((m, i) => (
            <Link to="/mentors" key={`${m.id}-${i}`} data-testid={`mentor-${m.id}`} className="block w-72 shrink-0">
              <MentorCard mentor={m} compact />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!testimonials?.length) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % testimonials.length), 5500);
    return () => clearInterval(timer);
  }, [testimonials?.length]);
  if (!testimonials?.length) return null;
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-violet w-[500px] h-[500px] left-[-8rem] top-20" />
      <div className="orb orb-saffron w-96 h-96 right-[-4rem] bottom-10" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-secondary/15 text-secondary border border-secondary/30 mb-4">{t("landing.testimonials.badge")}</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            1,00,000+ <span className="text-gradient-hot">{t("landing.testimonials.headingHighlight")}</span><br />{t("landing.testimonials.headingRest")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((tst, i) => (
            <div key={tst.id} data-testid={`testimonial-${i}`}
              className={`rounded-2xl border border-border p-8 bg-card card-elevated relative ${i === idx % 3 ? "ring-2 ring-primary/40" : ""}`}>
              <Quote className="w-6 h-6 text-accent mb-4" />
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: tst.rating || 5 }).map((_, j) => <Star key={j} className="w-4 h-4 fill-accent text-accent" />)}
              </div>
              <p className="text-sm leading-relaxed text-foreground/85 line-clamp-6">"{tst.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <img src={tst.avatar} alt={tst.name} className="w-11 h-11 rounded-full object-cover border-2 border-accent/40" />
                <div>
                  <div className="font-display font-semibold">{tst.name}</div>
                  <div className="text-xs text-muted-foreground">{tst.role}</div>
                </div>
              </div>
              {tst.course && <div className="mt-3 chip bg-muted text-muted-foreground">{tst.course}</div>}
            </div>
          )).slice(0, 3)}
        </div>
      </div>
    </section>
  );
}

function BlogSection({ blogs }) {
  const { t } = useTranslation();
  if (!blogs?.length) return null;
  return (
    <section className="py-20 md:py-28 relative">
      <div className="site-container">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">{t("landing.blog.badge")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              {t("landing.blog.headingPrefix")}<span className="text-gradient-hot">Tredeva Learn</span>{t("landing.blog.headingSuffix")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">{t("landing.blog.subtext")}</p>
          </div>
          <Link to="/blog" className="text-primary link-underline text-sm font-medium">{t("landing.blog.allEssays")}</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {blogs.slice(0, 3).map((b, i) => (
            <Link key={b.id} to={`/blog/${b.slug}`} data-testid={`blog-${b.slug}`}
              className={`group rounded-2xl border border-border overflow-hidden bg-card card-elevated flex flex-col ${i === 0 ? "md:col-span-2 md:row-span-1" : ""}`}>
              <div className={`relative overflow-hidden ${i === 0 ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
                <img src={b.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="chip bg-white/95 text-black uppercase text-[10px]">{b.category}</span>
                </div>
              </div>
              <div className="p-6 flex-1">
                <h3 className={`font-display font-bold leading-tight ${i === 0 ? "text-2xl md:text-3xl" : "text-xl"}`}>{b.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed">{b.excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{b.author_name}</span>
                  <span>·</span>
                  <span>{b.read_time}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMMUNITY = [
  { name: "Priya Sharma", role: "Jyotiṣa · Level 2", accent: "from-primary to-secondary" },
  { name: "Arjun Menon", role: "Sanskrit Foundation", accent: "from-amber-500 to-orange-500" },
  { name: "Ananya Rao", role: "Gītā Cohort ’25", accent: "from-secondary to-orange-600" },
  { name: "Vikram Desai", role: "Panchāṅga Practitioner", accent: "from-primary/70 to-primary" },
  { name: "Meera Krishnan", role: "Numerology · Certified", accent: "from-orange-500 to-amber-500" },
  { name: "Rohan Tiwari", role: "Vāstu Studies", accent: "from-primary to-primary/50" },
  { name: "Kavya Nair", role: "Mantra Sādhana", accent: "from-amber-400 to-yellow-500" },
  { name: "Aditya Pillai", role: "Upaniṣad Circle", accent: "from-secondary to-primary" },
  { name: "Ishaan Verma", role: "Tarot Reflection", accent: "from-primary to-amber-500" },
  { name: "Sneha Bhatt", role: "Rāmāyaṇa Study", accent: "from-orange-600 to-secondary" },
];

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function CommunityMarquee() {
  const { t } = useTranslation();
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="site-container text-center mb-10">
        <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">{t("landing.community.badge")}</div>
        <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          {t("landing.community.headingPlain")}<span className="text-gradient-cosmic">{t("landing.community.headingHighlight")}</span>
        </h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{t("landing.community.subtext")}</p>
      </div>
      <div className="site-container">
        <div className="marquee-fade overflow-hidden">
          <div className="flex gap-4 marquee-track w-max" aria-hidden="true">
            {[...COMMUNITY, ...COMMUNITY].map((m, i) => (
            <div key={i} className="relative w-40 h-40 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-border shrink-0 group">
              <div className={`absolute inset-0 bg-gradient-to-br ${m.accent} opacity-90`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display font-bold text-5xl md:text-6xl text-white/95 drop-shadow">{initials(m.name)}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-left">
                <div className="text-white text-sm font-semibold leading-tight">{m.name}</div>
                <div className="text-white/80 text-[11px] leading-tight">{m.role}</div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SampleCertificateSection() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" data-testid="sample-certificate-section">
      <div className="orb orb-gold w-96 h-96 left-[5%] top-10" />
      <div className="orb orb-magenta w-80 h-80 right-[8%] bottom-10" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">{t("landing.certificate.badge")}</div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            {t("landing.certificate.headingPlain")}<span className="text-gradient-hot">{t("landing.certificate.headingHighlight")}</span>{t("landing.certificate.headingSuffix")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{t("landing.certificate.subtext")}</p>
        </div>

        {/* Certificate card */}
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl p-1 bg-gradient-to-br from-primary via-secondary to-accent shadow-[0_30px_80px_-20px_hsl(244_49%_20%/0.45)]" data-testid="sample-certificate">
            <div className="relative rounded-[14px] p-8 md:p-14 overflow-hidden"
                 style={{ background: "linear-gradient(135deg, #fdf7e8 0%, #f6ecd0 50%, #f0dfae 100%)" }}>
              {/* Watermark 🕉 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.045]">
                <span className="text-[28rem] leading-none font-devanagari text-amber-900">ॐ</span>
              </div>

              {/* Ornate corner flourishes */}
              {[
                "top-4 left-4", "top-4 right-4 rotate-90",
                "bottom-4 left-4 -rotate-90", "bottom-4 right-4 rotate-180",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-16 h-16 ${cls}`}>
                  <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#b45309" strokeWidth="1.2">
                    <path d="M4 4 L28 4 M4 4 L4 28" />
                    <path d="M4 4 Q16 8 20 20 Q8 16 4 4" fill="#d97706" opacity="0.6" />
                    <circle cx="4" cy="4" r="2" fill="#b45309" />
                  </svg>
                </div>
              ))}

              {/* Double border */}
              <div className="absolute inset-6 border-2 border-amber-800/40 rounded-lg pointer-events-none" />
              <div className="absolute inset-8 border border-amber-800/25 rounded pointer-events-none" />

              {/* Content */}
              <div className="relative text-center text-amber-950">
                {/* Header — brand */}
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-display font-bold text-xl shadow-lg">T</div>
                  <div className="text-left">
                    <div className="font-display font-bold text-2xl tracking-tight text-amber-900">TREDEVA LEARN</div>
                    <div className="text-[10px] tracking-[0.32em] text-amber-800/70">वेद विद्या · A CREDENTIAL WORTH HOLDING</div>
                  </div>
                </div>

                {/* Ornament rule */}
                <div className="flex items-center justify-center gap-3 my-8">
                  <div className="h-px flex-1 max-w-[180px] bg-gradient-to-r from-transparent to-amber-800/50" />
                  <span className="text-amber-800 text-xl">✦</span>
                  <div className="h-px flex-1 max-w-[180px] bg-gradient-to-l from-transparent to-amber-800/50" />
                </div>

                {/* Title */}
                <div className="font-display italic text-lg text-amber-800/80">Certificate of Study</div>
                <div className="font-devanagari text-2xl mt-1 text-amber-900">प्रमाणपत्रम्</div>

                {/* Recipient */}
                <div className="mt-8">
                  <div className="text-xs tracking-[0.28em] uppercase text-amber-800/70">This is to certify that</div>
                  <div className="font-display font-bold text-5xl md:text-6xl mt-3 tracking-tight text-amber-950" style={{ fontFeatureSettings: '"liga","dlig"' }}>
                    Priyā Sharmā
                  </div>
                  <div className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-amber-900/85 leading-relaxed">
                    has successfully completed the rigorous, verse-by-verse study of
                  </div>
                  <div className="mt-3 font-display italic text-2xl md:text-3xl text-amber-900">
                    Bhagavad Gītā — A Verse-by-Verse Journey
                  </div>
                  <div className="mt-3 text-xs text-amber-800/70 tracking-widest">
                    12 WEEKS · 3 ATTRIBUTED COMMENTARIES · 42 SHLOKAS · FINAL ASSESSMENT PASSED
                  </div>
                </div>

                {/* Ornament rule */}
                <div className="flex items-center justify-center gap-3 my-10">
                  <div className="h-px flex-1 max-w-[200px] bg-gradient-to-r from-transparent to-amber-800/40" />
                  <span className="font-devanagari text-2xl text-amber-800">॥</span>
                  <div className="h-px flex-1 max-w-[200px] bg-gradient-to-l from-transparent to-amber-800/40" />
                </div>

                {/* Signatures + Seal */}
                <div className="grid grid-cols-3 gap-6 items-end">
                  {/* Ācharya sign */}
                  <div className="text-center">
                    <div className="font-editorial italic text-xl md:text-2xl text-amber-950 -mb-1">
                      V. Shastri
                    </div>
                    <div className="border-t border-amber-800/60 pt-2 mt-1">
                      <div className="font-serif text-sm text-amber-900 font-semibold">Ācharya Vishwanath Shastri</div>
                      <div className="text-[10px] tracking-widest uppercase text-amber-800/70">Signed for accuracy</div>
                    </div>
                  </div>

                  {/* Center seal */}
                  <div className="flex justify-center">
                    <div className="relative w-24 h-24 md:w-28 md:h-28">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-600 to-red-700 flex items-center justify-center shadow-lg">
                        <div className="w-[86%] h-[86%] rounded-full border-2 border-amber-100/70 flex items-center justify-center flex-col">
                          <div className="font-devanagari text-2xl md:text-3xl text-amber-50 leading-none">ॐ</div>
                          <div className="text-[7px] tracking-[0.3em] text-amber-100 mt-1">TREDEV</div>
                          <div className="text-[7px] tracking-[0.3em] text-amber-100">SEAL</div>
                        </div>
                      </div>
                      {/* Rotating text ring */}
                      <svg className="absolute inset-0 w-full h-full animate-[spin_25s_linear_infinite]" viewBox="0 0 100 100">
                        <defs>
                          <path id="cert-seal-circle" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
                        </defs>
                        <text fontSize="6.5" fill="#78350f" fontFamily="'Plus Jakarta Sans', sans-serif" letterSpacing="4">
                          <textPath href="#cert-seal-circle">• AUTHENTIC · VERIFIED · ĀCHARYA-SIGNED · TREDEVA LEARN {year}</textPath>
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Director sign */}
                  <div className="text-center">
                    <div className="font-editorial italic text-xl md:text-2xl text-amber-950 -mb-1">
                      A. Iyer
                    </div>
                    <div className="border-t border-amber-800/60 pt-2 mt-1">
                      <div className="font-serif text-sm text-amber-900 font-semibold">Ānanya Iyer</div>
                      <div className="text-[10px] tracking-widest uppercase text-amber-800/70">Academic Director</div>
                    </div>
                  </div>
                </div>

                {/* Verification footer */}
                <div className="mt-10 flex items-center justify-between text-[10px] tracking-widest uppercase text-amber-800/80 border-t border-amber-800/25 pt-4">
                  <div>Issued {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" })}</div>
                  <div>Verify at <span className="underline decoration-amber-800/40">tredevlearn.com/verify</span></div>
                  <div className="font-mono">TDL-8F3A-{year}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Under-certificate note + verify CTA */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              {t("landing.certificate.caption")}
            </div>
            <div className="flex gap-3">
              <Link to="/verify/TDL-8F3A-DEMO" data-testid="verify-sample-btn">
                <Button variant="outline" className="rounded-full">{t("landing.certificate.tryVerification")}</Button>
              </Link>
              <Link to="/courses">
                <Button className="rounded-full bg-gradient-hot text-white border-0 btn-glow">{t("landing.certificate.earnYours")} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConsultationCTA() {
  const { t } = useTranslation();
  return (
    <section className="py-20 md:py-28">
      <div className="site-container">
        <div className="relative rounded-3xl overflow-hidden border border-accent/30 bg-gradient-cosmic p-10 md:p-16 grid md:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="orb orb-saffron w-72 h-72 -top-20 -right-10" />
          <div className="orb orb-gold w-64 h-64 -bottom-20 -left-10" />
          <div className="relative">
            <Sparkles className="w-6 h-6 text-accent mb-4" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">{t("landing.consultation.heading")}</h2>
            <p className="mt-4 text-white/80 leading-relaxed max-w-xl">
              {t("landing.consultation.subtextPre")}<strong className="text-accent">{t("landing.consultation.subtextStrong")}</strong>{t("landing.consultation.subtextPost")}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> {t("landing.consultation.bullet1")}</li>
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> {t("landing.consultation.bullet2")}</li>
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> {t("landing.consultation.bullet3")}</li>
            </ul>
          </div>
          <div className="relative text-center md:text-right">
            <Link to="/consultation" data-testid={HOME.ctaConsultation}>
              <Button size="lg" className="rounded-full h-14 px-10 bg-gradient-hot text-white btn-glow border-0 text-base">
                {t("landing.consultation.cta")} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <div className="mt-3 text-xs text-white/60">{t("landing.consultation.caption")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const [shloka, setShloka] = useState(null);
  const [webinars, setWebinars] = useState([]);
  const [courses, setCourses] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDailyVerse().then(setShloka).catch(() => {});
    api.get("/webinars").then((r) => setWebinars(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/offerings").then((r) => setCourses(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/mentors").then((r) => setMentors(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/testimonials").then((r) => setTestimonials(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/blogs").then((r) => setBlogs(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <Hero stats={stats} />
      <SubjectMarquee />
      <FeaturedIn />
      <WebinarsSection webinars={webinars} />
      <PopularCoursesSection courses={courses} />
      <FreeToolsSection />

      {shloka && shloka.devanagari && (
        <section className="py-20 md:py-28 relative">
          <div className="site-container">
            <div className="text-center mb-10">
              <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">{t("landing.verse.badge")}</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                {t("landing.verse.headingPlain")}<span className="text-gradient-hot">{t("landing.verse.headingHighlight")}</span>{t("landing.verse.headingSuffix")}
              </h2>
            </div>
            <ShlokaPlayer verse={shloka} />
          </div>
        </section>
      )}

      <MentorsSection mentors={mentors} />
      <BlogSection blogs={blogs} />
      <TestimonialsSection testimonials={testimonials} />
      <CommunityMarquee />
      <SampleCertificateSection />
      <ConsultationCTA />
    </div>
  );
}
