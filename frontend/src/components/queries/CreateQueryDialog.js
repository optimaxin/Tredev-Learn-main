import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { QUERY_CATEGORIES } from "@/lib/queryUtils";

/** "+ Create Query" — opens a new ticket for the learner. */
export default function CreateQueryDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag) => setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));

  const reset = () => { setTitle(""); setDescription(""); setTags([]); };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Please give your query a title.");
    setSaving(true);
    try {
      const { data } = await api.post("/queries", { title: title.trim(), description: description.trim(), category_tags: tags });
      toast.success("Query created.");
      reset();
      setOpen(false);
      onCreated && onCreated(data);
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-full bg-gradient-hot text-white border-0" data-testid="create-query-btn">
          <Plus className="w-4 h-4 mr-2" /> Create Query
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="create-query-dialog">
        <DialogHeader>
          <DialogTitle>New query</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="eyebrow">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 h-11"
              placeholder="e.g. Certificate not showing on my profile" data-testid="create-query-title" />
          </div>
          <div>
            <label className="eyebrow">Describe your query</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 min-h-[110px]"
              placeholder="Give as much detail as you can — this becomes your first message." data-testid="create-query-description" />
          </div>
          <div>
            <label className="eyebrow">Category</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {QUERY_CATEGORIES.map((tag) => (
                <button type="button" key={tag} onClick={() => toggleTag(tag)} data-testid={`create-query-tag-${tag}`}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full rounded-full h-11 bg-gradient-hot text-white border-0" data-testid="create-query-submit">
            {saving ? "Creating…" : "Create query"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
