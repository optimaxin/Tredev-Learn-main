import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import CourseWorkspace from "@/components/CourseWorkspace";
import { BookOpen, Award } from "lucide-react";
import { localized } from "@/lib/utils";

export default function CourseDetail() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [offering, setOffering] = useState(null);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/offerings/${id}`);
    setOffering(data);
    if (user) {
      try {
        const my = await api.get("/enrollments/mine");
        setEnrolled(!!my.data.find((e) => e.offering_id === id));
      } catch {}
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id, user?.id]);

  const enroll = async () => {
    if (!user) return nav("/login", { state: { from: `/courses/${id}` } });
    setEnrolling(true);
    try {
      if (offering.price_inr > 0) {
        // MOCKED Razorpay flow
        const { data } = await api.post("/payments/create-order", { offering_id: id });
        toast.info(t("courseDetail.mockedPayment", { orderId: data.order_id }));
        await api.post("/payments/webhook-mock", { order_id: data.order_id });
      } else {
        await api.post("/enrollments", { offering_id: id });
      }
      toast.success(t("courseDetail.enrolledToast"));
      setEnrolled(true);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setEnrolling(false);
  };

  if (!offering) return <div className="p-20 text-center text-muted-foreground">{t("common.loading")}</div>;

  const verses = offering.verses_full || [];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        {offering.image_url && (
          <>
            <img src={offering.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
          </>
        )}
        <div className="relative site-container py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">{t(`courses.filters.${offering.type}`, offering.type.replace("_"," "))}</Badge>
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">{offering.subject}</Badge>
              {offering.festival && <Badge className="bg-accent text-accent-foreground uppercase tracking-widest text-[10px]">{offering.festival}</Badge>}
              {offering.approved_by_acharya && <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40">{t("courseDetail.acharyaSignedOff")}</Badge>}
            </div>
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight leading-tight" data-testid="course-title">{localized(offering, "title", lang)}</h1>
            {offering.subtitle && <p className="mt-3 text-xl font-serif italic text-primary">{localized(offering, "subtitle", lang)}</p>}
            <p className="mt-6 text-lg text-foreground/80 leading-relaxed">{localized(offering, "description", lang)}</p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              {enrolled ? (
                <Button size="lg" variant="outline" disabled className="rounded-full px-8 h-12" data-testid="enroll-status">{t("courseDetail.enrolledBtn")}</Button>
              ) : (
                <Button size="lg" onClick={enroll} disabled={enrolling} data-testid="enroll-btn" className="rounded-full px-8 h-12">
                  {enrolling ? t("courseDetail.enrolling") : (offering.price_inr === 0 ? t("courseDetail.enrollFree") : t("courseDetail.enrollPrice", { price: offering.price_inr.toLocaleString() }))}
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4 inline mr-1" /> {offering.duration}
              </div>
              {offering.acharya && (
                <Link to="#acharya" className="text-sm link-underline">
                  {t("courseDetail.taughtBy")} <span className="text-primary">{offering.acharya.name}</span>
                </Link>
              )}
            </div>
            {offering.price_inr > 0 && (
              <div className="mt-4 text-xs text-muted-foreground">{t("courseDetail.mockedNotice")}</div>
            )}
          </div>
        </div>
      </section>

      <section className="site-container py-16">
        {enrolled ? (
          <CourseWorkspace offeringId={id} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center max-w-2xl mx-auto">
            <BookOpen className="w-8 h-8 mx-auto text-primary/60 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("courseDetail.unlockNotice")}
            </p>
          </div>
        )}

        {verses.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="eyebrow mb-1">{t("courseDetail.anchoredVerses")}</div>
                <div className="text-sm text-muted-foreground">{t("courseDetail.anchoredVersesSubtext")}</div>
              </div>
              <div className="flex gap-2">
                {verses.map((v, vi) => (
                  <button key={v.id} onClick={()=>setSelectedVerseIdx(vi)}
                    data-testid={`verse-tab-${vi}`}
                    className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded-full border ${selectedVerseIdx === vi ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {v.reference}
                  </button>
                ))}
              </div>
            </div>
            <ShlokaPlayer verse={verses[selectedVerseIdx]} />
          </div>
        )}
        {offering.acharya && (
          <div id="acharya" className="mt-16 rounded-lg border border-border p-8 bg-card/50">
            <div className="eyebrow mb-3 text-primary">{t("courseDetail.acharyaParampara")}</div>
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center font-serif text-3xl text-primary shrink-0">
                {offering.acharya.name?.[0]}
              </div>
              <div>
                <div className="font-serif text-2xl">{offering.acharya.name}</div>
                {offering.acharya.parampara && <div className="text-sm text-muted-foreground mt-1 italic">{offering.acharya.parampara}</div>}
                {offering.acharya.bio && <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{offering.acharya.bio}</p>}
                <div className="mt-4 flex items-center gap-2 text-xs text-primary">
                  <Award className="w-3 h-3" /> {t("courseDetail.approvedNotice")}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
