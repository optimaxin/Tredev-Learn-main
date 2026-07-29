import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOME } from "@/constants/testIds";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import {
  ChevronRight, ChevronLeft, Star, Clock, Users, Award, Sparkles, Play, TrendingUp,
  Calculator, Hand, Feather, ScrollText, Wand2, ArrowRight, CheckCircle2, Quote
} from "lucide-react";

const AMBASSADOR_MEDITATE = "/assets/ambassador-meditate.png";
const AMBASSADOR_TEACH = "/assets/ambassador-teach.png";

const HERO_SLIDES = [
  {
    tag: "LIVE MENTORSHIP",
    title: "Learn the Vedic traditions from a real Ācharya",
    subtitle: "Batch starts on Vasant Panchamī · book your seat now",
    price: "₹5,000",
    origPrice: "₹39,000",
    cta: "Reserve my seat",
    ctaLink: "/courses",
    ctaAlt: "Explore course",
    ctaAltLink: "/courses",
    accent: "from-violet-600 via-fuchsia-500 to-amber-400",
    portrait: AMBASSADOR_TEACH,
  },
  {
    tag: "GUPT NAVRĀTRI · SADHANA",
    title: "Nine days. One vow. Move with the ritual calendar.",
    subtitle: "Live guided sādhana with an Ācharya · induction night included",
    price: "₹2,999",
    cta: "Join the sadhana",
    ctaLink: "/courses?type=sadhana",
    ctaAlt: "Full details",
    ctaAltLink: "/courses?type=sadhana",
    accent: "from-fuchsia-600 via-rose-500 to-amber-400",
    portrait: AMBASSADOR_MEDITATE,
  },
  {
    tag: "MAHĀ ŚIVARĀTRI · BOOTCAMP",
    title: "Master the Rudram — chant, meaning, and prāṇa",
    subtitle: "Two-evening intensive · live Q&A with the Ācharya",
    price: "₹8,000",
    origPrice: "₹10,000",
    cta: "Enroll now",
    ctaLink: "/webinars",
    ctaAlt: "Know more",
    ctaAltLink: "/webinars",
    accent: "from-indigo-500 via-violet-600 to-fuchsia-500",
    portrait: AMBASSADOR_MEDITATE,
  },
  {
    tag: "FOUNDATION",
    title: "The Bhagavad Gītā — Verse by Verse",
    subtitle: "18 chapters. Three commentaries. One Ācharya's signature.",
    price: "₹4,999",
    cta: "Start learning",
    ctaLink: "/courses",
    ctaAlt: "View curriculum",
    ctaAltLink: "/courses",
    accent: "from-amber-500 via-orange-500 to-rose-500",
    portrait: AMBASSADOR_TEACH,
    /* scripture slide keeps a warm gold→rose signature */
  },
];

const FREE_TOOLS = [
  { icon: Calculator, name: "Numerology", desc: "Your Mūlāṅka, Bhāgyāṅka & destiny number in seconds.", to: "/calculators", accent: "from-amber-500 to-orange-500" },
  { icon: Star, name: "Kundli", desc: "Twelve-house birth chart as a study object.", to: "/calculators", accent: "from-violet-600 to-fuchsia-600" },
  { icon: Wand2, name: "Tarot Reflection", desc: "Three-card spread — a mirror, not a prophecy.", to: "/calculators", accent: "from-indigo-500 to-violet-600" },
  { icon: Hand, name: "Rāma Śalākā", desc: "Ask Śrī Rāma — reflective counsel from the tradition.", to: "/calculators", accent: "from-rose-500 to-amber-500" },
  { icon: Feather, name: "Devanāgarī Translit", desc: "IAST → Devanāgarī, on the fly.", to: "/calculators", accent: "from-fuchsia-600 to-violet-600" },
  { icon: ScrollText, name: "Shloka of the Day", desc: "One verse. Fully attributed. Every day.", to: "/shloka-of-the-day", accent: "from-amber-400 to-yellow-500" },
];

const SUBJECTS = ["Astrology", "Numerology", "Panchang", "Kundli", "Vastu", "Tarot", "Bhagavad Gītā", "Vedas", "Upaniṣads", "Sanskrit", "Meditation", "Mantras", "Rāmāyaṇa", "Mahābhārata", "Purāṇas"];

const FEATURED_IN = [
  "TEDx", "Mid-day", "Lokmat Times", "The Hindu", "Times of India", "NDTV", "Republic", "Hindustan Times"
];

function HeroCarousel({ stats }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, []);
  const s = HERO_SLIDES[idx];
  return (
    <section className="relative overflow-hidden pt-8 md:pt-14 pb-14 md:pb-20">
      {/* Orbs */}
      <div className="orb orb-saffron w-[480px] h-[480px] -top-32 -left-32 animate-float" />
      <div className="orb orb-magenta w-[520px] h-[520px] -top-24 right-[-8rem]" />
      <div className="orb orb-gold w-[380px] h-[380px] bottom-[-6rem] left-[35%]" />
      <div className="mandala -top-40 -right-40" />

      <div className="relative site-container">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center min-h-[560px]">
          <div key={idx} className="fade-in-up">
            <span className="chip bg-primary/15 text-primary border border-primary/30" data-testid="hero-tag">
              <Sparkles className="w-3 h-3" /> {s.tag}
            </span>
            <h1 className="mt-6 font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight" data-testid="landing-hero">
              <span className={`bg-gradient-to-br ${s.accent} bg-clip-text text-transparent`}>{s.title.split(" ").slice(0, 3).join(" ")}</span>{" "}
              <span className="text-foreground">{s.title.split(" ").slice(3).join(" ")}</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/85 leading-relaxed max-w-xl">{s.subtitle}</p>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-gradient-hot">{s.price}</span>
              {s.origPrice && <span className="text-lg text-muted-foreground line-through">{s.origPrice}</span>}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to={s.ctaLink} data-testid={HOME.ctaExplore}>
                <Button size="lg" className="rounded-full h-13 px-8 bg-gradient-hot text-white btn-glow border-0 hover:opacity-95">
                  {s.cta} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to={s.ctaAltLink}>
                <Button size="lg" variant="outline" className="rounded-full h-13 px-8 border-accent/50 hover:border-accent">
                  {s.ctaAlt}
                </Button>
              </Link>
            </div>

            {/* Slide dots */}
            <div className="mt-10 flex gap-2">
              {HERO_SLIDES.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} data-testid={`hero-dot-${i}`}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-gradient-hot" : "w-4 bg-muted hover:bg-muted-foreground/40"}`} />
              ))}
            </div>
          </div>

          {/* Portrait column — Brand ambassador in centre of the circles */}
          <div className="relative hidden lg:block">
            <div className="relative w-full aspect-square max-w-[560px] ml-auto">
              {/* Concentric rings */}
              <div className="absolute inset-0 rounded-full border border-accent/25 animate-float" />
              <div className="absolute inset-6 rounded-full border border-primary/30" />
              <div className="absolute inset-14 rounded-full border-2 border-dashed border-secondary/40 animate-[spin_60s_linear_infinite]" />

              {/* Glow behind portrait */}
              <div className={`absolute inset-24 rounded-full bg-gradient-to-br ${s.accent} opacity-30 blur-2xl`} />

              {/* Portrait — cross-fade between slides */}
              {HERO_SLIDES.map((slide, i) => (
                <div key={i} className={`absolute inset-20 rounded-full overflow-hidden border-2 border-accent/40 shadow-[0_20px_60px_-10px_hsl(22_92%_40%/0.55)] transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  <img
                    src={slide.portrait}
                    alt="Brand ambassador"
                    data-testid={`hero-portrait-${i}`}
                    className="w-full h-full object-cover object-[center_15%] animate-float"
                    style={{ animationDelay: `${i * 0.5}s` }}
                  />
                  {/* Subtle inner gradient wash to blend with theme */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                </div>
              ))}

              {/* Floating badges */}
              <div className="absolute top-8 -left-4 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "1s" }}>
                <div className="text-xs font-medium">✨ Ācharya-signed</div>
              </div>
              <div className="absolute bottom-16 -right-4 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "2s" }}>
                <div className="text-xs font-medium">📜 Certificate issued</div>
              </div>
              <div className="absolute bottom-2 left-12 glass px-4 py-2 rounded-full animate-float z-10" style={{ animationDelay: "3s" }}>
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
            { n: `${Math.round((stats?.learners_display || 620000) / 1000)}K+`, l: "Learners" },
            { n: `${stats?.paths_display || 60}+`, l: "Learning paths" },
            { n: `${stats?.google_rating || 4.8}★`, l: "Google rating" },
            { n: `${stats?.mentors_display || 30}+`, l: "Expert mentors" },
            { n: `${stats?.years_of_legacy || 51}+`, l: "Years of legacy" },
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
  return (
    <section className="py-8 border-b border-border">
      <div className="site-container">
        <div className="overline text-center mb-5 opacity-70">As featured in</div>
        <div className="marquee-fade overflow-hidden">
          <div className="flex gap-14 marquee-track-slow w-max items-center px-4">
            {[...FEATURED_IN, ...FEATURED_IN].map((n, i) => (
              <div key={i} className="font-editorial italic text-2xl md:text-3xl text-muted-foreground opacity-70 whitespace-nowrap">{n}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CountdownChip({ startsInSeconds }) {
  const [remain, setRemain] = useState(startsInSeconds);
  useEffect(() => {
    setRemain(startsInSeconds);
    const t = setInterval(() => setRemain((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [startsInSeconds]);
  if (remain <= 0) return <span className="chip bg-secondary text-secondary-foreground">Live now</span>;
  const d = Math.floor(remain / 86400), h = Math.floor((remain % 86400) / 3600),
        m = Math.floor((remain % 3600) / 60);
  const label = d >= 1 ? `${d}d ${h}h` : `${h}h ${m}m`;
  return <span className="chip bg-primary/15 text-primary border border-primary/30"><Clock className="w-3 h-3" /> Starts in {label}</span>;
}

function WebinarsSection({ webinars }) {
  if (!webinars?.length) return null;
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-magenta w-96 h-96 -left-32 top-40" />
      <div className="site-container relative">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-secondary/15 text-secondary border border-secondary/30 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> LIVE & INTERACTIVE
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Upcoming Webinars</h2>
            <p className="mt-3 text-muted-foreground max-w-xl">Short, timely, single-evening intensives — the low-commitment entry into serious study.</p>
          </div>
          <Link to="/webinars" className="text-primary link-underline text-sm font-medium">See all →</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {webinars.slice(0, 4).map((w) => (
            <Link to="/webinars" key={w.id} className="group rounded-2xl border border-border overflow-hidden glass card-elevated block" data-testid={`webinar-${w.id}`}>
              <div className="relative aspect-[16/10] overflow-hidden">
                <img src={w.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute top-3 left-3">
                  <CountdownChip startsInSeconds={w.starts_in_seconds} />
                </div>
                {w.seats_remaining && w.seats_remaining < 30 && (
                  <div className="absolute top-3 right-3 chip bg-destructive text-destructive-foreground">
                    Only {w.seats_remaining} seats left
                  </div>
                )}
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-white font-display text-lg leading-tight">{w.title}</div>
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-muted-foreground">{new Date(w.starts_at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display font-bold text-xl text-primary tabular">₹{w.price_inr}</span>
                  {w.orig_price_inr > w.price_inr && <span className="text-xs text-muted-foreground line-through tabular">₹{w.orig_price_inr}</span>}
                </div>
                <Button size="sm" className="mt-3 w-full rounded-full bg-gradient-hot text-white border-0" data-testid={`webinar-register-${w.id}`}>
                  Register now
                </Button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoursesSection({ offerings }) {
  const trending = offerings.slice(0, 6);
  return (
    <section className="py-20 md:py-28 relative">
      <div className="site-container">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">
              <TrendingUp className="w-3 h-3" /> TRENDING PROGRAMS
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Most Popular Courses</h2>
            <p className="mt-3 text-muted-foreground max-w-xl">Learn at your own pace and become a credentialed practitioner.</p>
          </div>
          <Link to="/courses" className="text-primary link-underline text-sm font-medium">Explore more →</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trending.map((o) => (
            <Link key={o.id} to={`/courses/${o.id}`} data-testid={`course-card-${o.id}`}
              className="group rounded-2xl border border-border overflow-hidden bg-card card-elevated flex flex-col">
              <div className="relative aspect-[16/10] overflow-hidden">
                {o.image_url ? (
                  <img src={o.image_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 via-secondary/30 to-accent/30 flex items-center justify-center">
                    <span className="font-display text-6xl italic text-white/70">{o.subject?.[0] || "T"}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge className="bg-white/95 text-black hover:bg-white text-[10px] uppercase tracking-widest">{o.type === "recorded_course" ? "Basic" : o.type === "live_course" ? "Live" : o.type === "sadhana" ? "Practice" : "Advanced"}</Badge>
                </div>
                {o.festival && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-gradient-hot text-white border-0 text-[10px] uppercase tracking-widest">{o.festival}</Badge>
                  </div>
                )}
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="font-display text-xl text-white leading-tight">{o.title}</div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-2">{o.description}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {o.duration || "Self-paced"}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 2L+</span>
                  <span className="flex items-center gap-1 text-accent"><Star className="w-3 h-3 fill-current" /> 4.{7 + (o.title.length % 3)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <span className="chip bg-muted">1 Yr Access</span>
                  <span className="chip bg-muted">Certificate</span>
                  <span className="chip bg-muted">Live Practice</span>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    {o.price_inr === 0 ? (
                      <span className="font-display font-bold text-2xl text-primary">Free</span>
                    ) : (
                      <>
                        <span className="font-display font-bold text-2xl text-gradient-hot">₹{o.price_inr.toLocaleString()}</span>
                        <span className="ml-2 text-xs text-muted-foreground">/${o.price_usd}</span>
                      </>
                    )}
                  </div>
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Start <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FreeToolsSection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-gold w-96 h-96 right-[10%] top-20" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">
            <Wand2 className="w-3 h-3" /> COMPUTE · DON'T FORETELL
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Try <span className="text-gradient-hot">Free Tools</span> before you learn
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            High-intent, ungated tools. A chart is generated as a <em>study object</em>. Interpretation is the paid course; the computation is the free hook.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FREE_TOOLS.map((t, i) => (
            <Link to={t.to} key={i} data-testid={`free-tool-${i}`}
              className="group rounded-2xl border border-border p-6 bg-card card-elevated flex items-start gap-5 relative overflow-hidden">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${t.accent} flex items-center justify-center shrink-0 shadow-lg`}>
                <t.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-semibold">{t.name}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
                <div className="mt-3 text-xs text-primary font-medium flex items-center gap-1">
                  Try for free <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
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
  const [idx, setIdx] = useState(0);
  const perView = 4;
  const max = Math.max(0, mentors.length - perView);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i >= max ? 0 : i + 1)), 4500);
    return () => clearInterval(t);
  }, [max]);
  if (!mentors?.length) return null;
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-transparent via-muted/30 to-transparent relative overflow-hidden">
      <div className="mandala top-10 -left-40" />
      <div className="site-container relative">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-accent/15 text-accent border border-accent/30 mb-3">MENTORS</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">
              Meet the <span className="text-gradient-hot">keepers</span> of<br />ancient, timeless wisdom
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setIdx(Math.max(0, idx-1))} data-testid="mentors-prev" className="w-10 h-10 rounded-full border border-border hover:border-primary flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={()=>setIdx(Math.min(max, idx+1))} data-testid="mentors-next" className="w-10 h-10 rounded-full border border-border hover:border-primary flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
            <Link to="/mentors" className="ml-2 text-sm text-primary link-underline font-medium">See all →</Link>
          </div>
        </div>
        <div className="overflow-hidden">
          <div className="grid grid-flow-col auto-cols-[calc(100%/1)] md:auto-cols-[calc(100%/2)] lg:auto-cols-[calc(100%/4)] gap-6 transition-transform duration-700"
               style={{ transform: `translateX(calc(${idx} * -100% / ${perView}))` }}>
            {mentors.map((m) => (
              <Link to="/mentors" key={m.id} data-testid={`mentor-${m.id}`} className="group block">
                <div className="rounded-2xl overflow-hidden border border-border bg-card card-elevated">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="font-display text-xl font-semibold text-white">{m.name}</div>
                      <div className="text-xs text-white/85 mt-1">{m.title}</div>
                      {m.parampara && <div className="text-[10px] italic text-accent mt-2">{m.parampara}</div>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!testimonials?.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % testimonials.length), 5500);
    return () => clearInterval(t);
  }, [testimonials?.length]);
  if (!testimonials?.length) return null;
  const t = testimonials[idx];
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="orb orb-violet w-[500px] h-[500px] left-[-8rem] top-20" />
      <div className="orb orb-saffron w-96 h-96 right-[-4rem] bottom-10" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-secondary/15 text-secondary border border-secondary/30 mb-4">SUCCESS STORIES</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            1,00,000+ <span className="text-gradient-hot">success stories</span><br />from around the world
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
  if (!blogs?.length) return null;
  return (
    <section className="py-20 md:py-28 relative">
      <div className="site-container">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">JOURNAL</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              From the <span className="text-gradient-hot">Tredev Learn</span> Journal
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">Essays and reflections from India's traditions — attributed, cited, and unhurried.</p>
          </div>
          <Link to="/blog" className="text-primary link-underline text-sm font-medium">All essays →</Link>
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
  { name: "Priya Sharma", role: "Jyotiṣa · Level 2", accent: "from-violet-600 to-fuchsia-600" },
  { name: "Arjun Menon", role: "Sanskrit Foundation", accent: "from-amber-500 to-orange-500" },
  { name: "Ananya Rao", role: "Gītā Cohort ’25", accent: "from-fuchsia-600 to-rose-500" },
  { name: "Vikram Desai", role: "Panchāṅga Practitioner", accent: "from-indigo-500 to-violet-600" },
  { name: "Meera Krishnan", role: "Numerology · Certified", accent: "from-rose-500 to-amber-500" },
  { name: "Rohan Tiwari", role: "Vāstu Studies", accent: "from-violet-600 to-indigo-600" },
  { name: "Kavya Nair", role: "Mantra Sādhana", accent: "from-amber-400 to-yellow-500" },
  { name: "Aditya Pillai", role: "Upaniṣad Circle", accent: "from-fuchsia-600 to-violet-600" },
  { name: "Ishaan Verma", role: "Tarot Reflection", accent: "from-indigo-500 to-fuchsia-500" },
  { name: "Sneha Bhatt", role: "Rāmāyaṇa Study", accent: "from-amber-500 to-rose-500" },
];

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function CommunityMarquee() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="site-container text-center mb-10">
        <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">COMMUNITY</div>
        <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          More than a course — a <span className="text-gradient-cosmic">learning community</span>
        </h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Join a growing network of students, practitioners, and credentialed professionals — turning passion into expertise.
        </p>
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
  const year = new Date().getFullYear();
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" data-testid="sample-certificate-section">
      <div className="orb orb-gold w-96 h-96 left-[5%] top-10" />
      <div className="orb orb-magenta w-80 h-80 right-[8%] bottom-10" />
      <div className="site-container relative">
        <div className="text-center mb-14">
          <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">CREDENTIALS · PUBLICLY VERIFIABLE</div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            A certificate <span className="text-gradient-hot">worth putting</span> on your résumé
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Every certificate is Ācharya-signed and carries a code that anyone can verify — publicly, without logging in.
            This is what yours will look like.
          </p>
        </div>

        {/* Certificate card */}
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl p-1 bg-gradient-to-br from-violet-600 via-amber-500 to-fuchsia-600 shadow-[0_30px_80px_-20px_hsl(258_60%_35%/0.45)]" data-testid="sample-certificate">
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-display font-bold text-xl shadow-lg">T</div>
                  <div className="text-left">
                    <div className="font-display font-bold text-2xl tracking-tight text-amber-900">TREDEV LEARN</div>
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
                    <div className="font-editorial italic text-xl md:text-2xl text-amber-950 -mb-1"
                         style={{ fontFamily: '"Cormorant Garamond", serif' }}>
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
                        <text fontSize="6.5" fill="#78350f" fontFamily="Manrope, sans-serif" letterSpacing="4">
                          <textPath href="#cert-seal-circle">• AUTHENTIC · VERIFIED · ĀCHARYA-SIGNED · TREDEV LEARN {year}</textPath>
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Director sign */}
                  <div className="text-center">
                    <div className="font-editorial italic text-xl md:text-2xl text-amber-950 -mb-1"
                         style={{ fontFamily: '"Cormorant Garamond", serif' }}>
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
              Publicly verifiable · non-transferable · revocation goes on-record
            </div>
            <div className="flex gap-3">
              <Link to="/verify/TDL-8F3A-DEMO" data-testid="verify-sample-btn">
                <Button variant="outline" className="rounded-full">Try verification →</Button>
              </Link>
              <Link to="/courses">
                <Button className="rounded-full bg-gradient-hot text-white border-0 btn-glow">Earn yours <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConsultationCTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="site-container">
        <div className="relative rounded-3xl overflow-hidden border border-accent/30 bg-gradient-cosmic p-10 md:p-16 grid md:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="orb orb-saffron w-72 h-72 -top-20 -right-10" />
          <div className="orb orb-gold w-64 h-64 -bottom-20 -left-10" />
          <div className="relative">
            <Sparkles className="w-6 h-6 text-accent mb-4" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">Unsure where to begin?</h2>
            <p className="mt-4 text-white/80 leading-relaxed max-w-xl">
              Many people arrive interested but hesitant — should they study Sanskrit, the Gītā, meditation, jyotiṣa? Rather than lose you to that hesitation, we offer a <strong className="text-accent">free pathway consultation</strong>. Someone from our academic staff will reach out personally, understand your interest, and recommend a starting pathway.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> Honest pathway advice — not a hard pitch</li>
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> Auto-assigned to the staff member with lightest backlog</li>
              <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5"/> Consented under DPDP · used to help, not to spam</li>
            </ul>
          </div>
          <div className="relative text-center md:text-right">
            <Link to="/consultation" data-testid={HOME.ctaConsultation}>
              <Button size="lg" className="rounded-full h-14 px-10 bg-gradient-hot text-white btn-glow border-0 text-base">
                Request my pathway <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <div className="mt-3 text-xs text-white/60">A human at the top of the funnel · not a paywall</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [shloka, setShloka] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [webinars, setWebinars] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/shloka-of-day").then((r) => setShloka(r.data)).catch(() => {});
    api.get("/offerings").then((r) => setOfferings(r.data)).catch(() => {});
    api.get("/webinars").then((r) => setWebinars(r.data)).catch(() => {});
    api.get("/mentors").then((r) => setMentors(r.data)).catch(() => {});
    api.get("/testimonials").then((r) => setTestimonials(r.data)).catch(() => {});
    api.get("/blogs").then((r) => setBlogs(r.data)).catch(() => {});
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <HeroCarousel stats={stats} />
      <SubjectMarquee />
      <FeaturedIn />
      <WebinarsSection webinars={webinars} />
      <CoursesSection offerings={offerings} />
      <FreeToolsSection />

      {shloka && shloka.id && (
        <section className="py-20 md:py-28 relative">
          <div className="site-container">
            <div className="text-center mb-10">
              <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">TODAY'S VERSE</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                The verse, as a <span className="text-gradient-hot">first-class object</span>
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
