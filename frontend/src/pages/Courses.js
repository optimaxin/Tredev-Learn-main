import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import CourseCard from "@/components/CourseCard";

const TYPES = ["all", "masterclass", "webinar", "workshop", "recorded_course", "live_course", "sadhana", "ebook"];

export default function Courses() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const type = params.get("type") || "all";

  useEffect(() => {
    api.get("/offerings").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => {});
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
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">{t("courses.catalogueBadge")}</div>
      <h1 className="text-5xl md:text-6xl font-serif tracking-tight mb-10">{t("courses.title")}</h1>

      <div className="flex flex-wrap items-center gap-4 mb-10">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder={t("courses.searchPlaceholder")}
            data-testid="courses-search" className="pl-9 h-11 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((ty) => (
            <button key={ty} onClick={()=>setParam("type", ty)}
              data-testid={`filter-type-${ty}`}
              className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest border transition-colors ${type === ty ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
              {t(`courses.filters.${ty}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Uniform, disciplined grid — every card identical structure & height */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((o) => <CourseCard key={o.id} course={o} />)}
        {filtered.length === 0 && (
          <div className="col-span-full py-24 text-center text-muted-foreground">{t("courses.noResults")}</div>
        )}
      </div>
    </div>
  );
}
