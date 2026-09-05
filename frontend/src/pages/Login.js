import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}.`);
      const dest = loc.state?.from ||
        (user.role === "acharya" ? "/acharya" :
         user.role === "academic_staff" ? "/staff" :
         (user.role === "admin" || user.role === "super_admin") ? "/admin" : "/learner");
      nav(dest);
    } catch (err) {
      toast.error(formatApiError(err));
    }
    setBusy(false);
  };

  return (
    <div className="max-w-md mx-auto py-24 px-6">
      <div className="eyebrow mb-3">Sign in</div>
      <h1 className="text-4xl font-serif mb-8">Continue your study.</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="eyebrow">Email</label>
          <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
            data-testid="login-email" className="mt-2 h-12" />
        </div>
        <div>
          <label className="eyebrow">Password</label>
          <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
            data-testid="login-password" className="mt-2 h-12" />
        </div>
        <Button disabled={busy} type="submit" data-testid="login-submit" className="w-full h-12 rounded-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground pt-3">
          New here? <Link to="/register" className="link-underline text-primary">Create an account</Link>
        </p>
        <div className="pt-6 mt-6 border-t border-border text-xs text-muted-foreground">
          <div className="uppercase tracking-widest text-[10px] mb-2">Test accounts (MVP)</div>
          <div>learner@tredevlearn.com / Learner@123</div>
          <div>acharya@tredevlearn.com / Acharya@123</div>
          <div>staff@tredevlearn.com / Staff@123</div>
          <div>staff1@tredevlearn.com / Staff1@123</div>
          <div>admin@tredevlearn.com / Admin@123</div>
          <div>superadmin@tredevlearn.com / SuperAdmin@123</div>

        </div>
      </form>
    </div>
  );
}
