import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import { BookOpen, Award, GraduationCap, Users, CalendarDays, PartyPopper } from "lucide-react";
import { localized } from "@/lib/utils";
import { useCurrency, formatPrice } from "@/context/CurrencyContext";
import { portalPath, STAFF_ROLES } from "@/lib/roles";

export default function CourseDetail() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  const { id } = useParams();
  const { user } = useAuth();
  const { currency } = useCurrency();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [offering, setOffering] = useState(null);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/offerings/${id}`);
    setOffering(data);
    let liveBatches = [];
    if (data.type === "live_course") {
      const { data: b } = await api.get("/batches", { params: { offering_id: id } }).catch(() => ({ data: [] }));
      liveBatches = Array.isArray(b) ? b : [];
      setBatches(liveBatches);
      setSelectedBatchId((prev) => prev || liveBatches.find((x) => (x.seats_available ?? 0) > 0)?.id || "");
    }
    if (user) {
      try {
        const my = await api.get("/enrollments/mine");
        const already = !!(Array.isArray(my.data) ? my.data : []).find((e) => e.offering_id === id);
        setEnrolled(already);
      } catch {}
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id, user?.id]);

  // Cashfree redirects back here as /courses/:id?order_id=... after checkout —
  // reconcile via the status endpoint rather than trusting the redirect alone.
  useEffect(() => {
    const orderId = searchParams.get("order_id");
    if (!orderId || !user) return;
    api.get(`/payments/${orderId}/status`).then(({ data }) => {
      if (data.status === "paid") {
        setEnrolled(true);
        setSuccessInfo({ amountInr: data.amount_inr || 0, orderId });
        load();
      } else if (data.status === "failed") {
        toast.error(t("courseDetail.paymentFailed"));
      } else {
        toast.info(t("courseDetail.paymentPending"));
      }
    }).catch(() => {}).finally(() => {
      searchParams.delete("order_id");
      setSearchParams(searchParams, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLiveCourse = offering?.type === "live_course";
  const hasOpenBatch = batches.some((b) => (b.seats_available ?? 0) > 0);
  const isOwnAcharya = user?.role === "acharya" && offering?.acharya_id === user?.id;
  const isStaffRole = STAFF_ROLES.includes(user?.role);
  // Staff/admin already have full course access by role — they never enroll
  // or pay. The assigned Ācharya sees their own course the same way.
  const canView = enrolled || isOwnAcharya || isStaffRole;

  const enroll = async () => {
    if (!user) return nav("/login", { state: { from: `/courses/${id}` } });
    if (isLiveCourse && !selectedBatchId) return toast.error(t("courseDetail.selectBatchFirst"));
    setEnrolling(true);
    try {
      if (offering.price_inr > 0) {
        const { data } = await api.post("/payments/cashfree/create-order", {
          offering_id: id, coupon_code: couponCode.trim() || undefined,
          batch_id: isLiveCourse ? selectedBatchId : undefined,
        });
        // ponytail: "sandbox" hardcoded for the test phase — switch to
        // "production" here alongside flipping CASHFREE_ENV on the backend.
        const cashfree = window.Cashfree({ mode: "sandbox" });
        cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: "_self" });
        return; // browser navigates away to checkout; nothing left to do here
      }
      await api.post("/enrollments", { offering_id: id, batch_id: isLiveCourse ? selectedBatchId : undefined });
      setEnrolled(true);
      setSuccessInfo({ amountInr: 0 });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setEnrolling(false);
  };

  if (!offering) return <div className="p-20 text-center text-muted-foreground">{t("common.loading")}</div>;

  const verses = offering.verses_full || [];
  const price = currency === "USD" ? offering.price_usd : offering.price_inr;
  const lessonCount = Array.isArray(offering.modules) ? offering.modules.length : 0;

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
              {canView ? (
                <Button size="lg" variant="outline" disabled className="rounded-full px-8 h-12" data-testid="enroll-status">
                  {t(isStaffRole ? "courseDetail.staffAccessBtn" : "courseDetail.enrolledBtn")}
                </Button>
              ) : (
                <Button size="lg" onClick={enroll} disabled={enrolling || (isLiveCourse && !hasOpenBatch)} data-testid="enroll-btn" className="rounded-full px-8 h-12">
                  {enrolling ? t("courseDetail.enrolling") : (!price ? t("courseDetail.enrollFree") : t("courseDetail.enrollPrice", { price: formatPrice(offering, currency) }))}
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4 inline mr-1" /> {offering.duration}
              </div>
              {!isLiveCourse && lessonCount > 0 && (
                <div className="text-sm text-muted-foreground">{lessonCount} lesson{lessonCount === 1 ? "" : "s"}</div>
              )}
              {offering.acharya && (
                <Link to="#acharya" className="text-sm link-underline">
                  {t("courseDetail.taughtBy")} <span className="text-primary">{offering.acharya.name}</span>
                </Link>
              )}
            </div>

            {isLiveCourse && !canView && (
              <div className="mt-6 max-w-md" data-testid="batch-picker">
                <div className="eyebrow mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {t("courseDetail.chooseBatch")}</div>
                {batches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("courseDetail.noSeatsAvailable")}</p>
                ) : (
                  <div className="space-y-2">
                    {batches.map((b) => {
                      const seatsLeft = b.seats_available ?? 0;
                      const full = seatsLeft <= 0;
                      const active = selectedBatchId === b.id;
                      return (
                        <button key={b.id} type="button" disabled={full}
                          onClick={() => setSelectedBatchId(b.id)}
                          data-testid={`batch-option-${b.id}`}
                          className={`w-full text-left rounded-xl border p-3 flex items-center justify-between gap-3 transition-colors ${
                            full ? "border-border bg-muted/40 opacity-60 cursor-not-allowed" :
                            active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                          }`}>
                          <div>
                            <div className="font-medium text-sm">{b.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {t("courseDetail.batchStarts", { date: b.start_date })}</div>
                          </div>
                          <Badge variant={full ? "outline" : active ? "default" : "outline"} className="text-[10px] uppercase tracking-widest shrink-0">
                            {full ? t("courseDetail.batchFull") : t("courseDetail.batchSeatsLeft", { count: seatsLeft })}
                          </Badge>
                        </button>
                      );
                    })}
                    {!hasOpenBatch && <p className="text-xs text-destructive mt-1">{t("courseDetail.noSeatsAvailable")}</p>}
                  </div>
                )}
              </div>
            )}
            {price > 0 && !canView && (
              <div className="mt-4 flex items-center gap-2 max-w-xs">
                <span className="text-xs text-muted-foreground shrink-0">{t("courseDetail.haveCoupon")}</span>
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                  placeholder={t("courseDetail.couponPlaceholder")} className="h-8 text-xs" data-testid="coupon-code-input" />
              </div>
            )}
            {price > 0 && !canView && (
              <div className="mt-4 text-xs text-muted-foreground">{t("courseDetail.mockedNotice")}</div>
            )}
          </div>
        </div>
      </section>

      <section className="site-container py-16">
        {canView ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-10 text-center max-w-2xl mx-auto">
            <GraduationCap className="w-8 h-8 mx-auto text-primary mb-3" />
            <p className="text-sm text-foreground/80 mb-5">
              {t(isStaffRole ? "courseDetail.staffAccessNotice" : "courseDetail.enrolledGoToDashboard")}
            </p>
            <Link to={portalPath(user?.role)}>
              <Button className="rounded-full px-8" data-testid="go-to-dashboard">
                {t("courseDetail.openInDashboard")}
              </Button>
            </Link>
          </div>
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

      <Dialog open={!!successInfo} onOpenChange={(o) => !o && setSuccessInfo(null)}>
        <DialogContent className="max-w-md text-center" data-testid="enroll-success-dialog">
          <div className="py-4">
            <PartyPopper className="w-12 h-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-serif mb-2">{t("courseDetail.successTitle")}</h2>
            <p className="text-sm text-muted-foreground mb-1">{localized(offering, "title", lang)}</p>
            <p className="text-sm text-foreground/80 mt-3">
              {successInfo?.amountInr > 0
                ? t("courseDetail.successPaidBody", { title: localized(offering, "title", lang) })
                : t("courseDetail.successFreeBody", { title: localized(offering, "title", lang) })}
            </p>
            {successInfo?.amountInr > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm">
                <span className="text-muted-foreground">{t("courseDetail.successAmountPaid")}</span>
                <span className="font-serif">₹{successInfo.amountInr}</span>
              </div>
            )}
            {successInfo?.orderId && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left" data-testid="success-order-id">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("courseDetail.successOrderId")}</span>
                  <span className="font-mono text-xs">{successInfo.orderId}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{t("courseDetail.successScreenshotNote")}</p>
              </div>
            )}
            <Button className="w-full rounded-full h-12 mt-6" data-testid="success-go-to-dashboard"
              onClick={() => { setSuccessInfo(null); nav(portalPath(user?.role)); }}>
              {t("courseDetail.successGoToDashboard")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
