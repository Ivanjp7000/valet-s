import { useState, useRef, useEffect } from "react";
import { Loader2, Mail, Shield, ArrowRight, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Step = "email" | "otp" | "success";

export default function SroLogin() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (step === "otp") setTimeout(() => otpRefs.current[0]?.focus(), 100); }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith("@stregis.com")) {
      setEmailError("Only @stregis.com email addresses are allowed on this page.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/local", { username: trimmed, password: "" });
      const data = await res.json();
      if (data.requiresTwoFactor) {
        setPendingUserId(data.userId);
        setPendingEmail(data.email || trimmed);
        setStep("otp");
        setResendCooldown(60);
      } else if (data.error || res.status >= 400) {
        setEmailError(data.message || "Account not found. Please contact your administrator.");
      } else {
        window.location.href = "/";
      }
    } catch (err: any) {
      setEmailError(err.message || "Account not found. Please contact your administrator.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...otp];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    const lastFilled = Math.min(pasted.length, 5);
    otpRefs.current[lastFilled]?.focus();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { setOtpError("Please enter all 6 digits."); return; }
    setOtpError("");
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/verify-otp", { userId: pendingUserId, code });
      setStep("success");
      setTimeout(() => { window.location.href = "/"; }, 1200);
    } catch (err: any) {
      setOtpError(err.message || "Invalid or expired code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError("");
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/local", { username: pendingEmail, password: "" });
      const data = await res.json();
      if (data.requiresTwoFactor) {
        setPendingUserId(data.userId);
        setOtp(["", "", "", "", "", ""]);
        setResendCooldown(60);
        otpRefs.current[0]?.focus();
      }
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1c38] via-[#1a2744] to-[#0f1c38] flex flex-col items-center justify-center px-4 py-12">

      {/* Decorative top bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c9a84c] via-[#f0d078] to-[#c9a84c]" />

      {/* Logo / header */}
      <div className="text-center mb-10 select-none">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#c9a84c]/40 bg-white/5 mb-5 shadow-lg shadow-black/30">
          {step === "otp" ? (
            <Mail className="text-[#c9a84c]" size={26} />
          ) : step === "success" ? (
            <Shield className="text-emerald-400" size={26} />
          ) : (
            <Shield className="text-[#c9a84c]" size={26} />
          )}
        </div>
        <p className="text-[#c9a84c] tracking-[0.25em] text-xs font-medium uppercase mb-1">St. Regis Osaka</p>
        <h1 className="text-white text-2xl sm:text-3xl font-light tracking-wide">Valet Management</h1>
        <p className="text-white/40 text-sm mt-2">Staff Access Portal</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          {/* Gold top accent */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

          <div className="p-8">

            {/* EMAIL STEP */}
            {step === "email" && (
              <>
                <h2 className="text-white text-lg font-medium mb-1">Sign in</h2>
                <p className="text-white/50 text-sm mb-7">Enter your St. Regis email address to receive a login code.</p>
                <form onSubmit={handleEmailSubmit} noValidate>
                  <div className="mb-5">
                    <label className="block text-white/60 text-xs font-medium mb-2 tracking-wide uppercase">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                      <input
                        ref={emailRef}
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                        placeholder="yourname@stregis.com"
                        className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#c9a84c]/60 focus:bg-white/8 transition-all"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                    {emailError && (
                      <p className="mt-2.5 text-red-400 text-xs leading-relaxed">{emailError}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#d4b55a] disabled:opacity-50 disabled:cursor-not-allowed text-[#1a2744] font-semibold text-sm rounded-xl py-3 transition-all shadow-lg shadow-[#c9a84c]/20"
                  >
                    {isLoading ? (
                      <><Loader2 size={15} className="animate-spin" /> Sending code...</>
                    ) : (
                      <>Send Login Code <ArrowRight size={15} /></>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* OTP STEP */}
            {step === "otp" && (
              <>
                <h2 className="text-white text-lg font-medium mb-1">Check your inbox</h2>
                <p className="text-white/50 text-sm mb-1">
                  We sent a 6-digit code to
                </p>
                <p className="text-[#c9a84c] text-sm font-medium mb-7 truncate">{pendingEmail}</p>
                <form onSubmit={handleOtpSubmit} noValidate>
                  <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white/5 text-white transition-all focus:outline-none ${
                          digit
                            ? "border-[#c9a84c] bg-[#c9a84c]/10"
                            : "border-white/20 focus:border-[#c9a84c]/60"
                        }`}
                      />
                    ))}
                  </div>

                  {otpError && (
                    <p className="mb-4 text-red-400 text-xs text-center">{otpError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || otp.join("").length !== 6}
                    className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#d4b55a] disabled:opacity-50 disabled:cursor-not-allowed text-[#1a2744] font-semibold text-sm rounded-xl py-3 transition-all shadow-lg shadow-[#c9a84c]/20 mb-4"
                  >
                    {isLoading ? (
                      <><Loader2 size={15} className="animate-spin" /> Verifying...</>
                    ) : (
                      <>Verify & Sign In <ArrowRight size={15} /></>
                    )}
                  </button>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => { setStep("email"); setOtp(["","","","","",""]); setOtpError(""); }}
                      className="text-white/40 hover:text-white/70 text-xs transition-colors"
                    >
                      ← Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || isLoading}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#c9a84c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RotateCcw size={11} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* SUCCESS STEP */}
            {step === "success" && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-emerald-400" size={24} />
                </div>
                <h2 className="text-white text-lg font-medium mb-2">Access Granted</h2>
                <p className="text-white/50 text-sm">Redirecting you to the dashboard...</p>
                <div className="mt-4 flex justify-center">
                  <Loader2 className="text-[#c9a84c] animate-spin" size={20} />
                </div>
              </div>
            )}
          </div>

          {/* Gold bottom accent */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/40 to-transparent" />
        </div>

        {/* Footer note */}
        <p className="text-center text-white/20 text-xs mt-6">
          Restricted to @stregis.com accounts &nbsp;·&nbsp; St. Regis Osaka Valet
        </p>
      </div>
    </div>
  );
}
