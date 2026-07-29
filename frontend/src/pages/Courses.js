import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const TYPES = ["all", "masterclass", "webinar", "workshop", "recorded_course", "live_course", "sadhana", "ebook"];

export default function Courses() {
  const [items, setItems] = useState([]);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const type = params.get("type") || "all";

  useEffect(() => {
    api.get("/offerings").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => items.filter((o) => {
    if (type !== "all" && o.type !== type) return false;
    if (q && !(`${o.title} ${o.description} ${o.subject}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [items, q, type]);

  const setParam = (k, v) => {
    const p = new URLSearchParams(params);
    if (v === "all") p.delete(k); else p.set(k, v);
    setParams(p);
  };

  return (
    <div className="site-container py-16">
      <div className="overline mb-3">The catalogue</div>
      <h1 className="text-5xl md:text-6xl font-serif tracking-tight mb-10">Study.</h1>

      <div className="flex flex-wrap items-center gap-4 mb-10">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search courses, sadhanas, e-books…"
            data-testid="courses-search" className="pl-9 h-11 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t} onClick={()=>setParam("type", t)}
              data-testid={`filter-type-${t}`}
              className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest border transition-colors ${type === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
              {t === "all" ? "All" : t.replace("_"," ")}
            </button>
          ))}
        </div>
      </div>

      {/* Uniform, disciplined grid — every card identical structure & height */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((o) => (
          <Link key={o.id} to={`/courses/${o.id}`} data-testid={`course-card-${o.id}`}
            className="group flex flex-col rounded-2xl overflow-hidden border border-border bg-card card-elevated">
            {/* Cover — fixed aspect ratio for a consistent grid */}
            <div className="relative aspect-[16/10] overflow-hidden bg-muted">
              {o.image_url ? (
                <img src={o.image_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center">
                  <span className="font-serif text-6xl italic text-muted-foreground/40">{o.subject?.[0] || "T"}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <Badge className="bg-background/85 text-foreground border border-border text-[10px] uppercase tracking-widest">{o.type.replace("_"," ")}</Badge>
                {o.festival && <Badge className="bg-accent text-accent-foreground text-[10px] uppercase tracking-widest">{o.festival}</Badge>}
              </div>
            </div>

            {/* Body — flex-1 so footers align across the row */}
            <div className="flex flex-col flex-1 p-5">
              <div className="overline text-accent">{o.subject}</div>
              <h3 className="font-serif text-xl leading-snug mt-1.5 line-clamp-2">{o.title}</h3>
              {o.subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.subtitle}</p>}
              <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/70 mt-4">
                <div className="text-xs text-muted-foreground">{o.duration || "Self-paced"}</div>
                <div className="text-sm tabular">
                  {o.price_inr === 0 ? <span className="text-primary font-semibold">Free</span> :
                    <><span className="text-foreground font-medium">₹{o.price_inr.toLocaleString()}</span>
                     <span className="text-muted-foreground text-xs ml-2">/ ${o.price_usd}</span></>}
                </div>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-24 text-center text-muted-foreground">No offerings match.</div>
        )}
      </div>
    </div>
  );
}
