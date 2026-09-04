import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ticketCode, fmtDate, STATUS_BADGE } from "@/lib/queryUtils";

/** Left panel — the master ticket list (GUVI/Zen Class style). Shared by both portals. */
export default function QueryTicketList({
  tickets, selectedId, onSelect, search, onSearchChange, mode,
  createAction, emptyLabel, loading, testidPrefix = "query",
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? tickets.filter((t) => t.title?.toLowerCase().includes(q) || ticketCode(t.id).toLowerCase().includes(q))
    : tickets;

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col h-[70vh] min-h-[520px]" data-testid={`${testidPrefix}-list`}>
      <div className="p-4 border-b border-border space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search queries…" className="pl-9 h-10" data-testid={`${testidPrefix}-search`} />
        </div>
        {createAction}
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.map((t) => {
          const status = STATUS_BADGE[t.status] || STATUS_BADGE.OPEN;
          return (
            <button key={t.id} onClick={() => onSelect(t)} data-testid={`${testidPrefix}-card-${t.id}`}
              className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${selectedId === t.id ? "bg-primary/10" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">{ticketCode(t.id)}</span>
                <Badge variant={status.variant} className="text-[9px] uppercase tracking-widest shrink-0">{status.label}</Badge>
              </div>
              <div className="font-display font-semibold text-sm mt-1.5 line-clamp-1">{t.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {mode === "staff" ? `By ${t.user_name || "Learner"}` : (t.assigned_staff_name ? `With ${t.assigned_staff_name}` : "Unassigned")}
                {" · "}{fmtDate(t.created_at)}
              </div>
              {t.category_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.category_tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[9px] normal-case font-normal text-muted-foreground">{tag}</Badge>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground" data-testid={`${testidPrefix}-empty`}>
            {emptyLabel || "No queries yet."}
          </div>
        )}
      </div>
    </div>
  );
}
