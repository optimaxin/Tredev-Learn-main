import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminCoursesTab from "@/components/admin/AdminCoursesTab";
import AdminDashboardTab from "@/components/admin/AdminDashboardTab";
import AdminPurchasesTab from "@/components/admin/AdminPurchasesTab";
import AdminCouponsTab from "@/components/admin/AdminCouponsTab";
import AdminCreateAdminTab from "@/components/admin/AdminCreateAdminTab";
import QueriesStaff from "@/components/queries/QueriesStaff";

const CAPABILITIES = ["course_builder", "offerings", "quiz_author", "assessment_author", "session_author", "webinars", "mantras", "certs", "queries", "mentors", "calendar", "journal_author", "grader", "doubts", "consultations", "manual_access_grant"];
const CAPABILITY_LABELS = {
  course_builder: "Course builder",
  offerings: "All offerings",
  quiz_author: "Quizzes",
  assessment_author: "Assessments",
  session_author: "Live sessions",
  webinars: "Webinars",
  mantras: "Mantras",
  certs: "Certificates",
  queries: "Queries",
  mentors: "Mentors",
  calendar: "Festival calendar",
  journal_author: "Journal",
  grader: "Grading",
  doubts: "Doubts",
  consultations: "Consultations",
  manual_access_grant: "Manual course access grants",
};
const FEATURE_LABELS = {
  build: "Course builder",
  offerings: "All offerings",
  sessions: "Live sessions",
  webinars: "Webinars",
  verses: "Verses",
  mantras: "Mantras",
  "content-review": "Ācharya content review",
  doubts: "Doubts",
  certs: "Certificates",
  consultations: "Consultations",
  quizzes: "Quizzes",
  assessments: "Assessments",
  journal: "Journal (Blog)",
  grading: "Grading",
  queries: "Queries",
  mentors: "Mentors",
  calendar: "Festival calendar",
  community_chat: "Community Chat",
};

export default function AdminPortal() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [features, setFeatures] = useState([]);
  const isSuper = user?.role === "super_admin";

  const load = async () => {
    const [u, g, a, o, f, ft] = await Promise.all([
      api.get("/users").catch(() => ({ data: [] })),
      api.get("/capabilities").catch(() => ({ data: [] })),
      api.get("/audit-log").catch(() => ({ data: [] })),
      api.get("/offerings?published_only=false").catch(() => ({ data: [] })),
      api.get("/festivals").catch(() => ({ data: [] })),
      api.get("/feature-toggles").catch(() => ({ data: [] })),
    ]);
    const arr = (x) => (Array.isArray(x.data) ? x.data : []);
    setUsers(arr(u)); setGrants(arr(g)); setAudit(arr(a)); setOfferings(arr(o)); setFestivals(arr(f)); setFeatures(arr(ft));
  };
  useEffect(() => { load(); }, []);

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

  const toggleFeature = async (key, on) => {
    try {
      await api.patch(`/feature-toggles/${key}`, { enabled: on });
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
          <div className="eyebrow mb-1">{isSuper ? "Super Admin" : "Admin"} portal</div>
          <h1 className="text-4xl font-serif tracking-tight">Everything.</h1>
        </div>
        {isSuper && <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest ml-auto">Super Admin authority</Badge>}
      </div>

      <Tabs defaultValue={isSuper ? "dashboard" : "queries"} className="mt-10">
        <TabsList className="flex-wrap h-auto">
          {isSuper && <TabsTrigger value="dashboard" data-testid="admin-tab-dashboard">Dashboard</TabsTrigger>}
          {isSuper && <TabsTrigger value="purchases" data-testid="admin-tab-purchases">Purchases</TabsTrigger>}
          <TabsTrigger value="queries" data-testid="admin-tab-queries">Queries</TabsTrigger>
          <TabsTrigger value="features" data-testid="admin-tab-features">Feature toggles</TabsTrigger>
          <TabsTrigger value="capabilities" data-testid="admin-tab-capabilities">Capability grants</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="publishing" data-testid="admin-tab-publishing">Courses ({offerings.length})</TabsTrigger>
          <TabsTrigger value="festivals" data-testid="admin-tab-festivals">Festival calendar</TabsTrigger>
          <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit log</TabsTrigger>
          {isSuper && <TabsTrigger value="coupons" data-testid="admin-tab-coupons">Coupons</TabsTrigger>}
          {isSuper && <TabsTrigger value="create-admin" data-testid="admin-tab-create-admin">Create admin</TabsTrigger>}
        </TabsList>

        {isSuper && <TabsContent value="dashboard" className="mt-8"><AdminDashboardTab /></TabsContent>}
        {isSuper && <TabsContent value="purchases" className="mt-8"><AdminPurchasesTab /></TabsContent>}
        <TabsContent value="queries" className="mt-8"><QueriesStaff /></TabsContent>
        {isSuper && <TabsContent value="coupons" className="mt-8"><AdminCouponsTab /></TabsContent>}
        {isSuper && <TabsContent value="create-admin" className="mt-8"><AdminCreateAdminTab onCreated={load} /></TabsContent>}

        {/* Feature toggles */}
        <TabsContent value="features" className="mt-8">
          <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f)=>(
                  <TableRow key={f.key} data-testid={`feature-row-${f.key}`}>
                    <TableCell className="font-serif">{FEATURE_LABELS[f.key] || f.key}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={f.enabled} onCheckedChange={(v)=>toggleFeature(f.key,v)} data-testid={`feature-toggle-${f.key}`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Turning a feature off hides it from the Staff Panel and blocks its API for everyone, immediately.
          </p>
        </TabsContent>

        {/* Capability matrix */}
        <TabsContent value="capabilities" className="mt-8">
          <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  {CAPABILITIES.map((c)=>(<TableHead key={c} className="text-center">{CAPABILITY_LABELS[c] || c.replace("_"," ")}</TableHead>))}
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
          <AdminUsersTab users={users} isSuper={isSuper} onReload={load} />
        </TabsContent>

        {/* Courses */}
        <TabsContent value="publishing" className="mt-8">
          <AdminCoursesTab offerings={offerings} onReload={load} />
        </TabsContent>

        {/* Festivals */}
        <TabsContent value="festivals" className="mt-8">
          <div className="grid md:grid-cols-2 gap-4">
            {festivals.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-6 bg-card/60">
                <div className="eyebrow text-primary">{f.date}</div>
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
