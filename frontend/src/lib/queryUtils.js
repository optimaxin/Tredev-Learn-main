/** Shared helpers for the Queries (ticketed chat) feature — User Portal + Staff Panel. */

export const QUERY_CATEGORIES = [
  "Placement Support", "Course Content", "Technical Issue", "Coordination", "Billing", "General",
];

export const STATUS_BADGE = {
  OPEN: { label: "Open", variant: "outline" },
  ASSIGNED: { label: "Assigned", variant: "default" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

export function ticketCode(id) {
  return "Q" + (id || "").replace(/-/g, "").slice(0, 5).toUpperCase();
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "";
}

export function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}
