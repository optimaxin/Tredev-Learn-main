import React from "react";
import { Award } from "lucide-react";

export default function MentorCard({ mentor: m, compact = false }) {
  return (
    <div data-testid={`mentor-card-${m.id}`}
      className={`group rounded-2xl border border-secondary/30 bg-card card-elevated p-8 text-center flex flex-col items-center ${compact ? "h-full" : ""}`}>
      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-secondary/40 ring-4 ring-secondary/10 shrink-0">
        <img src={m.avatar} alt={m.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="mt-5 font-display text-2xl font-bold text-primary leading-tight">{m.name}</div>
      <div className={`eyebrow text-accent mt-1.5 ${compact ? "line-clamp-1" : ""}`}>{m.title}</div>
      {!compact && m.parampara && <div className="text-xs italic text-muted-foreground mt-2">{m.parampara}</div>}
      {m.bio && (
        <p className={`mt-4 text-sm leading-relaxed text-foreground/75 ${compact ? "line-clamp-3" : ""}`}>{m.bio}</p>
      )}
      {!compact && m.credentials?.length > 0 && (
        <div className="mt-5 space-y-2 text-left w-full">
          {m.credentials.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Award className="w-3 h-3 text-accent shrink-0 mt-0.5" /> {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
