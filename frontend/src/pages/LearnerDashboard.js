import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Video, Radio, MessageSquare, Award, Zap, BarChart3, BookOpen, CalendarClock } from "lucide-react";
import LearnerSidebar from "@/components/LearnerSidebar";
import CourseWorkspace from "@/components/CourseWorkspace";
import QueriesUser from "@/components/queries/QueriesUser";

/** Sample-style mini certificate card that a learner sees for each earned credential. */
function CertificatePreview({ c }) {
  const { t } = useTranslation();
  return (
    <div className="relative rounded-2xl p-1 bg-gradient-to-br from-amber-500 via-orange-500 to-primary shadow-xl" data-testid={`cert-preview-${c.code}`}>
      <div className="relative rounded-[14px] p-6 md:p-8 overflow-hidden"
           style={{ background: "linear-gradient(135deg, #fdf7e8 0%, #f6ecd0 50%, #f0dfae 100%)" }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06]">
          <span className="text-[14rem] leading-none font-devanagari text-amber-900">ॐ</span>
        </div>
        <div className="absolute inset-4 border-2 border-amber-800/40 rounded-lg pointer-events-none" />
        <div className="absolute inset-6 border border-amber-800/25 rounded pointer-events-none" />
        <div className="relative text-center text-amber-950">
          <div className="text-[10px] tracking-[0.3em] uppercase text-amber-800/70">Tredev Learn</div>
          <div className="font-devanagari text-lg mt-1 text-amber-900">प्रमाणपत्रम्</div>
          <div className="mt-4 text-[10px] tracking-widest uppercase text-amber-800/70">{t("learnerDashboard.certPreview.certifyThat")}</div>
          <div className="font-display font-bold text-2xl md:text-3xl mt-1 text-amber-950 leading-tight">
            {c.user_name}
          </div>
          <div className="mt-3 text-[10px] tracking-widest uppercase text-amber-800/70">{t("learnerDashboard.certPreview.hasCompleted")}</div>
          <div className="font-display italic text-lg text-amber-900 mt-1 leading-tight">{c.offering_title}</div>

          <div className="flex items-center justify-center gap-3 my-5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-800/40" />
            <span className="font-devanagari text-lg text-amber-800">॥</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-800/40" />
          </div>

          {/* Seal + signature */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="font-editorial italic text-lg text-amber-950">
                {(c.acharya_name || "").split(" ").slice(-1)[0] || "V. Shastri"}
              </div>
              <div className="border-t border-amber-800/60 pt-1 mt-1 max-w-[150px] mx-auto">
                <div className="font-serif text-xs text-amber-900 font-semibold">{c.acharya_name || t("learnerDashboard.certPreview.acharyaFallback")}</div>
                <div className="text-[9px] tracking-widest uppercase text-amber-800/70">{t("learnerDashboard.certPreview.signedForAccuracy")}</div>
              </div>
            </div>
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-600 to-red-700 flex items-center justify-center shadow-lg">
                <div className="w-[86%] h-[86%] rounded-full border-2 border-amber-100/70 flex items-center justify-center">
                  <div className="font-devanagari text-lg text-amber-50 leading-none">ॐ</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-[9px] tracking-widest uppercase text-amber-800/80 border-t border-amber-800/25 pt-3">
            <div>{new Date(c.issued_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</div>
            <Link to={`/verify/${c.code}`} className="underline decoration-amber-800/40 hover:text-amber-900">{t("learnerDashboard.certPreview.verify")}</Link>
            <div className="font-mono">{c.code}</div>
          </div>
          {c.revoked && <div className="mt-3 text-xs text-red-700 font-semibold">{t("learnerDashboard.certPreview.revoked")}</div>}
        </div>
      </div>
    </div>
  );
}

export default function LearnerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [certs, setCerts] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [events, setEvents] = useState([]);
  const [openCourseId, setOpenCourseId] = useState(null);

  const load = async () => {
    const [e, s, c, d, w, reg] = await Promise.all([
      api.get("/enrollments/mine").catch(()=>({data:[]})),
      api.get("/live-sessions/mine-learner").catch(()=>({data:[]})),
      api.get("/certificates/mine").catch(()=>({data:[]})),
      api.get("/doubts/mine").catch(()=>({data:[]})),
      api.get("/webinars").catch(()=>({data:[]})),
      api.get("/webinars/my-registrations").catch(()=>({data:[]})),
    ]);
    const arr = (x) => (Array.isArray(x.data) ? x.data : []);
    setEnrollments(arr(e));
    setSessions(arr(s));
    setCerts(arr(c));
    setDoubts(arr(d));
    const regSet = new Set(arr(reg));
    setEvents(arr(w).filter((x) => regSet.has(x.id)));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) load(); }, [user?.id]);

  const join = async (id) => {
    try {
      const { data } = await api.post(`/live-sessions/${id}/join`);
      toast.info(t("learnerDashboard.mockJoinToast"));
      window.open(data.join_url, "_blank");
    } catch { toast.error(t("learnerDashboard.couldNotJoin")); }
  };

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">{t("learnerDashboard.badge")}</div>
      <h1 className="text-5xl font-display font-bold tracking-tight">{t("learnerDashboard.welcome", { name: user?.name })}</h1>

      <div className="mt-10">
      <Tabs defaultValue="courses" className="grid lg:grid-cols-[260px_1fr] gap-10 items-start">
        <TabsList className="flex lg:flex-col h-auto w-full items-stretch justify-start gap-1.5 bg-card border border-border rounded-2xl p-3" data-testid="learner-nav">
          <TabsTrigger value="courses" data-testid="learner-tab-courses" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <BookOpen className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabStudy")}
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="learner-tab-performance" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <BarChart3 className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabPerformance")}
          </TabsTrigger>
          <TabsTrigger value="live" data-testid="learner-tab-live" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <Radio className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabLive")}
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="learner-tab-events" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <CalendarClock className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabEvents")} ({events.length})
          </TabsTrigger>
          <TabsTrigger value="queries" data-testid="learner-tab-queries" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <MessageSquare className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabQueries")}
          </TabsTrigger>
          <TabsTrigger value="certs" data-testid="learner-tab-certs" className="justify-start text-base font-medium py-3 px-4 rounded-xl">
            <Award className="w-4 h-4 mr-3 shrink-0" /> {t("learnerDashboard.tabCerts")}
          </TabsTrigger>
        </TabsList>

        {/* MY STUDY */}
        <TabsContent value="courses" className="mt-0">
          {openCourseId ? (
            <div>
              <Button variant="outline" size="sm" onClick={() => setOpenCourseId(null)} className="mb-6 rounded-full" data-testid="course-workspace-back">
                ← {t("learnerDashboard.backToCourses")}
              </Button>
              <CourseWorkspace offeringId={openCourseId} />
            </div>
          ) : (
            <>
              {enrollments.length === 0 && (
                <div className="text-muted-foreground text-sm">
                  {t("learnerDashboard.noEnrollments")} <Link to="/courses" className="text-primary link-underline">{t("learnerDashboard.browseCatalogue")}</Link>.
                </div>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrollments.map((e) => (
                  <button key={e.id} onClick={() => setOpenCourseId(e.offering_id)} data-testid={`enrollment-${e.id}`}
                    className="text-left rounded-2xl border border-border p-6 card-elevated bg-card">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{e.offering?.type?.replace("_"," ")}</Badge>
                    <div className="font-display font-bold text-xl mt-3 leading-tight">{e.offering?.title}</div>
                    <div className="text-xs text-muted-foreground mt-2">{t("learnerDashboard.enrolled")} {new Date(e.enrolled_at).toLocaleDateString()}</div>
                    {(() => {
                      const total = (e.offering?.modules || []).length;
                      const done = (e.completed_lessons || []).length;
                      const pct = total ? Math.round((done / total) * 100) : (e.progress || 0);
                      return (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span>{total ? `${done}/${total} ${t("learnerDashboard.lessons")}` : t("learnerDashboard.progress")}</span>
                            <span className="tabular">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    <div className="mt-5 text-sm text-primary">{t("learnerDashboard.continue")} →</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance" className="mt-0">
          <LearnerSidebar user={user} enrollments={enrollments} certs={certs} sessions={sessions} doubts={doubts} />
        </TabsContent>

        {/* LIVE */}
        <TabsContent value="live" className="mt-8">
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-border p-5 bg-card flex items-center gap-4" data-testid={`session-${s.id}`}>
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                  {s.mode === "broadcast" ? <Radio className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-display font-semibold text-lg">{s.title}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {new Date(s.starts_at).toLocaleString()} · {s.duration_min} {t("learnerDashboard.min")} · {s.mode}
                  </div>
                </div>
                {s.can_join ? (
                  <Button onClick={() => join(s.id)} data-testid={`join-${s.id}`} className="rounded-full px-6 bg-gradient-hot text-white border-0 animate-glow">
                    {t("learnerDashboard.joinNow")}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{t("learnerDashboard.opensSoon")}</Badge>
                )}
              </div>
            ))}
            {sessions.length === 0 && <div className="text-muted-foreground text-sm">{t("learnerDashboard.noSessions")}</div>}
          </div>
        </TabsContent>

        {/* EVENTS — registered webinars/events */}
        <TabsContent value="events" className="mt-8">
          <p className="text-sm text-muted-foreground mb-5">{t("learnerDashboard.eventsSubtext")}</p>
          <div className="space-y-3">
            {events.map((w) => (
              <div key={w.id} className="rounded-xl border border-border p-5 bg-card flex items-center gap-4 flex-wrap" data-testid={`learner-event-${w.id}`}>
                {w.cover_image
                  ? <img src={w.cover_image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-full bg-primary/15 grid place-items-center text-primary shrink-0"><Zap className="w-5 h-5" /></div>}
                <div className="flex-1 min-w-[220px]">
                  <div className="font-display font-semibold text-lg">{w.title}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {new Date(w.starts_at).toLocaleString()} · {w.duration_min} {t("learnerDashboard.min")}{w.mentor_name ? ` · ${t("learnerDashboard.withMentor", { name: w.mentor_name })}` : ""}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40 mt-2">{t("learnerDashboard.registered")}</Badge>
                </div>
                {w.join_url
                  ? <a href={w.join_url} target="_blank" rel="noreferrer" className="rounded-full bg-gradient-hot text-white h-10 px-6 inline-flex items-center gap-2 text-sm font-medium" data-testid={`event-join-${w.id}`}><Video className="w-4 h-4" /> {t("learnerDashboard.joinLink")}</a>
                  : <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{t("learnerDashboard.linkNearerDate")}</Badge>}
              </div>
            ))}
            {events.length === 0 && <div className="text-muted-foreground text-sm">{t("learnerDashboard.noEvents")} <Link to="/events" className="text-primary link-underline">{t("learnerDashboard.browseWebinars")}</Link>.</div>}
          </div>
        </TabsContent>

        {/* QUERIES */}
        <TabsContent value="queries" className="mt-8">
          <QueriesUser />
        </TabsContent>

        {/* CERTIFICATES */}
        <TabsContent value="certs" className="mt-8">
          {certs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center">
              <Award className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <div className="text-muted-foreground">{t("learnerDashboard.noCerts")}</div>
              <Link to="/courses" className="text-primary link-underline text-sm mt-3 inline-block">{t("learnerDashboard.browseCourses")} →</Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8" data-testid="learner-certs">
              {certs.map((c) => (
                <CertificatePreview key={c.id} c={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
