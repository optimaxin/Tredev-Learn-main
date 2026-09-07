import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const EMPTY = { code: "", discount_type: "percent", discount_value: 10, max_uses: "", is_special: false };

/** Super Admin — "Coupons" tab: create/manage discount codes, incl. special/launch ones. */
export default function AdminCouponsTab() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/coupons").then(({ data }) => setCoupons(Array.isArray(data) ? data : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error("Give the coupon a code.");
    setSaving(true);
    try {
      await api.post("/coupons", { ...form, max_uses: form.max_uses ? Number(form.max_uses) : null });
      toast.success("Coupon created.");
      setForm(EMPTY);
      load();
    } catch (e2) { toast.error(formatApiError(e2)); }
    setSaving(false);
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/coupons/${c.id}`, { active: !c.active });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await api.delete(`/coupons/${c.id}`);
      toast.success("Coupon deleted.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-lg border border-border bg-card/60 p-4 grid md:grid-cols-5 gap-3 items-end" data-testid="coupon-form">
        <div className="md:col-span-1">
          <label className="eyebrow">Code</label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="mt-1 h-10" placeholder="LAUNCH50" data-testid="coupon-code-input" />
        </div>
        <div>
          <label className="eyebrow">Type</label>
          <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
            <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">% off</SelectItem>
              <SelectItem value="flat_inr">Flat ₹ off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="eyebrow">Value</label>
          <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
            className="mt-1 h-10" data-testid="coupon-value-input" />
        </div>
        <div>
          <label className="eyebrow">Max uses</label>
          <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            className="mt-1 h-10" placeholder="Unlimited" data-testid="coupon-max-uses-input" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_special} onChange={(e) => setForm({ ...form, is_special: e.target.checked })}
              data-testid="coupon-special-input" />
            Special / launch
          </label>
          <Button type="submit" disabled={saving} className="h-10 rounded-full bg-gradient-hot text-white border-0" data-testid="coupon-submit-btn">
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Uses</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {coupons.map((c) => (
              <TableRow key={c.id} data-testid={`coupon-row-${c.id}`}>
                <TableCell className="font-mono">{c.code} {c.is_special && <Badge className="ml-2 text-[9px] uppercase">Special</Badge>}</TableCell>
                <TableCell>{c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}</TableCell>
                <TableCell>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                <TableCell><Badge variant={c.active ? "default" : "outline"} className="text-[10px] uppercase">{c.active ? "Active" : "Disabled"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(c)} data-testid={`coupon-toggle-${c.id}`}>{c.active ? "Disable" : "Enable"}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)} data-testid={`coupon-delete-${c.id}`}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {!coupons.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No coupons yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
