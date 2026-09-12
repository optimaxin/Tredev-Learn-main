import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import { toast } from "sonner";
import { Ban, CheckCircle2, Trash2, KeyRound, LogOut, Search } from "lucide-react";

const ROLES = ["learner", "acharya", "academic_staff", "admin", "super_admin"];

/** Admin Portal — "Users" tab: role changes (existing) + lifecycle actions (new):
 * suspend/reactivate, soft-delete, reset-password email, force-logout, and a
 * profile/purchase-history detail view. */
export default function AdminUsersTab({ users, isSuper, onReload }) {
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  useEffect(() => {
    api.get("/offerings", { params: { published_only: false } }).then(({ data }) => setCourses(Array.isArray(data) ? data : [])).catch(() => {});
    api.get("/admin/enrollments-index").then(({ data }) => setEnrollments(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setBatchFilter("all");
    if (courseFilter === "all") { setBatches([]); return; }
    api.get("/batches", { params: { offering_id: courseFilter } }).then(({ data }) => setBatches(Array.isArray(data) ? data : [])).catch(() => setBatches([]));
  }, [courseFilter]);

  // Learners enrolled in the selected course (and, if picked, the selected batch within it).
  const enrolledUserIds = useMemo(() => {
    if (courseFilter === "all") return null;
    const ids = new Set(
      enrollments
        .filter((e) => e.offering_id === courseFilter && (batchFilter === "all" || e.batch_id === batchFilter))
        .map((e) => e.user_id)
    );
    return ids;
  }, [enrollments, courseFilter, batchFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (enrolledUserIds && !enrolledUserIds.has(u.id)) return false;
      if (!q) return true;
      return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    });
  }, [users, search, roleFilter, enrolledUserIds]);

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…" className="pl-9 h-10" data-testid="users-search" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48 h-10" data-testid="users-role-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-56 h-10" data-testid="users-course-filter"><SelectValue placeholder="All courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {courseFilter !== "all" && (
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-48 h-10" data-testid="users-batch-filter"><SelectValue placeholder="All batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
    <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="whitespace-nowrap">Name</TableHead><TableHead className="whitespace-nowrap">Email</TableHead><TableHead className="whitespace-nowrap">Role</TableHead>
          <TableHead className="whitespace-nowrap">Status</TableHead><TableHead className="text-right whitespace-nowrap">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {filtered.map((u) => {
            // Only super_admin may touch a super_admin account — role change,
            // suspend, delete, force-logout, reset-password, all of it. The
            // backend enforces this too; this just keeps the UI honest about it.
            const locked = u.role === "super_admin" && !isSuper;
            return (
            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
              <TableCell className="font-serif whitespace-nowrap">{u.name}</TableCell>
              <TableCell className="font-mono text-xs whitespace-nowrap">{u.email}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={locked}>
                  <SelectTrigger className="w-40 h-9 shrink-0" data-testid={`role-select-${u.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} disabled={r === "super_admin" && !isSuper}>
                        {r.replace("_", " ")}
                      </SelectItem>
                    ))}
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
                  <UserDetailDialog user={u} />
                  {u.suspended ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Reactivate" disabled={locked || busyId === u.id}
                      onClick={() => reactivate(u)} data-testid={`user-reactivate-${u.id}`}><CheckCircle2 className="w-4 h-4" /></Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Suspend" disabled={locked || busyId === u.id}
                      onClick={() => suspend(u)} data-testid={`user-suspend-${u.id}`}><Ban className="w-4 h-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Force logout" disabled={locked || busyId === u.id}
                    onClick={() => forceLogout(u)} data-testid={`user-force-logout-${u.id}`}><LogOut className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset password" disabled={locked || busyId === u.id}
                    onClick={() => resetPassword(u)} data-testid={`user-reset-password-${u.id}`}><KeyRound className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" disabled={locked || busyId === u.id}
                    onClick={() => deleteUser(u)} data-testid={`user-delete-${u.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!filtered.length && users.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No users match your search.</p>
      )}
    </div>
    </div>
  );
}
