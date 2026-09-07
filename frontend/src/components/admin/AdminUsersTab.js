import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ban, CheckCircle2, Trash2, KeyRound, LogOut, Eye } from "lucide-react";

const ROLES = ["learner", "acharya", "academic_staff", "admin", "super_admin"];

/** Admin Portal — "Users" tab: role changes (existing) + lifecycle actions (new):
 * suspend/reactivate, soft-delete, reset-password email, force-logout, and a
 * profile/purchase-history detail view. */
export default function AdminUsersTab({ users, isSuper, onReload }) {
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const changeRole = async (uid, role) => {
    try {
      await api.patch(`/users/${uid}`, { role });
      toast.success("Role updated.");
      onReload();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const runAction = async (uid, label, fn) => {
    setBusyId(uid);
    try {
      await fn();
      toast.success(label);
      onReload();
    } catch (e) { toast.error(formatApiError(e)); }
    setBusyId(null);
  };

  const suspend = (u) => runAction(u.id, "User suspended.", () => api.patch(`/admin/users/${u.id}/suspend`));
  const reactivate = (u) => runAction(u.id, "User reactivated.", () => api.patch(`/admin/users/${u.id}/reactivate`));
  const forceLogout = (u) => {
    if (!window.confirm(`Force-logout ${u.name}? They'll need to sign in again.`)) return;
    runAction(u.id, "Force-logout applied.", () => api.post(`/admin/users/${u.id}/force-logout`));
  };
  const resetPassword = (u) => runAction(u.id, "Password-reset email sent.", () => api.post(`/admin/users/${u.id}/reset-password`));
  const deleteUser = (u) => {
    if (!window.confirm(`Delete ${u.name}? They will no longer be able to log in. This can be undone by support, not from this screen.`)) return;
    runAction(u.id, "User deleted.", () => api.delete(`/admin/users/${u.id}`));
  };

  const viewDetail = async (u) => {
    setLoadingDetail(true);
    setDetail({ user: u });
    try {
      const { data } = await api.get(`/admin/users/${u.id}/detail`);
      setDetail(data);
    } catch (e) { toast.error(formatApiError(e)); }
    setLoadingDetail(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
          <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
              <TableCell className="font-serif">{u.name}</TableCell>
              <TableCell className="font-mono text-xs">{u.email}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                  <SelectTrigger className="w-40 h-9" data-testid={`role-select-${u.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => {
                      if (r === "super_admin" && !isSuper) return null;
                      return <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {u.is_deleted ? <Badge variant="destructive" className="text-[10px] uppercase">Deleted</Badge>
                  : u.suspended ? <Badge variant="outline" className="text-[10px] uppercase text-amber-600 border-amber-600">Suspended</Badge>
                  : <Badge variant="outline" className="text-[10px] uppercase">Active</Badge>}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1.5">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="View profile & history"
                    onClick={() => viewDetail(u)} data-testid={`user-view-${u.id}`}><Eye className="w-4 h-4" /></Button>
                  {u.suspended ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Reactivate" disabled={busyId === u.id}
                      onClick={() => reactivate(u)} data-testid={`user-reactivate-${u.id}`}><CheckCircle2 className="w-4 h-4" /></Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Suspend" disabled={busyId === u.id}
                      onClick={() => suspend(u)} data-testid={`user-suspend-${u.id}`}><Ban className="w-4 h-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Force logout" disabled={busyId === u.id}
                    onClick={() => forceLogout(u)} data-testid={`user-force-logout-${u.id}`}><LogOut className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset password" disabled={busyId === u.id}
                    onClick={() => resetPassword(u)} data-testid={`user-reset-password-${u.id}`}><KeyRound className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" disabled={busyId === u.id}
                    onClick={() => deleteUser(u)} data-testid={`user-delete-${u.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl" data-testid="user-detail-dialog">
          <DialogHeader><DialogTitle>{detail?.user?.name}</DialogTitle></DialogHeader>
          {loadingDetail ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <div className="eyebrow mb-2">Enrollments ({detail?.enrollments?.length || 0})</div>
                {(detail?.enrollments || []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b border-border py-2">
                    <span>{e.offering_title || e.offering_id}</span>
                    <span className="text-xs text-muted-foreground">{e.progress}% · {e.source || "purchase"}</span>
                  </div>
                ))}
                {!(detail?.enrollments || []).length && <p className="text-xs text-muted-foreground">No courses yet.</p>}
              </div>
              <div>
                <div className="eyebrow mb-2">Payments ({detail?.payments?.length || 0})</div>
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
    </div>
  );
}
