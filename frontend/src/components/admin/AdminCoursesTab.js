import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import CourseWorkspace from "@/components/CourseWorkspace";
import { toast } from "sonner";
import { Search, Users, PlayCircle } from "lucide-react";

const FLAGS = [
  { key: "is_popular", label: "Popular" },
  { key: "is_recommended", label: "Recommended" },
  { key: "is_verified", label: "Verified" },
];

function matches(s, q) {
  if (!q) return true;
  return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
}

/** Click-through roster for one course: recorded courses show a flat student
 * list, live courses show it grouped by batch — same search box either way. */
function CourseRosterDialog({ offering, onClose }) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]); // recorded
  const [batches, setBatches] = useState([]); // live: [{batch_id, batch_name, students}]
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const isLive = offering.type === "live_course";
    const req = isLive
      ? api.get(`/admin/offerings/${offering.id}/batches-with-students`)
      : api.get(`/admin/offerings/${offering.id}/students`);
    req.then(({ data }) => {
      if (isLive) setBatches(Array.isArray(data) ? data : []);
      else setStudents(Array.isArray(data) ? data : []);
    }).catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [offering.id, offering.type]);

  const q = search.trim().toLowerCase();
  const isLive = offering.type === "live_course";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="course-roster-dialog">
        <DialogHeader><DialogTitle>{offering.title} <span className="text-xs text-muted-foreground font-normal ml-2">{isLive ? "batch enrollment" : "enrolled students"}</span></DialogTitle></DialogHeader>
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9 h-10" data-testid="course-roster-search" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : isLive ? (
            batches.map((b) => {
              const filtered = b.students.filter((s) => matches(s, q));
              if (q && filtered.length === 0) return null;
              return (
                <div key={b.batch_id}>
                  <div className="eyebrow mb-2">{b.batch_name} ({filtered.length})</div>
                  <div className="space-y-1.5">
                    {filtered.map((s) => (
                      <div key={s.user_id} className="flex items-center justify-between text-sm border-b border-border py-1.5">
                        <span>{s.name} <span className="text-xs text-muted-foreground">{s.email}</span></span>
                        <UserDetailDialog user={{ id: s.user_id, name: s.name, role: "learner" }} />
                      </div>
                    ))}
                    {filtered.length === 0 && <p className="text-xs text-muted-foreground">No students.</p>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-1.5">
              {students.filter((s) => matches(s, q)).map((s) => (
                <div key={s.user_id} className="flex items-center justify-between text-sm border-b border-border py-1.5">
                  <span>{s.name} <span className="text-xs text-muted-foreground">{s.email}</span></span>
                  <UserDetailDialog user={{ id: s.user_id, name: s.name, role: "learner" }} />
                </div>
              ))}
              {students.length === 0 && <p className="text-xs text-muted-foreground">No students enrolled.</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Full course content — lessons, videos, live sessions/recordings, the
 * assessment — exactly what an admin/super_admin gets by role, with no
 * enrollment needed. Same viewer a learner uses, in a bigger dialog. */
function CourseContentDialog({ offering, onClose }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" data-testid="course-content-dialog">
        <DialogHeader><DialogTitle>{offering.title}</DialogTitle></DialogHeader>
        <CourseWorkspace offeringId={offering.id} />
      </DialogContent>
    </Dialog>
  );
}

/** Admin Portal — "Courses" tab: the old single-row publish toggle, plus bulk
 * select + publish/unpublish/archive, and Popular/Recommended/Verified flags. */
export default function AdminCoursesTab({ offerings, onReload }) {
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rosterFor, setRosterFor] = useState(null);
  const [contentFor, setContentFor] = useState(null);

  const toggleSelected = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const patchOffering = async (o, patch) => {
    try {
      await api.patch(`/offerings/${o.id}`, patch);
      onReload();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const bulkAction = async (action) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      await api.patch("/admin/offerings/bulk", { ids: selected, action });
      toast.success(`${selected.length} course(s) updated.`);
      setSelected([]);
      onReload();
    } catch (e) { toast.error(formatApiError(e)); }
    setBulkBusy(false);
  };

  const visible = offerings.filter((o) => !o.is_archived);
  const archived = offerings.filter((o) => o.is_archived);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/60 p-3 flex items-center gap-3" data-testid="courses-bulk-bar">
        <span className="text-xs text-muted-foreground">{selected.length} selected</span>
        <Button size="sm" variant="outline" disabled={!selected.length || bulkBusy} onClick={() => bulkAction("publish")} data-testid="bulk-publish-btn">Publish</Button>
        <Button size="sm" variant="outline" disabled={!selected.length || bulkBusy} onClick={() => bulkAction("unpublish")} data-testid="bulk-unpublish-btn">Unpublish</Button>
        <Button size="sm" variant="outline" disabled={!selected.length || bulkBusy} onClick={() => bulkAction("archive")} data-testid="bulk-archive-btn">Archive</Button>
      </div>

      {visible.map((o) => (
        <div key={o.id} className="rounded-lg border border-border p-4 bg-card/60 flex flex-wrap items-center gap-4" data-testid={`course-row-${o.id}`}>
          <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => toggleSelected(o.id)} data-testid={`course-select-${o.id}`} />
          <button type="button" onClick={() => setRosterFor(o)} className="flex-1 min-w-[180px] text-left hover:text-primary transition-colors" data-testid={`course-open-${o.id}`}>
            <div className="font-serif text-lg">{o.title}</div>
            <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_", " ")}</div>
          </button>
          <Badge variant={o.approved_by_acharya ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
            {o.approved_by_acharya ? "Ācharya ✓" : "No sign-off"}
          </Badge>
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-xs">
              <Switch checked={!!o[f.key]} onCheckedChange={(v) => patchOffering(o, { [f.key]: v })} data-testid={`course-${f.key}-${o.id}`} />
              {f.label}
            </label>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-xs">{o.is_published ? "Live" : "Draft"}</span>
            <Switch checked={!!o.is_published} onCheckedChange={(v) => patchOffering(o, { is_published: v })} data-testid={`publish-${o.id}`} />
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRosterFor(o)} data-testid={`course-students-${o.id}`}>
            <Users className="w-3.5 h-3.5 mr-1.5" /> Students
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setContentFor(o)} data-testid={`course-content-${o.id}`}>
            <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> View content
          </Button>
        </div>
      ))}

      {rosterFor && <CourseRosterDialog offering={rosterFor} onClose={() => setRosterFor(null)} />}
      {contentFor && <CourseContentDialog offering={contentFor} onClose={() => setContentFor(null)} />}

      {archived.length > 0 && (
        <div>
          <div className="eyebrow mt-6 mb-2 text-muted-foreground">Archived ({archived.length})</div>
          {archived.map((o) => (
            <div key={o.id} className="rounded-lg border border-dashed border-border p-4 bg-card/30 flex items-center gap-4 opacity-70" data-testid={`course-row-${o.id}`}>
              <div className="flex-1">
                <div className="font-serif">{o.title}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => patchOffering(o, { is_archived: false })} data-testid={`course-unarchive-${o.id}`}>Unarchive</Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground pt-2">Guarantee: an Ācharya's name is never shown as approving a course they haven't signed off on.</p>
    </div>
  );
}
