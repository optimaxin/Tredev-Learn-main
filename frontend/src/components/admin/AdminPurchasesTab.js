import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

const STATUS_VARIANT = { paid: "default", created: "outline", failed: "destructive" };

/** Admin Portal — "Purchases" tab: the course purchase log/dashboard. Search by
 * order id / learner email / course, plus a payment-status filter — the email
 * and order id are always shown so a payment can be verified against what the
 * learner reports paying. */
export default function AdminPurchasesTab() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    api.get("/admin/purchases").then(({ data }) => setPurchases(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      return [p.order_id, p.user_email, p.user_name, p.offering_title].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [purchases, search, status]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order id, email, course…" className="pl-9 h-10" data-testid="purchases-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 h-10" data-testid="purchases-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="created">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order ID</TableHead><TableHead>Learner</TableHead><TableHead>Email</TableHead><TableHead>Course</TableHead>
            <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Verified</TableHead><TableHead>Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} data-testid={`purchase-row-${p.id}`}>
                <TableCell className="font-mono text-xs">{p.order_id}</TableCell>
                <TableCell className="text-xs">{p.user_name}</TableCell>
                <TableCell className="font-mono text-xs">{p.user_email}</TableCell>
                <TableCell>{p.offering_title}</TableCell>
                <TableCell>₹{p.amount_inr}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[p.status] || "outline"} className="text-[10px] uppercase">{p.status}</Badge></TableCell>
                <TableCell>
                  {p.status === "paid" ? (
                    <Badge variant={p.signature_verified ? "default" : "outline"} className="text-[10px] uppercase">
                      {p.signature_verified ? "Verified" : "Unverified"}
                    </Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                {purchases.length ? "No purchases match your search." : "No purchases yet."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
