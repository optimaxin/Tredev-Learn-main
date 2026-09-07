import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const FLAGS = [
  { key: "is_popular", label: "Popular" },
  { key: "is_recommended", label: "Recommended" },
  { key: "is_verified", label: "Verified" },
];

/** Admin Portal — "Courses" tab: the old single-row publish toggle, plus bulk
 * select + publish/unpublish/archive, and Popular/Recommended/Verified flags. */
export default function AdminCoursesTab({ offerings, onReload }) {
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

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
          <div className="flex-1 min-w-[180px]">
            <div className="font-serif text-lg">{o.title}</div>
            <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_", " ")}</div>
          </div>
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
        </div>
      ))}

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
