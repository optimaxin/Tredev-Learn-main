import React, { useEffect, useState, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Award, Video, Radio, Zap, FileText, Send, BookOpen, Stamp } from "lucide-react";
import LessonManager, { LessonEditor } from "@/components/LessonManager";
import OfferingEditor from "@/components/OfferingEditor";
import VerseBuilder from "@/components/VerseBuilder";
import MantraBuilder from "@/components/MantraBuilder";
import CertificateModal from "@/components/CertificateDoc";

const TYPES = ["masterclass","webinar","workshop","recorded_course","live_course","sadhana","ebook"];

export default function AcademicStaffPortal() {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [acharyas, setAcharyas] = useState([]);
  const [content, setContent] = useState([]);
  const [certGroups, setCertGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [webinars, setWebinars] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pendingCerts, setPendingCerts] = useState([]);
  const [verses, setVerses] = useState([]);
  const [mantras, setMantras] = useState([]);
  const [viewingCert, setViewingCert] = useState(null);

  const [answerText, setAnswerText] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [newOffering, setNewOffering] = useState({
    title: "", subtitle: "", description: "", type: "recorded_course",
    track: "A", subject: "Bhagavad Gita", price_inr: 0, price_usd: 0,
    duration: "", acharya_id: "", is_published: false, image_url: "",
  });
  const [draftLessons, setDraftLessons] = useState([]);
  const [creatingOffering, setCreatingOffering] = useState(false);
  const submitLock = useRef(false);
  const [newSession, setNewSession] = useState({
    title: "", offering_id: "", acharya_id: "", starts_at: "", duration_min: 60, mode: "interactive",
    join_url: "", topic: "",
  });
  const [editSession, setEditSession] = useState(null); // session being edited (id + fields)
  const [editWebinar, setEditWebinar] = useState(null); // webinar being edited
  const [newWebinar, setNewWebinar] = useState({
    title: "", cover_image: "", starts_at: "", duration_min: 90,
    price_inr: 99, orig_price_inr: 999, mentor_id: "", mentor_name: "",
    description: "", seats_remaining: 100, join_url: "",
  });
  const [issueForm, setIssueForm] = useState({ user_id: "", offering_id: "" });

  const load = async () => {
    const [o, cn, d, a, con, cg, u, w, s, pc, vs, mn] = await Promise.all([
      api.get("/offerings?published_only=false"),
      api.get("/consultations/mine").catch(()=>({data:[]})),
      api.get("/doubts").catch(()=>({data:[]})),
      api.get("/acharyas"),
      api.get("/acharya/content").catch(()=>({data:[]})),
      api.get("/certificates/all-grouped").catch(()=>({data:[]})),
      api.get("/learners").catch(()=>({data:[]})),
      api.get("/webinars").catch(()=>({data:[]})),
      api.get("/live-sessions").catch(()=>({data:[]})),
      api.get("/certificates/requests").catch(()=>({data:[]})),
      api.get("/verses?limit=200").catch(()=>({data:[]})),
      api.get("/mantras").catch(()=>({data:[]})),
    ]);
    setOfferings(o.data);
    setConsultations(cn.data);
    setDoubts(d.data.filter((x)=>!x.answer));
    setAcharyas(a.data);
    setContent(con.data);
    setCertGroups(cg.data);
    setUsers(u.data);
    setWebinars(w.data);
    setSessions(s.data);
    setPendingCerts(pc.data);
    setVerses(vs.data);
    setMantras(mn.data);
  };
  useEffect(() => { load(); }, []);

  const createOffering = async (e) => {
    e.preventDefault();
    if (!newOffering.acharya_id) return toast.error("Assign an Ācharya — every course must be routed to one for sign-off.");
    if (submitLock.current) return;            // guard against double-submit (sync, race-safe)
    submitLock.current = true;
    setCreatingOffering(true);
    try {
      const modules = draftLessons.map((l, i) => ({
        id: l.id, title: l.title, body: l.body,
        video_url: l.video_url || "", video_path: l.video_path || "", order: i,
      }));
      await api.post("/offerings", { ...newOffering, modules });
      toast.success("Draft created. Awaiting Ācharya sign-off.");
      setNewOffering({...newOffering, title:"", description:"", subtitle:""});
      setDraftLessons([]);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    setCreatingOffering(false);
    submitLock.current = false;
  };

  const closeConsult = async (c, status) => {
    try {
      await api.patch(`/consultations/${c.id}`, { status });
      toast.success("Updated.");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const answer = async (d) => {
    if (!answerText[d.id]) return;
    try {
      await api.post(`/doubts/${d.id}/answer`, { answer: answerText[d.id] });
      toast.success("Answered.");
      setAnswerText({...answerText, [d.id]: ""});
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const reviewContent = async (c, approved) => {
    try {
      await api.post(`/acharya/content/${c.id}/review`, {
        approved, notes: reviewNotes[c.id] || "",
      });
      toast.success(approved ? "Approved for publication." : "Changes requested.");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!newSession.title || !newSession.acharya_id || !newSession.starts_at) {
      return toast.error("Title, Ācharya and start time are required.");
    }
    try {
      const isoTime = new Date(newSession.starts_at).toISOString();
      const offering_id = newSession.offering_id === "__other__" ? "" : newSession.offering_id;
      await api.post("/live-sessions", { ...newSession, offering_id, starts_at: isoTime, duration_min: parseInt(newSession.duration_min) });
      toast.success("Session scheduled.");
      setNewSession({ title: "", offering_id: "", acharya_id: "", starts_at: "", duration_min: 60, mode: "interactive", join_url: "", topic: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // Convert a stored ISO time to the value a datetime-local input expects.
  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };

  const startEditSession = (s) => setEditSession({
    id: s.id, title: s.title || "", offering_id: s.offering_id || "__other__",
    acharya_id: s.acharya_id || "", starts_at: toLocalInput(s.starts_at),
    duration_min: s.duration_min || 60, mode: s.mode || "interactive",
    join_url: s.join_url || "", topic: s.topic || "",
  });

  const saveEditSession = async () => {
    if (!editSession.title || !editSession.acharya_id || !editSession.starts_at) {
      return toast.error("Title, Ācharya and start time are required.");
    }
    try {
      const offering_id = editSession.offering_id === "__other__" ? "" : editSession.offering_id;
      await api.patch(`/live-sessions/${editSession.id}`, {
        title: editSession.title, offering_id, acharya_id: editSession.acharya_id,
        starts_at: new Date(editSession.starts_at).toISOString(),
        duration_min: parseInt(editSession.duration_min), mode: editSession.mode,
        join_url: editSession.join_url, topic: editSession.topic,
      });
      toast.success("Session updated.");
      setEditSession(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const deleteSession = async (id) => {
    try {
      await api.delete(`/live-sessions/${id}`);
      toast.success("Session deleted.");
      setEditSession(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const startEditWebinar = (w) => setEditWebinar({
    id: w.id, title: w.title || "", description: w.description || "", cover_image: w.cover_image || "",
    starts_at: toLocalInput(w.starts_at), duration_min: w.duration_min || 90,
    price_inr: w.price_inr || 0, orig_price_inr: w.orig_price_inr || 0,
    seats_remaining: w.seats_remaining || 0, mentor_id: w.mentor_id || "", join_url: w.join_url || "",
  });

  const saveEditWebinar = async () => {
    if (!editWebinar.title || !editWebinar.starts_at) return toast.error("Title and start time are required.");
    try {
      const acharya = acharyas.find((a) => a.id === editWebinar.mentor_id);
      await api.patch(`/webinars/${editWebinar.id}`, {
        title: editWebinar.title, description: editWebinar.description, cover_image: editWebinar.cover_image,
        starts_at: new Date(editWebinar.starts_at).toISOString(), duration_min: parseInt(editWebinar.duration_min),
        price_inr: parseInt(editWebinar.price_inr), orig_price_inr: parseInt(editWebinar.orig_price_inr),
        seats_remaining: parseInt(editWebinar.seats_remaining), join_url: editWebinar.join_url,
        mentor_id: editWebinar.mentor_id, mentor_name: acharya?.name || "",
      });
      toast.success("Webinar updated.");
      setEditWebinar(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const deleteWebinar = async (id) => {
    try {
      await api.delete(`/webinars/${id}`);
      toast.success("Webinar deleted.");
      setEditWebinar(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const createWebinar = async (e) => {
    e.preventDefault();
    if (!newWebinar.title || !newWebinar.starts_at) return toast.error("Title and start time required.");
    try {
      const isoTime = new Date(newWebinar.starts_at).toISOString();
      const acharya = acharyas.find((a) => a.id === newWebinar.mentor_id);
      await api.post("/webinars", {
        ...newWebinar,
        starts_at: isoTime,
        mentor_name: acharya?.name || newWebinar.mentor_name,
        duration_min: parseInt(newWebinar.duration_min),
        price_inr: parseInt(newWebinar.price_inr),
        orig_price_inr: parseInt(newWebinar.orig_price_inr),
        seats_remaining: parseInt(newWebinar.seats_remaining),
      });
      toast.success("Webinar published.");
      setNewWebinar({ ...newWebinar, title: "", starts_at: "", cover_image: "", description: "", join_url: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const issueCert = async (e) => {
    e.preventDefault();
    if (!issueForm.user_id || !issueForm.offering_id) return toast.error("Learner and course required.");
    try {
      const { data } = await api.post("/certificates/issue", issueForm);
      toast.success(`Issued ${data.code} — routed to ${data.acharya_name || "the Ācharya"} for signature.`);
      setIssueForm({ user_id: "", offering_id: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const assignAcharya = async (offeringId, acharyaId) => {
    try {
      await api.patch(`/offerings/${offeringId}`, { acharya_id: acharyaId });
      toast.success("Ācharya assigned — course routed for sign-off.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const deleteMantra = async (id) => {
    try {
      await api.delete(`/mantras/${id}`);
      toast.success("Mantra deleted.");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const approveCertRequest = async (code) => {
    try {
      await api.post(`/certificates/${code}/approve-request`);
      toast.success("Approved — routed to the Ācharya for signature.");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const STATUS_LABEL = {
    requested: "Requested by learner",
    pending_signature: "Awaiting Ācharya signature",
    signed: "Signed",
    published: "Published",
  };

  const learners = users.filter((u) => u.role === "learner");
  const pendingContent = content.filter((c) => c.status === "pending_review");

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">ACADEMIC STAFF PORTAL · THE OPERATIONAL ENGINE</div>
      <h1 className="text-5xl font-display font-bold tracking-tight">{user?.name}</h1>

      <Tabs defaultValue="build" className="mt-10">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="build" data-testid="staff-tab-build">Course builder</TabsTrigger>
          <TabsTrigger value="offerings" data-testid="staff-tab-offerings">All offerings ({offerings.length})</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="staff-tab-sessions">Schedule sessions</TabsTrigger>
          <TabsTrigger value="webinars" data-testid="staff-tab-webinars">Webinars</TabsTrigger>
          <TabsTrigger value="verses" data-testid="staff-tab-verses">Verses ({verses.length})</TabsTrigger>
          <TabsTrigger value="mantras" data-testid="staff-tab-mantras">Mantras ({mantras.length})</TabsTrigger>
          <TabsTrigger value="content-review" data-testid="staff-tab-content-review">Ācharya content ({pendingContent.length})</TabsTrigger>
          <TabsTrigger value="doubts" data-testid="staff-tab-doubts">Doubts ({doubts.length})</TabsTrigger>
          <TabsTrigger value="certs" data-testid="staff-tab-certs">Certificates</TabsTrigger>
          <TabsTrigger value="consultations" data-testid="staff-tab-consultations">Consultations ({consultations.length})</TabsTrigger>
        </TabsList>

        {/* COURSE BUILDER */}
        <TabsContent value="build" className="mt-8">
          <form onSubmit={createOffering} className="rounded-2xl border border-border p-8 bg-card grid md:grid-cols-2 gap-5 max-w-4xl" data-testid="offering-form">
            <div className="md:col-span-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-2xl">Build a new offering</h3>
            </div>
            <div className="md:col-span-2">
              <label className="overline">Title</label>
              <Input value={newOffering.title} onChange={(e)=>setNewOffering({...newOffering,title:e.target.value})} required data-testid="offering-title" className="mt-2 h-11" />
            </div>
            <div className="md:col-span-2">
              <label className="overline">Subtitle</label>
              <Input value={newOffering.subtitle} onChange={(e)=>setNewOffering({...newOffering,subtitle:e.target.value})} className="mt-2 h-11" />
            </div>
            <div className="md:col-span-2">
              <label className="overline">Description</label>
              <Textarea value={newOffering.description} onChange={(e)=>setNewOffering({...newOffering,description:e.target.value})} required data-testid="offering-desc" className="mt-2 min-h-[100px]" />
            </div>
            <div>
              <label className="overline">Type</label>
              <Select value={newOffering.type} onValueChange={(v)=>setNewOffering({...newOffering,type:v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="offering-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t=><SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="overline">Subject</label>
              <Input value={newOffering.subject} onChange={(e)=>setNewOffering({...newOffering,subject:e.target.value})} className="mt-2 h-11" />
            </div>
            <div>
              <label className="overline">Ācharya (multiple Ācharyas — pick one)</label>
              <Select value={newOffering.acharya_id} onValueChange={(v)=>setNewOffering({...newOffering,acharya_id:v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="offering-acharya"><SelectValue placeholder="Assign an Ācharya…" /></SelectTrigger>
                <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="overline">Cover image URL (upload later)</label>
              <Input value={newOffering.image_url} onChange={(e)=>setNewOffering({...newOffering,image_url:e.target.value})} className="mt-2 h-11" placeholder="https://…" />
            </div>
            <div>
              <label className="overline">Duration</label>
              <Input value={newOffering.duration} onChange={(e)=>setNewOffering({...newOffering,duration:e.target.value})} className="mt-2 h-11" placeholder="e.g. 8-week cohort" />
            </div>
            <div>
              <label className="overline">Price (INR)</label>
              <Input type="number" value={newOffering.price_inr} onChange={(e)=>setNewOffering({...newOffering,price_inr:parseInt(e.target.value||0)})} className="mt-2 h-11" />
            </div>
            <div>
              <label className="overline">Price (USD)</label>
              <Input type="number" value={newOffering.price_usd} onChange={(e)=>setNewOffering({...newOffering,price_usd:parseInt(e.target.value||0)})} className="mt-2 h-11" />
            </div>
            {/* Lessons — recorded video + written content, reviewed by the Ācharya before sign-off */}
            <div className="md:col-span-2 border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-1">
                <Video className="w-4 h-4 text-primary" />
                <h4 className="font-display font-semibold">Lessons — recorded video & written content</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Add each lesson's video and written notes. The Ācharya reviews these before signing off. (You can also add or edit lessons later under “All offerings”.)</p>
              <LessonEditor lessons={draftLessons} onChange={setDraftLessons} idPrefix="draft-lesson" />
            </div>
            <Button type="submit" disabled={creatingOffering} data-testid="offering-create" className="md:col-span-2 rounded-full h-12 bg-gradient-hot text-white border-0">
              {creatingOffering ? "Saving…" : "Save draft — send to Ācharya for sign-off"}
            </Button>
            <p className="md:col-span-2 text-xs text-muted-foreground">Nothing is published under an Ācharya's name until they've approved it.</p>
          </form>
        </TabsContent>

        {/* OFFERINGS LIST — with Ācharya names visible */}
        <TabsContent value="offerings" className="mt-8 space-y-3">
          {offerings.map((o)=>{
            const acharya = acharyas.find(a => a.id === o.acharya_id);
            const lessonCount = Array.isArray(o.modules) ? o.modules.length : 0;
            return (
              <details key={o.id} className="rounded-xl border border-border bg-card" data-testid={`staff-offering-${o.id}`}>
                <summary className="p-5 flex items-center gap-4 flex-wrap cursor-pointer list-none">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-display font-semibold text-lg">{o.title}</div>
                    <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_"," ")}</div>
                    {acharya && <div className="text-xs text-primary mt-1">Ācharya: {acharya.name}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest gap-1">
                    <BookOpen className="w-3 h-3" /> {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant={o.is_published ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                    {o.is_published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant={o.approved_by_acharya ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                    {o.approved_by_acharya ? "Ācharya ✓" : "Awaiting sign-off"}
                  </Badge>
                </summary>
                <div className="border-t border-border p-5 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="overline">Assigned Ācharya</label>
                    <Select value={o.acharya_id || ""} onValueChange={(v)=>assignAcharya(o.id, v)}>
                      <SelectTrigger className="h-10 w-64" data-testid={`assign-acharya-${o.id}`}><SelectValue placeholder="Assign an Ācharya…"/></SelectTrigger>
                      <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {!o.acharya_id && <span className="text-xs text-destructive">Not routed — assign an Ācharya to send for review</span>}
                  </div>
                  <OfferingEditor offering={o} onSaved={load} />
                  {o.approval_notes && !o.approved_by_acharya && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs">
                      <strong>Ācharya requested changes:</strong> {o.approval_notes}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-semibold">Lessons — recorded video & written content</h4>
                  </div>
                  <LessonManager offering={o} onSaved={load} />
                </div>
              </details>
            );
          })}
        </TabsContent>

        {/* SCHEDULE LIVE SESSIONS */}
        <TabsContent value="sessions" className="mt-8 grid lg:grid-cols-[1fr_1.4fr] gap-8">
          <form onSubmit={createSession} className="rounded-2xl border border-border p-6 bg-card space-y-4" data-testid="session-form">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-xl">Schedule a session</h3>
            </div>
            <p className="text-xs text-muted-foreground">Choose an Ācharya — the session appears on their portal to join. A session can belong to a course, or be standalone (“Other”).</p>
            <div>
              <label className="overline">Title</label>
              <Input value={newSession.title} onChange={(e)=>setNewSession({...newSession, title: e.target.value})} data-testid="session-title" className="mt-2 h-11" />
            </div>
            <div>
              <label className="overline">Course</label>
              <Select value={newSession.offering_id} onValueChange={(v)=>setNewSession({...newSession, offering_id: v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="session-offering"><SelectValue placeholder="Pick a course…"/></SelectTrigger>
                <SelectContent>
                  {offerings.map(o=><SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                  <SelectItem value="__other__">Other — not tied to a course</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSession.offering_id === "__other__" && (
              <div>
                <label className="overline">Session topic</label>
                <Input value={newSession.topic} onChange={(e)=>setNewSession({...newSession, topic: e.target.value})} data-testid="session-topic" className="mt-2 h-11" placeholder="What is this standalone session about?" />
              </div>
            )}
            <div>
              <label className="overline">Ācharya</label>
              <Select value={newSession.acharya_id} onValueChange={(v)=>setNewSession({...newSession, acharya_id: v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="session-acharya"><SelectValue placeholder="Assign an Ācharya…"/></SelectTrigger>
                <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="overline">Starts at</label>
                <Input type="datetime-local" value={newSession.starts_at} onChange={(e)=>setNewSession({...newSession, starts_at: e.target.value})} data-testid="session-starts" className="mt-2 h-11" />
              </div>
              <div>
                <label className="overline">Duration (min)</label>
                <Input type="number" value={newSession.duration_min} onChange={(e)=>setNewSession({...newSession, duration_min: e.target.value})} className="mt-2 h-11" />
              </div>
            </div>
            <div>
              <label className="overline">Session link (join URL)</label>
              <Input value={newSession.join_url} onChange={(e)=>setNewSession({...newSession, join_url: e.target.value})} data-testid="session-link" className="mt-2 h-11" placeholder="https://meet.google.com/… or Zoom link" />
            </div>
            <div>
              <label className="overline">Mode</label>
              <Select value={newSession.mode} onValueChange={(v)=>setNewSession({...newSession, mode: v})}>
                <SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interactive">Interactive</SelectItem>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" data-testid="session-submit" className="w-full rounded-full h-11 bg-gradient-hot text-white border-0">Schedule session</Button>
          </form>

          <div>
            <h3 className="font-display font-bold text-xl mb-4">All scheduled sessions</h3>
            <p className="text-xs text-muted-foreground mb-3">Click a session to edit or delete it.</p>
            <div className="space-y-3">
              {sessions.map((s) => (
                editSession?.id === s.id ? (
                  <div key={s.id} className="rounded-xl border border-primary/40 p-4 bg-card space-y-3" data-testid={`edit-session-${s.id}`}>
                    <Input value={editSession.title} onChange={(e)=>setEditSession({...editSession, title:e.target.value})} className="h-10" placeholder="Title" />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={editSession.offering_id} onValueChange={(v)=>setEditSession({...editSession, offering_id:v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Course"/></SelectTrigger>
                        <SelectContent>
                          {offerings.map(o=><SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                          <SelectItem value="__other__">Other — not a course</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editSession.acharya_id} onValueChange={(v)=>setEditSession({...editSession, acharya_id:v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Ācharya"/></SelectTrigger>
                        <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {editSession.offering_id === "__other__" && (
                      <Input value={editSession.topic} onChange={(e)=>setEditSession({...editSession, topic:e.target.value})} className="h-10" placeholder="Session topic" />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="datetime-local" value={editSession.starts_at} onChange={(e)=>setEditSession({...editSession, starts_at:e.target.value})} className="h-10" />
                      <Input type="number" value={editSession.duration_min} onChange={(e)=>setEditSession({...editSession, duration_min:e.target.value})} className="h-10" />
                    </div>
                    <Input value={editSession.join_url} onChange={(e)=>setEditSession({...editSession, join_url:e.target.value})} className="h-10" placeholder="Session link (join URL)" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditSession} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`edit-session-save-${s.id}`}>Save</Button>
                      <Button size="sm" variant="outline" onClick={()=>setEditSession(null)} className="rounded-full">Cancel</Button>
                      <Button size="sm" variant="outline" onClick={()=>deleteSession(s.id)} className="rounded-full text-destructive ml-auto" data-testid={`edit-session-delete-${s.id}`}>Delete</Button>
                    </div>
                  </div>
                ) : (
                  <button key={s.id} onClick={()=>startEditSession(s)} className="w-full text-left rounded-xl border border-border p-4 bg-card flex items-center gap-4 hover:border-primary/50 transition-colors" data-testid={`staff-session-${s.id}`}>
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                      {s.mode === "broadcast" ? <Radio className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground tabular">
                        {new Date(s.starts_at).toLocaleString()} · {s.duration_min} min{!s.offering_id && " · standalone"}
                      </div>
                      {s.acharya_name && <div className="text-[11px] text-primary">Ācharya: {s.acharya_name}</div>}
                      {s.join_url && <div className="text-[11px] text-muted-foreground truncate">🔗 {s.join_url}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Edit</span>
                  </button>
                )
              ))}
              {sessions.length === 0 && <div className="text-sm text-muted-foreground">No sessions scheduled yet.</div>}
            </div>
          </div>
        </TabsContent>

        {/* WEBINARS */}
        <TabsContent value="webinars" className="mt-8 grid lg:grid-cols-[1fr_1.4fr] gap-8">
          <form onSubmit={createWebinar} className="rounded-2xl border border-border p-6 bg-card space-y-4" data-testid="webinar-form">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-xl">Publish a webinar</h3>
            </div>
            <div>
              <label className="overline">Title</label>
              <Input value={newWebinar.title} onChange={(e)=>setNewWebinar({...newWebinar, title: e.target.value})} data-testid="webinar-title" className="mt-2 h-11" />
            </div>
            <div>
              <label className="overline">Description</label>
              <Textarea value={newWebinar.description} onChange={(e)=>setNewWebinar({...newWebinar, description: e.target.value})} className="mt-2 min-h-[80px]" />
            </div>
            <div>
              <label className="overline">Cover image URL</label>
              <Input value={newWebinar.cover_image} onChange={(e)=>setNewWebinar({...newWebinar, cover_image: e.target.value})} className="mt-2 h-11" placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="overline">Starts at</label>
                <Input type="datetime-local" value={newWebinar.starts_at} onChange={(e)=>setNewWebinar({...newWebinar, starts_at: e.target.value})} data-testid="webinar-starts" className="mt-2 h-11" />
              </div>
              <div>
                <label className="overline">Duration (min)</label>
                <Input type="number" value={newWebinar.duration_min} onChange={(e)=>setNewWebinar({...newWebinar, duration_min: e.target.value})} className="mt-2 h-11" />
              </div>
            </div>
            <div>
              <label className="overline">Ācharya / mentor</label>
              <Select value={newWebinar.mentor_id} onValueChange={(v)=>setNewWebinar({...newWebinar, mentor_id: v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="webinar-mentor"><SelectValue placeholder="Assign a mentor…"/></SelectTrigger>
                <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="overline">Price (INR)</label>
                <Input type="number" value={newWebinar.price_inr} onChange={(e)=>setNewWebinar({...newWebinar, price_inr: e.target.value})} className="mt-2 h-11" />
              </div>
              <div>
                <label className="overline">Original (INR)</label>
                <Input type="number" value={newWebinar.orig_price_inr} onChange={(e)=>setNewWebinar({...newWebinar, orig_price_inr: e.target.value})} className="mt-2 h-11" />
              </div>
            </div>
            <div>
              <label className="overline">Seats</label>
              <Input type="number" value={newWebinar.seats_remaining} onChange={(e)=>setNewWebinar({...newWebinar, seats_remaining: e.target.value})} className="mt-2 h-11" />
            </div>
            <div>
              <label className="overline">Session link (join URL)</label>
              <Input value={newWebinar.join_url} onChange={(e)=>setNewWebinar({...newWebinar, join_url: e.target.value})} data-testid="webinar-link" className="mt-2 h-11" placeholder="https://… meeting link" />
            </div>
            <Button type="submit" data-testid="webinar-submit" className="w-full rounded-full h-11 bg-gradient-hot text-white border-0">Publish webinar</Button>
          </form>

          <div>
            <h3 className="font-display font-bold text-xl mb-1">All webinars</h3>
            <p className="text-xs text-muted-foreground mb-4">Click a webinar to edit or delete it.</p>
            <div className="space-y-3">
              {webinars.map((w) => (
                editWebinar?.id === w.id ? (
                  <div key={w.id} className="rounded-xl border border-primary/40 p-4 bg-card space-y-3" data-testid={`edit-webinar-${w.id}`}>
                    <Input value={editWebinar.title} onChange={(e)=>setEditWebinar({...editWebinar, title:e.target.value})} className="h-10" placeholder="Title" />
                    <Textarea value={editWebinar.description} onChange={(e)=>setEditWebinar({...editWebinar, description:e.target.value})} className="min-h-[70px]" placeholder="Description" />
                    <Input value={editWebinar.cover_image} onChange={(e)=>setEditWebinar({...editWebinar, cover_image:e.target.value})} className="h-10" placeholder="Cover image URL" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="datetime-local" value={editWebinar.starts_at} onChange={(e)=>setEditWebinar({...editWebinar, starts_at:e.target.value})} className="h-10" />
                      <Input type="number" value={editWebinar.duration_min} onChange={(e)=>setEditWebinar({...editWebinar, duration_min:e.target.value})} className="h-10" placeholder="Duration" />
                    </div>
                    <Select value={editWebinar.mentor_id} onValueChange={(v)=>setEditWebinar({...editWebinar, mentor_id:v})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Mentor"/></SelectTrigger>
                      <SelectContent>{acharyas.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="number" value={editWebinar.price_inr} onChange={(e)=>setEditWebinar({...editWebinar, price_inr:e.target.value})} className="h-10" placeholder="₹" />
                      <Input type="number" value={editWebinar.orig_price_inr} onChange={(e)=>setEditWebinar({...editWebinar, orig_price_inr:e.target.value})} className="h-10" placeholder="Orig ₹" />
                      <Input type="number" value={editWebinar.seats_remaining} onChange={(e)=>setEditWebinar({...editWebinar, seats_remaining:e.target.value})} className="h-10" placeholder="Seats" />
                    </div>
                    <Input value={editWebinar.join_url} onChange={(e)=>setEditWebinar({...editWebinar, join_url:e.target.value})} className="h-10" placeholder="Session link (join URL)" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditWebinar} className="rounded-full bg-gradient-hot text-white border-0">Save</Button>
                      <Button size="sm" variant="outline" onClick={()=>setEditWebinar(null)} className="rounded-full">Cancel</Button>
                      <Button size="sm" variant="outline" onClick={()=>deleteWebinar(w.id)} className="rounded-full text-destructive ml-auto" data-testid={`edit-webinar-delete-${w.id}`}>Delete</Button>
                    </div>
                  </div>
                ) : (
                  <button key={w.id} onClick={()=>startEditWebinar(w)} className="w-full text-left rounded-xl border border-border p-4 bg-card flex items-center gap-4 hover:border-primary/50 transition-colors" data-testid={`staff-webinar-${w.id}`}>
                    {w.cover_image
                      ? <img src={w.cover_image} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                      : <div className="w-20 h-14 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0"><Zap className="w-4 h-4" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold">{w.title}</div>
                      <div className="text-[11px] text-muted-foreground tabular">
                        {new Date(w.starts_at).toLocaleString()} · {w.duration_min} min · with {w.mentor_name || "—"}
                      </div>
                      {w.join_url && <div className="text-[11px] text-muted-foreground truncate">🔗 {w.join_url}</div>}
                    </div>
                    <div className="text-primary font-display font-bold tabular shrink-0">₹{w.price_inr}</div>
                  </button>
                )
              ))}
              {webinars.length === 0 && <div className="text-sm text-muted-foreground">No webinars yet.</div>}
            </div>
          </div>
        </TabsContent>

        {/* VERSES — for the Shloka Player across portals */}
        <TabsContent value="verses" className="mt-8 grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <VerseBuilder onSaved={load} />
          <div>
            <h3 className="font-display font-bold text-xl mb-4">All verses ({verses.length})</h3>
            <div className="space-y-3">
              {verses.map((vv) => (
                <div key={vv.id} className="rounded-xl border border-border p-4 bg-card" data-testid={`staff-verse-${vv.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{vv.scripture}</Badge>
                    <span className="text-xs text-muted-foreground">{vv.reference}</span>
                    {vv.audio_url && <span className="text-[10px] text-primary ml-auto">♪ audio</span>}
                  </div>
                  <div className="font-devanagari text-lg mt-2 leading-relaxed line-clamp-2">{vv.devanagari}</div>
                  {vv.audio_url && <audio src={vv.audio_url} controls className="mt-2 w-full h-8" />}
                </div>
              ))}
              {verses.length === 0 && <div className="text-sm text-muted-foreground">No verses yet.</div>}
            </div>
          </div>
        </TabsContent>

        {/* MANTRAS — by deity, linked to the festival calendar */}
        <TabsContent value="mantras" className="mt-8 grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <MantraBuilder onSaved={load} />
          <div>
            <h3 className="font-display font-bold text-xl mb-4">All mantras ({mantras.length})</h3>
            <div className="space-y-3">
              {mantras.map((mm) => (
                <div key={mm.id} className="rounded-xl border border-border p-4 bg-card" data-testid={`staff-mantra-${mm.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-accent border-accent/40">{mm.deity}</Badge>
                    <span className="font-display font-semibold">{mm.title}</span>
                    <button onClick={()=>deleteMantra(mm.id)} className="text-muted-foreground hover:text-destructive text-xs ml-auto" data-testid={`mantra-delete-${mm.id}`}>Delete</button>
                  </div>
                  {mm.devanagari && <div className="font-devanagari text-base mt-2 leading-relaxed line-clamp-2">{mm.devanagari}</div>}
                  {mm.audio_url && <audio src={mm.audio_url} controls className="mt-2 w-full h-8" />}
                </div>
              ))}
              {mantras.length === 0 && <div className="text-sm text-muted-foreground">No mantras yet.</div>}
            </div>
          </div>
        </TabsContent>

        {/* ĀCHARYA CONTENT REVIEW */}
        <TabsContent value="content-review" className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">Draft content submitted by Ācharyas. Format, cite, and approve — only then publish under their name.</p>
          {content.length === 0 && <div className="text-muted-foreground text-sm">No content submissions.</div>}
          {content.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border p-6 bg-card" data-testid={`review-content-${c.id}`}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{c.kind.replace("_"," ")}</Badge>
                <Badge variant={c.status === "approved" ? "default" : c.status === "changes_requested" ? "destructive" : "outline"} className="text-[10px] uppercase tracking-widest">
                  {c.status.replace("_"," ")}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40">
                  {offerings.find(o=>o.id===c.offering_id)?.title || "General / unattached"}
                </Badge>
                <span className="text-xs text-muted-foreground">by {c.acharya_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <div className="font-display font-bold text-xl mt-2">{c.title}</div>
              <div className="mt-3 font-editorial text-base leading-relaxed max-h-64 overflow-y-auto whitespace-pre-line border-l-2 border-accent/40 pl-4">
                {c.body}
              </div>
              {c.status === "pending_review" && (
                <>
                  <Textarea value={reviewNotes[c.id] || ""} onChange={(e)=>setReviewNotes({...reviewNotes, [c.id]: e.target.value})}
                    placeholder="Notes back to the Ācharya…" className="mt-4" data-testid={`review-notes-${c.id}`} />
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={()=>reviewContent(c, true)} data-testid={`review-approve-${c.id}`}
                      className="rounded-full bg-gradient-hot text-white border-0">
                      <CheckCircle2 className="w-4 h-4 mr-1"/>Approve for publication
                    </Button>
                    <Button size="sm" onClick={()=>reviewContent(c, false)} data-testid={`review-reject-${c.id}`}
                      variant="outline" className="rounded-full">
                      <XCircle className="w-4 h-4 mr-1"/>Request changes
                    </Button>
                  </div>
                </>
              )}
              {c.status === "changes_requested" && c.review_notes && (
                <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs">
                  <strong>Sent back:</strong> {c.review_notes}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* DOUBTS */}
        <TabsContent value="doubts" className="mt-8 space-y-4">
          {doubts.length === 0 && <div className="text-muted-foreground text-sm">No open doubts.</div>}
          {doubts.map((d)=>(
            <div key={d.id} className="rounded-2xl border border-border p-5 bg-card" data-testid={`staff-doubt-${d.id}`}>
              <div className="text-xs text-muted-foreground">From {d.asked_by_name}</div>
              <div className="font-display text-lg mt-1">{d.question}</div>
              <Textarea value={answerText[d.id]||""} onChange={(e)=>setAnswerText({...answerText,[d.id]:e.target.value})}
                placeholder="Your answer…" className="mt-3" data-testid={`staff-answer-${d.id}`} />
              <Button onClick={()=>answer(d)} className="mt-3 rounded-full bg-gradient-hot text-white border-0" data-testid={`staff-answer-submit-${d.id}`}>
                <Send className="w-4 h-4 mr-2"/>Post answer
              </Button>
            </div>
          ))}
        </TabsContent>

        {/* CERTIFICATES — issue new + grouped by user */}
        <TabsContent value="certs" className="mt-8 space-y-8">
          <form onSubmit={issueCert} className="rounded-2xl border border-border p-6 bg-card grid md:grid-cols-3 gap-4 items-end max-w-4xl" data-testid="issue-cert-form">
            <div className="md:col-span-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-xl">Issue a certificate</h3>
            </div>
            <div>
              <label className="overline">Learner</label>
              <Select value={issueForm.user_id} onValueChange={(v)=>setIssueForm({...issueForm, user_id: v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="issue-learner"><SelectValue placeholder="Choose a learner…"/></SelectTrigger>
                <SelectContent>{learners.map(l=><SelectItem key={l.id} value={l.id}>{l.name} · {l.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="overline">Course</label>
              <Select value={issueForm.offering_id} onValueChange={(v)=>setIssueForm({...issueForm, offering_id: v})}>
                <SelectTrigger className="mt-2 h-11" data-testid="issue-offering"><SelectValue placeholder="Choose a course…"/></SelectTrigger>
                <SelectContent>{offerings.filter(o=>o.approved_by_acharya).map(o=><SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" data-testid="issue-submit" className="rounded-full h-11 bg-gradient-hot text-white border-0">Issue</Button>
            <p className="md:col-span-3 text-xs text-muted-foreground">On issue, the certificate is routed to the course's Ācharya for signature. Once the Ācharya signs, it's published to the learner automatically. (Learners can also request certificates on 100% completion — see “Certificate requests” below.)</p>
          </form>

          {/* Learner certificate requests — approve to route to the Ācharya */}
          <div data-testid="certs-requests">
            <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Stamp className="w-5 h-5 text-primary" /> Certificate requests ({pendingCerts.length})
            </h3>
            <div className="space-y-3">
              {pendingCerts.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 flex-wrap" data-testid={`cert-request-${c.code}`}>
                  <Award className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-display font-semibold">{c.user_name} · <span className="font-serif italic">{c.offering_title}</span></div>
                    <div className="text-[11px] text-muted-foreground font-mono">{c.code} · requested {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : ""} · Ācharya: {c.acharya_name || "—"}</div>
                  </div>
                  <Button size="sm" onClick={()=>approveCertRequest(c.code)} data-testid={`cert-approve-request-${c.code}`}
                    className="rounded-full bg-gradient-hot text-white border-0">
                    <CheckCircle2 className="w-4 h-4 mr-1"/>Approve → route to Ācharya
                  </Button>
                </div>
              ))}
              {pendingCerts.length === 0 && <div className="text-muted-foreground text-sm">No pending certificate requests.</div>}
            </div>
          </div>

          {/* Grouped by learner */}
          <div>
            <h3 className="font-display font-bold text-xl mb-4">Issued — by learner</h3>
            <div className="space-y-3">
              {certGroups.map((g) => (
                <details key={g.user_id} className="rounded-2xl border border-border bg-card" data-testid={`cert-group-${g.user_id}`}>
                  <summary className="p-5 cursor-pointer flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">{g.user_name?.[0] || "?"}</div>
                    <div className="flex-1">
                      <div className="font-display font-semibold text-lg">{g.user_name}</div>
                      <div className="text-xs text-muted-foreground">{g.certificates.length} certificate(s)</div>
                    </div>
                  </summary>
                  <div className="border-t border-border p-5 space-y-2">
                    {g.certificates.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 text-sm" data-testid={`cert-row-${c.code}`}>
                        <Award className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1">
                          <div className="font-serif">{c.offering_title}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.code} · issued {new Date(c.issued_at).toLocaleDateString()}</div>
                        </div>
                        <Badge variant={(c.signature_status||"published")==="published" ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                          {STATUS_LABEL[c.signature_status] || "Published"}
                        </Badge>
                        {c.revoked && <Badge variant="destructive" className="text-[10px]">Revoked</Badge>}
                        <button onClick={()=>setViewingCert(c)} className="text-primary link-underline text-xs" data-testid={`cert-download-${c.code}`}>Download</button>
                        <a href={`/verify/${c.code}`} target="_blank" rel="noreferrer" className="text-primary link-underline text-xs">Verify →</a>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
              {certGroups.length === 0 && <div className="text-muted-foreground text-sm">No certificates have been issued yet.</div>}
            </div>
          </div>
        </TabsContent>

        {/* CONSULTATIONS */}
        <TabsContent value="consultations" className="mt-8 space-y-3">
          {consultations.map((c)=>(
            <div key={c.id} className="rounded-2xl border border-border p-5 bg-card" data-testid={`consult-row-${c.id}`}>
              <div className="flex items-baseline gap-3">
                <div className="font-display font-semibold text-lg">{c.name}</div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{c.status}</Badge>
                <div className="text-xs text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{c.email} · {c.phone}</div>
              <p className="mt-3 font-editorial italic">"{c.interest}"</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={()=>closeConsult(c,"contacted")} data-testid={`consult-contacted-${c.id}`} variant="outline" className="rounded-full">Mark contacted</Button>
                <Button size="sm" onClick={()=>closeConsult(c,"closed")} data-testid={`consult-closed-${c.id}`} className="rounded-full bg-gradient-hot text-white border-0">Close</Button>
              </div>
            </div>
          ))}
          {consultations.length === 0 && <div className="text-muted-foreground text-sm">No consultations assigned.</div>}
        </TabsContent>
      </Tabs>
      <CertificateModal cert={viewingCert} onClose={()=>setViewingCert(null)} />
    </div>
  );
}
