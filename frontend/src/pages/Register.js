import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(email, password, name);
      toast.success("Welcome to Tredev Learn.");
      nav("/learner");
    } catch (err) { toast.error(formatApiError(err)); }
    setBusy(false);
  };

  return (
    <div className="max-w-md mx-auto py-24 px-6">
      <div className="eyebrow mb-3">Join</div>
      <h1 className="text-4xl font-serif mb-8">Begin.</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="eyebrow">Full name</label>
          <Input value={name} onChange={(e)=>setName(e.target.value)} required
            data-testid="register-name" className="mt-2 h-12" />
        </div>
        <div>
          <label className="eyebrow">Email</label>
          <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
            data-testid="register-email" className="mt-2 h-12" />
        </div>
        <div>
          <label className="eyebrow">Password (min 6)</label>
          <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={6}
            data-testid="register-password" className="mt-2 h-12" />
        </div>
        <Button disabled={busy} type="submit" data-testid="register-submit" className="w-full h-12 rounded-full">
          {busy ? "Creating…" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground pt-3">
          Already have an account? <Link to="/login" className="link-underline text-primary">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
