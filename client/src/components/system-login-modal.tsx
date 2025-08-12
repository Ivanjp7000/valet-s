import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, X } from "lucide-react";

interface SystemLoginModalProps {
  onClose: () => void;
}

export function SystemLoginModal({ onClose }: SystemLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to Replit Auth login
    window.location.href = "/api/login";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-sm mx-4 w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-regis-navy rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="text-regis-gold" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-regis-navy">System Access</h2>
          </div>

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
            
            <Button 
              type="submit"
              className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium mb-4"
            >
              Login
            </Button>
          </form>

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
