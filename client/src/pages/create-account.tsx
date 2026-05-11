import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, CheckCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  if (op === "+") answer = a + b;
  else if (op === "-") answer = Math.max(a, b) - Math.min(a, b);
  else answer = a * b;
  const display = op === "-" ? `${Math.max(a, b)} − ${Math.min(a, b)}` : `${a} ${op} ${b}`;
  return { display, answer };
}

export default function CreateAccount() {
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<{ message: string; isStRegis: boolean } | null>(null);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) { setError("Please enter your full name"); return; }
    if (!email.trim()) { setError("Please enter your email address"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address"); return; }
    if (!captchaAnswer.trim()) { setError("Please answer the verification question"); return; }

    setIsLoading(true);
    try {
      const data = await apiRequest("POST", "/api/auth/register", {
        fullName: fullName.trim(),
        email: email.trim(),
        captchaAnswer: Number(captchaAnswer),
        captchaExpected: captcha.answer,
      });
      setSuccess({ message: data.message, isStRegis: data.isStRegis });
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
      refreshCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#0f1a30] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-regis-navy mb-3">Check Your Email</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">{success.message}</p>
            {!success.isStRegis && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-amber-800 text-xs leading-relaxed">
                  <strong>What happens next:</strong><br />
                  1. Click the verification link in your email<br />
                  2. An administrator will review your request<br />
                  3. You'll receive a confirmation email within 48 business hours<br />
                  4. Log in using your email — a code will be sent each time
                </p>
              </div>
            )}
            {success.isStRegis && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-blue-800 text-xs leading-relaxed">
                  <strong>Almost done:</strong><br />
                  1. Click the verification link in your email<br />
                  2. Your account will be instantly activated<br />
                  3. Log in using your email — a 6-digit code will be sent each time
                </p>
              </div>
            )}
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-regis-navy hover:bg-blue-900 text-white"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#0f1a30] flex items-center justify-center px-4">
      <Card className="max-w-sm w-full">
        <CardContent className="p-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-5 -ml-1"
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-regis-navy rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="text-regis-gold" size={22} />
            </div>
            <h2 className="text-xl font-semibold text-regis-navy">Create Account</h2>
            <p className="text-xs text-gray-400 mt-1">Valet System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <Input
                type="text"
                placeholder="e.g. Yuki Tanaka"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="focus:border-regis-gold"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus:border-regis-gold"
                autoComplete="email"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                @stregis.com addresses are approved instantly
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Verification — What is <span className="font-bold text-regis-navy">{captcha.display}</span> ?
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="focus:border-regis-gold"
                />
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-gray-400 hover:text-gray-600 px-2"
                  title="New question"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 size={15} className="mr-2 animate-spin" />Submitting…</>
              ) : (
                "Submit Request"
              )}
            </Button>
          </form>

          <p className="text-[10px] text-gray-400 text-center mt-5 leading-relaxed">
            Already have an account?{" "}
            <button
              className="underline hover:text-gray-600"
              onClick={() => navigate("/")}
            >
              Log in
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
