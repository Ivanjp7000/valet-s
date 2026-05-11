import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Crown, LogOut, Gauge, ShieldCheck, BookOpen, Globe,
  ArrowRight, Minimize2, Maximize2, Car, Settings, FileText, Shield, Building,
} from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { OrganizationalUnit, PhysicalLocation, User } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [compactView, setCompactView] = useState(false);

  const { data: ous } = useQuery<OrganizationalUnit[]>({
    queryKey: ["/api/ous"],
    enabled: user?.role === 'superadmin',
  });
  const { data: locations } = useQuery<PhysicalLocation[]>({
    queryKey: ["/api/locations"],
    enabled: user?.role === 'superadmin',
  });
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'superadmin',
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'privilege_admin': return 'Privilege Admin';
      case 'standard_admin': return 'Standard Admin';
      case 'standard_user': return 'Standard User';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-600';
      case 'privilege_admin': return 'bg-blue-600';
      case 'standard_user': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2147 50%, #0a1628 100%)' }}>

      {/* Header */}
      <div className="border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c96d)' }}>
              <Crown className="text-regis-navy" size={22} />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">Valet Management System</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-blue-200 text-sm">Welcome back, {user?.firstName || user?.username}</p>
                <Badge className={`${getRoleColor(user?.role || '')} text-white text-xs px-2 py-0`}>
                  {getRoleLabel(user?.role || '')}
                </Badge>
              </div>
            </div>
          </div>
          <a href="/api/logout"
            className="flex items-center gap-2 text-blue-200/70 hover:text-white text-sm transition-colors"
            data-testid="link-logout">
            <LogOut size={16} />
            Sign out
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Page heading */}
        <div className="mb-8 sm:mb-10">
          <p className="text-white/40 text-xs uppercase tracking-widest font-medium mb-1">Control Centre</p>
          <h2 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">Where would you like to go?</h2>
        </div>

        {/* Mobile compact toggle */}
        <div className="sm:hidden flex justify-end mb-4">
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {compactView ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            {compactView ? "Expanded" : "Compact"}
          </button>
        </div>

        {/* Compact mobile view */}
        {compactView && (
          <div className="sm:hidden space-y-2">
            <Link href="/staff">
              <div className="rounded-xl p-3 flex items-center gap-3 border border-white/10 cursor-pointer active:opacity-80 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}>
                  <Gauge className="text-white" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Operations Dashboard</p>
                  <p className="text-white/40 text-xs truncate">Manage valet requests & tickets</p>
                </div>
                <ArrowRight className="text-white/30" size={16} />
              </div>
            </Link>

            {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
              <Link href="/admin">
                <div className="rounded-xl p-3 flex items-center gap-3 border border-white/10 cursor-pointer active:opacity-80 transition-opacity"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #92710a, #c9a84c)' }}>
                    {user?.role === 'superadmin' ? <ShieldCheck className="text-white" size={18} /> : <Settings className="text-white" size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{user?.role === 'superadmin' ? 'Super Admin' : 'Admin Panel'}</p>
                    <p className="text-white/40 text-xs truncate">Manage settings & users</p>
                  </div>
                  <ArrowRight className="text-white/30" size={16} />
                </div>
              </Link>
            )}

            <Link href="/docs">
              <div className="rounded-xl p-3 flex items-center gap-3 border border-white/10 cursor-pointer active:opacity-80 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #374151, #6b7280)' }}>
                  <BookOpen className="text-white" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Documentation</p>
                  <p className="text-white/40 text-xs truncate">Guides & references</p>
                </div>
                <ArrowRight className="text-white/30" size={16} />
              </div>
            </Link>

            {user?.role === 'superadmin' && (
              <div className="rounded-xl p-3 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="text-purple-400" size={14} />
                  <p className="text-white font-semibold text-sm">System Overview</p>
                </div>
                <div className="flex justify-around text-center">
                  {[{ label: 'Orgs', val: ous?.length ?? 0 }, { label: 'Locations', val: locations?.length ?? 0 }, { label: 'Users', val: users?.length ?? 0 }].map(s => (
                    <div key={s.label}>
                      <p className="text-xl font-bold text-purple-300">{s.val}</p>
                      <p className="text-[11px] text-white/40">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main cards — standard view */}
        <div className={compactView ? "hidden sm:block" : ""}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">

            {/* Operations Dashboard */}
            <Link href="/staff">
              <div
                className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{ background: 'linear-gradient(145deg, #1a2e5a 0%, #1e3a6e 60%, #243d78 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                data-testid="card-staff-dashboard"
              >
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-y-8 translate-x-8"
                  style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />

                <div className="relative p-7 sm:p-8">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}>
                    <Gauge className="text-white" size={26} />
                  </div>

                  <p className="text-blue-300/60 text-[11px] uppercase tracking-widest font-medium mb-1">Live Operations</p>
                  <h3 className="text-white text-xl font-bold mb-2 tracking-tight">Operations Dashboard</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-6">
                    Manage active valet requests, update ticket status, and monitor daily activity in real time.
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-blue-300 text-sm font-semibold group-hover:gap-2.5 transition-all">
                      Access Operations <ArrowRight size={15} />
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <Car size={14} className="text-white/60" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Admin Panel */}
            {(user?.role === 'superadmin' || user?.role === 'privilege_admin') && (
              <Link href="/admin">
                <div
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                  style={{ background: 'linear-gradient(145deg, #3a2a00 0%, #4a3500 60%, #5a4200 100%)', border: '1px solid rgba(201,168,76,0.25)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                  data-testid="card-admin-panel"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-y-8 translate-x-8"
                    style={{ background: 'radial-gradient(circle, #c9a84c, transparent)' }} />

                  <div className="relative p-7 sm:p-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #92710a, #c9a84c)' }}>
                      {user?.role === 'superadmin'
                        ? <ShieldCheck className="text-white" size={26} />
                        : <Settings className="text-white" size={26} />}
                    </div>

                    <p className="text-yellow-400/50 text-[11px] uppercase tracking-widest font-medium mb-1">
                      {user?.role === 'superadmin' ? 'System Control' : 'Administration'}
                    </p>
                    <h3 className="text-white text-xl font-bold mb-2 tracking-tight">
                      {user?.role === 'superadmin' ? 'Super Admin Panel' : 'Admin Panel'}
                    </h3>
                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                      {user?.role === 'superadmin'
                        ? 'Manage organizations, locations, users, licenses and system-wide settings.'
                        : 'Manage locations and staff accounts within your organization.'}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-yellow-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                        Access Admin Panel <ArrowRight size={15} />
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Shield size={14} className="text-yellow-400/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Documentation */}
            <Link href="/docs">
              <div
                className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{ background: 'linear-gradient(145deg, #1c2030 0%, #222638 60%, #272c42 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                data-testid="card-documentation"
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-8 translate-x-8"
                  style={{ background: 'radial-gradient(circle, #94a3b8, transparent)' }} />

                <div className="relative p-7 sm:p-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #374151, #4b5563)' }}>
                    <BookOpen className="text-white" size={26} />
                  </div>

                  <p className="text-gray-400/50 text-[11px] uppercase tracking-widest font-medium mb-1">Knowledge Base</p>
                  <h3 className="text-white text-xl font-bold mb-2 tracking-tight">Documentation</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-6">
                    System guides, feature references, and step-by-step operational instructions for all staff.
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-gray-300 text-sm font-semibold group-hover:gap-2.5 transition-all">
                      Open Documentation <ArrowRight size={15} />
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <FileText size={14} className="text-white/40" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* System Overview — superadmin only */}
            {user?.role === 'superadmin' && (
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #1e1040 0%, #241450 60%, #2a185e 100%)', border: '1px solid rgba(167,139,250,0.2)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                data-testid="card-super-admin-stats"
              >
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-15 -translate-y-10 translate-x-10"
                  style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />

                <div className="relative p-7 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' }}>
                      <Globe className="text-white" size={18} />
                    </div>
                    <div>
                      <p className="text-purple-300/50 text-[11px] uppercase tracking-widest font-medium">Multi-tenant</p>
                      <h3 className="text-white font-bold text-base tracking-tight">System Overview</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Organizations', val: ous?.length ?? 0, icon: Building },
                      { label: 'Locations', val: locations?.length ?? 0, icon: Globe },
                      { label: 'Total Users', val: users?.length ?? 0, icon: Shield },
                    ].map(({ label, val, icon: Icon }) => (
                      <div key={label} className="text-center rounded-xl py-3"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
                        <p className="text-2xl font-bold text-purple-300">{val}</p>
                        <p className="text-white/35 text-[10px] mt-0.5 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
