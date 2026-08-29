import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { uploadCourseMedia } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Send, UploadCloud } from "lucide-react";

export const newQuestion = () => ({
  id: (window.crypto?.randomUUID?.() || String(Date.now() + Math.random())),
  type: "mcq", prompt: "", points: 1, options: ["", ""], correct: [], multiple: false, image_url: "",
});

const emptyQuiz = () => ({
  title: "", context: "event", unlock_rule: "always", questions: [],
  starts_at: "", ends_at: "", festival_id: "",
});

// datetime-local <-> ISO helpers (input needs "YYYY-MM-DDTHH:mm", API stores ISO)
const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const toIso = (local) => (local ? new Date(local).toISOString() : "");

export function QuestionEditor({ questions, onChange }) {
  const [uploadPct, setUploadPct] = useState({}); // question id -> 0..100
  const patch = (idx, p) => onChange(questions.map((q, i) => (i === idx ? { ...q, ...p } : q)));
  const add = () => onChange([...questions, newQuestion()]);
  const remove = (idx) => onChange(questions.filter((_, i) => i !== idx));

  const onImageFile = async (idx, file) => {
    if (!file) return;
    const qid = questions[idx].id;
    setUploadPct((p) => ({ ...p, [qid]: 0 }));
    try {
      const { public_url } = await uploadCourseMedia(file, (pct) => setUploadPct((p) => ({ ...p, [qid]: pct })));
      patch(idx, { image_url: public_url });
      toast.success("Image uploaded.");
    } catch (e) { toast.error(formatApiError(e) || e.message || "Upload failed"); }
    setUploadPct((p) => { const { [qid]: _drop, ...rest } = p; return rest; });
  };

  const patchOption = (idx, oi, value) => {
    const options = questions[idx].options.map((o, i) => (i === oi ? value : o));
    patch(idx, { options });
  };
  const addOption = (idx) => patch(idx, { options: [...questions[idx].options, ""] });
  const removeOption = (idx, oi) => {
    const options = questions[idx].options.filter((_, i) => i !== oi);
    const correct = questions[idx].correct.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c));
    patch(idx, { options, correct });
  };
  const toggleCorrect = (idx, oi) => {
    const q = questions[idx];
    const has = q.correct.includes(oi);
    const correct = q.multiple
      ? (has ? q.correct.filter((c) => c !== oi) : [...q.correct, oi])
      : (has ? [] : [oi]);
    patch(idx, { correct });
  };

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="rounded-xl border border-border p-4 bg-background/60 space-y-3" data-testid={`question-${q.id}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
            <Select value={q.type} onValueChange={(v) => patch(idx, v === "mcq" ? { type: v, options: ["", ""], correct: [] } : { type: v, options: undefined, correct: undefined })}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple choice</SelectItem>
                <SelectItem value="paragraph">Paragraph</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={1} value={q.points} onChange={(e) => patch(idx, { points: parseInt(e.target.value || 1) })} className="h-9 w-20" placeholder="Points" />
            <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive p-2 ml-auto" aria-label="Remove question">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea value={q.prompt} onChange={(e) => patch(idx, { prompt: e.target.value })} placeholder="Question prompt…" className="min-h-[70px]" />
          <div>
            <label className="eyebrow">Image (optional)</label>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {q.image_url && (
                <img src={q.image_url} alt="Question" className="w-28 h-20 rounded-lg object-cover border border-border" />
              )}
              <label className="inline-flex items-center gap-2 text-xs rounded-full border border-border px-3 h-9 cursor-pointer hover:bg-muted transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                {q.image_url ? "Replace image" : "Upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageFile(idx, e.target.files?.[0])} data-testid={`question-image-upload-${q.id}`} />
              </label>
              {uploadPct[q.id] != null && <span className="text-xs text-primary tabular">Uploading… {uploadPct[q.id]}%</span>}
            </div>
            <Input value={q.image_url || ""} onChange={(e) => patch(idx, { image_url: e.target.value })} className="mt-2 h-9" placeholder="…or paste an image URL" data-testid={`question-image-url-${q.id}`} />
          </div>
          {q.type === "mcq" && (
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={q.multiple} onCheckedChange={(v) => patch(idx, { multiple: !!v, correct: [] })} />
                Allow multiple correct answers
              </label>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Checkbox checked={q.correct.includes(oi)} onCheckedChange={() => toggleCorrect(idx, oi)} />
                  <Input value={opt} onChange={(e) => patchOption(idx, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="h-9" />
                  <button type="button" onClick={() => removeOption(idx, oi)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove option">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addOption(idx)} className="rounded-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add option
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} className="rounded-full">
        <Plus className="w-4 h-4 mr-1" /> Add question
      </Button>
    </div>
  );
}

export default function QuizManager({ canAuthorQuiz = true }) {
  const [quizzes, setQuizzes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [linkChoice, setLinkChoice] = useState({}); // quizId -> {mode, session_id, starts_at}
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [q, s, f] = await Promise.all([
      api.get("/quizzes?context=event").catch(() => ({ data: [] })),
      api.get("/live-sessions").catch(() => ({ data: [] })),
      api.get("/festivals").catch(() => ({ data: [] })),
    ]);
    setQuizzes(q.data);
    setSessions(s.data);
    setFestivals(f.data);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing(emptyQuiz());
  const startEdit = (q) => setEditing({ ...q, starts_at: toLocalInput(q.starts_at), ends_at: toLocalInput(q.ends_at) });

  const save = async () => {
    if (!editing.title) return toast.error("Title is required.");
    if (editing.starts_at && editing.ends_at && editing.ends_at <= editing.starts_at) {
      return toast.error("End date/time must be after the start date/time.");
    }
    setSaving(true);
    try {
      const payload = { ...editing, starts_at: toIso(editing.starts_at), ends_at: toIso(editing.ends_at) };
      if (editing.id) {
        await api.patch(`/quizzes/${editing.id}`, payload);
        toast.success("Quiz updated.");
      } else {
        await api.post("/quizzes", { ...payload, context: "event" });
        toast.success("Quiz created.");
      }
      setEditing(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/quizzes/${id}`);
      toast.success("Quiz deleted.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const publish = async (q) => {
    try {
      await api.patch(`/quizzes/${q.id}`, { status: "published" });
      toast.success("Quiz published.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const linkEvent = async (q) => {
    const choice = linkChoice[q.id] || {};
    try {
      if (choice.mode === "auto") {
        if (!choice.starts_at) return toast.error("Pick a start time for the auto-created event.");
        await api.post(`/quizzes/${q.id}/link-event`, { auto_create: true, starts_at: new Date(choice.starts_at).toISOString() });
      } else {
        if (!choice.session_id) return toast.error("Pick an event to link.");
        await api.post(`/quizzes/${q.id}/link-event`, { live_session_id: choice.session_id });
      }
      toast.success("Quiz linked to event.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="quiz-manager">
      {!canAuthorQuiz && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="quiz-author-disabled">
          Quiz authoring has not been granted to you by admin — you can't create new quizzes.
        </div>
      )}
      {!editing && canAuthorQuiz && (
        <Button onClick={startNew} className="rounded-full bg-gradient-hot text-white border-0" data-testid="quiz-new">
          <Plus className="w-4 h-4 mr-1" /> New quiz
        </Button>
      )}

      {editing && (
        <div className="rounded-2xl border border-border p-6 bg-card space-y-4 max-w-3xl" data-testid="quiz-editor">
          <div>
            <label className="eyebrow">Title</label>
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-2 h-11" data-testid="quiz-title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Start date &amp; time</label>
              <Input type="datetime-local" value={editing.starts_at || ""}
                onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
                className="mt-2 h-11" data-testid="quiz-starts-at" />
            </div>
            <div>
              <label className="eyebrow">End date &amp; time</label>
              <Input type="datetime-local" value={editing.ends_at || ""}
                onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })}
                className="mt-2 h-11" data-testid="quiz-ends-at" />
            </div>
          </div>
          <div>
            <label className="eyebrow">Unlock rule</label>
            <Select value={editing.unlock_rule} onValueChange={(v) => setEditing({ ...editing, unlock_rule: v })}>
              <SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always available</SelectItem>
                <SelectItem value="on_course_complete">On course complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="eyebrow">Event / Festival (optional)</label>
            <Select value={editing.festival_id || "__none__"} onValueChange={(v) => setEditing({ ...editing, festival_id: v === "__none__" ? "" : v })}>
              <SelectTrigger className="mt-2 h-11" data-testid="quiz-festival"><SelectValue placeholder="Attach to a festival…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not tied to a festival</SelectItem>
                {festivals.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} — {new Date(f.date).toLocaleDateString()}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Once published, this quiz shows a "Play &amp; Win" button on the festival's card in the Calendar section.</p>
          </div>
          <QuestionEditor questions={editing.questions} onChange={(questions) => setEditing({ ...editing, questions })} />
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="quiz-save">
              {saving ? "Saving…" : "Save quiz"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {quizzes.map((q) => (
          <div key={q.id} className="rounded-xl border border-border p-4 bg-card space-y-3" data-testid={`quiz-${q.id}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-display font-semibold">{q.title}</div>
                <div className="text-xs text-muted-foreground">
                  {q.questions?.length || 0} question(s)
                  {q.starts_at ? ` · Starts ${new Date(q.starts_at).toLocaleString()}` : ""}
                  {q.ends_at ? ` · Ends ${new Date(q.ends_at).toLocaleString()}` : ""}
                </div>
              </div>
              <Badge variant={q.status === "published" ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">{q.status}</Badge>
              {q.ends_at && q.ends_at < new Date().toISOString() && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-destructive">Expired</Badge>
              )}
              {canAuthorQuiz && (
                <>
                  <Button size="sm" variant="outline" onClick={() => startEdit(q)} className="rounded-full">Edit</Button>
                  {q.status !== "published" && (
                    <Button size="sm" onClick={() => publish(q)} className="rounded-full bg-gradient-hot text-white border-0">Publish</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => remove(q.id)} className="rounded-full text-destructive">Delete</Button>
                </>
              )}
            </div>
            {canAuthorQuiz && (
            <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3">
              <Select value={linkChoice[q.id]?.mode || "existing"} onValueChange={(v) => setLinkChoice({ ...linkChoice, [q.id]: { ...linkChoice[q.id], mode: v } })}>
                <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Link an existing event</SelectItem>
                  <SelectItem value="auto">Auto-create an event</SelectItem>
                </SelectContent>
              </Select>
              {(linkChoice[q.id]?.mode || "existing") === "existing" ? (
                <Select value={linkChoice[q.id]?.session_id || ""} onValueChange={(v) => setLinkChoice({ ...linkChoice, [q.id]: { ...linkChoice[q.id], session_id: v } })}>
                  <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Pick an event…" /></SelectTrigger>
                  <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type="datetime-local" value={linkChoice[q.id]?.starts_at || ""} onChange={(e) => setLinkChoice({ ...linkChoice, [q.id]: { ...linkChoice[q.id], starts_at: e.target.value } })} className="h-9 w-56" />
              )}
              <Button size="sm" variant="outline" onClick={() => linkEvent(q)} className="rounded-full">
                <Send className="w-3.5 h-3.5 mr-1" /> Link
              </Button>
            </div>
            )}
          </div>
        ))}
        {quizzes.length === 0 && <div className="text-sm text-muted-foreground">No quizzes yet.</div>}
      </div>
    </div>
  );
}
