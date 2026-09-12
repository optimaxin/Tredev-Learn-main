import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

const STATUS_VARIANT = { paid: "default", created: "outline", failed: "destructive" };

/** Admin-only: "did this learner's payment actually go through?" — a read-only
 * look at their payment status (not the total amount) so an escalated
 * "I paid but got no access" query can be verified before granting access. */
export default function UserPaymentStatusDialog({ userId }) {
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${userId}/detail`);
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) {
      toast.error(formatApiError(e));
      setPayments([]);
    }
    setLoading(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" onClick={load} data-testid="payment-status-btn">
        <Receipt className="w-3.5 h-3.5 mr-1.5" /> Payment status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="payment-status-dialog">
          <DialogHeader><DialogTitle>Payment status</DialogTitle></DialogHeader>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {(payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border py-2" data-testid={`payment-status-row-${p.id}`}>
                  <div>
                    <div className="font-mono text-xs">{p.order_id}</div>
                    <div className="text-xs text-muted-foreground">₹{p.amount_inr}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[p.status] || "outline"} className="text-[10px] uppercase">{p.status}</Badge>
                    {p.status === "paid" && (
                      <Badge variant={p.signature_verified ? "default" : "outline"} className="text-[10px] uppercase">
                        {p.signature_verified ? "Verified" : "Unverified"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {!(payments || []).length && <p className="text-sm text-muted-foreground text-center py-6">No payments found for this learner.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
