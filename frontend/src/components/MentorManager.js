import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const emptyMentor = () => ({
  name: "", title: "", avatar: "", parampara: "", order: 0, bio: "",
});

export default function MentorManager() {
  const [mentors, setMentors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [credentialsText, setCredentialsText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/mentors").catch(() => ({ data: [] }));
    setMentors(Array.isArray(data) ? data : []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(emptyMentor()); setCredentialsText(""); };
  const startEdit = (m) => { setEditing(m); setCredentialsText((m.credentials || []).join("\n")); };

  const save = async () => {
    if (!editing.name.trim()) return toast.error("Name is required.");
    setSaving(true);
    const payload = { ...editing, order: parseInt(editing.order) || 0, credentials: credentialsText.split("\n").map((c) => c.trim()).filter(Boolean) };
    try {
      if (editing.id) {
        await api.patch(`/mentors/${editing.id}`, payload);
        toast.success("Mentor updated.");
      } else {
        await api.post("/mentors", payload);
        toast.success("Mentor added.");
      }
      setEditing(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/mentors/${id}`);
      toast.success("Mentor removed.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="mentor-manager">
      {!editing && (
        <Button onClick={startNew} className="rounded-full bg-gradient-hot text-white border-0" data-testid="mentor-new">
          <Plus className="w-4 h-4 mr-1" /> New mentor
        </Button>
      )}

      {editing && (
        <div className="rounded-2xl border border-border p-6 bg-card space-y-4 max-w-2xl" data-testid="mentor-editor">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Name</label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-2 h-11" data-testid="mentor-name" />
            </div>
            <div>
              <label className="eyebrow">Title</label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-2 h-11" data-testid="mentor-title" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Avatar URL</label>
              <Input value={editing.avatar} onChange={(e) => setEditing({ ...editing, avatar: e.target.value })} className="mt-2 h-11" />
            </div>
            <div>
              <label className="eyebrow">Parampara / lineage</label>
              <Input value={editing.parampara} onChange={(e) => setEditing({ ...editing, parampara: e.target.value })} className="mt-2 h-11" />
            </div>
          </div>
          <div>
            <label className="eyebrow">Display order</label>
            <Input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: e.target.value })} className="mt-2 h-11 w-32" />
          </div>
          <div>
            <label className="eyebrow">Credentials (one per line)</label>
            <Textarea value={credentialsText} onChange={(e) => setCredentialsText(e.target.value)} className="mt-2 min-h-[90px]" />
          </div>
          <div>
            <label className="eyebrow">Bio</label>
            <Textarea value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} className="mt-2 min-h-[100px]" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="mentor-save">
              {saving ? "Saving…" : "Save mentor"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {mentors.map((m) => (
          <div key={m.id} className="rounded-xl border border-border p-4 bg-card flex items-center gap-4" data-testid={`mentor-${m.id}`}>
            <div className="flex-1">
              <div className="font-display font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.title}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => startEdit(m)} className="rounded-full">Edit</Button>
            <Button size="sm" variant="outline" onClick={() => remove(m.id)} className="rounded-full text-destructive">Delete</Button>
          </div>
        ))}
        {mentors.length === 0 && <div className="text-sm text-muted-foreground">No mentors yet.</div>}
      </div>
    </div>
  );
}
