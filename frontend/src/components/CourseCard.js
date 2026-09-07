import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { localized } from "@/lib/utils";
import { useCurrency, formatPrice } from "@/context/CurrencyContext";

export default function CourseCard({ course: o }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  const { currency } = useCurrency();
  const price = currency === "USD" ? o.price_usd : o.price_inr;
  return (
    <Link to={`/courses/${o.id}`} data-testid={`course-card-${o.id}`}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {o.festival && <Badge className="bg-secondary text-secondary-foreground text-[10px] uppercase tracking-widest">{o.festival}</Badge>}
          <Badge className="bg-background/90 text-foreground border border-border text-[10px] uppercase tracking-widest">{o.type?.replace("_", " ")}</Badge>
        </div>
        <div className="absolute bottom-3 left-3 chip bg-card/95 text-primary">
          <Clock className="w-3 h-3" /> {o.duration || "Self-paced"}
        </div>
      </div>

      {/* Body — flex-1 so footers align across the row */}
      <div className="flex flex-col flex-1 p-6">
        <div className="eyebrow text-accent">{o.subject}</div>
        <h3 className="font-display text-xl font-semibold leading-snug mt-2 text-primary line-clamp-2">{localized(o, "title", lang)}</h3>
        {o.subtitle && <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{localized(o, "subtitle", lang)}</p>}
        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="tabular">
              {!price ? <span className="text-primary font-display font-bold text-xl">Free</span> :
                <span className="text-accent font-display font-bold text-xl">{formatPrice(o, currency)}</span>}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 group-hover:opacity-90 transition-opacity">
              Enroll Now <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
