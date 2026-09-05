import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const emptyEntry = () => ({
  slug: "", title: "", category: "", excerpt: "", cover_image: "", author_name: "", read_time: "", body: "",
});

export default function JournalManager({ canAuthor = true }) {
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/blogs").catch(() => ({ data: [] }));
    setEntries(Array.isArray(data) ? data : []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing(emptyEntry());
  const startEdit = (b) => setEditing(b);

  const save = async () => {
    if (!editing.title.trim()) return toast.error("Title is required.");
    setSaving(true);
    try {
      if (editing.id) {
        await api.patch(`/blogs/${editing.id}`, editing);
        toast.success("Journal entry updated.");
      } else {
        const slug = editing.slug.trim() || slugify(editing.title);
        await api.post("/blogs", { ...editing, slug });
        toast.success("Journal entry published.");
      }
      setEditing(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/blogs/${id}`);
      toast.success("Journal entry removed.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="journal-manager">
      {!canAuthor && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="journal-author-disabled">
          Journal management has not been granted to you by admin — you can't create, edit, or delete journal entries.
        </div>
      )}
      {!editing && canAuthor && (
        <Button onClick={startNew} className="rounded-full bg-gradient-hot text-white border-0" data-testid="journal-new">
          <Plus className="w-4 h-4 mr-1" /> New journal entry
        </Button>
      )}

      {editing && canAuthor && (
        <div className="rounded-2xl border border-border p-6 bg-card space-y-4 max-w-2xl" data-testid="journal-editor">
          <div>
            <label className="eyebrow">Title</label>
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-2 h-11" data-testid="journal-title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Slug {editing.id ? "" : "(optional — auto-generated from title)"}</label>
              <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="mt-2 h-11" disabled={!!editing.id} data-testid="journal-slug" />
            </div>
            <div>
              <label className="eyebrow">Category</label>
              <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="mt-2 h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Author name</label>
              <Input value={editing.author_name} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} className="mt-2 h-11" />
            </div>
            <div>
              <label className="eyebrow">Read time</label>
              <Input value={editing.read_time} onChange={(e) => setEditing({ ...editing, read_time: e.target.value })} placeholder="e.g. 6 min" className="mt-2 h-11" />
            </div>
          </div>
          <div>
            <label className="eyebrow">Cover image URL</label>
            <Input value={editing.cover_image} onChange={(e) => setEditing({ ...editing, cover_image: e.target.value })} className="mt-2 h-11" />
          </div>
          <div>
            <label className="eyebrow">Excerpt</label>
            <Textarea value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} className="mt-2 min-h-[70px]" />
          </div>
          <div>
            <label className="eyebrow">Body</label>
            <Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="mt-2 min-h-[200px] font-editorial" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="journal-save">
              {saving ? "Saving…" : "Save entry"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((b) => (
          <div key={b.id} className="rounded-xl border border-border p-4 bg-card flex items-center gap-4" data-testid={`journal-${b.id}`}>
            <div className="flex-1">
              <div className="font-display font-semibold">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.author_name}</div>
            </div>
            {b.category && <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{b.category}</Badge>}
            {canAuthor && (
              <>
                <Button size="sm" variant="outline" onClick={() => startEdit(b)} className="rounded-full">Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(b.id)} className="rounded-full text-destructive">Delete</Button>
              </>
            )}
          </div>
        ))}
        {entries.length === 0 && <div className="text-sm text-muted-foreground">No journal entries yet.</div>}
      </div>
    </div>
  );
}
