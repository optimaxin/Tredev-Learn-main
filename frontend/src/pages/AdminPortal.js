import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const CAPABILITIES = ["course_builder", "quiz_author", "grader", "doubts", "consultations", "cohorts"];
const ROLES = ["learner", "acharya", "academic_staff", "admin", "super_admin"];

export default function AdminPortal() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const isSuper = user?.role === "super_admin";

  const load = async () => {
    const [u, g, a, o, f] = await Promise.all([
      api.get("/users"),
      api.get("/capabilities"),
      api.get("/audit-log"),
      api.get("/offerings?published_only=false"),
      api.get("/festivals"),
    ]);
    setUsers(u.data); setGrants(g.data); setAudit(a.data); setOfferings(o.data); setFestivals(f.data);
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (uid, role) => {
    try {
      await api.patch(`/users/${uid}`, { role });
      toast.success("Role updated.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const staff = users.filter((u) => u.role === "academic_staff");
  const hasGrant = (staffId, cap) => grants.some((g) => g.staff_id === staffId && g.capability === cap);
  const findGrant = (staffId, cap) => grants.find((g) => g.staff_id === staffId && g.capability === cap);

  const toggleGrant = async (staffId, cap, on) => {
    try {
      if (on) {
        await api.post("/capabilities", { staff_id: staffId, capability: cap, scope: ["*"] });
      } else {
        const g = findGrant(staffId, cap);
        if (g) await api.delete(`/capabilities/${g.id}`);
      }
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const publishOffering = async (o) => {
    try {
      await api.patch(`/offerings/${o.id}`, { is_published: !o.is_published });
      toast.success(!o.is_published ? "Published." : "Unpublished.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const issueCert = async (learnerId, offeringId) => {
    try {
      const { data } = await api.post("/certificates/issue", { user_id: learnerId, offering_id: offeringId });
      toast.success(`Issued ${data.code}`);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="site-container py-12">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="overline mb-1">{isSuper ? "Super Admin" : "Admin"} portal</div>
          <h1 className="text-4xl font-serif tracking-tight">Everything.</h1>
        </div>
        {isSuper && <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest ml-auto">Super Admin authority</Badge>}
      </div>

      <Tabs defaultValue="capabilities" className="mt-10">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="capabilities" data-testid="admin-tab-capabilities">Capability grants</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="publishing" data-testid="admin-tab-publishing">Publishing ({offerings.length})</TabsTrigger>
          <TabsTrigger value="festivals" data-testid="admin-tab-festivals">Festival calendar</TabsTrigger>
          <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit log</TabsTrigger>
        </TabsList>

        {/* Capability matrix */}
        <TabsContent value="capabilities" className="mt-8">
          <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  {CAPABILITIES.map((c)=>(<TableHead key={c} className="text-center capitalize">{c.replace("_"," ")}</TableHead>))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s)=>(
                  <TableRow key={s.id} data-testid={`staff-row-${s.id}`}>
                    <TableCell className="font-serif">{s.name}<div className="text-xs text-muted-foreground font-sans">{s.email}</div></TableCell>
                    {CAPABILITIES.map((c)=>(
                      <TableCell key={c} className="text-center">
                        <Switch checked={hasGrant(s.id, c)} onCheckedChange={(v)=>toggleGrant(s.id,c,v)} data-testid={`grant-${s.id}-${c}`} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow><TableCell colSpan={CAPABILITIES.length+1} className="text-center text-muted-foreground py-8">
                    No academic staff yet. Change a user's role to <code className="mx-1 px-1 py-0.5 bg-muted rounded">academic_staff</code> in the Users tab.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Access here is granted capability by capability. Two staff members can share this portal and see entirely different tools. This MVP grants at scope <code>*</code>; per-offering scoping is a next-phase enhancement.
          </p>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-8">
          <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Change role</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {users.map((u)=>(
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell className="font-serif">{u.name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase tracking-widest text-[10px]">{u.role.replace("_"," ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Select value={u.role} onValueChange={(v)=>changeRole(u.id, v)}>
                        <SelectTrigger className="w-44 h-9 ml-auto" data-testid={`role-select-${u.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r)=>{
                            if (r === "super_admin" && !isSuper) return null;
                            return <SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Publishing */}
        <TabsContent value="publishing" className="mt-8 space-y-3">
          {offerings.map((o)=>(
            <div key={o.id} className="rounded-lg border border-border p-4 bg-card/60 flex items-center gap-4" data-testid={`pub-row-${o.id}`}>
              <div className="flex-1">
                <div className="font-serif text-lg">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.subject} · {o.type.replace("_"," ")}</div>
              </div>
              <Badge variant={o.approved_by_acharya ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                {o.approved_by_acharya ? "Ācharya ✓" : "No sign-off"}
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs">{o.is_published ? "Live" : "Draft"}</span>
                <Switch checked={!!o.is_published} onCheckedChange={()=>publishOffering(o)} data-testid={`publish-${o.id}`} />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">Guarantee: an Ācharya's name is never shown as approving a course they haven't signed off on.</p>
        </TabsContent>

        {/* Festivals */}
        <TabsContent value="festivals" className="mt-8">
          <div className="grid md:grid-cols-2 gap-4">
            {festivals.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-6 bg-card/60">
                <div className="overline text-primary">{f.date}</div>
                <div className="font-serif text-2xl mt-1">{f.name}</div>
                <p className="text-sm text-muted-foreground mt-2">{f.significance}</p>
                <Badge variant="outline" className="mt-3 text-[10px] uppercase tracking-widest">{f.related_offering_subject}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="mt-8">
          <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {audit.map((a)=>(
                  <TableRow key={a.id} data-testid={`audit-row-${a.id}`}>
                    <TableCell className="font-mono text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{a.actor_email} <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-widest">{a.actor_role}</Badge></TableCell>
                    <TableCell><code className="text-xs">{a.action}</code></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.target}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Every privileged action is written to an immutable audit log.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
