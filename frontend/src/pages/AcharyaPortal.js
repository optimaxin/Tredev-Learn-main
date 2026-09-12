import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { compressImage } from "@/lib/upload";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import VideoPlayer from "@/components/VideoPlayer";
import { CheckCircle2, XCircle, Video, Radio, ScrollText, Award, FileText, PlusCircle, BookOpen, PenLine, Stamp, CalendarClock, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";

const CONTENT_KINDS = [
  { value: "lecture_note", labelKey: "acharyaPortal.contentKinds.lectureNote" },
  { value: "verse_commentary", labelKey: "acharyaPortal.contentKinds.verseCommentary" },
  { value: "lesson_draft", labelKey: "acharyaPortal.contentKinds.lessonDraft" },
];

const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

function mondayOf(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  return date;
}
const isoDate = (d) => d.toISOString().slice(0, 10);

/** One batch's classes, one week at a time — a batch's whole timetable can
 * span months, so "Scheduled sessions" shows the current week by default
 * with prev/next navigation instead of dumping every class at once. */
function BatchWeekSchedule({ batch, onJoin }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  useEffect(() => {
    setLoading(true);
    api.get("/live-sessions/mine-acharya", {
      params: { batch_id: batch.id, week_start: isoDate(monday), week_end: isoDate(sunday) },
    }).then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id, weekOffset]);

  return (
    <div className="rounded-2xl border border-border p-6 bg-card" data-testid={`batch-week-${batch.id}`}>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{batch.offering_title}</Badge>
        <span className="text-xs text-muted-foreground">{batch.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-full hover:bg-muted" aria-label="Previous week" data-testid={`batch-week-prev-${batch.id}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs tabular text-muted-foreground">{monday.toLocaleDateString()} – {sunday.toLocaleDateString()}</span>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-full hover:bg-muted" aria-label="Next week" data-testid={`batch-week-next-${batch.id}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No classes this week.</div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="rounded-lg bg-muted/60 p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1" data-testid={`batch-week-session-${s.id}`}>
              <span className="font-display font-semibold">{s.title}</span>
              <span className="text-xs text-muted-foreground tabular">{new Date(s.starts_at).toLocaleString()} · {s.duration_min} min</span>
              {s.can_join && (
                <Button size="sm" onClick={() => onJoin(s.id)} className="ml-auto rounded-full h-8 px-4 bg-gradient-hot text-white border-0 animate-glow" data-testid={`batch-week-join-${s.id}`}>Join now</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AcharyaPortal() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [offerings, setOfferings] = useState([]);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [contentSubmissions, setContentSubmissions] = useState([]);
  const [signedCerts, setSignedCerts] = useState([]);
  const [pendingCerts, setPendingCerts] = useState([]);
  const [signName, setSignName] = useState({});
  const [signingId, setSigningId] = useState(null);
  const [notes, setNotes] = useState({});
  const [rejectNotes, setRejectNotes] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [pendingSchedules, setPendingSchedules] = useState([]); // batches awaiting this acharya's timetable sign-off
  const [approvedBatches, setApprovedBatches] = useState([]); // approved batches — Scheduled sessions shows these week-by-week, not all at once
  const [scheduleNotes, setScheduleNotes] = useState({});
  const [decidingScheduleId, setDecidingScheduleId] = useState(null);
  const [newContent, setNewContent] = useState({
    title: "", body: "", kind: "lecture_note", offering_id: "",
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [submittingContent, setSubmittingContent] = useState(false);

  const load = async () => {
    const [o, s, c, sc, pc] = await Promise.all([
      api.get("/offerings?published_only=false").catch(() => ({ data: [] })),
      api.get("/live-sessions/mine-acharya").catch(() => ({ data: [] })),
      api.get("/acharya/content").catch(() => ({ data: [] })),
      api.get("/certificates/signed-by-me").catch(() => ({ data: [] })),
      api.get("/certificates/pending-signature").catch(() => ({ data: [] })),
    ]);
    const mine = (Array.isArray(o.data) ? o.data : []).filter((x) => x.acharya_id === user?.id);
    setOfferings(mine);
    setPending(mine.filter((x) => !x.approved_by_acharya));
    setApproved(mine.filter((x) => x.approved_by_acharya));
    setSessions(Array.isArray(s.data) ? s.data : []);
    setContentSubmissions(Array.isArray(c.data) ? c.data : []);
    setSignedCerts(Array.isArray(sc.data) ? sc.data : []);
    setPendingCerts(Array.isArray(pc.data) ? pc.data : []);

    const liveCourseIds = mine.filter((x) => x.type === "live_course").map((x) => x.id);
    const batchLists = await Promise.all(
      liveCourseIds.map((id) => api.get("/batches", { params: { offering_id: id } }).catch(() => ({ data: [] })))
    );
    const allBatches = batchLists.flatMap((r, i) => (Array.isArray(r.data) ? r.data : []).map((b) => ({ ...b, offering_title: mine.find((x) => x.id === liveCourseIds[i])?.title })));
    setPendingSchedules(allBatches.filter((b) => b.schedule_status === "pending_approval"));
    setApprovedBatches(allBatches.filter((b) => b.schedule_status === "approved"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) load(); }, [user?.id]);

  const decide = async (o, approvedVal) => {
    try {
      await api.post(`/offerings/${o.id}/approval`, { approved: approvedVal, notes: notes[o.id] || "" });
      toast.success(approvedVal ? t("acharyaPortal.approvedToast") : t("acharyaPortal.sentBackToast"));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const decideSchedule = async (batchId, approvedVal) => {
    setDecidingScheduleId(batchId);
    try {
      await api.post(`/batches/${batchId}/schedule-approval`, { approved: approvedVal, notes: scheduleNotes[batchId] || "" });
      toast.success(approvedVal ? t("acharyaPortal.timetableApprovedToast") : t("acharyaPortal.timetableSentBackToast"));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setDecidingScheduleId(null);
  };

  const submitContent = async (e) => {
    e.preventDefault();
    if (!newContent.title.trim() || !newContent.body.trim()) return toast.error(t("acharyaPortal.titleBodyRequired"));
    if (attachmentFile && attachmentFile.size > ATTACHMENT_MAX_BYTES) return toast.error(t("acharyaPortal.attachmentTooLarge"));
    setSubmittingContent(true);
    try {
      let payload = { ...newContent };
      if (attachmentFile) {
        // Images compress client-side (fewer bytes over the wire); PDFs/DOCX are
        // already compressed containers, so they upload as-is — no data loss either way.
        const toUpload = attachmentFile.type.startsWith("image/") ? await compressImage(attachmentFile) : attachmentFile;
        const { data: signed } = await api.post("/acharya/content/sign-upload", {
          filename: toUpload.name, content_type: toUpload.type, size_bytes: toUpload.size,
        });
        await axios.put(signed.upload_url, toUpload, { headers: { "Content-Type": toUpload.type } });
        payload = { ...payload, attachment_url: signed.public_url, attachment_name: signed.filename, attachment_size: toUpload.size };
      }
      await api.post("/acharya/content", payload);
      toast.success(t("acharyaPortal.submittedToast"));
      setNewContent({ title: "", body: "", kind: "lecture_note", offering_id: "" });
      setAttachmentFile(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    setSubmittingContent(false);
  };

  const joinSession = async (id) => {
    try {
      const { data } = await api.post(`/live-sessions/${id}/join`);
      toast.info(t("acharyaPortal.mockedJoinToast"));
      window.open(data.join_url, "_blank");
    } catch { toast.error(t("acharyaPortal.couldNotJoin")); }
  };

  const signCert = async (c) => {
    const name = (signName[c.code] ?? user?.name ?? "").trim();
    if (!name) return toast.error(t("acharyaPortal.enterSignatureName"));
    setSigningId(c.code);
    try {
      await api.post(`/certificates/${c.code}/sign`, { signature_name: name });
      toast.success(t("acharyaPortal.signedToast"));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSigningId(null);
  };

  const rejectCert = async (c) => {
    const note = (rejectNotes[c.code] || "").trim();
    if (!note) return toast.error(t("acharyaPortal.rejectReasonRequired"));
    setRejectingId(c.code);
    try {
      await api.post(`/certificates/${c.code}/reject`, { note });
      toast.success(t("acharyaPortal.rejectedToast"));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setRejectingId(null);
  };

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">{t("acharyaPortal.badge")}</div>
      <h1 className="text-5xl font-display font-bold tracking-tight">{user?.name}</h1>
      {user?.parampara && <p className="mt-2 italic text-accent font-editorial text-lg">{user.parampara}</p>}

      <Tabs defaultValue="approvals" className="mt-10">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="approvals" data-testid="acharya-tab-approvals">{t("acharyaPortal.tabApprovals")} ({pending.length})</TabsTrigger>
          <TabsTrigger value="content" data-testid="acharya-tab-content">{t("acharyaPortal.tabAddContent")}</TabsTrigger>
          <TabsTrigger value="content-log" data-testid="acharya-tab-content-log">{t("acharyaPortal.tabMySubmissions")} ({contentSubmissions.length})</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="acharya-tab-sessions">{t("acharyaPortal.tabSessions")} ({sessions.length})</TabsTrigger>
          <TabsTrigger value="published" data-testid="acharya-tab-published">{t("acharyaPortal.tabPublished")} ({approved.length})</TabsTrigger>
          <TabsTrigger value="awaiting-signature" data-testid="acharya-tab-awaiting-signature">{t("acharyaPortal.tabAwaitingSignature")} ({pendingCerts.length})</TabsTrigger>
          <TabsTrigger value="signed-certs" data-testid="acharya-tab-signed-certs">{t("acharyaPortal.tabSignedCerts")} ({signedCerts.length})</TabsTrigger>
        </TabsList>

        {/* APPROVAL QUEUE */}
        <TabsContent value="approvals" className="mt-8 space-y-4">
          {/* Batch timetables — staff uploads a class schedule per batch before scheduling any session */}
          <div className="space-y-3">
            <div className="eyebrow flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5" /> {t("acharyaPortal.timetablesHeading")} ({pendingSchedules.length})</div>
            {pendingSchedules.length === 0 && <div className="text-muted-foreground text-sm">{t("acharyaPortal.noTimetablesPending")}</div>}
            {pendingSchedules.map((b) => (
              <div key={b.id} className="rounded-2xl border border-border p-6 bg-card" data-testid={`schedule-approval-${b.id}`}>
                <div className="flex items-baseline gap-3 mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{b.offering_title}</Badge>
                  <span className="text-xs text-muted-foreground">{t("acharyaPortal.timetableFor", { batch: b.name })}</span>
                </div>
                <div className="space-y-2 mt-3">
                  {(b.timetable || []).map((slot, i) => (
                    <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display font-semibold">{slot.title}</span>
                      <span className="text-xs text-muted-foreground tabular">{new Date(slot.starts_at).toLocaleString()} · {slot.duration_min} min</span>
                      {slot.topic && <span className="text-xs text-muted-foreground italic">{slot.topic}</span>}
                    </div>
                  ))}
                </div>
                <Textarea placeholder={t("acharyaPortal.feedbackPlaceholder")} value={scheduleNotes[b.id] || ""}
                  onChange={(e) => setScheduleNotes({ ...scheduleNotes, [b.id]: e.target.value })}
                  data-testid={`schedule-notes-${b.id}`} className="mt-4" />
                <div className="mt-4 flex gap-3">
                  <Button onClick={() => decideSchedule(b.id, true)} disabled={decidingScheduleId === b.id} data-testid={`schedule-approve-${b.id}`} className="rounded-full bg-gradient-hot text-white border-0">
                    <CheckCircle2 className="w-4 h-4 mr-2"/>{t("acharyaPortal.approveTimetable")}
                  </Button>
                  <Button onClick={() => { if (!(scheduleNotes[b.id] || "").trim()) return toast.error(t("acharyaPortal.addFeedbackRequired")); decideSchedule(b.id, false); }}
                    disabled={decidingScheduleId === b.id} data-testid={`schedule-reject-${b.id}`} variant="outline" className="rounded-full">
                    <XCircle className="w-4 h-4 mr-2"/>{t("acharyaPortal.requestTimetableChanges")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="eyebrow pt-2">{t("acharyaPortal.coursesHeading")}</div>
          {pending.length === 0 && <div className="text-muted-foreground text-sm">{t("acharyaPortal.nothingAwaitingSignoff")}</div>}
          {pending.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border p-6 bg-card" data-testid={`approval-${o.id}`}>
              <div className="flex items-baseline gap-3 mb-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{o.type.replace("_"," ")}</Badge>
                <span className="text-xs text-muted-foreground">{o.subject}</span>
              </div>
              <div className="font-display font-bold text-2xl">{o.title}</div>
              <p className="text-sm text-muted-foreground mt-2">{o.description}</p>

              {/* Lessons to review — recorded video + written content uploaded by staff */}
              <div className="mt-5">
                <div className="eyebrow flex items-center gap-2 mb-3"><BookOpen className="w-3.5 h-3.5" /> {t("acharyaPortal.lessonsToReview")} ({Array.isArray(o.modules) ? o.modules.length : 0})</div>
                {(!o.modules || o.modules.length === 0) && (
                  <div className="text-xs text-muted-foreground rounded-lg bg-muted p-3">{t("acharyaPortal.noLessonsYet")}</div>
                )}
                <div className="space-y-4">
                  {(o.modules || []).map((m, i) => (
                    <div key={m.id || i} className="rounded-xl border border-border p-4 bg-background/50" data-testid={`review-lesson-${o.id}-${i}`}>
                      <div className="font-display font-semibold">{i + 1}. {m.title || t("acharyaPortal.untitledLesson")}</div>
                      {m.video_url && (
                        <VideoPlayer offeringId={o.id} lessonId={m.id || String(i)} className="mt-3 max-w-xl" />
                      )}
                      {m.body && (
                        <div className="mt-3 font-editorial text-sm leading-relaxed whitespace-pre-line border-l-2 border-accent/40 pl-4">{m.body}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Textarea placeholder={t("acharyaPortal.feedbackPlaceholder")} value={notes[o.id] || ""}
                onChange={(e)=>setNotes({...notes, [o.id]: e.target.value})}
                data-testid={`approval-notes-${o.id}`} className="mt-4" />
              <div className="mt-4 flex gap-3">
                <Button onClick={()=>decide(o, true)} data-testid={`approve-${o.id}`} className="rounded-full bg-gradient-hot text-white border-0">
                  <CheckCircle2 className="w-4 h-4 mr-2"/>{t("acharyaPortal.goodToGo")}
                </Button>
                <Button onClick={()=>{ if(!(notes[o.id]||"").trim()) return toast.error(t("acharyaPortal.addFeedbackRequired")); decide(o, false); }} data-testid={`reject-${o.id}`} variant="outline" className="rounded-full">
                  <XCircle className="w-4 h-4 mr-2"/>{t("acharyaPortal.requestChanges")}
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ADD CONTENT (goes to staff for review) */}
        <TabsContent value="content" className="mt-8">
          <div className="rounded-2xl border border-border p-8 bg-card max-w-3xl" data-testid="acharya-content-form">
            <div className="flex items-center gap-2 mb-2">
              <PlusCircle className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-2xl">{t("acharyaPortal.draftNewContent")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t("acharyaPortal.draftNewContentSubtext")}
            </p>
            <form onSubmit={submitContent} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="eyebrow">{t("acharyaPortal.kind")}</label>
                  <Select value={newContent.kind} onValueChange={(v)=>setNewContent({...newContent, kind: v})}>
                    <SelectTrigger className="mt-2 h-11" data-testid="acharya-content-kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTENT_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{t(k.labelKey)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="eyebrow">{t("acharyaPortal.courseOptional")}</label>
                  <Select value={newContent.offering_id} onValueChange={(v)=>setNewContent({...newContent, offering_id: v})}>
                    <SelectTrigger className="mt-2 h-11" data-testid="acharya-content-offering"><SelectValue placeholder={t("acharyaPortal.attachToCourse")} /></SelectTrigger>
                    <SelectContent>{offerings.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="eyebrow">{t("acharyaPortal.title")}</label>
                <Input value={newContent.title} onChange={(e)=>setNewContent({...newContent, title: e.target.value})}
                  data-testid="acharya-content-title" className="mt-2 h-11" placeholder={t("acharyaPortal.titleExample")} />
              </div>
              <div>
                <label className="eyebrow">{t("acharyaPortal.body")}</label>
                <Textarea value={newContent.body} onChange={(e)=>setNewContent({...newContent, body: e.target.value})}
                  data-testid="acharya-content-body" className="mt-2 min-h-[220px] font-editorial"
                  placeholder={t("acharyaPortal.bodyPlaceholder")} />
              </div>
              <div>
                <label className="eyebrow flex items-center gap-1"><Paperclip className="w-3 h-3"/> {t("acharyaPortal.attachment")}</label>
                <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > ATTACHMENT_MAX_BYTES) { toast.error(t("acharyaPortal.attachmentTooLarge")); e.target.value = ""; return; }
                    setAttachmentFile(f);
                  }}
                  data-testid="acharya-content-attachment" className="mt-2" />
              </div>
              <Button type="submit" disabled={submittingContent} data-testid="acharya-content-submit"
                className="rounded-full h-11 px-8 bg-gradient-hot text-white border-0">
                {submittingContent ? t("acharyaPortal.submitting") : t("acharyaPortal.submitForReview")}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* MY CONTENT SUBMISSIONS LOG */}
        <TabsContent value="content-log" className="mt-8 space-y-3">
          {contentSubmissions.length === 0 && <div className="text-muted-foreground text-sm">{t("acharyaPortal.noSubmissionsYet")}</div>}
          {contentSubmissions.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border p-5 bg-card" data-testid={`content-sub-${c.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{c.kind.replace("_"," ")}</Badge>
                <Badge variant={c.status === "approved" ? "default" : c.status === "changes_requested" ? "destructive" : "outline"} className="text-[10px] uppercase tracking-widest">
                  {c.status.replace("_"," ")}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40">
                  {offerings.find(o=>o.id===c.offering_id)?.title || t("acharyaPortal.general")}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <div className="font-display font-semibold text-lg mt-2">{c.title}</div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.body}</p>
              {c.attachment_url && (
                <a href={c.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary link-underline" data-testid={`content-attachment-${c.id}`}>
                  <Paperclip className="w-3 h-3" /> {c.attachment_name || t("acharyaPortal.viewAttachment")}
                </a>
              )}
              {c.review_notes && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
                  <span className="uppercase tracking-widest text-[9px] text-muted-foreground">{t("acharyaPortal.reviewersNotes")}: </span>
                  {c.review_notes}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* SCHEDULED SESSIONS — batch-wise, one week at a time per batch;
            standalone (non-batch) sessions listed separately below since a
            week window doesn't apply to those. */}
        <TabsContent value="sessions" className="mt-8 space-y-6">
          <p className="text-sm text-muted-foreground">{t("acharyaPortal.sessionsSubtext")}</p>

          {approvedBatches.length > 0 && (
            <div className="space-y-3">
              {approvedBatches.map((b) => <BatchWeekSchedule key={b.id} batch={b} onJoin={joinSession} />)}
            </div>
          )}

          {(() => {
            const standalone = sessions.filter((s) => !s.batch_id);
            if (approvedBatches.length > 0 && standalone.length === 0) return null;
            return (
              <div className="space-y-3">
                {approvedBatches.length > 0 && <div className="eyebrow">Other sessions</div>}
                {standalone.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border p-5 bg-card flex items-center gap-4" data-testid={`acharya-session-${s.id}`}>
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                      {s.mode === "broadcast" ? <Radio className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-display font-semibold text-lg">{s.title}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {new Date(s.starts_at).toLocaleString()} · {s.duration_min} min · {s.mode}
                      </div>
                      {s.offering_title && <div className="text-xs text-primary mt-1">{s.offering_title}</div>}
                    </div>
                    {s.can_join ? (
                      <Button onClick={()=>joinSession(s.id)} className="rounded-full px-6 bg-gradient-hot text-white border-0 animate-glow" data-testid={`acharya-join-${s.id}`}>{t("acharyaPortal.joinNow")}</Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{t("acharyaPortal.opensBefore")}</Badge>
                    )}
                  </div>
                ))}
                {standalone.length === 0 && <div className="text-sm text-muted-foreground">{t("acharyaPortal.noSessionsScheduled")}</div>}
              </div>
            );
          })()}
        </TabsContent>

        {/* PUBLISHED */}
        <TabsContent value="published" className="mt-8 space-y-3">
          {approved.map((o) => (
            <div key={o.id} className="rounded-xl border border-border p-5 bg-card flex items-center justify-between" data-testid={`acharya-published-${o.id}`}>
              <div>
                <div className="font-display font-semibold text-lg">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_"," ")}</div>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/courses/${o.id}`} className="text-sm link-underline text-primary" data-testid={`acharya-view-course-${o.id}`}>
                  {t("acharyaPortal.viewCourse")} →
                </Link>
                <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest">{t("acharyaPortal.signedOff")}</Badge>
              </div>
            </div>
          ))}
          {approved.length === 0 && <div className="text-sm text-muted-foreground">{t("acharyaPortal.noCoursesPublished")}</div>}
        </TabsContent>

        {/* AWAITING SIGNATURE — certs routed to this acharya by staff */}
        <TabsContent value="awaiting-signature" className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">{t("acharyaPortal.awaitingSignatureSubtext")}</p>
          {pendingCerts.length === 0 && <div className="text-muted-foreground text-sm">{t("acharyaPortal.nothingAwaitingSignature")}</div>}
          {pendingCerts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border p-6 bg-card" data-testid={`sign-cert-${c.code}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <Award className="w-5 h-5 text-accent" />
                <div>
                  <div className="font-display font-semibold text-lg">{c.user_name}</div>
                  <div className="text-xs text-muted-foreground font-serif italic">{c.offering_title}</div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">{c.code}</span>
              </div>
              <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <label className="eyebrow flex items-center gap-1"><PenLine className="w-3 h-3"/> {t("acharyaPortal.signature")}</label>
                  <Input value={signName[c.code] ?? user?.name ?? ""} onChange={(e)=>setSignName({...signName, [c.code]: e.target.value})}
                    data-testid={`sign-name-${c.code}`} className="mt-2 h-11 font-editorial italic" />
                </div>
                <Button onClick={()=>signCert(c)} disabled={signingId===c.code || rejectingId===c.code} data-testid={`sign-submit-${c.code}`}
                  className="rounded-full h-11 px-6 bg-gradient-hot text-white border-0">
                  <Stamp className="w-4 h-4 mr-2"/>{signingId===c.code ? t("acharyaPortal.signing") : t("acharyaPortal.signAndCertify")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{t("acharyaPortal.signCertifyDisclaimer")}</p>

              <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end border-t border-border pt-4">
                <div>
                  <label className="eyebrow flex items-center gap-1"><XCircle className="w-3 h-3"/> {t("acharyaPortal.reject")}</label>
                  <Textarea value={rejectNotes[c.code] ?? ""} onChange={(e)=>setRejectNotes({...rejectNotes, [c.code]: e.target.value})}
                    placeholder={t("acharyaPortal.rejectReasonPlaceholder")} data-testid={`reject-note-${c.code}`} className="mt-2 min-h-[44px]" />
                </div>
                <Button onClick={()=>rejectCert(c)} disabled={rejectingId===c.code || signingId===c.code} variant="outline"
                  data-testid={`reject-submit-${c.code}`} className="rounded-full h-11 px-6 text-destructive border-destructive/40 hover:bg-destructive/10">
                  <XCircle className="w-4 h-4 mr-2"/>{rejectingId===c.code ? t("acharyaPortal.rejecting") : t("acharyaPortal.reject")}
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* SIGNED CERTIFICATES — issued under this acharya's signature */}
        <TabsContent value="signed-certs" className="mt-8">
          <p className="text-sm text-muted-foreground mb-5">{t("acharyaPortal.signedCertsSubtext")}</p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="acharya-signed-certs">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="text-left p-4">{t("acharyaPortal.learner")}</th><th className="text-left p-4">{t("acharyaPortal.course")}</th><th className="text-left p-4">{t("acharyaPortal.issued")}</th><th className="text-left p-4">{t("acharyaPortal.code")}</th><th className="text-right p-4">{t("acharyaPortal.verify")}</th></tr>
              </thead>
              <tbody>
                {signedCerts.map((c) => (
                  <tr key={c.id} className="border-t border-border" data-testid={`signed-cert-${c.code}`}>
                    <td className="p-4 font-display">{c.user_name}</td>
                    <td className="p-4">{c.offering_title}</td>
                    <td className="p-4 text-xs text-muted-foreground">{new Date(c.issued_at).toLocaleDateString()}</td>
                    <td className="p-4 font-mono text-xs">{c.code}</td>
                    <td className="p-4 text-right">
                      <a href={`/verify/${c.code}`} target="_blank" rel="noreferrer" className="text-primary link-underline text-xs">{t("acharyaPortal.open")} →</a>
                    </td>
                  </tr>
                ))}
                {signedCerts.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-muted-foreground text-sm">{t("acharyaPortal.noSignedCertsYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
