import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/lib/api";
import { sendPhoneOtp, confirmPhoneOtp } from "@/lib/firebaseClient";
import { Mail, Phone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const GoogleIcon = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.8Z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"/>
    <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z"/>
    <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"/>
  </svg>
);

export default function Login() {
  const { login, loginWithGoogle, loginWithPhone, resendVerification, verifyOtp } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState("choose"); // choose | email | phone-number | phone-code
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");

  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const destFor = (user) => loc.state?.from ||
    (user.role === "acharya" ? "/acharya" :
     user.role === "academic_staff" ? "/staff" :
     (user.role === "admin" || user.role === "super_admin") ? "/admin" : "/learner");

  const back = () => setStep("choose");

  const submitGoogle = async () => {
    setBusy(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Welcome, ${user.name}.`);
      nav(destFor(user));
    } catch (err) { toast.error(err?.message || formatApiError(err) || "Google sign-in failed."); }
    setBusy(false);
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNeedsVerification(false);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}.`);
      nav(destFor(user));
    } catch (err) {
      if (err?.response?.data?.detail === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        toast.error("Please verify your email before signing in.");
      } else {
        toast.error(formatApiError(err));
      }
    }
    setBusy(false);
  };

  const resend = async () => {
    setResending(true);
    try {
      const data = await resendVerification(email, password);
      toast.success(data.email_verification_sent ? "Code re-sent — check your inbox." : "Couldn't send the code — try again shortly.");
    } catch (err) { toast.error(formatApiError(err)); }
    setResending(false);
  }

  const submitVerifyCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyOtp(email, verifyCode);
      const user = await login(email, password);
      toast.success(`Welcome, ${user.name}.`);
      nav(destFor(user));
    } catch (err) { toast.error(formatApiError(err) || "Invalid or expired code."); }
    setBusy(false);
  };

  const sendPhoneCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await sendPhoneOtp(phone, "recaptcha-container");
      setConfirmation(result);
      setStep("phone-code");
      toast.success("Code sent via SMS.");
    } catch (err) { toast.error(err?.message || "Couldn't send the SMS code. Check the number and try again."); }
    setBusy(false);
  };

  const confirmPhoneCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const idToken = await confirmPhoneOtp(confirmation, phoneCode);
      const user = await loginWithPhone(idToken);
      toast.success(`Welcome, ${user.name}.`);
      nav(destFor(user));
    } catch (err) { toast.error(err?.message || formatApiError(err) || "Invalid code."); }
    setBusy(false);
  };

  const BackLink = () => (
    <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (step === "choose") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <div className="eyebrow mb-3">Sign in</div>
        <h1 className="text-4xl font-serif mb-8">Continue your study.</h1>
        <div className="space-y-3">
          <Button type="button" variant="outline" disabled={busy} onClick={submitGoogle}
            data-testid="login-google" className="w-full h-12 rounded-full justify-center gap-3">
            <GoogleIcon /> Continue with Google
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("phone-number")}
            data-testid="login-phone" className="w-full h-12 rounded-full justify-center gap-3">
            <Phone className="h-4 w-4" /> Continue with phone
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("email")}
            data-testid="login-email-choice" className="w-full h-12 rounded-full justify-center gap-3">
            <Mail className="h-4 w-4" /> Continue with email
          </Button>
        </div>
        <div id="recaptcha-container" />
        <p className="text-sm text-muted-foreground pt-6">
          New here? <Link to="/register" className="link-underline text-primary">Create an account</Link>
        </p>
        <div className="pt-6 mt-6 border-t border-border text-xs text-muted-foreground">
          <div className="uppercase tracking-widest text-[10px] mb-2">Test accounts (MVP)</div>
          <div>learner@tredevlearn.com / Learner@123</div>
          <div>learner1@tredevlearn.com / Learner1@123</div>
          <div>acharya@tredevlearn.com / Acharya@123</div>
          <div>staff@tredevlearn.com / Staff@123</div>
          <div>staff1@tredevlearn.com / Staff1@123</div>
          <div>admin@tredevlearn.com / Admin@123</div>
          <div>superadmin@tredevlearn.com / SuperAdmin@123</div>
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <BackLink />
        <h1 className="text-4xl font-serif mb-8">Sign in with email.</h1>
        <form onSubmit={submitEmail} className="space-y-4">
          <div>
            <label className="eyebrow">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              data-testid="login-email" className="mt-2 h-12" />
          </div>
          <div>
            <label className="eyebrow">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              data-testid="login-password" className="mt-2 h-12" />
          </div>
          <Button disabled={busy} type="submit" data-testid="login-submit" className="w-full h-12 rounded-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          {needsVerification && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2" data-testid="login-needs-verification">
              <p>Your email isn't verified yet. Enter the code we emailed you, or resend it.</p>
              <div className="flex gap-2">
                <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric" maxLength={6} placeholder="123456" className="h-9 flex-1" />
                <Button type="button" size="sm" disabled={busy || verifyCode.length !== 6} onClick={submitVerifyCode} className="rounded-full">
                  {busy ? "Verifying…" : "Verify"}
                </Button>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={resending} onClick={resend} className="rounded-full">
                {resending ? "Sending…" : "Resend code"}
              </Button>
            </div>
          )}
        </form>
      </div>
    );
  }

  if (step === "phone-number") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <BackLink />
        <h1 className="text-4xl font-serif mb-8">Sign in with phone.</h1>
        <form onSubmit={sendPhoneCode} className="space-y-4">
          <div>
            <label className="eyebrow">Phone number (with country code)</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" required
              data-testid="login-phone-number" className="mt-2 h-12" />
          </div>
          <Button disabled={busy || !phone} type="submit" data-testid="login-phone-send" className="w-full h-12 rounded-full">
            {busy ? "Sending…" : "Send SMS code"}
          </Button>
        </form>
        <div id="recaptcha-container" />
      </div>
    );
  }

  if (step === "phone-code") {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="text-4xl font-serif mb-4">Enter your code.</h1>
        <p className="text-muted-foreground mb-8">
          We've texted a 6-digit code to <span className="font-medium text-foreground">{phone}</span>.
        </p>
        <form onSubmit={confirmPhoneCode} className="space-y-4">
          <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="123456"
            data-testid="login-phone-code" className="h-12 text-center text-2xl tracking-[0.5em]" />
          <Button disabled={busy || phoneCode.length !== 6} type="submit" data-testid="login-phone-verify" className="w-full h-12 rounded-full">
            {busy ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
      </div>
    );
  }

  return null;
}
