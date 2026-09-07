import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

/** "Grant course access" — staff/admin manually enrolls a learner into a course,
 * bypassing payment (e.g. they paid but the enrollment never landed). */
export default function GrantCourseAccessDialog({ userId }) {
  const [open, setOpen] = useState(false);
  const [offerings, setOfferings] = useState([]);
  const [offeringId, setOfferingId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/offerings?published_only=false").then(({ data }) => setOfferings(Array.isArray(data) ? data : [])).catch(() => {});
  }, [open]);

  const submit = async () => {
    if (!offeringId) return toast.error("Choose a course first.");
    setSaving(true);
    try {
      await api.post("/enrollments/manual-grant", { user_id: userId, offering_id: offeringId, note });
      toast.success("Course access granted.");
      setOpen(false);
      setOfferingId("");
      setNote("");
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full" data-testid="grant-access-btn">
          <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Grant access
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="grant-access-dialog">
        <DialogHeader><DialogTitle>Grant course access</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="eyebrow">Course</label>
            <Select value={offeringId} onValueChange={setOfferingId}>
              <SelectTrigger className="mt-2 h-11" data-testid="grant-access-offering"><SelectValue placeholder="Choose a course" /></SelectTrigger>
              <SelectContent>
                {offerings.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="eyebrow">Note (optional)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-2"
              placeholder="e.g. Paid via UPI, payment webhook missed the enrollment." data-testid="grant-access-note" />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full h-11 bg-gradient-hot text-white border-0" data-testid="grant-access-submit">
            {saving ? "Granting…" : "Grant access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
