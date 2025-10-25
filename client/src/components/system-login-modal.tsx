import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SystemLoginModalProps {
  onClose: () => void;
}

export function SystemLoginModal({ onClose }: SystemLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      await apiRequest("POST", "/api/auth/local", { username, password });
      // On success, reload the page to update authentication state
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please check username and password.");
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
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <Button 
              type="submit"
              className="w-full bg-regis-navy hover:bg-blue-900 text-white font-medium mb-4"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Logging in..." : "Login"}
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
