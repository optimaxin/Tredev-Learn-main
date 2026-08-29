import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** Sadhana daily view: sankalpa + japa counter + compassionate streak arc. */
export default function SadhanaCounter({ offeringId, initial, onUpdate }) {
  const [count, setCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [sankalpa, setSankalpa] = useState(initial?.sankalpa || "");
  const [savingSankalpa, setSavingSankalpa] = useState(false);
  const [busy, setBusy] = useState(false);
  const streak = initial?.streak || 0;
  const totalJapa = initial?.total_japa || 0;
  const checkins = initial?.checkins || [];
  const cohort = initial?.cohort_count || 0;

  const doCheckin = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/sadhana/checkin", {
        offering_id: offeringId, japa_count: count, notes,
      });
      if (data.already_done) toast.info("You've already checked in today.");
      else toast.success("Check-in saved.");
      setCount(0); setNotes("");
      onUpdate?.();
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };

  const saveSankalpa = async () => {
    if (!sankalpa.trim()) return;
    setSavingSankalpa(true);
    try {
      await api.post("/sadhana/sankalpa", { offering_id: offeringId, sankalpa });
      toast.success("Sankalpa taken.");
      onUpdate?.();
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingSankalpa(false);
  };

  // 21-day mala arc
  const arc = Array.from({ length: 21 }).map((_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (20 - i));
    const iso = day.toISOString().slice(0, 10);
    const found = checkins.find((c) => c.date === iso);
    return { iso, found, isToday: i === 20 };
  });

  return (
    <div className="rounded-lg border border-border bg-card/60 p-8 md:p-14" data-testid="sadhana-panel">
      <div className="text-center max-w-2xl mx-auto">
        <div className="eyebrow mb-3">Sankalpa · a vow, in your own words</div>
        {!initial?.sankalpa ? (
          <div className="space-y-3">
            <Input
              value={sankalpa}
              onChange={(e) => setSankalpa(e.target.value)}
              placeholder="I resolve, on this day, to…"
              data-testid="sadhana-sankalpa-input"
              className="text-center font-serif italic text-lg h-14"
            />
            <Button onClick={saveSankalpa} disabled={savingSankalpa} data-testid="sadhana-sankalpa-save"
              className="rounded-full px-8">Take the vow</Button>
          </div>
        ) : (
          <p className="font-serif italic text-2xl leading-relaxed text-foreground/90" data-testid="sadhana-sankalpa-text">
            "{initial.sankalpa}"
          </p>
        )}
      </div>

      {/* Japa counter */}
      <div className="mt-14 flex flex-col items-center gap-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Japa rounds today</div>
        <button
          onClick={() => setCount((c) => c + 1)}
          data-testid="sadhana-japa-btn"
          className="relative w-52 h-52 md:w-64 md:h-64 rounded-full border-2 border-accent/40 flex items-center justify-center hover:border-accent transition-all animate-glow bg-background/40"
        >
          <span className="text-6xl md:text-7xl font-serif tabular">{count}</span>
          <span className="absolute -bottom-8 text-xs uppercase tracking-widest text-muted-foreground">tap to count</span>
        </button>
      </div>

      {/* Notes + Check-in */}
      <div className="mt-16 max-w-xl mx-auto">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="A word for your journal (optional)"
          data-testid="sadhana-notes-input"
        />
        <Button onClick={doCheckin} disabled={busy} data-testid="sadhana-checkin-btn"
          className="mt-4 w-full rounded-full h-12">Mark today complete</Button>
      </div>

      {/* Streak arc — compassionate: missed days fade */}
      <div className="mt-16 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Last 21 days · compassionate streak</div>
          <div className="text-xs text-muted-foreground tabular">
            <span data-testid="sadhana-streak" className="text-foreground font-medium">{streak}</span> day streak · {totalJapa} japa total
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {arc.map((d, i) => (
            <div key={i} className={`mala-dot ${d.found ? "filled" : ""} ${d.isToday ? "today" : ""}`} title={d.iso} />
          ))}
        </div>
        <div className="mt-6 text-xs text-muted-foreground">
          {cohort > 0 ? <><span className="text-foreground tabular font-medium">{cohort.toLocaleString()}</span> sādhaks practising with you today.</> : ""}
        </div>
      </div>
    </div>
  );
}
