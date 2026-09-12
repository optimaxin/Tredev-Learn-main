import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, CalendarPlus, ListChecks } from "lucide-react";

const emptyBatch = () => ({ name: "", start_date: "", max_students: 50 });
const emptySession = () => ({ title: "", acharya_id: "", starts_at: "", duration_min: 60, join_url: "" });

const SCHEDULE_STATUS_LABEL = {
  pending_approval: "Awaiting Ācharya approval",
  approved: "Approved by Ācharya",
  changes_requested: "Changes requested",
};

/** Batches for a live_course offering — cohorts with their own start date,
 * a capacity cap, and a live seat count. Each batch row can also schedule a
 * live session directly against itself (offering + batch prefilled), instead
 * of staff having to re-pick both in the separate global sessions tab. */
export default function BatchManager({ offeringId, acharyas = [] }) {
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(emptyBatch());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [schedulingFor, setSchedulingFor] = useState(null); // batch id whose session form is open
  const [sessionForm, setSessionForm] = useState(emptySession());
  const [schedulingSaving, setSchedulingSaving] = useState(false);

  const load = () => {
    api.get("/batches", { params: { offering_id: offeringId } })
      .then(({ data }) => setBatches(Array.isArray(data) ? data : []))
      .catch(() => {});
  };
  useEffect(() => { load(); }, [offeringId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (b) => { setEditingId(b.id); setForm({ name: b.name, start_date: b.start_date || "", max_students: b.max_students || 50 }); };
  const cancelEdit = () => { setEditingId(null); setForm(emptyBatch()); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date) return toast.error("Batch name and start date are required.");
    setSaving(true);
    try {
      const payload = { ...form, max_students: parseInt(form.max_students) || 50 };
      if (editingId) {
        await api.patch(`/batches/${editingId}`, payload);
        toast.success("Batch updated.");
      } else {
        await api.post("/batches", { ...payload, offering_id: offeringId });
        toast.success("Batch added.");
      }
      cancelEdit();
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/batches/${id}`);
      toast.success("Batch deleted.");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const openScheduleFor = (batchId) => {
    setSchedulingFor(schedulingFor === batchId ? null : batchId);
    setSessionForm(emptySession());
  };

  const submitSession = async (e, batchId) => {
    e.preventDefault();
    if (!sessionForm.title || !sessionForm.acharya_id || !sessionForm.starts_at) {
      return toast.error("Title, Ācharya, and start time are required.");
    }
    setSchedulingSaving(true);
    try {
      await api.post("/live-sessions", {
        ...sessionForm,
        offering_id: offeringId,
        batch_id: batchId,
        starts_at: new Date(sessionForm.starts_at).toISOString(),
        duration_min: parseInt(sessionForm.duration_min) || 60,
      });
      toast.success("Session scheduled for this batch.");
      setSchedulingFor(null);
    } catch (err) { toast.error(formatApiError(err)); }
    setSchedulingSaving(false);
  };

  return (
    <div className="space-y-5" data-testid={`batch-manager-${offeringId}`}>
      <form onSubmit={submit} className="rounded-xl border border-border p-4 bg-background/60 grid sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-1">
          <label className="eyebrow">Batch name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Batch 1" className="mt-2 h-10" data-testid="batch-name" />
        </div>
        <div>
          <label className="eyebrow">Start date</label>
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="mt-2 h-10" data-testid="batch-start-date" />
        </div>
        <div>
          <label className="eyebrow">Max students</label>
          <Input type="number" min={1} max={50} value={form.max_students}
            onChange={(e) => setForm({ ...form, max_students: e.target.value })}
            className="mt-2 h-10" data-testid="batch-max-students" />
        </div>
        <div className="sm:col-span-3 flex gap-2">
          <Button type="submit" size="sm" disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="batch-submit">
            <Plus className="w-4 h-4 mr-1" /> {saving ? "Saving…" : editingId ? "Save batch" : "Add batch"}
          </Button>
          {editingId && <Button type="button" size="sm" variant="outline" onClick={cancelEdit} className="rounded-full">Cancel</Button>}
        </div>
      </form>

      <div className="space-y-2">
        {batches.map((b) => {
          const seatsLeft = b.seats_available ?? Math.max(0, (b.max_students || 0) - (b.enrolled_count || 0));
          return (
          <div key={b.id} className="rounded-xl border border-border bg-card" data-testid={`batch-row-${b.id}`}>
            <div className="p-4 flex items-center gap-4 flex-wrap">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-[160px]">
                <div className="font-display font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground tabular">
                  Starts {b.start_date} · {b.enrolled_count ?? 0}/{b.max_students} enrolled ·{" "}
                  {seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left` : "Full"}
                </div>
                {b.schedule_status && (
                  <Badge variant={b.schedule_status === "approved" ? "default" : b.schedule_status === "changes_requested" ? "destructive" : "outline"}
                    className="mt-1.5 text-[10px] uppercase tracking-widest">
                    {SCHEDULE_STATUS_LABEL[b.schedule_status] || b.schedule_status}
                  </Badge>
                )}
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-full" data-testid={`batch-open-${b.id}`}>
                <Link to={`/staff/batches/${b.id}`}><ListChecks className="w-4 h-4 mr-1" /> Open batch</Link>
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openScheduleFor(b.id)} data-testid={`batch-schedule-${b.id}`}>
                <CalendarPlus className="w-4 h-4 mr-1" /> Schedule session
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => startEdit(b)} data-testid={`batch-edit-${b.id}`}>Edit</Button>
              <button type="button" onClick={() => remove(b.id)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Delete batch" data-testid={`batch-delete-${b.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {b.schedule_status === "changes_requested" && b.schedule_notes && (
              <div className="mx-4 mb-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs" data-testid={`batch-schedule-notes-${b.id}`}>
                <span className="uppercase tracking-widest text-[9px] text-destructive font-semibold">Ācharya requested changes: </span>
                {b.schedule_notes}
              </div>
            )}

            {schedulingFor === b.id && (
              <form onSubmit={(e) => submitSession(e, b.id)} className="border-t border-border p-4 grid sm:grid-cols-2 gap-3" data-testid={`batch-session-form-${b.id}`}>
                <div className="sm:col-span-2">
                  <label className="eyebrow">Session title</label>
                  <Input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                    className="mt-2 h-10" data-testid="batch-session-title" />
                </div>
                <div>
                  <label className="eyebrow">Ācharya</label>
                  <Select value={sessionForm.acharya_id} onValueChange={(v) => setSessionForm({ ...sessionForm, acharya_id: v })}>
                    <SelectTrigger className="mt-2 h-10" data-testid="batch-session-acharya"><SelectValue placeholder="Assign an Ācharya…" /></SelectTrigger>
                    <SelectContent>{acharyas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="eyebrow">Starts at</label>
                  <Input type="datetime-local" value={sessionForm.starts_at} onChange={(e) => setSessionForm({ ...sessionForm, starts_at: e.target.value })}
                    className="mt-2 h-10" data-testid="batch-session-starts" />
                </div>
                <div>
                  <label className="eyebrow">Duration (min)</label>
                  <Input type="number" value={sessionForm.duration_min} onChange={(e) => setSessionForm({ ...sessionForm, duration_min: e.target.value })}
                    className="mt-2 h-10" />
                </div>
                <div>
                  <label className="eyebrow">Join link</label>
                  <Input value={sessionForm.join_url} onChange={(e) => setSessionForm({ ...sessionForm, join_url: e.target.value })}
                    placeholder="https://meeting.zoho.in/…" className="mt-2 h-10" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" size="sm" disabled={schedulingSaving} className="rounded-full bg-gradient-hot text-white border-0" data-testid="batch-session-submit">
                    {schedulingSaving ? "Scheduling…" : "Schedule for this batch"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setSchedulingFor(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
          );
        })}
        {batches.length === 0 && <div className="text-sm text-muted-foreground">No batches yet — add one above.</div>}
      </div>
    </div>
  );
}
