import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function CreateChannelModal({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("PUBLIC");
  const [courseId, setCourseId] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);

  useEffect(() => {
    if (open) api.get("/offerings").then((r) => setCourses(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [open]);

  const reset = () => { setName(""); setType("PUBLIC"); setCourseId(""); setIsReadOnly(false); setInviteLink(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === "COURSE_PRIVATE" && !courseId) return toast.error("Pick a course.");
    setSaving(true);
    try {
      const { data } = await api.post("/channels", {
        name: name.trim(),
        type,
        ...(type === "COURSE_PRIVATE" ? { course_id: courseId } : {}),
        is_read_only: isReadOnly,
      });
      toast.success("Channel created.");
      onCreated(data);
      if (data.type === "INVITE_ONLY") {
        setInviteLink(`${window.location.origin}/community?join=${data.join_token}`);
      } else {
        reset();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied");
  };

  const done = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this link — anyone with it can join the channel.</p>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly data-testid="chat-channel-invite-link-input" />
              <Button type="button" variant="outline" onClick={copyInviteLink} data-testid="chat-channel-copy-invite-button">
                Copy link
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={done} data-testid="chat-channel-done-button">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="channel-name" data-testid="chat-channel-name-input" />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="chat-channel-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="COURSE_PRIVATE">Course-private</SelectItem>
                <SelectItem value="INVITE_ONLY">Invite-only (link)</SelectItem>
              </SelectContent>
            </Select>
            {type === "COURSE_PRIVATE" && (
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger data-testid="chat-channel-course-select"><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isReadOnly} onChange={(e) => setIsReadOnly(e.target.checked)} data-testid="chat-channel-readonly-checkbox" />
              Read-only (announcements)
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saving} data-testid="chat-channel-submit-button">
                {saving ? "Creating…" : "Create channel"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
