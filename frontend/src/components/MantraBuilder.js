import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadCourseMedia } from "@/lib/upload";
import { Music, UploadCloud, CheckCircle2 } from "lucide-react";

const COMMON_DEITIES = ["Shiva","Vishnu","Krishna","Rama","Durga","Devi","Lakshmi","Saraswati","Ganesha","Hanuman","Surya","Guru"];

const blank = () => ({ deity: "", title: "", devanagari: "", iast: "", meaning: "", audio_url: "" });

/** Staff-facing editor to add a mantra under a deity (auto-links to the festival calendar). */
export default function MantraBuilder({ onSaved }) {
  const [m, setM] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [audioPct, setAudioPct] = useState(null);
  const set = (p) => setM((s) => ({ ...s, ...p }));

  const onAudio = async (file) => {
    if (!file) return;
    setAudioPct(0);
    try {
      const { public_url } = await uploadCourseMedia(file, setAudioPct);
      set({ audio_url: public_url });
      toast.success("Audio uploaded.");
    } catch (e) { toast.error(formatApiError(e) || e.message || "Upload failed"); }
    setAudioPct(null);
  };

  const save = async () => {
    if (!m.deity.trim() || !m.title.trim()) return toast.error("Deity and title are required.");
    setSaving(true);
    try {
      await api.post("/mantras", m);
      toast.success(`Mantra added under ${m.deity}.`);
      setM(blank());
      onSaved && onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border p-8 bg-card space-y-5" data-testid="mantra-builder">
      <div className="flex items-center gap-2">
        <Music className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-2xl">Add a mantra</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="overline">Deity / god name</label>
          <Input list="deity-list" value={m.deity} onChange={(e)=>set({deity:e.target.value})} className="mt-2 h-11" placeholder="e.g. Shiva" data-testid="mantra-deity" />
          <datalist id="deity-list">{COMMON_DEITIES.map((d)=><option key={d} value={d} />)}</datalist>
          <p className="text-[11px] text-muted-foreground mt-1">Auto-links to festivals with the same deity.</p>
        </div>
        <div>
          <label className="overline">Title</label>
          <Input value={m.title} onChange={(e)=>set({title:e.target.value})} className="mt-2 h-11" placeholder="e.g. Mahāmṛtyuñjaya Mantra" data-testid="mantra-title" />
        </div>
      </div>
      <div>
        <label className="overline">Devanāgarī</label>
        <Textarea value={m.devanagari} onChange={(e)=>set({devanagari:e.target.value})} className="mt-2 min-h-[80px] font-devanagari text-lg" data-testid="mantra-devanagari" />
      </div>
      <div>
        <label className="overline">Transliteration (IAST)</label>
        <Textarea value={m.iast} onChange={(e)=>set({iast:e.target.value})} className="mt-2 min-h-[60px] font-editorial italic" />
      </div>
      <div>
        <label className="overline">Meaning</label>
        <Textarea value={m.meaning} onChange={(e)=>set({meaning:e.target.value})} className="mt-2 min-h-[60px]" />
      </div>
      <div>
        <label className="overline">Recitation audio</label>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="w-4 h-4" /> {m.audio_url ? "Replace audio" : "Upload audio"}
            <input type="file" accept="audio/*" className="hidden" onChange={(e)=>onAudio(e.target.files?.[0])} data-testid="mantra-audio" />
          </label>
          {audioPct != null && <span className="text-xs text-primary tabular">Uploading… {audioPct}%</span>}
          {m.audio_url && audioPct == null && <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="w-3.5 h-3.5" /> Audio attached</span>}
        </div>
        {m.audio_url && <audio src={m.audio_url} controls className="mt-3 w-full max-w-md" />}
      </div>
      <Button onClick={save} disabled={saving} className="rounded-full h-11 px-8 bg-gradient-hot text-white border-0" data-testid="mantra-save">
        {saving ? "Saving…" : "Add mantra"}
      </Button>
    </div>
  );
}
