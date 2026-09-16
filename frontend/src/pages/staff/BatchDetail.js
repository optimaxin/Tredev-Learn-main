import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, UploadCloud, Search, Pencil, Users, FileSpreadsheet, CalendarClock, Trash2, Plus } from "lucide-react";

const SCHEDULE_STATUS_LABEL = {
  pending_approval: "Awaiting Ācharya approval",
  approved: "Approved by Ācharya",
  changes_requested: "Changes requested",
};

/** Full page for one batch: roster, CSV/Excel timetable upload (instead of the
 * old row-by-row form), and the resulting scheduled sessions once approved. */
export default function BatchDetail() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState([]);
  const [acharyas, setAcharyas] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editingSession, setEditingSession] = useState(null); // {id, starts_at, ...}
  const [savingSession, setSavingSession] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState(false);
  const [timetableDraft, setTimetableDraft] = useState([]);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reconstructed from the batch's own offering_id — lands the user back on
  // the exact offering + Batches tab they came from, not the bare staff grid.
  const backLink = batch?.offering_id ? `/staff?tab=offerings&offering=${batch.offering_id}&subtab=batches` : "/staff";

  const load = async () => {
    try {
      const [b, s] = await Promise.all([
        api.get(`/batches/${batchId}`),
        api.get(`/batches/${batchId}/students`).catch(() => ({ data: [] })),
      ]);
      setBatch(b.data);
      api.get("/acharyas").then((r) => setAcharyas(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      setStudents(Array.isArray(s.data) ? s.data : []);
      if (b.data?.schedule_status === "approved") {
        const { data } = await api.get("/live-sessions", { params: { batch_id: batchId } }).catch(() => ({ data: [] }));
        setSessions(Array.isArray(data) ? data : []);
      } else {
        setSessions([]);
      }
    } catch (e) { toast.error(formatApiError(e)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUpload = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!(name.endsWith(".csv") || name.endsWith(".xlsx"))) {
      return toast.error("Upload a .csv or .xlsx file.");
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Explicitly unset Content-Type (the api instance defaults it to
      // application/json) so the browser sets multipart/form-data with the
      // required boundary itself — a hardcoded string here would omit it.
      await api.post(`/batches/${batchId}/timetable/upload`, form, {
        headers: { "Content-Type": undefined },
      });
      toast.success("Timetable sent to the Ācharya for approval.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setUploading(false);
  };

  const startEditTimetable = () => {
    setTimetableDraft((batch.timetable || []).map((slot) => ({
      title: slot.title || "", starts_at: (slot.starts_at || "").slice(0, 16),
      duration_min: slot.duration_min || 60, mode: slot.mode || "interactive", topic: slot.topic || "",
    })));
    setEditingTimetable(true);
  };

  const addTimetableRow = () => setTimetableDraft((d) => [...d, { title: "", starts_at: "", duration_min: 60, mode: "interactive", topic: "" }]);
  const removeTimetableRow = (i) => setTimetableDraft((d) => d.filter((_, idx) => idx !== i));
  const updateTimetableRow = (i, patch) => setTimetableDraft((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const saveTimetable = async () => {
    if (timetableDraft.some((r) => !r.title.trim() || !r.starts_at)) {
      return toast.error("Every class needs a title and a start time.");
    }
    setSavingTimetable(true);
    try {
      const items = timetableDraft.map((r) => ({
        title: r.title, starts_at: `${r.starts_at}:00`,
        duration_min: parseInt(r.duration_min) || 60, mode: r.mode, topic: r.topic,
      }));
      await api.patch(`/batches/${batchId}/timetable`, { items });
      toast.success("Timetable updated — sent back to the Ācharya for approval.");
      setEditingTimetable(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingTimetable(false);
  };

  const saveSession = async () => {
    if (!editingSession) return;
    setSavingSession(true);
    try {
      await api.patch(`/live-sessions/${editingSession.id}`, {
        starts_at: new Date(editingSession.starts_at).toISOString(),
        duration_min: parseInt(editingSession.duration_min) || 60,
        title: editingSession.title,
        acharya_id: editingSession.acharya_id,
        join_url: editingSession.join_url,
        recording_url: editingSession.recording_url,
      });
      toast.success("Session updated.");
      setEditingSession(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingSession(false);
  };

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  if (loading) return <div className="site-container py-16 text-muted-foreground">Loading…</div>;
  if (!batch) return <div className="site-container py-16 text-muted-foreground">Batch not found.</div>;

  return (
    <div className="site-container py-12" data-testid={`batch-detail-${batchId}`}>
      <Link to={backLink} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Staff Panel
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-4xl font-serif tracking-tight">{batch.name}</h1>
        {batch.schedule_status && (
          <Badge variant={batch.schedule_status === "approved" ? "default" : batch.schedule_status === "changes_requested" ? "destructive" : "outline"}
            className="text-[10px] uppercase tracking-widest">
            {SCHEDULE_STATUS_LABEL[batch.schedule_status] || batch.schedule_status}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {batch.offering_title} · Starts {batch.start_date} · {batch.enrolled_count}/{batch.max_students} enrolled
      </p>

      {batch.schedule_status === "changes_requested" && batch.schedule_notes && (
        <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm" data-testid="batch-detail-notes">
          <span className="uppercase tracking-widest text-[10px] text-destructive font-semibold">Ācharya requested changes: </span>
          {batch.schedule_notes}
        </div>
      )}

      {/* Sidebar nav + section content — so switching between class schedule,
          sessions, and roster doesn't mean scrolling through all three. */}
      <div className="mt-8">
        <Tabs defaultValue={batch.schedule_status === "approved" ? "sessions" : "schedule"} className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
          <TabsList className="flex flex-nowrap overflow-x-auto lg:overflow-visible lg:flex-col [&>*]:shrink-0 h-auto w-full items-stretch justify-start gap-1.5 bg-card border border-border rounded-2xl p-3">
            <TabsTrigger value="schedule" data-testid="batch-detail-tab-schedule" className="justify-start text-sm font-medium py-2.5 px-3 rounded-xl">
              <FileSpreadsheet className="w-4 h-4 mr-2 shrink-0" /> Class schedule
            </TabsTrigger>
            <TabsTrigger value="sessions" data-testid="batch-detail-tab-sessions" className="justify-start text-sm font-medium py-2.5 px-3 rounded-xl">
              <CalendarClock className="w-4 h-4 mr-2 shrink-0" /> Scheduled sessions ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="roster" data-testid="batch-detail-tab-roster" className="justify-start text-sm font-medium py-2.5 px-3 rounded-xl">
              <Users className="w-4 h-4 mr-2 shrink-0" /> Enrolled students ({students.length})
            </TabsTrigger>
          </TabsList>

          {/* Class schedule — timetable upload */}
          <TabsContent value="schedule" className="mt-0 rounded-2xl border border-border p-6 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-xl">Class schedule</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a CSV or Excel file with columns <code className="text-xs bg-muted px-1 py-0.5 rounded">title, date, time, duration_min, mode, topic</code>.
              It's sent to the assigned Ācharya to verify — once approved, classes are scheduled automatically and the file is discarded (the parsed data lives here already).
            </p>
            <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
              <UploadCloud className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload timetable file"}
              <input type="file" accept=".csv,.xlsx" className="hidden" disabled={uploading}
                onChange={(e) => onUpload(e.target.files?.[0])} data-testid="batch-detail-upload" />
            </label>

            {batch.timetable?.length > 0 && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="eyebrow">Proposed classes ({editingTimetable ? timetableDraft.length : batch.timetable.length})</div>
                  {!editingTimetable && (
                    <Button size="sm" variant="outline" onClick={startEditTimetable} className="rounded-full" data-testid="timetable-edit">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                  )}
                </div>

                {editingTimetable ? (
                  <div className="space-y-2">
                    {timetableDraft.map((row, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 grid sm:grid-cols-2 gap-3" data-testid={`timetable-row-${i}`}>
                        <div className="sm:col-span-2">
                          <label className="eyebrow">Title</label>
                          <Input value={row.title} onChange={(e) => updateTimetableRow(i, { title: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Starts at</label>
                          <Input type="datetime-local" value={row.starts_at} onChange={(e) => updateTimetableRow(i, { starts_at: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Duration (min)</label>
                          <Input type="number" value={row.duration_min} onChange={(e) => updateTimetableRow(i, { duration_min: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Mode</label>
                          <Select value={row.mode} onValueChange={(v) => updateTimetableRow(i, { mode: v })}>
                            <SelectTrigger className="mt-2 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="interactive">Interactive</SelectItem>
                              <SelectItem value="broadcast">Broadcast</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="eyebrow">Topic (optional)</label>
                          <Input value={row.topic} onChange={(e) => updateTimetableRow(i, { topic: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <button type="button" onClick={() => removeTimetableRow(i)} className="text-muted-foreground hover:text-destructive p-1.5" aria-label="Remove class" data-testid={`timetable-row-remove-${i}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={addTimetableRow} className="rounded-full" data-testid="timetable-add-row">
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add class
                      </Button>
                      <Button size="sm" disabled={savingTimetable} onClick={saveTimetable} className="rounded-full" data-testid="timetable-save">
                        {savingTimetable ? "Saving…" : "Save changes"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingTimetable(false)} className="rounded-full">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  batch.timetable.map((slot, i) => (
                    <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display font-semibold">{slot.title}</span>
                      <span className="text-xs text-muted-foreground tabular">{new Date(slot.starts_at).toLocaleString()} · {slot.duration_min} min</span>
                      {slot.topic && <span className="text-xs text-muted-foreground italic">{slot.topic}</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* Scheduled sessions (post-approval) — editable, incl. recording link */}
          <TabsContent value="sessions" className="mt-0 rounded-2xl border border-border p-6 bg-card">
            <h2 className="font-display font-bold text-xl mb-4">Scheduled sessions ({sessions.length})</h2>
            {batch.schedule_status !== "approved" ? (
              <div className="text-sm text-muted-foreground">Sessions appear here once the Ācharya approves this batch's class schedule.</div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border p-3" data-testid={`batch-session-${s.id}`}>
                    {editingSession?.id === s.id ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="eyebrow">Session title</label>
                          <Input value={editingSession.title} onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Ācharya</label>
                          <Select value={editingSession.acharya_id} onValueChange={(v) => setEditingSession({ ...editingSession, acharya_id: v })}>
                            <SelectTrigger className="mt-2 h-9"><SelectValue placeholder="Assign an Ācharya…" /></SelectTrigger>
                            <SelectContent>{acharyas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="eyebrow">Starts at</label>
                          <Input type="datetime-local" value={editingSession.starts_at} onChange={(e) => setEditingSession({ ...editingSession, starts_at: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Duration (min)</label>
                          <Input type="number" value={editingSession.duration_min} onChange={(e) => setEditingSession({ ...editingSession, duration_min: e.target.value })} className="mt-2 h-9" />
                        </div>
                        <div>
                          <label className="eyebrow">Join link</label>
                          <Input value={editingSession.join_url} onChange={(e) => setEditingSession({ ...editingSession, join_url: e.target.value })}
                            placeholder="https://meeting.zoho.in/…" className="mt-2 h-9" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="eyebrow">Recording link (once the class is over)</label>
                          <Input value={editingSession.recording_url} onChange={(e) => setEditingSession({ ...editingSession, recording_url: e.target.value })}
                            placeholder="https://…" className="mt-2 h-9" data-testid={`batch-session-recording-${s.id}`} />
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                          <Button size="sm" disabled={savingSession} onClick={saveSession} className="rounded-full">Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSession(null)} className="rounded-full">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-display font-semibold flex-1 min-w-[160px]">{s.title}</span>
                        <span className="text-xs text-muted-foreground tabular">{new Date(s.starts_at).toLocaleString()} · {s.duration_min} min</span>
                        {s.recording_url ? (
                          <a href={s.recording_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Recording</a>
                        ) : (
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">No recording yet</span>
                        )}
                        <button type="button" onClick={() => setEditingSession({
                          id: s.id, title: s.title, duration_min: s.duration_min, starts_at: s.starts_at?.slice(0, 16),
                          acharya_id: s.acharya_id || "", join_url: s.join_url || "", recording_url: s.recording_url || "",
                        })}
                          className="text-muted-foreground hover:text-primary p-1.5" aria-label="Edit session" data-testid={`batch-session-edit-${s.id}`}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && <div className="text-sm text-muted-foreground">No sessions yet.</div>}
              </div>
            )}
          </TabsContent>

          {/* Roster */}
          <TabsContent value="roster" className="mt-0 rounded-2xl border border-border p-6 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-xl">Enrolled students ({students.length})</h2>
            </div>
            <div className="relative mb-4 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9 h-10" data-testid="batch-detail-search" />
            </div>
            <div className="space-y-2">
              {filteredStudents.map((s) => (
                <div key={s.user_id} className="rounded-lg border border-border p-3 flex items-center gap-4 flex-wrap" data-testid={`batch-student-${s.user_id}`}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </div>
                  <span className="text-xs text-muted-foreground tabular">Enrolled {s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : "—"}</span>
                  <span className="text-xs text-muted-foreground tabular">{s.progress || 0}% progress</span>
                </div>
              ))}
              {filteredStudents.length === 0 && <div className="text-sm text-muted-foreground">No students found.</div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
