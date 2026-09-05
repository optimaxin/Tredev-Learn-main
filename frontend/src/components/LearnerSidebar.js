import React, { useEffect, useState } from "react";
import { Award, BookOpen, HelpCircle, Radio } from "lucide-react";
import api from "@/lib/api";

/** Right sidebar for the Learner Dashboard — profile, performance, and quick stats. */
export default function LearnerSidebar({ user, enrollments, certs, sessions, doubts }) {
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    api.get("/learner/performance").then(({ data }) => setPerformance(data)).catch(() => {});
  }, []);

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

      <div className="rounded-2xl border border-border bg-card p-6" data-testid="performance-card">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Performance</div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-display font-bold">{performance?.performance_pct ?? 0}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${performance?.performance_pct ?? 0}%` }} />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Attendance ({performance?.lessons_attended ?? 0}/{performance?.total_lessons ?? 0} lessons)</span>
            <span className="font-semibold tabular">{performance?.attendance_pct ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Assignments ({performance?.graded_assignments ?? 0} graded)</span>
            <span className="font-semibold tabular">{performance?.quiz_avg_pct ?? "—"}{performance?.quiz_avg_pct != null ? "%" : ""}</span>
          </div>
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
