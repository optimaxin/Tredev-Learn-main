import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Music } from "lucide-react";

export default function Mantras() {
  const { t } = useTranslation();
  const [mantras, setMantras] = useState([]);
  const [params, setParams] = useSearchParams();
  const deity = params.get("deity") || "all";

  useEffect(() => { api.get("/mantras").then((r) => setMantras(r.data)).catch(() => {}); }, []);

  const deities = useMemo(
    () => Array.from(new Set(mantras.map((m) => m.deity).filter(Boolean))).sort(),
    [mantras]
  );
  const filtered = useMemo(
    () => (deity === "all" ? mantras : mantras.filter((m) => m.deity === deity)),
    [mantras, deity]
  );

  const setDeity = (d) => {
    const p = new URLSearchParams(params);
    if (d === "all") p.delete("deity"); else p.set("deity", d);
    setParams(p);
  };

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">
        <Music className="w-3 h-3" /> {t("mantras.badge")}
      </div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        {t("mantras.headingPlain")} <span className="text-gradient-cosmic">{t("mantras.headingHighlight")}</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        {t("mantras.subtext")}
      </p>

      {/* Deity filter — auto-built from what's available */}
      <div className="mt-10 flex flex-wrap gap-2">
        {["all", ...deities].map((d) => (
          <button key={d} onClick={() => setDeity(d)} data-testid={`mantra-deity-${d}`}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border transition-colors ${deity === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
            {d === "all" ? t("mantras.allDeities") : d}
          </button>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-6">
        {filtered.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card p-7 card-elevated" data-testid={`mantra-${m.id}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="chip bg-accent/15 text-accent border border-accent/30">{m.deity}</span>
            </div>
            <h3 className="font-display font-bold text-2xl">{m.title}</h3>
            {m.devanagari && <div className="font-devanagari text-2xl leading-relaxed mt-4 text-foreground/90">{m.devanagari}</div>}
            {m.iast && <div className="font-editorial italic text-muted-foreground mt-3">{m.iast}</div>}
            {m.meaning && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{m.meaning}</p>}
            {m.audio_url
              ? <audio src={m.audio_url} controls className="mt-5 w-full" data-testid={`mantra-audio-${m.id}`} />
              : <div className="mt-5 text-xs text-muted-foreground">{t("mantras.audioComingSoon")}</div>}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground text-sm">
            {deity !== "all" ? t("mantras.noneForDeity", { deity }) : t("mantras.noneYet")}
          </div>
        )}
      </div>
    </div>
  );
}
