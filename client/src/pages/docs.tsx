import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, User, ShieldCheck, Shield, Crown, Ticket, Car, Clock, MapPin, Users, Building, Settings, FileText, BarChart2, Upload, Key, Eye } from "lucide-react";
import { Link } from "wouter";

type Role = "superadmin" | "privilege_admin" | "standard_admin" | "standard_user" | undefined;

function Section({ title, icon, badge, badgeColor, children }: {
  title: string;
  icon: ReactNode;
  badge: string;
  badgeColor: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-sm border mb-6">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 flex-shrink-0">
            {icon}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base sm:text-lg text-regis-navy">{title}</CardTitle>
            <Badge className={`${badgeColor} text-white text-xs`}>{badge}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

function Item({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex-shrink-0 text-gray-400">{icon}</div>
      <div>
        <p className="text-sm font-medium text-regis-navy">{title}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function Docs() {
  const { user } = useAuth();
  const role = user?.role as Role;

  const isSuperAdmin = role === "superadmin";
  const isPrivilegeAdmin = role === "privilege_admin" || isSuperAdmin;
  const isStandardAdmin = role === "standard_admin" || isPrivilegeAdmin;
  const isStandardUser = role === "standard_user" || isStandardAdmin;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1 text-gray-500 hover:text-regis-navy px-2">
                <ChevronLeft size={16} />
                Home
              </Button>
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-regis-navy">Documentation</h1>
              <p className="text-xs text-gray-500">Valet-S System Guide</p>
            </div>
          </div>
          {user && (
            <Badge className="bg-regis-navy text-white text-xs">
              {role === "superadmin" ? "Super Admin" : role === "privilege_admin" ? "Privilege Admin" : role === "standard_admin" ? "Standard Admin" : role === "standard_user" ? "Standard User" : "User"}
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* ── SUPER ADMIN ─────────────────────────────────── */}
        {isSuperAdmin && (
          <Section
            title="Super Admin — System Control"
            icon={<Crown size={18} className="text-purple-600" />}
            badge="Super Admin"
            badgeColor="bg-purple-600"
          >
            <Item
              icon={<Building size={14} />}
              title="Manage Organizations (OUs)"
              desc="Create and manage client organizations (e.g. Marriott, Sony, Panasonic). Each OU is fully isolated — its data is never visible to other OUs."
            />
            <Item
              icon={<Users size={14} />}
              title="All Users & Roles"
              desc="Create accounts at any role level (Super Admin, Privilege Admin, Standard Admin) and assign them to any OU. Reset passwords and manage access globally."
            />
            <Item
              icon={<Settings size={14} />}
              title="System Settings"
              desc="Configure global system parameters including session behavior, licence keys, and feature flags that apply across all organizations."
            />
            <Item
              icon={<ShieldCheck size={14} />}
              title="Licence Management"
              desc="View and manage per-OU licence status. Licences control feature access and expiry for each client organization."
            />
            <Item
              icon={<BarChart2 size={14} />}
              title="Global Analytics"
              desc="Access system-wide statistics across all OUs and locations — total organizations, users, locations, and ticket volumes."
            />
            <Item
              icon={<FileText size={14} />}
              title="FAQ Management"
              desc="Edit the guest-facing FAQ content shown on the public valet portal. Changes take effect immediately for all guests."
            />
          </Section>
        )}

        {/* ── PRIVILEGE ADMIN ─────────────────────────────── */}
        {isPrivilegeAdmin && (
          <Section
            title="Privilege Admin — OU Management"
            icon={<Shield size={18} className="text-regis-gold" />}
            badge="Privilege Admin"
            badgeColor="bg-yellow-600"
          >
            <Item
              icon={<Building size={14} />}
              title="Manage Locations"
              desc="Create, edit, and delete physical valet locations within your organization. Each location gets its own name and is visible to assigned staff."
            />
            <Item
              icon={<Users size={14} />}
              title="Manage Staff Accounts"
              desc="Create Standard Admin accounts within your OU. Assign them to specific locations using Location Scopes — staff without scopes see all OU data."
            />
            <Item
              icon={<Key size={14} />}
              title="Location Scopes"
              desc="Restrict a Standard Admin to one or more locations. They will only see tickets, stats, and roster data for those assigned locations."
            />
            <Item
              icon={<Upload size={14} />}
              title="V-info Import"
              desc="Bulk-import guest names by visitor type (in-house, day-use, etc.) via CSV. Names auto-expire after 24 hours. Use Manage Names to review or delete entries early."
            />
            <Item
              icon={<BarChart2 size={14} />}
              title="Analytics"
              desc="View OU-wide ticket analytics — daily volumes, status breakdowns, peak hours, and completion rates across all locations in your organization."
            />
            <Item
              icon={<FileText size={14} />}
              title="Export Data"
              desc="Download ticket records as CSV or JSON for any date range. Use for reporting, handover notes, or external processing."
            />
          </Section>
        )}

        {/* ── STANDARD ADMIN ──────────────────────────────── */}
        {isStandardAdmin && (
          <Section
            title="Operations Dashboard"
            icon={<Car size={18} className="text-blue-600" />}
            badge="Standard Admin"
            badgeColor="bg-blue-600"
          >
            <Item
              icon={<Ticket size={14} />}
              title="Create Valet Tickets"
              desc="Use New Ticket to log a vehicle. Enter guest name, room number, car details, plate, and parking sector. A unique 5-digit ticket number is generated automatically."
            />
            <Item
              icon={<Clock size={14} />}
              title="Update Ticket Status"
              desc="Move tickets through the workflow: Pending → In Transit → Ready → Completed. Status changes trigger live notifications to the guest's tracking page."
            />
            <Item
              icon={<MapPin size={14} />}
              title="Parking & Retrieval"
              desc="Record parking sector and location per ticket. Accept retrieval requests from guests and track the handoff process with timers."
            />
            <Item
              icon={<Car size={14} />}
              title="Car Photos"
              desc="Attach a photo to any ticket using the camera or upload. Use the plate scanner (OCR) to auto-fill the Japanese licence plate field."
            />
            <Item
              icon={<BarChart2 size={14} />}
              title="Daily Stats & Roster"
              desc="View today's ticket counts by status and toggle the Vehicle Roster to see all active vehicles with their parking positions."
            />
            <Item
              icon={<FileText size={14} />}
              title="Audit Log"
              desc="Browse a daily record of all ticket activity — who changed what and when. Filter by date for historical review."
            />
          </Section>
        )}

        {/* ── STANDARD USER ───────────────────────────────── */}
        {isStandardUser && (
          <Section
            title="Standard User — Read-Only Access"
            icon={<Eye size={18} className="text-green-600" />}
            badge="Standard User"
            badgeColor="bg-green-600"
          >
            <Item
              icon={<Eye size={14} />}
              title="View Live Ticket Activity"
              desc="Log in to see all active valet tickets and their current status in real time — Pending, In Transit, Ready, and Completed."
            />
            <Item
              icon={<Car size={14} />}
              title="Vehicle Roster"
              desc="Access the Vehicle Roster to see all active vehicles, their assigned parking sector and location, and current ticket status."
            />
            <Item
              icon={<MapPin size={14} />}
              title="Licence Plate Information"
              desc="View licence plate details attached to each ticket, including OCR-scanned Japanese plates where available."
            />
            <Item
              icon={<Clock size={14} />}
              title="Process Tracking"
              desc="Monitor the full retrieval workflow with live countdown timers for each stage. Read-only — no ticket creation or status changes."
            />
          </Section>
        )}

        {/* ── GUEST SELF-SERVICE ──────────────────────────── */}
        <Section
          title="Guest Self-Service"
          icon={<User size={18} className="text-gray-500" />}
          badge="All Users"
          badgeColor="bg-gray-500"
        >
          <Item
            icon={<Ticket size={14} />}
            title="Retrieve Your Vehicle"
            desc="Go to the hotel's valet portal and enter your 5-digit ticket number along with the name on the ticket to request your car."
          />
          <Item
            icon={<Clock size={14} />}
            title="Live Progress Tracking"
            desc="Once your request is submitted, track your vehicle's status in real time — from retrieval through transit to ready for pickup."
          />
          <Item
            icon={<Eye size={14} />}
            title="Countdown Timers"
            desc="Each stage shows a live countdown so you always know how long until your car is ready."
          />
        </Section>

        <p className="text-center text-xs text-gray-400 mt-2 mb-6">
          Valet-S · Documentation v1.0 · Content shown based on your access level.
        </p>
      </div>
    </div>
  );
}
