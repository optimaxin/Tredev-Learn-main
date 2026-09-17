import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/lib/api";
import { sendPhoneOtp, confirmPhoneOtp, refreshIdToken } from "@/lib/firebaseClient";
import PhoneInput from "@/components/PhoneInput";
import useResendTimer from "@/hooks/useResendTimer";
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

// Every step in both signup paths, in order:
//  choose -> email-form -> email-otp -> email-profile          (email + password, then OTP, then name)
//  choose -> phone-number -> phone-otp -> phone-profile         (SMS OTP, then name + email)
//  choose -> (google popup, done immediately)
export default function Register() {
  const { register, verifyOtp, login, resendVerification, completeProfile, loginWithGoogle, loginWithPhone } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState("choose");
  const [busy, setBusy] = useState(false);

  // email path
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  // phone path
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [phoneIdToken, setPhoneIdToken] = useState(null);
  const [phoneName, setPhoneName] = useState("");
  const [phoneEmail, setPhoneEmail] = useState("");

  const emailOtpTimer = useResendTimer();
  const phoneOtpTimer = useResendTimer();

  const back = () => setStep("choose");

  const submitGoogle = async () => {
    setBusy(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Welcome, ${user.name}.`);
      nav("/learner");
    } catch (err) { toast.error(err?.message || formatApiError(err) || "Google sign-in failed."); }
    setBusy(false);
  };

  const submitEmailForm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await register(email, password);
      setSent(!!data.email_verification_sent);
      setStep("email-otp");
      emailOtpTimer.start();
    } catch (err) { toast.error(formatApiError(err)); }
    setBusy(false);
  };

  const submitEmailOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyOtp(email, code);
      await login(email, password);
      setStep("email-profile");
    } catch (err) { toast.error(formatApiError(err) || "Invalid or expired code."); }
    setBusy(false);
  };

  const resendEmailCode = async () => {
    setResending(true);
    try {
      const data = await resendVerification(email, password);
      setSent(!!data.email_verification_sent);
      toast.success(data.email_verification_sent ? "Code re-sent — check your inbox." : "Couldn't send the code — try again shortly.");
      emailOtpTimer.start();
    } catch (err) { toast.error(formatApiError(err)); }
    setResending(false);
  };

  const submitEmailProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await completeProfile(profileName, profilePhone);
      toast.success("Welcome — you're all set!");
      nav("/learner");
    } catch (err) { toast.error(formatApiError(err)); }
    setBusy(false);
  };

  const submitPhoneNumber = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await sendPhoneOtp(phone, "recaptcha-container");
      setConfirmation(result);
      setStep("phone-otp");
      phoneOtpTimer.start();
      toast.success("Code sent via SMS.");
    } catch (err) { toast.error(err?.message || "Couldn't send the SMS code. Check the number and try again."); }
    setBusy(false);
  };

  const resendPhoneCode = async () => {
    setBusy(true);
    try {
      const result = await sendPhoneOtp(phone, "recaptcha-container");
      setConfirmation(result);
      phoneOtpTimer.start();
      toast.success("Code re-sent via SMS.");
    } catch (err) { toast.error(err?.message || "Couldn't resend the SMS code."); }
    setBusy(false);
  };

  const submitPhoneOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const idToken = await confirmPhoneOtp(confirmation, phoneCode);
      setPhoneIdToken(idToken);
      setStep("phone-profile");
    } catch (err) { toast.error(err?.message || "Invalid code."); }
    setBusy(false);
  };

  const submitPhoneProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const freshToken = (await refreshIdToken()) || phoneIdToken;
      const user = await loginWithPhone(freshToken, { name: phoneName, email: phoneEmail });
      toast.success(`Welcome, ${user.name}.`);
      nav("/learner");
    } catch (err) { toast.error(formatApiError(err)); }
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
        <div className="eyebrow mb-3">Join</div>
        <h1 className="text-4xl font-serif mb-8">Begin.</h1>
        <div className="space-y-3">
          <Button type="button" variant="outline" disabled={busy} onClick={submitGoogle}
            data-testid="register-google" className="w-full h-12 rounded-full justify-center gap-3">
            <GoogleIcon /> Continue with Google
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("phone-number")}
            data-testid="register-phone" className="w-full h-12 rounded-full justify-center gap-3">
            <Phone className="h-4 w-4" /> Continue with phone
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("email-form")}
            data-testid="register-email-choice" className="w-full h-12 rounded-full justify-center gap-3">
            <Mail className="h-4 w-4" /> Continue with email
          </Button>
        </div>
        <div id="recaptcha-container" />
        <p className="text-sm text-muted-foreground pt-6">
          Already have an account? <Link to="/login" className="link-underline text-primary">Sign in</Link>
        </p>
      </div>
    );
  }

  if (step === "email-form") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <BackLink />
        <h1 className="text-4xl font-serif mb-8">Sign up with email.</h1>
        <form onSubmit={submitEmailForm} className="space-y-4">
          <div>
            <label className="eyebrow">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              data-testid="register-email" className="mt-2 h-12" />
          </div>
          <div>
            <label className="eyebrow">Password (min 8, a letter and a number)</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              data-testid="register-password" className="mt-2 h-12" />
          </div>
          <Button disabled={busy} type="submit" data-testid="register-submit" className="w-full h-12 rounded-full">
            {busy ? "Sending code…" : "Send verification code"}
          </Button>
        </form>
      </div>
    );
  }

  if (step === "email-otp") {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <div className="eyebrow mb-3">Almost there</div>
        <h1 className="text-4xl font-serif mb-4">Enter your code.</h1>
        <p className="text-muted-foreground mb-8">
          {sent ? (
            <>We've emailed a 6-digit verification code to <span className="font-medium text-foreground">{email}</span>. Enter it below.</>
          ) : (
            <>We couldn't send the code to <span className="font-medium text-foreground">{email}</span> right now. Try "Resend code" below, or check back shortly.</>
          )}
        </p>
        <form onSubmit={submitEmailOtp} className="space-y-4">
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="123456"
            data-testid="register-otp" className="h-12 text-center text-2xl tracking-[0.5em]" />
          <Button disabled={busy || code.length !== 6} type="submit" data-testid="register-otp-submit" className="w-full h-12 rounded-full">
            {busy ? "Verifying…" : "Verify & continue"}
          </Button>
          {emailOtpTimer.canResend ? (
            <Button type="button" variant="outline" disabled={resending} onClick={resendEmailCode} className="w-full h-12 rounded-full">
              {resending ? "Sending…" : "Resend code"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Resend code in {emailOtpTimer.left}s</p>
          )}
        </form>
      </div>
    );
  }

  if (step === "email-profile") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <h1 className="text-4xl font-serif mb-4">Just a bit more.</h1>
        <p className="text-muted-foreground mb-8">Tell us your name — phone number is optional.</p>
        <form onSubmit={submitEmailProfile} className="space-y-4">
          <div>
            <label className="eyebrow">Full name</label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} required
              data-testid="register-profile-name" className="mt-2 h-12" />
          </div>
          <div>
            <label className="eyebrow">Phone number (optional)</label>
            <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+919876543210"
              data-testid="register-profile-phone" className="mt-2 h-12" />
          </div>
          <Button disabled={busy || !profileName} type="submit" data-testid="register-profile-submit" className="w-full h-12 rounded-full">
            {busy ? "Finishing…" : "Finish"}
          </Button>
        </form>
      </div>
    );
  }

  if (step === "phone-number") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <BackLink />
        <h1 className="text-4xl font-serif mb-8">Sign up with phone.</h1>
        <form onSubmit={submitPhoneNumber} className="space-y-4">
          <div>
            <label className="eyebrow">Phone number</label>
            <PhoneInput value={phone} onChange={setPhone} testId="register-phone-number" />
          </div>
          <Button disabled={busy || !phone} type="submit" data-testid="register-phone-send" className="w-full h-12 rounded-full">
            {busy ? "Sending…" : "Send SMS code"}
          </Button>
        </form>
        <div id="recaptcha-container" />
      </div>
    );
  }

  if (step === "phone-otp") {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="text-4xl font-serif mb-4">Enter your code.</h1>
        <p className="text-muted-foreground mb-8">
          We've texted a 6-digit code to <span className="font-medium text-foreground">{phone}</span>.
        </p>
        <form onSubmit={submitPhoneOtp} className="space-y-4">
          <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="123456"
            data-testid="register-phone-code" className="h-12 text-center text-2xl tracking-[0.5em]" />
          <Button disabled={busy || phoneCode.length !== 6} type="submit" data-testid="register-phone-verify" className="w-full h-12 rounded-full">
            {busy ? "Verifying…" : "Verify & continue"}
          </Button>
          {phoneOtpTimer.canResend ? (
            <Button type="button" variant="outline" disabled={busy} onClick={resendPhoneCode} className="w-full h-12 rounded-full">
              Resend OTP
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Resend OTP in {phoneOtpTimer.left}s</p>
          )}
        </form>
      </div>
    );
  }

  if (step === "phone-profile") {
    return (
      <div className="max-w-md mx-auto py-24 px-6">
        <h1 className="text-4xl font-serif mb-4">Just a bit more.</h1>
        <p className="text-muted-foreground mb-8">Tell us your name and email to finish setting up your account.</p>
        <form onSubmit={submitPhoneProfile} className="space-y-4">
          <div>
            <label className="eyebrow">Full name</label>
            <Input value={phoneName} onChange={(e) => setPhoneName(e.target.value)} required
              data-testid="register-phone-name" className="mt-2 h-12" />
          </div>
          <div>
            <label className="eyebrow">Email</label>
            <Input type="email" value={phoneEmail} onChange={(e) => setPhoneEmail(e.target.value)} required
              data-testid="register-phone-email" className="mt-2 h-12" />
          </div>
          <Button disabled={busy || !phoneName || !phoneEmail} type="submit" data-testid="register-phone-profile-submit" className="w-full h-12 rounded-full">
            {busy ? "Finishing…" : "Finish"}
          </Button>
        </form>
      </div>
    );
  }

  return null;
}
