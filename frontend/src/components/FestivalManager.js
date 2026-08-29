import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UploadCloud, Plus, Sparkles } from "lucide-react";

const CSV_HEADER = "name,date,significance,deity,related_offering_subject";
const DEFAULT_CSV = `${CSV_HEADER}
Onam (Thiruvonam),2026-08-26,Kerala's harvest festival celebrating the mythical return of King Mahabali,,
Raksha Bandhan,2026-08-28,Siblings tie a protective thread celebrating the bond of sibling love,,
Janmashtami,2026-09-04,Birth of Lord Krishna,Krishna,Bhagavad Gita
Ganesh Chaturthi,2026-09-14,Installation and worship of Lord Ganesha culminating in visarjan,Ganesha,Mantras
Sharad Navratri,2026-10-11,Nine nights honoring the nine forms of Goddess Durga,Durga,Mantras
Durga Ashtami,2026-10-18,Peak Durga Puja day — Kanya Pujan and Ashtami worship,Durga,Mantras
Dussehra (Vijayadashami),2026-10-20,Triumph of good over evil marking the end of Navratri,Durga,
Karva Chauth,2026-10-29,Married women fast for their husbands' longevity and wellbeing,,
Dhanteras,2026-11-06,Worship of wealth and Goddess Lakshmi start of the Diwali season,Lakshmi,
Naraka Chaturdashi (Choti Diwali),2026-11-07,Commemorates Krishna's victory over the demon Narakasura,Krishna,Bhagavad Gita
Diwali (Lakshmi Puja),2026-11-08,The festival of lights — the main Lakshmi Puja day,Lakshmi,
Govardhan Puja,2026-11-10,Commemorates Krishna lifting Govardhan hill to shelter Vraj,Krishna,Bhagavad Gita
Bhai Dooj,2026-11-10,Sisters pray for their brothers' long life and wellbeing,,
Chhath Puja,2026-11-14,Ancient worship of the Sun God at the river's edge,Surya,
Kartik Purnima (Dev Deepawali),2026-11-24,Full moon of Kartik — mass lamp-lighting at the sacred ghats,Shiva,Mantras
Gita Jayanti,2026-12-20,Anniversary of Krishna's recitation of the Bhagavad Gita at Kurukshetra,Krishna,Bhagavad Gita`;

const emptyFestival = () => ({ name: "", date: "", significance: "", deity: "", related_offering_subject: "" });

export default function FestivalManager({ canAuthor = true }) {
  const [festivals, setFestivals] = useState([]);
  const [csvText, setCsvText] = useState("");
  const [mode, setMode] = useState("append");
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/festivals").then((r) => setFestivals(r.data || [])).catch(() => setFestivals([]));
  useEffect(() => { load(); }, []);

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!csvText.trim()) return toast.error("Paste or upload CSV data first.");
    setImporting(true);
    try {
      const { data } = await api.post("/festivals/import-csv", { csv_text: csvText, mode });
      setFestivals(data);
      toast.success(`Imported ${data.length} festival(s).`);
      setCsvText("");
    } catch (e) { toast.error(formatApiError(e)); }
    setImporting(false);
  };

  const save = async () => {
    if (!editing.name.trim() || !editing.date) return toast.error("Name and date are required.");
    setSaving(true);
    try {
      if (editing.id) {
        await api.patch(`/festivals/${editing.id}`, editing);
        toast.success("Festival updated.");
      } else {
        await api.post("/festivals", editing);
        toast.success("Festival added.");
      }
      setEditing(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/festivals/${id}`);
      toast.success("Festival removed.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!canAuthor) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="calendar-author-disabled">
        Calendar management has not been granted to you by admin.
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="festival-manager">
      <div className="rounded-2xl border border-border p-6 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl">Upload / update festival CSV</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Columns: <code className="px-1 py-0.5 bg-muted rounded">{CSV_HEADER}</code>. "Replace" clears the whole
          calendar first; "Append / update" upserts rows matching the same name + date.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="w-4 h-4" /> Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="festival-csv-file" />
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => setCsvText(DEFAULT_CSV)} className="rounded-full" data-testid="festival-load-default">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Load default dataset
          </Button>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-10 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="append">Append / update</SelectItem>
              <SelectItem value="replace">Replace entire calendar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={CSV_HEADER}
          className="min-h-[160px] font-mono text-xs" data-testid="festival-csv-text" />
        <Button onClick={importCsv} disabled={importing} className="rounded-full bg-gradient-hot text-white border-0" data-testid="festival-csv-import">
          {importing ? "Importing…" : "Import CSV"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border p-6 bg-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-display font-bold text-xl">Festivals ({festivals.length})</h3>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(emptyFestival())} className="rounded-full" data-testid="festival-new">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add festival
            </Button>
          )}
        </div>
        {editing && (
          <div className="rounded-xl border border-primary/40 p-4 space-y-3" data-testid="festival-editor">
            <div className="grid md:grid-cols-2 gap-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Festival name" className="h-10" data-testid="festival-name" />
              <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="h-10" data-testid="festival-date" />
            </div>
            <Textarea value={editing.significance} onChange={(e) => setEditing({ ...editing, significance: e.target.value })} placeholder="Significance" className="min-h-[70px]" />
            <div className="grid md:grid-cols-2 gap-3">
              <Input value={editing.deity} onChange={(e) => setEditing({ ...editing, deity: e.target.value })} placeholder="Deity (optional, e.g. Krishna)" className="h-10" />
              <Input value={editing.related_offering_subject} onChange={(e) => setEditing({ ...editing, related_offering_subject: e.target.value })} placeholder="Related course subject (optional)" className="h-10" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="festival-save">
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {festivals.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-3 bg-background/50 flex items-center gap-4 flex-wrap" data-testid={`festival-row-${f.id}`}>
              <div className="text-xs font-mono text-muted-foreground w-24 shrink-0">{f.date}</div>
              <div className="flex-1 min-w-[160px] font-display font-semibold">{f.name}</div>
              {f.deity && <span className="text-[10px] uppercase tracking-widest text-accent">{f.deity}</span>}
              <Button size="sm" variant="outline" onClick={() => setEditing(f)} className="rounded-full">Edit</Button>
              <Button size="sm" variant="outline" onClick={() => remove(f.id)} className="rounded-full text-destructive">Delete</Button>
            </div>
          ))}
          {festivals.length === 0 && <div className="text-sm text-muted-foreground">No festivals yet — import a CSV above.</div>}
        </div>
      </div>
    </div>
  );
}
