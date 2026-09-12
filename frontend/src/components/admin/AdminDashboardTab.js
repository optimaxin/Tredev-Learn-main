import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const TILES = [
  { key: "revenue_inr", label: "Total revenue (courses + webinars)", prefix: "₹" },
  { key: "transactions", label: "Transactions" },
  { key: "pending_payments", label: "Pending payments" },
  { key: "failed_payments", label: "Failed payments" },
];

const SLICE_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7", "#eab308", "#06b6d4"];

/** Admin Portal — "Dashboard" tab: always-visible revenue/transactions/pending/
 * failed tiles (revenue combined across courses + webinars), then a
 * Courses/Webinars toggle switching between the course revenue donut + top
 * courses, and a webinar monthly bar chart + per-webinar attendance/earnings. */
export default function AdminDashboardTab() {
  const [stats, setStats] = useState(null);
  const [topCourses, setTopCourses] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [webinarReport, setWebinarReport] = useState(null);
  const [webinarDetail, setWebinarDetail] = useState(null);
  const [loadingWebinarDetail, setLoadingWebinarDetail] = useState(false);
  const [mode, setMode] = useState("courses");

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/top-courses").then(({ data }) => setTopCourses(Array.isArray(data) ? data : [])).catch(() => {});
    api.get("/admin/webinars-report").then(({ data }) => setWebinarReport(data)).catch(() => {});
  }, []);

  const openCourseReport = async (offeringId) => {
    setLoadingReport(true);
    setReport({ offering_id: offeringId });
    try {
      const { data } = await api.get(`/admin/course/${offeringId}/report`);
      setReport(data);
    } catch (e) {
      toast.error(formatApiError(e));
      setReport(null);
    }
    setLoadingReport(false);
  };

  const openWebinarReport = async (webinarId) => {
    setLoadingWebinarDetail(true);
    setWebinarDetail({ webinar_id: webinarId });
    try {
      const { data } = await api.get(`/admin/webinar/${webinarId}/report`);
      setWebinarDetail(data);
    } catch (e) {
      toast.error(formatApiError(e));
      setWebinarDetail(null);
    }
    setLoadingWebinarDetail(false);
  };

  if (!stats) return <div className="text-sm text-muted-foreground py-8 text-center">Loading dashboard…</div>;

  const slices = stats.revenue_by_course || [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TILES.map((t) => (
          <div key={t.key} className="rounded-lg border border-border bg-card/60 p-4" data-testid={`dashboard-tile-${t.key}`}>
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="text-2xl font-serif mt-1">{t.prefix || ""}{(stats[t.key] ?? 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="inline-flex rounded-full border border-border p-1 bg-card/60" data-testid="dashboard-mode-toggle">
        <button type="button" onClick={() => setMode("courses")} data-testid="dashboard-mode-courses"
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === "courses" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Courses
        </button>
        <button type="button" onClick={() => setMode("webinars")} data-testid="dashboard-mode-webinars"
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === "webinars" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Webinars
        </button>
      </div>

      {mode === "courses" ? (
        <>
          <div className="rounded-lg border border-border bg-card/60 p-4 max-w-xs" data-testid="dashboard-tile-course_revenue_inr">
            <div className="text-xs text-muted-foreground">Course revenue</div>
            <div className="text-2xl font-serif mt-1">₹{(stats.course_revenue_inr ?? 0).toLocaleString()}</div>
          </div>

          <div>
            <div className="eyebrow mb-3">Revenue by course — click a slice for details</div>
            <div className="rounded-lg border border-border bg-card/60 p-4" style={{ height: 360 }} data-testid="revenue-by-course-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices} dataKey="revenue_inr" nameKey="title"
                    cx="35%" innerRadius="55%" outerRadius="85%" paddingAngle={2}
                    onClick={(d) => openCourseReport(d.offering_id)}
                    cursor="pointer"
                  >
                    {slices.map((s, i) => (
                      <Cell key={s.offering_id} fill={SLICE_COLORS[i % SLICE_COLORS.length]} data-testid={`revenue-slice-${s.offering_id}`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                  <Legend layout="vertical" verticalAlign="middle" align="right"
                    wrapperStyle={{ fontSize: 11, right: 12, top: "58%", transform: "translateY(-45%)", maxWidth: "46%", lineHeight: "22px" }} />
                </PieChart>
              </ResponsiveContainer>
              {!slices.length && <div className="text-sm text-muted-foreground text-center -mt-40">No revenue yet.</div>}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-3">Top-performing courses (by enrollments)</div>
            <div className="rounded-lg border border-border bg-card/60 divide-y divide-border">
              {topCourses.map((c, i) => (
                <button key={c.offering_id} onClick={() => openCourseReport(c.offering_id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 text-left"
                  data-testid={`top-course-${c.offering_id}`}>
                  <span>{i + 1}. {c.title}</span>
                  <span className="text-muted-foreground">{c.enrollments} enrolled</span>
                </button>
              ))}
              {!topCourses.length && <div className="px-4 py-6 text-sm text-muted-foreground text-center">No enrollments yet.</div>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card/60 p-4" data-testid="webinar-total-registered">
              <div className="text-xs text-muted-foreground">People joined (all webinars)</div>
              <div className="text-2xl font-serif mt-1">{(webinarReport?.total_registered ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-4" data-testid="dashboard-tile-webinar_revenue_inr">
              <div className="text-xs text-muted-foreground">Webinar revenue</div>
              <div className="text-2xl font-serif mt-1">₹{(stats.webinar_revenue_inr ?? 0).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <div className="eyebrow mb-3">Webinars conducted per month</div>
            <div className="rounded-lg border border-border bg-card/60 p-4" style={{ height: 320 }} data-testid="webinar-monthly-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={webinarReport?.monthly || []} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue_inr" name="Revenue (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="registered_count" name="People joined" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="webinars_conducted" name="Webinars conducted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!(webinarReport?.monthly || []).length && <div className="text-sm text-muted-foreground text-center -mt-32">No webinars yet.</div>}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-3">Webinars — click one for who joined</div>
            <div className="rounded-lg border border-border bg-card/60 divide-y divide-border">
              {(webinarReport?.webinars || []).map((w) => (
                <button key={w.webinar_id} onClick={() => openWebinarReport(w.webinar_id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50 text-left flex-wrap"
                  data-testid={`webinar-row-${w.webinar_id}`}>
                  <span className="font-medium">{w.title}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {w.starts_at ? new Date(w.starts_at).toLocaleString() : "TBA"} · {w.duration_min} min
                  </span>
                  <span className="text-xs text-muted-foreground tabular">₹{w.price_inr} · {w.registered_count} joined · ₹{w.revenue_inr.toLocaleString()} earned</span>
                </button>
              ))}
              {!(webinarReport?.webinars || []).length && <div className="px-4 py-6 text-sm text-muted-foreground text-center">No webinars yet.</div>}
            </div>
          </div>
        </>
      )}

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="max-w-2xl" data-testid="course-report-dialog">
          <DialogHeader><DialogTitle>{report?.title || "Course report"}</DialogTitle></DialogHeader>
          {loadingReport || !report?.monthly ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Total revenue</div>
                  <div className="text-lg font-serif mt-1">₹{report.total_revenue_inr.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Total enrolled</div>
                  <div className="text-lg font-serif mt-1">{report.total_enrollments}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Top-seller rank</div>
                  <div className="text-lg font-serif mt-1">#{report.revenue_rank} / {report.revenue_rank_of}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Enrollment rank</div>
                  <div className="text-lg font-serif mt-1">#{report.enrollment_rank} / {report.enrollment_rank_of}</div>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-2">Monthly sales (revenue &amp; enrollments)</div>
                <div style={{ height: 240 }} data-testid="course-report-monthly-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.monthly} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue_inr" name="Revenue (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="enrollments" name="Enrollments" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {!report.monthly.length && <div className="text-sm text-muted-foreground text-center -mt-32">No monthly activity yet.</div>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!webinarDetail} onOpenChange={(o) => !o && setWebinarDetail(null)}>
        <DialogContent className="max-w-2xl" data-testid="webinar-report-dialog">
          <DialogHeader><DialogTitle>{webinarDetail?.title || "Webinar report"}</DialogTitle></DialogHeader>
          {loadingWebinarDetail || !webinarDetail?.attendees ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Session time</div>
                  <div className="text-sm font-serif mt-1">{webinarDetail.starts_at ? new Date(webinarDetail.starts_at).toLocaleString() : "TBA"}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="text-lg font-serif mt-1">₹{webinarDetail.price_inr}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">People joined</div>
                  <div className="text-lg font-serif mt-1">{webinarDetail.registered_count}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-lg font-serif mt-1">₹{webinarDetail.revenue_inr.toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-2">Who joined ({webinarDetail.attendees.length})</div>
                <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                  {webinarDetail.attendees.map((a) => (
                    <div key={a.user_id} className="px-4 py-2.5 text-sm flex items-center justify-between" data-testid={`webinar-attendee-${a.user_id}`}>
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{a.email}</span>
                    </div>
                  ))}
                  {!webinarDetail.attendees.length && <div className="px-4 py-6 text-sm text-muted-foreground text-center">Nobody's joined yet.</div>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
