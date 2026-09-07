import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const TILES = [
  { key: "revenue_inr", label: "Revenue", prefix: "₹" },
  { key: "transactions", label: "Transactions" },
  { key: "pending_payments", label: "Pending payments" },
  { key: "failed_payments", label: "Failed payments" },
];

/** Admin Portal — "Dashboard" tab: revenue/transactions/pending/failed tiles,
 * revenue-by-course chart, and a top-performing-courses list. */
export default function AdminDashboardTab() {
  const [stats, setStats] = useState(null);
  const [topCourses, setTopCourses] = useState([]);

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/top-courses").then(({ data }) => setTopCourses(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  if (!stats) return <div className="text-sm text-muted-foreground py-8 text-center">Loading dashboard…</div>;

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

      <div>
        <div className="eyebrow mb-3">Revenue by course</div>
        <div
          className="rounded-lg border border-border bg-card/60 p-4"
          style={{ height: Math.max(288, (stats.revenue_by_course?.length || 0) * 40) }}
          data-testid="revenue-by-course-chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.revenue_by_course} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="title"
                width={180}
                tick={{ fontSize: 11 }}
                tickFormatter={(title) => (title.length > 22 ? `${title.slice(0, 22)}…` : title)}
                interval={0}
              />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} labelFormatter={(title) => title} />
              <Bar dataKey="revenue_inr" fill="var(--primary, #8b5cf6)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-3">Top-performing courses (by enrollments)</div>
        <div className="rounded-lg border border-border bg-card/60 divide-y divide-border">
          {topCourses.map((c, i) => (
            <div key={c.offering_id} className="flex items-center justify-between px-4 py-3 text-sm" data-testid={`top-course-${c.offering_id}`}>
              <span>{i + 1}. {c.title}</span>
              <span className="text-muted-foreground">{c.enrollments} enrolled</span>
            </div>
          ))}
          {!topCourses.length && <div className="px-4 py-6 text-sm text-muted-foreground text-center">No enrollments yet.</div>}
        </div>
      </div>
    </div>
  );
}
