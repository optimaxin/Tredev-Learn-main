import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { localized } from "@/lib/utils";

export default function BlogDetail() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  const { slug } = useParams();
  const [b, setB] = useState(null);
  const [related, setRelated] = useState([]);
  useEffect(() => {
    api.get(`/blogs/${slug}`).then((r) => setB(r.data));
    api.get(`/blogs`).then((r) => setRelated(r.data.filter((x) => x.slug !== slug).slice(0, 3)));
  }, [slug]);
  if (!b) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;
  return (
    <article className="max-w-3xl mx-auto py-16 px-6">
      <Link to="/blog" className="text-sm text-primary link-underline flex items-center gap-1 mb-8">
        <ArrowLeft className="w-4 h-4" /> All essays
      </Link>
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">{b.category}</div>
      <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]" data-testid="blog-title">{localized(b, "title", lang)}</h1>
      <div className="mt-4 text-sm text-muted-foreground">By {b.author_name} · {b.read_time}</div>
      <div className="mt-8 rounded-2xl overflow-hidden aspect-[16/9]">
        <img src={b.cover_image} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="mt-10 prose prose-lg max-w-none text-foreground/90 leading-relaxed font-editorial">
        {localized(b, "body", lang).split("\n\n").map((p, i) => (
          <p key={i} className="text-lg leading-[1.85] mt-6">{p}</p>
        ))}
      </div>
      {related.length > 0 && (
        <div className="mt-20 pt-12 border-t border-border">
          <h3 className="font-display text-2xl font-bold mb-6">Keep reading</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {related.map((r) => (
              <Link key={r.id} to={`/blog/${r.slug}`} className="group card-elevated rounded-xl border border-border overflow-hidden bg-card">
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={r.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">{r.category}</div>
                  <div className="font-display text-lg font-semibold mt-1 leading-tight">{localized(r, "title", lang)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
