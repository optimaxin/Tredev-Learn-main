import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SadhanaCounter from "@/components/SadhanaCounter";
import { CheckCircle2, Circle, PlayCircle, Award, ClipboardList, Radio, Video } from "lucide-react";

const CERT_LABEL = {
  requested: "Requested — awaiting staff approval",
  pending_signature: "Approved — awaiting Ācharya's signature",
  published: "Certificate issued",
};
const ASSESSMENT_LABEL = { submitted: "Submitted — awaiting staff review", graded: "Graded" };

/** The enrolled-learner view of a course: one lesson at a time (sidebar nav + player),
 * progress tracking, and the lessons → assessment → certificate gate. Self-contained so
 * it can be embedded anywhere (Learner Dashboard, public course page) without prop-drilling. */
export default function CourseWorkspace({ offeringId }) {
  const [offering, setOffering] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [myCert, setMyCert] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [sadhana, setSadhana] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [attemptStatus, setAttemptStatus] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [joiningId, setJoiningId] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/offerings/${offeringId}`);
    setOffering(data);
    const my = await api.get("/enrollments/mine").catch(() => ({ data: [] }));
    const en = my.data.find((e) => e.offering_id === offeringId);
    setCompleted(en?.completed_lessons || []);
    const mc = await api.get("/certificates/mine-all").catch(() => ({ data: [] }));
    setMyCert(mc.data.find((c) => c.offering_id === offeringId && !c.revoked) || null);
    const ls = await api.get("/live-sessions/mine-learner").catch(() => ({ data: [] }));
    setSessions(ls.data.filter((s) => s.offering_id === offeringId));
    if (data.type === "sadhana") {
      const s = await api.get(`/sadhana/${offeringId}`).catch(() => null);
      if (s) setSadhana(s.data);
    }
  };
  useEffect(() => { load(); setActiveIdx(0); /* eslint-disable-next-line */ }, [offeringId]);

  useEffect(() => {
    if (!offering) return;
    const total = (offering.modules || []).length;
    const donePct = total ? Math.round((completed.length / total) * 100) : 0;
    if (donePct !== 100) return;
    api.get(`/offerings/${offeringId}/assessment`).then(({ data }) => {
      if (data?.locked) return;
      setAssessment(data);
      api.get(`/quizzes/${data.id}/my-attempt`).then((r) => setAttemptStatus(r.data)).catch(() => {});
    }).catch(() => {});
  }, [offering, completed, offeringId]);

  const toggleLesson = async (lessonId) => {
    const done = !completed.includes(lessonId);
    try {
      const { data } = await api.post(`/enrollments/${offeringId}/complete-lesson`, { lesson_id: lessonId, done });
      setCompleted(data.completed_lessons);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const requestCertificate = async () => {
    setRequesting(true);
    try {
      const { data } = await api.post("/certificates/request", { offering_id: offeringId });
      setMyCert(data);
      toast.success("Certificate requested — the academic team will review it.");
    } catch (e) { toast.error(formatApiError(e)); }
    setRequesting(false);
  };

  const joinSession = async (s) => {
    setJoiningId(s.id);
    try {
      const { data } = await api.post(`/live-sessions/${s.id}/join`);
      window.open(data.join_url, "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(formatApiError(e)); }
    setJoiningId(null);
  };

  if (!offering) return <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>;

  const modules = offering.modules || [];
  const totalLessons = modules.length;
  const pct = totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0;
  const active = modules[activeIdx];
  const activeId = active ? (active.id || String(activeIdx)) : null;
  const activeDone = activeId ? completed.includes(activeId) : false;

  return (
    <div data-testid="course-workspace">
      {offering.type === "sadhana" && (
        <div className="mb-10">
          <SadhanaCounter offeringId={offeringId} initial={sadhana} onUpdate={load} />
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">{completed.length}/{totalLessons} lessons complete</div>
        <div className="text-sm font-semibold tabular">{pct}%</div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-8" data-testid="course-progress">
        <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Certificate — unlocks only after the assessment (if any) has been attempted */}
      {pct === 100 && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4 flex-wrap" data-testid="cert-cta">
          <Award className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1 min-w-[220px]">
            <div className="font-display font-semibold">You've completed every lesson 🎉</div>
            <div className="text-sm text-muted-foreground">
              {myCert
                ? CERT_LABEL[myCert.signature_status] || "In progress"
                : (assessment && !attemptStatus ? "Complete the course assessment first." : "Request your Ācharya-signed certificate.")}
            </div>
          </div>
          {!myCert && (
            <Button onClick={requestCertificate} disabled={requesting || (assessment && !attemptStatus)}
              className="rounded-full bg-gradient-hot text-white border-0" data-testid="request-cert">
              {requesting ? "Requesting…" : "Request certificate"}
            </Button>
          )}
          {myCert && myCert.signature_status === "published" && (
            <Link to="/certificates"><Button className="rounded-full bg-gradient-hot text-white border-0">View certificate</Button></Link>
          )}
          {myCert && myCert.signature_status !== "published" && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{myCert.signature_status.replace("_", " ")}</Badge>
          )}
        </div>
      )}

      {/* Assessment — unlocks only once every lesson is marked complete */}
      {pct === 100 && assessment && (
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4 flex-wrap" data-testid="assessment-cta">
          <ClipboardList className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1 min-w-[220px]">
            <div className="font-display font-semibold">Course assessment</div>
            <div className="text-sm text-muted-foreground">
              {attemptStatus
                ? (attemptStatus.status === "graded"
                  ? `${ASSESSMENT_LABEL.graded} — score ${attemptStatus.score}/${attemptStatus.total_score}`
                  : ASSESSMENT_LABEL[attemptStatus.status] || "In progress")
                : "Test your understanding to complete this course."}
            </div>
          </div>
          {!attemptStatus && (
            <Link to={`/quiz/${assessment.id}`}>
              <Button className="rounded-full bg-gradient-hot text-white border-0" data-testid="start-assessment">Start assessment</Button>
            </Link>
          )}
          {attemptStatus && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
              {attemptStatus.status === "graded" ? `Score ${attemptStatus.score}/${attemptStatus.total_score}` : "Pending review"}
            </Badge>
          )}
        </div>
      )}

      {/* Live sessions scheduled for this specific course */}
      {sessions.length > 0 && (
        <div className="mb-8 space-y-3" data-testid="course-live-sessions">
          <div className="eyebrow">Live sessions for this course</div>
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl border border-border p-4 bg-card flex items-center gap-4 flex-wrap" data-testid={`course-session-${s.id}`}>
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                {s.mode === "broadcast" ? <Radio className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="font-display font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground tabular">{new Date(s.starts_at).toLocaleString()} · {s.duration_min} min</div>
              </div>
              {s.can_join ? (
                <Button size="sm" onClick={() => joinSession(s)} disabled={joiningId === s.id} className="rounded-full bg-gradient-hot text-white border-0">
                  {joiningId === s.id ? "Joining…" : "Join now"}
                </Button>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Opens 5 min before</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {totalLessons === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <PlayCircle className="w-8 h-8 mx-auto text-primary/60 mb-3" />
          <p className="text-sm text-muted-foreground">Curriculum coming soon.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Lesson list — click a lesson to load it in the player */}
          <div className="space-y-1" data-testid="lesson-nav">
            {modules.map((m, i) => {
              const lid = m.id || String(i);
              const isDone = completed.includes(lid);
              return (
                <button key={lid} type="button" onClick={() => setActiveIdx(i)} data-testid={`lesson-nav-${i}`}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    i === activeIdx ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-foreground/85"
                  }`}>
                  {isDone
                    ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="flex-1 leading-snug">{i + 1}. {m.title || "Untitled lesson"}</span>
                </button>
              );
            })}
          </div>

          {/* Player — the currently selected lesson only */}
          <div data-testid="lesson-player">
            <div className="text-2xl font-serif mb-4">{active.title || "Untitled lesson"}</div>
            {active.video_url ? (
              <video key={activeId} src={active.video_url} controls className="w-full rounded-xl border border-border bg-black aspect-video" />
            ) : (
              <div className="w-full rounded-xl border border-dashed border-border aspect-video flex items-center justify-center text-muted-foreground text-sm">
                No video for this lesson.
              </div>
            )}
            {active.body && (
              <div className="mt-5 font-editorial leading-relaxed whitespace-pre-line text-foreground/85">{active.body}</div>
            )}
            <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)} className="rounded-full">
                  ← Previous
                </Button>
                <Button size="sm" variant="outline" disabled={activeIdx === totalLessons - 1} onClick={() => setActiveIdx((i) => i + 1)} className="rounded-full">
                  Next →
                </Button>
              </div>
              <Button size="sm" variant={activeDone ? "default" : "outline"} onClick={() => toggleLesson(activeId)}
                data-testid="lesson-complete-toggle"
                className={`rounded-full ${activeDone ? "bg-primary text-primary-foreground border-0" : ""}`}>
                {activeDone ? <><Award className="w-4 h-4 mr-1" />Completed</> : "Mark complete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
