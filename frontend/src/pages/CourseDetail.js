import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import SadhanaCounter from "@/components/SadhanaCounter";
import { ChevronRight, BookOpen, Users, Award } from "lucide-react";

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [offering, setOffering] = useState(null);
  const [selectedVerseIdx, setSelectedVerseIdx] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [myCert, setMyCert] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [sadhana, setSadhana] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/offerings/${id}`);
    setOffering(data);
    if (user) {
      try {
        const my = await api.get("/enrollments/mine");
        const en = my.data.find((e) => e.offering_id === id);
        setEnrolled(!!en);
        setCompleted(en?.completed_lessons || []);
      } catch {}
      try {
        const mc = await api.get("/certificates/mine-all");
        setMyCert(mc.data.find((c) => c.offering_id === id && !c.revoked) || null);
      } catch {}
      if (data.type === "sadhana") {
        try {
          const s = await api.get(`/sadhana/${id}`);
          setSadhana(s.data);
        } catch {}
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const enroll = async () => {
    if (!user) return nav("/login", { state: { from: `/courses/${id}` } });
    setEnrolling(true);
    try {
      if (offering.price_inr > 0) {
        // MOCKED Razorpay flow
        const { data } = await api.post("/payments/create-order", { offering_id: id });
        toast.info(`Mocked payment · order ${data.order_id}. Completing…`);
        await api.post("/payments/webhook-mock", { order_id: data.order_id });
      } else {
        await api.post("/enrollments", { offering_id: id });
      }
      toast.success("Enrolled.");
      setEnrolled(true);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setEnrolling(false);
  };

  const toggleLesson = async (lessonId) => {
    const done = !completed.includes(lessonId);
    try {
      const { data } = await api.post(`/enrollments/${id}/complete-lesson`, { lesson_id: lessonId, done });
      setCompleted(data.completed_lessons);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const requestCertificate = async () => {
    setRequesting(true);
    try {
      const { data } = await api.post("/certificates/request", { offering_id: id });
      setMyCert(data);
      toast.success("Certificate requested — the academic team will review it.");
    } catch (e) { toast.error(formatApiError(e)); }
    setRequesting(false);
  };

  const CERT_LABEL = {
    requested: "Requested — awaiting staff approval",
    pending_signature: "Approved — awaiting Ācharya's signature",
    published: "Certificate issued",
  };

  if (!offering) return <div className="p-20 text-center text-muted-foreground">Loading…</div>;

  const verses = offering.verses_full || [];
  const totalLessons = (offering.modules || []).length;
  const pct = totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0;

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
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">{offering.type.replace("_"," ")}</Badge>
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">{offering.subject}</Badge>
              {offering.festival && <Badge className="bg-accent text-accent-foreground uppercase tracking-widest text-[10px]">{offering.festival}</Badge>}
              {offering.approved_by_acharya && <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40">Ācharya signed off</Badge>}
            </div>
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight leading-tight" data-testid="course-title">{offering.title}</h1>
            {offering.subtitle && <p className="mt-3 text-xl font-serif italic text-primary">{offering.subtitle}</p>}
            <p className="mt-6 text-lg text-foreground/80 leading-relaxed">{offering.description}</p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              {enrolled ? (
                <Button size="lg" variant="outline" disabled className="rounded-full px-8 h-12" data-testid="enroll-status">Enrolled ✓</Button>
              ) : (
                <Button size="lg" onClick={enroll} disabled={enrolling} data-testid="enroll-btn" className="rounded-full px-8 h-12">
                  {enrolling ? "Enrolling…" : (offering.price_inr === 0 ? "Enroll — free" : `Enroll · ₹${offering.price_inr.toLocaleString()}`)}
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4 inline mr-1" /> {offering.duration}
              </div>
              {offering.acharya && (
                <Link to="#acharya" className="text-sm link-underline">
                  Taught by <span className="text-primary">{offering.acharya.name}</span>
                </Link>
              )}
            </div>
            {offering.price_inr > 0 && (
              <div className="mt-4 text-xs text-muted-foreground">Payments are <strong>MOCKED</strong> for this MVP — Razorpay integration keys not yet configured.</div>
            )}
          </div>
        </div>
      </section>

      {/* Sadhana view for sādhaks */}
      {offering.type === "sadhana" && enrolled && (
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="overline mb-3 text-center">Your daily practice</div>
          <h2 className="text-3xl md:text-4xl font-serif text-center mb-10">Sit with the tradition.</h2>
          <SadhanaCounter offeringId={id} initial={sadhana} onUpdate={load} />
        </section>
      )}

      {/* Modules & Verses */}
      <section className="site-container py-16 grid lg:grid-cols-[1fr_2fr] gap-12">
        <div className="lg:sticky lg:top-24 self-start">
          <div className="overline mb-3">Modules</div>
          <div className="space-y-4">
            {(offering.modules || []).map((m, mi) => (
              <div key={mi} className="border-l-2 border-accent/50 pl-4" data-testid={`module-${mi}`}>
                <div className="font-serif text-lg">{m.title}</div>
                <ul className="mt-2 space-y-1">
                  {(m.lessons || []).map((l, li) => (
                    <li key={li} className="text-sm text-muted-foreground flex items-center gap-2">
                      <ChevronRight className="w-3 h-3" /> {l.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(offering.modules || []).length === 0 && (
              <div className="text-sm text-muted-foreground">Curriculum coming soon.</div>
            )}
          </div>
        </div>

        <div>
          {/* Recorded lessons — video + written content (gated on enrollment) */}
          {(offering.modules || []).length > 0 && (
            <div className="mb-16" data-testid="course-lessons">
              <div className="flex items-center justify-between mb-4">
                <div className="overline">Recorded lessons</div>
                {enrolled && (
                  <div className="text-xs text-muted-foreground">{completed.length}/{totalLessons} · {pct}% complete</div>
                )}
              </div>
              {enrolled && (
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-8" data-testid="course-progress">
                  <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              )}

              {/* Certificate request — appears when the course is 100% complete */}
              {enrolled && pct === 100 && (
                <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4 flex-wrap" data-testid="cert-cta">
                  <Award className="w-6 h-6 text-primary shrink-0" />
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-display font-semibold">You've completed every lesson 🎉</div>
                    <div className="text-sm text-muted-foreground">
                      {myCert ? CERT_LABEL[myCert.signature_status] || "In progress" : "Request your Ācharya-signed certificate."}
                    </div>
                  </div>
                  {!myCert && (
                    <Button onClick={requestCertificate} disabled={requesting} className="rounded-full bg-gradient-hot text-white border-0" data-testid="request-cert">
                      {requesting ? "Requesting…" : "Request certificate"}
                    </Button>
                  )}
                  {myCert && myCert.signature_status === "published" && (
                    <Link to="/certificates"><Button className="rounded-full bg-gradient-hot text-white border-0">View certificate</Button></Link>
                  )}
                  {myCert && myCert.signature_status !== "published" && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{myCert.signature_status.replace("_"," ")}</Badge>
                  )}
                </div>
              )}
              {!enrolled ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center">
                  <BookOpen className="w-8 h-8 mx-auto text-primary/60 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Enroll to unlock the recorded video lessons and written material for this course.
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {(offering.modules || []).map((m, i) => {
                    const lid = m.id || String(i);
                    const isDone = completed.includes(lid);
                    return (
                      <div key={lid} data-testid={`lesson-view-${i}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="font-serif text-xl">{i + 1}. {m.title || "Untitled lesson"}</div>
                          <Button size="sm" variant={isDone ? "default" : "outline"} onClick={()=>toggleLesson(lid)}
                            data-testid={`lesson-complete-${i}`}
                            className={`rounded-full shrink-0 ${isDone ? "bg-primary text-primary-foreground border-0" : ""}`}>
                            {isDone ? <><Award className="w-4 h-4 mr-1"/>Completed</> : "Mark complete"}
                          </Button>
                        </div>
                        {m.video_url && (
                          <video src={m.video_url} controls className="mt-3 w-full rounded-lg border border-border" />
                        )}
                        {m.body && (
                          <div className="mt-3 font-editorial leading-relaxed whitespace-pre-line text-foreground/85">{m.body}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {verses.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="overline mb-1">Anchored verses · Shloka Player</div>
                  <div className="text-sm text-muted-foreground">Every scriptural lesson anchored to a verse.</div>
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
            </>
          )}
          {offering.acharya && (
            <div id="acharya" className="mt-16 rounded-lg border border-border p-8 bg-card/50">
              <div className="overline mb-3 text-primary">Ācharya · parampara</div>
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center font-serif text-3xl text-primary shrink-0">
                  {offering.acharya.name?.[0]}
                </div>
                <div>
                  <div className="font-serif text-2xl">{offering.acharya.name}</div>
                  {offering.acharya.parampara && <div className="text-sm text-muted-foreground mt-1 italic">{offering.acharya.parampara}</div>}
                  {offering.acharya.bio && <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{offering.acharya.bio}</p>}
                  <div className="mt-4 flex items-center gap-2 text-xs text-primary">
                    <Award className="w-3 h-3" /> Has approved this course for accuracy.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
