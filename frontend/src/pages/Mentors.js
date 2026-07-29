import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Award, BookOpen, Users } from "lucide-react";

export default function Mentors() {
  const [mentors, setMentors] = useState([]);
  useEffect(() => { api.get("/mentors").then((r) => setMentors(r.data)); }, []);

  return (
    <div className="site-container py-16">
      <div className="chip bg-accent/15 text-accent border border-accent/30 mb-4">THE PARAMPARĀ</div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        Meet the <span className="text-gradient-cosmic">keepers</span> of ancient, timeless wisdom
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Every scholar you'll study with signs off on the accuracy of the content published under their name. That signature is the platform's trust surface.
      </p>

      <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map((m) => (
          <div key={m.id} data-testid={`mentor-card-${m.id}`}
            className="group rounded-2xl border border-border overflow-hidden bg-card card-elevated">
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={m.avatar} alt={m.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="font-display text-2xl font-bold text-white leading-tight">{m.name}</div>
                <div className="text-xs text-accent mt-1">{m.title}</div>
                {m.parampara && <div className="text-[10px] italic text-white/80 mt-2">{m.parampara}</div>}
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-foreground/85">{m.bio}</p>
              <div className="mt-5 space-y-2">
                {(m.credentials || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Award className="w-3 h-3 text-accent shrink-0 mt-0.5" /> {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
