import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadCourseMedia } from "@/lib/upload";
import { Trash2, Plus, UploadCloud, Save, CheckCircle2 } from "lucide-react";

export const newLesson = () => ({
  id: (window.crypto?.randomUUID?.() || String(Date.now() + Math.random())),
  title: "", body: "", video_url: "", video_path: "",
});

/**
 * Controlled lesson list editor (recorded video + written body).
 * Parent owns the `lessons` array and receives updates via `onChange`.
 */
export function LessonEditor({ lessons, onChange, idPrefix = "lesson" }) {
  const [uploading, setUploading] = useState({}); // id -> percent

  const patch = (idx, p) => onChange(lessons.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const add = () => onChange([...lessons, newLesson()]);
  const remove = (idx) => onChange(lessons.filter((_, i) => i !== idx));

  const onVideo = async (idx, file) => {
    if (!file) return;
    const id = lessons[idx].id;
    setUploading((u) => ({ ...u, [id]: 0 }));
    try {
      const { public_url, path } = await uploadCourseMedia(file, (pct) =>
        setUploading((u) => ({ ...u, [id]: pct }))
      );
      patch(idx, { video_url: public_url, video_path: path });
      toast.success("Video uploaded.");
    } catch (e) {
      toast.error(formatApiError(e) || e.message || "Upload failed");
    } finally {
      setUploading((u) => { const n = { ...u }; delete n[id]; return n; });
    }
  };

  return (
    <div className="space-y-4">
      {lessons.length === 0 && (
        <p className="text-sm text-muted-foreground">No lessons yet — add recorded video + written notes for the Ācharya to review.</p>
      )}
      {lessons.map((l, idx) => (
        <div key={l.id} className="rounded-xl border border-border p-4 bg-background/60 space-y-3" data-testid={`${idPrefix}-${l.id}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
            <Input value={l.title} onChange={(e) => patch(idx, { title: e.target.value })}
              placeholder="Lesson title" className="h-10" data-testid={`${idPrefix}-title-${l.id}`} />
            <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Remove lesson">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea value={l.body} onChange={(e) => patch(idx, { body: e.target.value })}
            placeholder="Written lesson content…" className="min-h-[100px] font-editorial" data-testid={`${idPrefix}-body-${l.id}`} />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
              <UploadCloud className="w-4 h-4" />
              {l.video_url ? "Replace video" : "Upload video"}
              <input type="file" accept="video/*" className="hidden"
                onChange={(e) => onVideo(idx, e.target.files?.[0])} data-testid={`${idPrefix}-video-${l.id}`} />
            </label>
            {uploading[l.id] != null && (
              <span className="text-xs text-primary tabular">Uploading… {uploading[l.id]}%</span>
            )}
            {l.video_url && uploading[l.id] == null && (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <CheckCircle2 className="w-3.5 h-3.5" /> Video attached
              </span>
            )}
          </div>
          {l.video_url && (
            <video src={l.video_url} controls className="w-full max-w-md rounded-lg border border-border" />
          )}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} className="rounded-full" data-testid={`${idPrefix}-add`}>
        <Plus className="w-4 h-4 mr-1" /> Add lesson
      </Button>
    </div>
  );
}

/**
 * Self-saving wrapper used per existing offering (persists via PATCH /offerings/{id}).
 */
export default function LessonManager({ offering, onSaved }) {
  const [lessons, setLessons] = useState(
    Array.isArray(offering.modules) && offering.modules.length
      ? offering.modules.map((m) => ({ ...newLesson(), ...m }))
      : []
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const modules = lessons.map((l, i) => ({
        id: l.id, title: l.title, body: l.body,
        video_url: l.video_url || "", video_path: l.video_path || "", order: i,
      }));
      await api.patch(`/offerings/${offering.id}`, { modules });
      toast.success("Lessons saved.");
      onSaved && onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4" data-testid={`lesson-manager-${offering.id}`}>
      <LessonEditor lessons={lessons} onChange={setLessons} idPrefix={`lesson-${offering.id}`} />
      <Button size="sm" onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`lesson-save-${offering.id}`}>
        <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save lessons"}
      </Button>
    </div>
  );
}
