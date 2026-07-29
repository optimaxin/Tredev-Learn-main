import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Events() {
  const [festivals, setFestivals] = useState([]);
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    api.get("/festivals").then((r) => setFestivals(r.data));
    api.get("/webinars").then((r) => setSessions(r.data));
  }, []);

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">EVENTS · CALENDAR</div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        The festival <span className="text-gradient-cosmic">calendar</span> is our marketing calendar
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Religious time already carries urgency, anticipation, and collective participation — so our launches align to it.
      </p>

      <div className="mt-14 flex items-baseline gap-3 flex-wrap mb-6">
        <h2 className="font-display text-3xl font-bold">Festival calendar</h2>
        <span className="chip bg-accent/15 text-accent border border-accent/30">Auto-computed · Vedic (tithi-based)</span>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {festivals.map((f) => (
          <div key={f.id} data-testid={`festival-${f.id}`}
            className="rounded-2xl border border-border p-6 bg-card card-elevated flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-hot flex flex-col items-center justify-center shrink-0 text-white">
              <div className="text-[10px] uppercase tracking-widest opacity-90">{new Date(f.date).toLocaleDateString(undefined, { month: "short" })}</div>
              <div className="font-display font-bold text-2xl leading-none">{new Date(f.date).getDate()}</div>
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-xl">{f.name}</div>
              <div className="text-xs text-primary tabular mt-0.5">
                {new Date(f.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{f.significance}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {f.related_offering_subject && (
                  <Link to={`/courses?q=${encodeURIComponent(f.related_offering_subject)}`}
                    className="text-xs text-primary inline-flex items-center gap-1 link-underline" data-testid={`festival-related-${f.id}`}>
                    Courses: {f.related_offering_subject} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                {f.deity && (
                  <Link to={`/mantras?deity=${encodeURIComponent(f.deity)}`}
                    className="text-xs text-accent inline-flex items-center gap-1 link-underline" data-testid={`festival-mantras-${f.id}`}>
                    {f.deity} mantras <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-16 font-display text-3xl font-bold mb-6">Upcoming live sessions</h2>
      <div className="space-y-3">
        {sessions.map((s) => (
          <Link to="/webinars" key={s.id}
            className="rounded-xl border border-border p-5 bg-card hover:border-primary transition-colors flex items-center gap-5">
            <Calendar className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="font-display text-lg font-semibold">{s.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(s.starts_at).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {s.mentor_name}
              </div>
            </div>
            <span className="text-primary font-medium text-sm">Details →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
