import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT = { paid: "default", created: "outline", failed: "destructive" };

/** Admin Portal — "Purchases" tab: the course purchase log/dashboard. */
export default function AdminPurchasesTab() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/purchases").then(({ data }) => setPurchases(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Order</TableHead><TableHead>Learner</TableHead><TableHead>Course</TableHead>
          <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {purchases.map((p) => (
            <TableRow key={p.id} data-testid={`purchase-row-${p.id}`}>
              <TableCell className="font-mono text-xs">{p.order_id}</TableCell>
              <TableCell className="text-xs">{p.user_name || p.user_email}</TableCell>
              <TableCell>{p.offering_title}</TableCell>
              <TableCell>₹{p.amount_inr}</TableCell>
              <TableCell><Badge variant={STATUS_VARIANT[p.status] || "outline"} className="text-[10px] uppercase">{p.status}</Badge></TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {!purchases.length && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No purchases yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
