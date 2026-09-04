import React from "react";
import { Award, BookOpen, HelpCircle, Radio } from "lucide-react";

/** Right sidebar for the Learner Dashboard — profile, overall progress, and quick stats. */
export default function LearnerSidebar({ user, enrollments, certs, sessions, doubts }) {
  const pctOf = (e) => {
    const total = (e.offering?.modules || []).length;
    const done = (e.completed_lessons || []).length;
    return total ? Math.round((done / total) * 100) : (e.progress || 0);
  };
  const overallPct = enrollments.length
    ? Math.round(enrollments.reduce((sum, e) => sum + pctOf(e), 0) / enrollments.length)
    : 0;
  const openDoubts = doubts.filter((d) => !d.answer).length;

  const stats = [
    { icon: BookOpen, label: "Courses enrolled", value: enrollments.length },
    { icon: Award, label: "Certificates earned", value: certs.length },
    { icon: Radio, label: "Upcoming live sessions", value: sessions.length },
    { icon: HelpCircle, label: "Doubts awaiting reply", value: openDoubts },
  ];

  return (
    <aside className="space-y-6" data-testid="learner-sidebar">
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-hot flex items-center justify-center text-2xl font-bold text-white">
          {user?.name?.[0] || "U"}
        </div>
        <div className="mt-3 font-display font-bold text-lg">{user?.name}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Learner</div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Overall progress</div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-display font-bold">{overallPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Your stats</div>
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm text-muted-foreground">{label}</div>
            <div className="font-display font-bold tabular">{value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
