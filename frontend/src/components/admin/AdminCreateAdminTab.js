import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const EMPTY = { name: "", email: "", password: "" };

/** Super Admin — "Create admin" tab: direct admin-account creation (today the
 * only alternative is self-register as a learner + promote via the Users tab). */
export default function AdminCreateAdminTab({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      return toast.error("Name, email, and a 6+ character password are required.");
    }
    setSaving(true);
    try {
      await api.post("/admin/create-admin", form);
      toast.success(`Admin account created for ${form.email}.`);
      setForm(EMPTY);
      onCreated && onCreated();
    } catch (e2) { toast.error(formatApiError(e2)); }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card/60 p-6 max-w-md space-y-4" data-testid="create-admin-form">
      <div>
        <label className="eyebrow">Name</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 h-11" data-testid="create-admin-name" />
      </div>
      <div>
        <label className="eyebrow">Email</label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 h-11" data-testid="create-admin-email" />
      </div>
      <div>
        <label className="eyebrow">Temporary password</label>
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 h-11" data-testid="create-admin-password" />
      </div>
      <Button type="submit" disabled={saving} className="w-full rounded-full h-11 bg-gradient-hot text-white border-0" data-testid="create-admin-submit">
        {saving ? "Creating…" : "Create admin account"}
      </Button>
      <p className="text-xs text-muted-foreground">The new admin can sign in immediately with this password — send it to them securely.</p>
    </form>
  );
}
