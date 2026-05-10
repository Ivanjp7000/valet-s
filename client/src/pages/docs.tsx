import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

export default function Docs() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-gray-500 hover:text-regis-navy">
              <ChevronLeft size={16} />
              Home
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
          <FileText size={56} className="mb-4 text-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-500 mb-2">Documentation</h1>
          <p className="text-sm text-gray-400">Content coming soon.</p>
        </div>
      </div>
    </div>
  );
}
