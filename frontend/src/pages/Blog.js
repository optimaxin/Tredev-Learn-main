import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { localized } from "@/lib/utils";

const CATEGORIES = ["all", "gita", "palmistry", "tarot", "vastu", "panchang"];

export default function Blog() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  const [posts, setPosts] = useState([]);
  const [cat, setCat] = useState("all");

  useEffect(() => {
    const q = cat === "all" ? "" : `?category=${cat}`;
    api.get(`/blogs${q}`).then((r) => setPosts(Array.isArray(r.data) ? r.data : [])).catch(() => setPosts([]));
  }, [cat]);

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">JOURNAL</div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        From the <span className="text-gradient-cosmic">Tredev Learn</span> Journal
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Essays and reflections from India's traditions — attributed, cited, and unhurried.
      </p>

      <div className="mt-10 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} data-testid={`blog-cat-${c}`}
            className={`chip transition-colors ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted-foreground/20"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((b, i) => (
          <Link key={b.id} to={`/blog/${b.slug}`} data-testid={`blog-item-${b.slug}`}
            className={`group rounded-2xl border border-border overflow-hidden bg-card card-elevated flex flex-col ${i === 0 ? "lg:col-span-2 lg:row-span-1" : ""}`}>
            <div className={`relative overflow-hidden ${i === 0 ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
              <img src={b.cover_image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute top-3 left-3 chip bg-white/95 text-black uppercase text-[10px]">{b.category}</span>
            </div>
            <div className="p-6 flex-1">
              <h2 className={`font-display font-bold leading-tight ${i === 0 ? "text-2xl md:text-3xl" : "text-xl"}`}>{localized(b, "title", lang)}</h2>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed">{localized(b, "excerpt", lang)}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{b.author_name}</span><span>·</span><span>{b.read_time}</span>
              </div>
            </div>
          </Link>
        ))}
        {posts.length === 0 && <div className="col-span-full text-center py-24 text-muted-foreground">No posts.</div>}
      </div>
    </div>
  );
}
