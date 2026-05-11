import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, X, Mail, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SystemLoginModalProps {
  onClose: () => void;
}

export function SystemLoginModal({ onClose }: SystemLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 2FA state
  const [otpStep, setOtpStep] = useState(false);
  const [pendingUserId, setPendingUserId] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (otpStep) otpRefs.current[0]?.focus();
  }, [otpStep]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await apiRequest("POST", "/api/auth/local", { username, password });
      if (data.requiresTwoFactor) {
        setPendingUserId(data.userId);
        setPendingEmail(data.email || "");
        setOtpStep(true);
      } else {
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please check username and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { setError("Please enter the 6-digit code."); return; }
    setError("");
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/verify-otp", { userId: pendingUserId, code });
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Invalid or expired code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-sm mx-4 w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-regis-navy rounded-full flex items-center justify-center mx-auto mb-4">
              {otpStep ? <Mail className="text-regis-gold" size={24} /> : <Shield className="text-regis-gold" size={24} />}
            </div>
            <h2 className="text-xl font-semibold text-regis-navy">
              {otpStep ? "Verification Code" : "System Access"}
            </h2>
            {otpStep && (
              <p className="text-sm text-gray-500 mt-1">
                A 6-digit code was sent to{" "}
                <span className="font-medium text-regis-navy">{pendingEmail}</span>
              </p>
            )}
          </div>

          {!otpStep ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:border-regis-gold"
                />
              </div>
              <div className="mb-6">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:border-regis-gold"
                />
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium mb-4"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? <><Loader2 size={16} className="mr-2 animate-spin" />Logging in...</> : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit}>
              <div className="flex justify-center gap-2 mb-6">
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
                    className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-regis-navy"
                  />
                ))}
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium mb-4"
                disabled={isLoading}
              >
                {isLoading ? <><Loader2 size={16} className="mr-2 animate-spin" />Verifying...</> : "Verify Code"}
              </Button>
              <button
                type="button"
                onClick={() => { setOtpStep(false); setOtp(["","","","","",""]); setError(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to login
              </button>
            </form>
          )}

          {!otpStep && (
            <>
              <Button variant="ghost" onClick={onClose} className="w-full text-gray-500 hover:text-gray-700">
                Cancel
              </Button>
              <div className="text-center mt-3">
                <a
                  href="/create-account"
                  className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  create account
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
