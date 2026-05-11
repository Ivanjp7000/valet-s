import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  const configs: Record<string, { icon: React.ReactNode; title: string; body: string; color: string }> = {
    approved: {
      icon: <CheckCircle className="text-green-600" size={32} />,
      color: "bg-green-100",
      title: "Email Verified & Account Activated!",
      body: "Your @stregis.com account has been verified and is now active. You can log in using your email address — a 6-digit code will be sent to your inbox each time.",
    },
    pending: {
      icon: <Clock className="text-amber-500" size={32} />,
      color: "bg-amber-100",
      title: "Email Verified — Pending Approval",
      body: "Your email has been confirmed. An administrator will review your account request and you will receive a confirmation email within 48 business hours.",
    },
    expired: {
      icon: <AlertCircle className="text-orange-500" size={32} />,
      color: "bg-orange-100",
      title: "Verification Link Expired",
      body: "This verification link has expired (links are valid for 24 hours). Please register again to receive a new link.",
    },
    invalid: {
      icon: <XCircle className="text-red-500" size={32} />,
      color: "bg-red-100",
      title: "Invalid Verification Link",
      body: "This link is not valid or has already been used. If you need help, please contact your system administrator.",
    },
    error: {
      icon: <XCircle className="text-red-500" size={32} />,
      color: "bg-red-100",
      title: "Something Went Wrong",
      body: "We were unable to process your verification. Please try again or contact your administrator.",
    },
  };

  const cfg = configs[status || ""] || configs["invalid"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#0f1a30] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className={`w-16 h-16 ${cfg.color} rounded-full flex items-center justify-center mx-auto mb-5`}>
            {cfg.icon}
          </div>
          <h2 className="text-xl font-semibold text-regis-navy mb-3">{cfg.title}</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">{cfg.body}</p>

          {(status === "approved" || status === "pending") && (
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-regis-navy hover:bg-blue-900 text-white mb-3"
            >
              {status === "approved" ? "Log In Now" : "Back to Home"}
            </Button>
          )}

          {(status === "expired" || status === "error" || status === "invalid") && (
            <Button
              onClick={() => navigate("/create-account")}
              className="w-full bg-regis-navy hover:bg-blue-900 text-white mb-3"
            >
              Try Again
            </Button>
          )}

          <p className="text-[11px] text-gray-400">
            St. Regis Osaka · Valet Management System
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
