import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Video, Radio, ScrollText, Award, FileText, PlusCircle, BookOpen, PenLine, Stamp } from "lucide-react";

const CONTENT_KINDS = [
  { value: "lecture_note", labelKey: "acharyaPortal.contentKinds.lectureNote" },
  { value: "verse_commentary", labelKey: "acharyaPortal.contentKinds.verseCommentary" },
  { value: "lesson_draft", labelKey: "acharyaPortal.contentKinds.lessonDraft" },
];

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
  const [newContent, setNewContent] = useState({
    title: "", body: "", kind: "lecture_note", offering_id: "",
  });
  const [submittingContent, setSubmittingContent] = useState(false);

  const load = async () => {
    const [o, s, c, sc, pc] = await Promise.all([
      api.get("/offerings?published_only=false"),
      api.get("/live-sessions/mine-acharya").catch(() => ({ data: [] })),
      api.get("/acharya/content").catch(() => ({ data: [] })),
      api.get("/certificates/signed-by-me").catch(() => ({ data: [] })),
      api.get("/certificates/pending-signature").catch(() => ({ data: [] })),
    ]);
    const mine = o.data.filter((x) => x.acharya_id === user?.id);
    setOfferings(mine);
    setPending(mine.filter((x) => !x.approved_by_acharya));
    setApproved(mine.filter((x) => x.approved_by_acharya));
    setSessions(s.data);
    setContentSubmissions(c.data);
    setSignedCerts(sc.data);
    setPendingCerts(pc.data);
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

  const submitContent = async (e) => {
    e.preventDefault();
    if (!newContent.title.trim() || !newContent.body.trim()) return toast.error(t("acharyaPortal.titleBodyRequired"));
    setSubmittingContent(true);
    try {
      await api.post("/acharya/content", newContent);
      toast.success(t("acharyaPortal.submittedToast"));
      setNewContent({ title: "", body: "", kind: "lecture_note", offering_id: "" });
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
                        <video src={m.video_url} controls className="mt-3 w-full max-w-xl rounded-lg border border-border" />
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
              {c.review_notes && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
                  <span className="uppercase tracking-widest text-[9px] text-muted-foreground">{t("acharyaPortal.reviewersNotes")}: </span>
                  {c.review_notes}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* SCHEDULED SESSIONS */}
        <TabsContent value="sessions" className="mt-8">
          <p className="text-sm text-muted-foreground mb-5">{t("acharyaPortal.sessionsSubtext")}</p>
          <div className="space-y-3">
            {sessions.map((s) => (
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
            {sessions.length === 0 && <div className="text-sm text-muted-foreground">{t("acharyaPortal.noSessionsScheduled")}</div>}
          </div>
        </TabsContent>

        {/* PUBLISHED */}
        <TabsContent value="published" className="mt-8 space-y-3">
          {approved.map((o) => (
            <div key={o.id} className="rounded-xl border border-border p-5 bg-card flex items-center justify-between" data-testid={`acharya-published-${o.id}`}>
              <div>
                <div className="font-display font-semibold text-lg">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_"," ")}</div>
              </div>
              <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest">{t("acharyaPortal.signedOff")}</Badge>
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
                <Button onClick={()=>signCert(c)} disabled={signingId===c.code} data-testid={`sign-submit-${c.code}`}
                  className="rounded-full h-11 px-6 bg-gradient-hot text-white border-0">
                  <Stamp className="w-4 h-4 mr-2"/>{signingId===c.code ? t("acharyaPortal.signing") : t("acharyaPortal.signAndCertify")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{t("acharyaPortal.signCertifyDisclaimer")}</p>
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
