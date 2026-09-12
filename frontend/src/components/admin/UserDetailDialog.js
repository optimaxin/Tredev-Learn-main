import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, Ban, CheckCircle2, UserMinus } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const PERFORMANCE_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7"];

/** Admin-only profile + history dialog (enrollments/payments/quiz performance,
 * or a role-specific report for staff/acharya) — GET /admin/users/{id}/detail.
 * Shared by the Users tab's "view profile & history" action and the Courses
 * tab's student-roster drill-down, so there's one place to maintain this. */
export default function UserDetailDialog({ user, trigger }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState(null);

  const reload = () => {
    if (!user?.id) return;
    return api.get(`/admin/users/${user.id}/detail`)
      .then(({ data }) => setDetail(data))
      .catch((e) => toast.error(formatApiError(e)));
  };

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setDetail({ user });
    reload().finally(() => setLoading(false));
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const runEnrollmentAction = async (enrollmentId, label, fn) => {
    setBusyEnrollmentId(enrollmentId);
    try {
      await fn();
      toast.success(label);
      await reload();
    } catch (e) { toast.error(formatApiError(e)); }
    setBusyEnrollmentId(null);
  };

  const suspendEnrollment = (e) => runEnrollmentAction(e.id, "Access restricted for this course.",
    () => api.patch(`/admin/enrollments/${e.id}/suspend`));
  const reactivateEnrollment = (e) => runEnrollmentAction(e.id, "Access restored.",
    () => api.patch(`/admin/enrollments/${e.id}/reactivate`));
  const removeEnrollment = (e) => {
    if (!window.confirm(`Remove ${detail?.user?.name} from "${e.offering_title || "this course"}"? They will be unenrolled and will need to purchase or be re-granted access to rejoin.`)) return;
    runEnrollmentAction(e.id, "Removed from course/batch.", () => api.delete(`/admin/enrollments/${e.id}`));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="View profile & history" data-testid={`user-view-${user?.id}`}>
            <Eye className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="user-detail-dialog">
        <DialogHeader><DialogTitle>{detail?.user?.name} <span className="text-xs text-muted-foreground font-normal ml-2 capitalize">{detail?.user?.role?.replace("_", " ")}</span></DialogTitle></DialogHeader>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : detail?.staff_report ? (
          <div className="space-y-3" data-testid="user-detail-staff-report">
            <div className="eyebrow mb-2">Query-handling report</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Queries claimed</div>
                <div className="text-lg font-serif mt-1">{detail.staff_report.queries_claimed}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Closed</div>
                <div className="text-lg font-serif mt-1">{detail.staff_report.queries_closed}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Still open</div>
                <div className="text-lg font-serif mt-1">{detail.staff_report.queries_open}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Escalated to admin</div>
                <div className="text-lg font-serif mt-1">{detail.staff_report.queries_escalated}</div>
              </div>
            </div>
          </div>
        ) : detail?.acharya_report ? (
          <div className="space-y-3" data-testid="user-detail-acharya-report">
            <div className="eyebrow mb-2">Teaching report</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Courses taught</div>
                <div className="text-lg font-serif mt-1">{detail.acharya_report.courses_taught}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Total enrolled</div>
                <div className="text-lg font-serif mt-1">{detail.acharya_report.total_enrollments}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Revenue generated</div>
                <div className="text-lg font-serif mt-1">₹{detail.acharya_report.total_revenue_inr.toLocaleString()}</div>
              </div>
            </div>
            <div>
              {detail.acharya_report.courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm border-b border-border py-2">
                  <span>{c.title}</span>
                  <span className="text-xs text-muted-foreground">{c.is_published ? "Published" : "Draft"}</span>
                </div>
              ))}
              {!detail.acharya_report.courses.length && <p className="text-xs text-muted-foreground">No courses yet.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto" data-testid="user-detail-learner-report">
            {detail?.quiz_performance && (
              <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quiz performance</span>
                <span className="text-sm">
                  {detail.quiz_performance.attempts} attempts
                  {detail.quiz_performance.average_score != null && ` · avg ${detail.quiz_performance.average_score}`}
                </span>
              </div>
            )}
            <div>
              <div className="eyebrow mb-2">Course performance ({detail?.enrollments?.length || 0} enrolled)</div>
              {(detail?.enrollments || []).length ? (
                <div className="flex flex-col sm:flex-row items-center gap-4" data-testid="learner-performance-chart">
                  <div style={{ width: 160, height: 160 }} className="shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={detail.enrollments.map((e) => ({ title: e.offering_title || e.offering_id, progress: e.progress || 0 }))}
                          dataKey="progress" nameKey="title" innerRadius="55%" outerRadius="85%" paddingAngle={2}
                        >
                          {detail.enrollments.map((e, i) => (
                            <Cell key={e.id} fill={PERFORMANCE_COLORS[i % PERFORMANCE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v}% watched`, "Progress"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-2.5">
                    {detail.enrollments.map((e, i) => {
                      const progress = e.progress || 0;
                      const label = progress >= 100 ? "Completed" : progress > 0 ? "In progress" : "Not started";
                      const busy = busyEnrollmentId === e.id;
                      return (
                        <div key={e.id} className="flex items-center justify-between text-sm gap-3" data-testid={`user-enrollment-${e.id}`}>
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PERFORMANCE_COLORS[i % PERFORMANCE_COLORS.length] }} />
                            <span className="truncate">{e.offering_title || e.offering_id}</span>
                            {e.suspended && <span className="text-[10px] uppercase tracking-wide text-amber-600 border border-amber-600 rounded px-1 shrink-0">Restricted</span>}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-muted-foreground mr-1">{progress}% · {label}</span>
                            {e.suspended ? (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Restore access" disabled={busy}
                                onClick={() => reactivateEnrollment(e)} data-testid={`enrollment-reactivate-${e.id}`}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Restrict access to this course/batch" disabled={busy}
                                onClick={() => suspendEnrollment(e)} data-testid={`enrollment-suspend-${e.id}`}><Ban className="w-3.5 h-3.5" /></Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remove from this course/batch" disabled={busy}
                              onClick={() => removeEnrollment(e)} data-testid={`enrollment-remove-${e.id}`}><UserMinus className="w-3.5 h-3.5" /></Button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">No courses yet.</p>}
            </div>
            <div>
              <div className="eyebrow mb-2">Purchase history ({detail?.payments?.length || 0})</div>
              {(detail?.payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border py-2">
                  <span className="font-mono text-xs">{p.order_id}</span>
                  <span className="text-xs text-muted-foreground">₹{p.amount_inr} · {p.status}</span>
                </div>
              ))}
              {!(detail?.payments || []).length && <p className="text-xs text-muted-foreground">No purchases yet.</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
