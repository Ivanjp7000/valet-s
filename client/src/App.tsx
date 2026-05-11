import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import StaffDashboard from "@/pages/staff-dashboard";
import AdminPanel from "@/pages/admin-panel";
import Docs from "@/pages/docs";
import CreateAccount from "@/pages/create-account";
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";

// Version is derived from the build date — updates automatically on every deploy
function buildVersion() {
  const d = new Date();
  return `Release ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

const APP_VERSION = buildVersion();

function VersionBadge() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none">
      <span className="text-[11px] font-mono tracking-widest opacity-20 text-gray-500">
        {APP_VERSION}
      </span>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <Switch>
      {/* Public routes — always accessible */}
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/verify-email" component={VerifyEmail} />

      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/staff" component={StaffDashboard} />
          <Route path="/docs" component={Docs} />
          {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
            <Route path="/admin" component={AdminPanel} />
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <VersionBadge />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
