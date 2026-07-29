import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadCourseMedia } from "@/lib/upload";
import { Plus, Trash2, UploadCloud, ScrollText, CheckCircle2 } from "lucide-react";

const blank = () => ({
  scripture: "", reference: "", devanagari: "", iast: "", audio_url: "",
  word_by_word: [], translations: [], commentaries: [],
});

/** Staff-facing editor to add a scriptural verse with audio for the Shloka Player. */
export default function VerseBuilder({ onSaved }) {
  const [v, setV] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [audioPct, setAudioPct] = useState(null);
  const set = (p) => setV((s) => ({ ...s, ...p }));

  const addRow = (key, row) => set({ [key]: [...v[key], row] });
  const setRow = (key, i, p) => set({ [key]: v[key].map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const delRow = (key, i) => set({ [key]: v[key].filter((_, j) => j !== i) });

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
    if (!v.scripture.trim() || !v.reference.trim() || !v.devanagari.trim())
      return toast.error("Scripture, reference and Devanāgarī are required.");
    setSaving(true);
    try {
      await api.post("/verses", v);
      toast.success("Verse added — now available in the Shloka Player.");
      setV(blank());
      onSaved && onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border p-8 bg-card max-w-4xl space-y-5" data-testid="verse-builder">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-2xl">Add a verse</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="overline">Scripture</label>
          <Input value={v.scripture} onChange={(e)=>set({scripture:e.target.value})} className="mt-2 h-11" placeholder="e.g. Bhagavad Gītā" data-testid="verse-scripture" />
        </div>
        <div>
          <label className="overline">Reference</label>
          <Input value={v.reference} onChange={(e)=>set({reference:e.target.value})} className="mt-2 h-11" placeholder="e.g. 2.47" data-testid="verse-reference" />
        </div>
      </div>
      <div>
        <label className="overline">Devanāgarī</label>
        <Textarea value={v.devanagari} onChange={(e)=>set({devanagari:e.target.value})} className="mt-2 min-h-[90px] font-devanagari text-lg" data-testid="verse-devanagari" />
      </div>
      <div>
        <label className="overline">Transliteration (IAST)</label>
        <Textarea value={v.iast} onChange={(e)=>set({iast:e.target.value})} className="mt-2 min-h-[70px] font-editorial italic" data-testid="verse-iast" />
      </div>

      {/* Audio */}
      <div>
        <label className="overline">Recitation audio</label>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="w-4 h-4" /> {v.audio_url ? "Replace audio" : "Upload audio"}
            <input type="file" accept="audio/*" className="hidden" onChange={(e)=>onAudio(e.target.files?.[0])} data-testid="verse-audio" />
          </label>
          {audioPct != null && <span className="text-xs text-primary tabular">Uploading… {audioPct}%</span>}
          {v.audio_url && audioPct == null && <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="w-3.5 h-3.5" /> Audio attached</span>}
        </div>
        {v.audio_url && <audio src={v.audio_url} controls className="mt-3 w-full max-w-md" />}
      </div>

      {/* Word-by-word */}
      <RowEditor title="Word by word" rows={v.word_by_word} onAdd={()=>addRow("word_by_word",{sanskrit:"",iast:"",meaning:""})} onDel={(i)=>delRow("word_by_word",i)}
        render={(r,i)=>(
          <div className="grid grid-cols-3 gap-2 flex-1">
            <Input value={r.sanskrit} onChange={(e)=>setRow("word_by_word",i,{sanskrit:e.target.value})} className="h-10 font-devanagari" placeholder="संस्कृत" />
            <Input value={r.iast} onChange={(e)=>setRow("word_by_word",i,{iast:e.target.value})} className="h-10" placeholder="IAST" />
            <Input value={r.meaning} onChange={(e)=>setRow("word_by_word",i,{meaning:e.target.value})} className="h-10" placeholder="meaning" />
          </div>
        )} />

      {/* Translations */}
      <RowEditor title="Translations" rows={v.translations} onAdd={()=>addRow("translations",{author:"",text:""})} onDel={(i)=>delRow("translations",i)}
        render={(r,i)=>(
          <div className="grid grid-cols-[1fr_2fr] gap-2 flex-1">
            <Input value={r.author} onChange={(e)=>setRow("translations",i,{author:e.target.value})} className="h-10" placeholder="Author" />
            <Input value={r.text} onChange={(e)=>setRow("translations",i,{text:e.target.value})} className="h-10" placeholder="Translation" />
          </div>
        )} />

      {/* Commentaries */}
      <RowEditor title="Commentaries" rows={v.commentaries} onAdd={()=>addRow("commentaries",{author:"",text:""})} onDel={(i)=>delRow("commentaries",i)}
        render={(r,i)=>(
          <div className="grid grid-cols-[1fr_2fr] gap-2 flex-1">
            <Input value={r.author} onChange={(e)=>setRow("commentaries",i,{author:e.target.value})} className="h-10" placeholder="Author" />
            <Input value={r.text} onChange={(e)=>setRow("commentaries",i,{text:e.target.value})} className="h-10" placeholder="Commentary" />
          </div>
        )} />

      <Button onClick={save} disabled={saving} className="rounded-full h-11 px-8 bg-gradient-hot text-white border-0" data-testid="verse-save">
        {saving ? "Saving…" : "Add verse"}
      </Button>
    </div>
  );
}

function RowEditor({ title, rows, onAdd, onDel, render }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="overline">{title}</label>
        <Button type="button" size="sm" variant="outline" onClick={onAdd} className="rounded-full h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {render(r, i)}
            <button type="button" onClick={()=>onDel(i)} className="text-muted-foreground hover:text-destructive p-1.5" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">None added.</p>}
      </div>
    </div>
  );
}
