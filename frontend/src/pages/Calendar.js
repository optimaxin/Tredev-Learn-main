import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Trophy } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function FestivalCard({ f, quiz, featured }) {
  const { t } = useTranslation();
  const date = new Date(f.date);
  return (
    <div data-testid={`festival-${f.id}`}
      className={`rounded-2xl border p-6 card-elevated flex items-start gap-5 transition-transform hover:-translate-y-0.5 ${
        featured ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card" : "border-border bg-card"
      }`}>
      <div className="w-16 h-16 rounded-2xl bg-gradient-hot flex flex-col items-center justify-center shrink-0 text-white">
        <div className="text-[10px] uppercase tracking-widest opacity-90">{date.toLocaleDateString(undefined, { month: "short" })}</div>
        <div className="font-display font-bold text-2xl leading-none">{date.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-xl">{f.name}</div>
        <div className="text-xs text-primary tabular mt-0.5">
          {date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
        </div>
        {f.significance && <p className="mt-1 text-sm text-muted-foreground">{f.significance}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
          {f.related_offering_subject && (
            <Link to={`/courses?q=${encodeURIComponent(f.related_offering_subject)}`}
              className="text-xs text-primary inline-flex items-center gap-1 link-underline" data-testid={`festival-related-${f.id}`}>
              {t("calendarPage.courses")}: {f.related_offering_subject} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {f.deity && (
            <Link to={`/mantras?deity=${encodeURIComponent(f.deity)}`}
              className="text-xs text-accent inline-flex items-center gap-1 link-underline" data-testid={`festival-mantras-${f.id}`}>
              {f.deity} {t("calendarPage.mantras")} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {quiz && (
            <Link to={`/quiz/${quiz.id}`} data-testid={`festival-play-win-${f.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hot text-white text-xs font-semibold px-4 py-1.5 btn-glow animate-glow">
              <Trophy className="w-3.5 h-3.5" /> {t("calendarPage.playAndWin")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { t } = useTranslation();
  const [festivals, setFestivals] = useState([]);
  const [quizzesByFestival, setQuizzesByFestival] = useState({});
  const [cursor, setCursor] = useState(() => { const d = todayStart(); d.setDate(1); return d; });

  useEffect(() => {
    api.get("/festivals").then((r) => setFestivals(r.data || [])).catch(() => setFestivals([]));
    api.get("/quizzes/events").then((r) => {
      const map = {};
      (r.data || []).forEach((q) => { if (q.festival_id) map[q.festival_id] = q; });
      setQuizzesByFestival(map);
    }).catch(() => setQuizzesByFestival({}));
  }, []);

  const upcoming = useMemo(() => {
    const start = todayStart();
    const end = new Date(start.getTime() + 30 * DAY_MS);
    return festivals
      .filter((f) => { const d = new Date(f.date); return d >= start && d <= end; })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [festivals]);

  const monthFestivals = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    return festivals
      .filter((f) => { const d = new Date(f.date); return d.getFullYear() === y && d.getMonth() === m; })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [festivals, cursor]);

  const shiftMonth = (delta) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const isCurrentMonth = cursor.getFullYear() === todayStart().getFullYear() && cursor.getMonth() === todayStart().getMonth();

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">
        <Sparkles className="w-3 h-3" /> {t("nav.calendar")}
      </div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        {t("calendarPage.headingPlain")}<span className="text-gradient-cosmic">{t("calendarPage.headingHighlight")}</span>{t("calendarPage.headingSuffix")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        {t("calendarPage.subtextPre")} <Link to="/events" className="text-primary link-underline">{t("nav.events")}</Link>.
      </p>

      {/* HAPPENING SOON — auto-expiring 30-day window */}
      <div className="mt-14 flex items-baseline gap-3 flex-wrap mb-6">
        <h2 className="font-display text-3xl font-bold">{t("calendarPage.happeningSoon")}</h2>
        <span className="chip bg-accent/15 text-accent border border-accent/30">{t("calendarPage.autoUpdates")}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {upcoming.map((f) => (
          <FestivalCard key={f.id} f={f} quiz={quizzesByFestival[f.id]} featured />
        ))}
        {upcoming.length === 0 && (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {t("calendarPage.noUpcoming")}
          </div>
        )}
      </div>

      {/* BROWSE BY MONTH */}
      <div className="mt-16 flex items-center justify-between flex-wrap gap-4 mb-6">
        <h2 className="font-display text-3xl font-bold">{t("calendarPage.browseByMonth")}</h2>
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-2 py-1.5">
          <button onClick={() => shiftMonth(-1)} aria-label={t("calendarPage.prevMonth")} data-testid="calendar-prev-month"
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-display font-semibold text-sm min-w-[140px] text-center tabular" data-testid="calendar-month-label">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => shiftMonth(1)} aria-label={t("calendarPage.nextMonth")} data-testid="calendar-next-month"
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentMonth && (
            <button onClick={() => { const d = todayStart(); d.setDate(1); setCursor(d); }}
              className="text-xs text-primary link-underline ml-1 pr-2">{t("calendarPage.today")}</button>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {monthFestivals.map((f) => (
          <FestivalCard key={f.id} f={f} quiz={quizzesByFestival[f.id]} />
        ))}
        {monthFestivals.length === 0 && (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {t("calendarPage.noneRecorded", { month: cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) })}
          </div>
        )}
      </div>
    </div>
  );
}
