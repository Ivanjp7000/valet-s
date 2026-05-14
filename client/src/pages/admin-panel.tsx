import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Crown, HelpCircle, Settings, Users, LogOut, Edit, Trash2, Plus, Building, MapPin, Shield, TicketIcon, Eye, EyeOff, Home, Car, BarChart2, Database, TrendingUp, CalendarDays, Download, FileText, FileJson, CheckSquare, Square, Loader2, FileDown, ShieldCheck, UserCheck, UserX, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import valetBanner7a from "@assets/ValetS-Banner7a_1778476300539.png";
import { Link } from "wouter";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ValetTicketWizard } from "@/components/valet-ticket-wizard";
import type { Faq, SystemSetting, OrganizationalUnit, PhysicalLocation, User, SafeUser, UserLocationScope, ValetTicket } from "@shared/schema";
import { format } from "date-fns";

function RegistrationsBadge() {
  const { data: pending } = useQuery<any[]>({ queryKey: ['/api/admin/pending-registrations'] });
  const { data: newStregis } = useQuery<any[]>({ queryKey: ['/api/admin/new-stregis-accounts'] });
  const total = (pending?.length ?? 0) + (newStregis?.length ?? 0);
  if (!total) return null;
  return (
    <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-red-500 text-white">
      {total > 9 ? '9+' : total}
    </span>
  );
}

function PendingRegistrationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approveOU, setApproveOU] = useState("");
  const [approveRole, setApproveRole] = useState("");

  const { data: pending, isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/pending-registrations'],
    refetchInterval: 15000,
  });

  const { data: newStregisAccounts, isLoading: isLoadingStregis } = useQuery<any[]>({
    queryKey: ['/api/admin/new-stregis-accounts'],
    refetchInterval: 15000,
  });

  const activateStregisMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/new-stregis-accounts/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/new-stregis-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Account Activated", description: "The staff account is now active. A confirmation email has been sent." });
    },
    onError: () => toast({ title: "Error", description: "Failed to activate account.", variant: "destructive" }),
  });

  const rejectStregisMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/new-stregis-accounts/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/new-stregis-accounts'] });
      toast({ title: "Account Rejected", description: "The registration has been rejected." });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject account.", variant: "destructive" }),
  });

  const { data: ous } = useQuery<any[]>({ queryKey: ['/api/ous'] });

  const approveMutation = useMutation({
    mutationFn: ({ id, ouId, role }: { id: string; ouId: string; role: string }) =>
      apiRequest("POST", `/api/admin/pending-registrations/${id}/approve`, { ouId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setApproveTarget(null);
      setApproveOU("");
      setApproveRole("");
      toast({ title: "Account approved", description: "The user has been activated and will receive a confirmation email." });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to approve account.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/pending-registrations/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-registrations'] });
      toast({ title: "Registration rejected", description: "The account has been removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject account.", variant: "destructive" }),
  });

  const handleApproveSubmit = () => {
    if (!approveOU) { toast({ title: "Required", description: "Please select an Organization.", variant: "destructive" }); return; }
    if (!approveRole) { toast({ title: "Required", description: "Please select a Role.", variant: "destructive" }); return; }
    approveMutation.mutate({ id: approveTarget.id, ouId: approveOU, role: approveRole });
  };

  const totalCount = (newStregisAccounts?.length ?? 0) + (pending?.length ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">Registrations</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Staff accounts awaiting your approval before they can access the system.
        </p>
      </div>

      {/* @stregis.com accounts pending activation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">@stregis.com Staff Registrations</h3>
          {Array.isArray(newStregisAccounts) && newStregisAccounts.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {newStregisAccounts.length} awaiting activation
            </span>
          )}
        </div>
        <Card className="border-amber-200">
          <CardContent className="p-0">
            {isLoadingStregis ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
            ) : !Array.isArray(newStregisAccounts) || newStregisAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserCheck size={32} className="text-gray-200 mb-2" />
                <p className="text-gray-400 text-sm">No pending @stregis.com registrations</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {newStregisAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-amber-700">
                        {(acc.firstName?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {[acc.firstName, acc.lastName].filter(Boolean).join(' ') || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {acc.createdAt ? format(new Date(acc.createdAt), 'MMM d, yyyy HH:mm') : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3 gap-1"
                        disabled={activateStregisMutation.isPending || rejectStregisMutation.isPending}
                        onClick={() => activateStregisMutation.mutate(acc.id)}
                      >
                        <UserCheck size={12} /> Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-3 gap-1"
                        disabled={activateStregisMutation.isPending || rejectStregisMutation.isPending}
                        onClick={() => rejectStregisMutation.mutate(acc.id)}
                      >
                        <UserX size={12} /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Other Pending Registrations</h3>
          {Array.isArray(pending) && pending.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {pending.length} waiting
            </span>
          )}
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) { setApproveTarget(null); setApproveOU(""); setApproveRole(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-regis-navy">Approve Registration</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-sm text-gray-900">{[approveTarget.firstName, approveTarget.lastName].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-gray-500">{approveTarget.email}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                You must assign an Organization and Role before this account is activated.
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Organization (OU) *</label>
                  <Select value={approveOU} onValueChange={setApproveOU}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(ous || []).map((ou: any) => (
                        <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
                  <Select value={approveRole} onValueChange={setApproveRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard_user">Standard User (view only)</SelectItem>
                      <SelectItem value="standard_admin">Standard Admin (operational access)</SelectItem>
                      <SelectItem value="privilege_admin">Privilege Admin (OU management)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                  onClick={handleApproveSubmit}
                  disabled={approveMutation.isPending || !approveOU || !approveRole}
                >
                  {approveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Approve & Activate
                </Button>
                <Button variant="outline" onClick={() => { setApproveTarget(null); setApproveOU(""); setApproveRole(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : !Array.isArray(pending) || pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <UserCheck size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No pending registrations</p>
              <p className="text-gray-400 text-xs mt-1">All self-registered accounts have been reviewed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pending.map((reg) => (
                <div key={reg.id} className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700">
                          {(reg.firstName?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900">
                          {[reg.firstName, reg.lastName].filter(Boolean).join(' ') || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{reg.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-10 flex-wrap">
                      <Clock size={11} className="text-gray-400" />
                      <span className="text-[11px] text-gray-400">
                        {reg.createdAt ? format(new Date(reg.createdAt), 'MMM d, yyyy HH:mm') : '—'}
                      </span>
                      {reg.accountStatus === 'pending_email_verification' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                          ⏳ Awaiting email click
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                          ✓ Email verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3 gap-1"
                      onClick={() => setApproveTarget(reg)}
                      disabled={rejectMutation.isPending}
                    >
                      <UserCheck size={13} /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-3 gap-1"
                      onClick={() => rejectMutation.mutate(reg.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <UserX size={13} /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isSuperAdmin = user?.role === 'superadmin';
  const isPrivilegeAdmin = user?.role === 'privilege_admin';
  const defaultTab = isSuperAdmin ? "ous" : "locations";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  const [showAddOU, setShowAddOU] = useState(false);
  const [newOU, setNewOU] = useState({ name: "", code: "", contactEmail: "", contactPhone: "" });
  const [editingOU, setEditingOU] = useState<OrganizationalUnit | null>(null);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: "", address: "", code: "", ouId: "" });
  const [editingLocation, setEditingLocation] = useState<PhysicalLocation | null>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: "", password: "", email: "", firstName: "", lastName: "", 
    role: "standard_admin", ouId: "", locationId: "" 
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserPassword, setEditUserPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showTicketWizard, setShowTicketWizard] = useState(false);
  const [managingUserScopes, setManagingUserScopes] = useState<User | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'storage'>('day');
  const [reportOuId, setReportOuId] = useState('');
  const [reportLocationId, setReportLocationId] = useState('');
  const [usersOuId, setUsersOuId] = useState('');
  const [userLocationScopes, setUserLocationScopes] = useState<UserLocationScope[]>([]);

  // Backup state
  const [backupOuId, setBackupOuId] = useState('');
  const [backupRange, setBackupRange] = useState<'1d'|'7d'|'30d'|'3m'|'6m'|'1y'|'all'>('30d');
  const [backupFormat, setBackupFormat] = useState<'csv'|'json'>('csv');
  const [backupIncludeTickets, setBackupIncludeTickets] = useState(true);
  const [backupIncludeUsers, setBackupIncludeUsers] = useState(false);
  const [backupIncludeLocations, setBackupIncludeLocations] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [pdfRange, setPdfRange] = useState<'1d'|'7d'|'30d'|'3m'|'6m'|'1y'|'all'>('7d');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfIncludeCarPhoto, setPdfIncludeCarPhoto] = useState(false);
  const [pdfIncludePlatePhoto, setPdfIncludePlatePhoto] = useState(false);

  const RANGE_LABELS: Record<string, string> = {
    '1d': 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days',
    '3m': 'Last 3 months', '6m': 'Last 6 months', '1y': 'Last year', 'all': 'All time',
  };

  function toCSV(rows: Record<string, any>[]): string {
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const body = rows.map(r =>
      keys.map(k => { const v = r[k] ?? ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(',')
    );
    return [header, ...body].join('\n');
  }

  function triggerDownload(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFullExport() {
    if (!backupIncludeTickets && !backupIncludeUsers && !backupIncludeLocations) {
      toast({ title: 'Nothing selected', description: 'Select at least one data type to export.', variant: 'destructive' }); return;
    }
    setBackupLoading(true);
    try {
      const params = new URLSearchParams({
        range: backupRange,
        includeTickets: String(backupIncludeTickets),
        includeUsers: String(backupIncludeUsers),
        includeLocations: String(backupIncludeLocations),
        ...(isSuperAdmin && backupOuId ? { ouId: backupOuId } : {}),
      });
      const res = await fetch(`/api/backup/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const _d = new Date();
      const stamp = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

      if (backupFormat === 'json') {
        triggerDownload(JSON.stringify(data, null, 2), `backup_${stamp}.json`, 'application/json');
      } else {
        const parts: string[] = [];
        if (data.tickets?.length)   parts.push(`=== TICKETS ===\n${toCSV(data.tickets)}`);
        if (data.users?.length)     parts.push(`=== USERS ===\n${toCSV(data.users)}`);
        if (data.locations?.length) parts.push(`=== LOCATIONS ===\n${toCSV(data.locations)}`);
        triggerDownload(parts.join('\n\n'), `backup_${stamp}.csv`, 'text/csv');
      }
      toast({ title: 'Export complete', description: `Downloaded as ${backupFormat.toUpperCase()}.` });
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not generate export. Try again.', variant: 'destructive' });
    } finally {
      setBackupLoading(false);
    }
  }

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({
        range: pdfRange,
        includeTickets: 'true',
        includeUsers: 'false',
        includeLocations: 'false',
        ...(isSuperAdmin && backupOuId ? { ouId: backupOuId } : {}),
      });
      const res = await fetch(`/api/backup/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const departed: any[] = (data.tickets || []).filter((t: any) => t.status === 'completed');

      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // pdf-lib StandardFonts only support WinAnsi (Latin-1). Strip non-encodable characters.
      const sanitize = (s: string) => (s || '-')
        .replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/\u2012/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

      const doc = await PDFDocument.create();
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const W = 595, H = 842, M = 40;
      let page = doc.addPage([W, H]);
      let y = H - M;

      const _now = new Date();
      const stamp = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
      const rangeLabel = RANGE_LABELS[pdfRange];

      // Title
      page.drawText('Departed History Report', { x: M, y, font: fontBold, size: 18, color: rgb(0.1,0.1,0.1) });
      y -= 22;
      page.drawText(`Range: ${rangeLabel}   |   Generated: ${stamp}   |   Total: ${departed.length} records`, { x: M, y, font, size: 10, color: rgb(0.45,0.45,0.45) });
      y -= 18;
      page.drawRectangle({ x: M, y, width: W - M*2, height: 1, color: rgb(0.8,0.7,0.2) });
      y -= 16;

      if (departed.length === 0) {
        page.drawText('No departed tickets found for the selected period.', { x: M, y, font, size: 12, color: rgb(0.5,0.5,0.5) });
      }

      // Fetch image bytes — uses proxy for object storage paths, direct fetch for data: URLs
      const fetchPhotoBytes = async (photoPath: string): Promise<Uint8Array | null> => {
        try {
          const url = photoPath.startsWith('data:')
            ? photoPath
            : `/api/backup/photo?path=${encodeURIComponent(photoPath)}`;
          const r = await fetch(url);
          if (!r.ok) return null;
          return new Uint8Array(await r.arrayBuffer());
        } catch { return null; }
      };
      const tryEmbedPhoto = async (bytes: Uint8Array) => {
        try { return await doc.embedJpg(bytes); } catch {}
        try { return await doc.embedPng(bytes); } catch {}
        return null;
      };

      for (const t of departed) {
        const hasCarPhoto = pdfIncludeCarPhoto && !!t.carPhoto;
        const hasPlatePhoto = pdfIncludePlatePhoto && !!t.platePhotoUrl;
        const hasAnyPhoto = hasCarPhoto || hasPlatePhoto;
        const neededHeight = 50 + (hasAnyPhoto ? 130 : 0);
        if (y < 60 + neededHeight) { page = doc.addPage([W, H]); y = H - M; }

        const car = sanitize(`${t.carColor || ''} ${t.carMake || ''} ${t.carModel || ''}`.trim() || '-');
        const plate = sanitize(t.licensePlate || '-');
        const checkedIn = t.createdAt ? new Date(t.createdAt).toLocaleString('en-GB', { hour12: false }) : '-';
        const departed2 = t.departedAt ? new Date(t.departedAt).toLocaleString('en-GB', { hour12: false }) : '-';
        const stay = t.totalStaySeconds ? `${Math.floor(t.totalStaySeconds/3600)}h ${Math.floor((t.totalStaySeconds%3600)/60)}m` : '-';
        const visitor = t.visitorType === 'hotel_guest' ? 'Hotel' : t.visitorType === 'restaurant' ? 'Restaurant' : 'Other';
        const rawGuest = (t.guestName || '').replace(/^(Mr\.|Mrs\.|Ms\.|Mx\.|Dr\.|Miss|Sir|Lord)\s*/i, '').trim();
        const guestName = sanitize(rawGuest ? rawGuest : '-');

        page.drawText(`#${t.ticketNumber}`, { x: M, y, font: fontBold, size: 11, color: rgb(0.15,0.15,0.15) });
        page.drawText(guestName, { x: M + 54, y, font, size: 11, color: rgb(0.15,0.15,0.15) });
        page.drawText(visitor, { x: W - M - 60, y, font, size: 9, color: rgb(0.5,0.5,0.5) });
        y -= 14;
        page.drawText(car, { x: M + 10, y, font, size: 9, color: rgb(0.3,0.3,0.3) });
        page.drawText(`Plate: ${plate}`, { x: M + 220, y, font, size: 9, color: rgb(0.3,0.3,0.3) });
        page.drawText(`Stay: ${stay}`, { x: W - M - 80, y, font, size: 9, color: rgb(0.3,0.3,0.3) });
        y -= 12;
        page.drawText(`In: ${checkedIn}`, { x: M + 10, y, font, size: 8, color: rgb(0.5,0.5,0.5) });
        page.drawText(`Out: ${departed2}`, { x: M + 200, y, font, size: 8, color: rgb(0.5,0.5,0.5) });
        y -= 12;

        if (hasAnyPhoto) {
          let photoRowH = 0;
          let xOff = M + 10;

          // Car photo (full vehicle shot)
          if (hasCarPhoto) {
            const bytes = await fetchPhotoBytes(t.carPhoto);
            if (bytes) {
              const img = await tryEmbedPhoto(bytes);
              if (img) {
                const iW = 160, iH = 120;
                page.drawImage(img, { x: xOff, y: y - iH, width: iW, height: iH });
                photoRowH = Math.max(photoRowH, iH);
                xOff += iW + 8;
              }
            }
          }

          // Plate photo (cropped plate image, typically wide/short)
          if (hasPlatePhoto) {
            const bytes = await fetchPhotoBytes(t.platePhotoUrl);
            if (bytes) {
              const img = await tryEmbedPhoto(bytes);
              if (img) {
                const iW = 170, iH = 60;
                page.drawImage(img, { x: xOff, y: y - iH, width: iW, height: iH });
                photoRowH = Math.max(photoRowH, iH);
              }
            }
          }

          if (photoRowH > 0) y -= (photoRowH + 8);
        }

        page.drawRectangle({ x: M, y, width: W - M*2, height: 0.5, color: rgb(0.88,0.88,0.88) });
        y -= 12;
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `departed_history_${stamp}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF ready', description: `${departed.length} departed tickets exported.` });
    } catch (e: any) {
      toast({ title: 'PDF failed', description: e?.message || 'Could not generate PDF. Try again.', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  }

  const { data: allTickets } = useQuery<ValetTicket[]>({
    queryKey: ["/api/staff/tickets"],
  });

  const { data: faqs, isLoading: faqsLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const { data: ous, isLoading: ousLoading } = useQuery<OrganizationalUnit[]>({
    queryKey: ["/api/ous"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<PhysicalLocation[]>({
    queryKey: ["/api/locations"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const handleError = (error: any, defaultMsg: string) => {
    if (isUnauthorizedError(error)) {
      toast({ title: "Unauthorized", description: "Session expired. Redirecting...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
    // Try to extract detailed error message from response
    const errorMsg = error?.response?.data?.message || defaultMsg;
    toast({ title: "Error", description: errorMsg, variant: "destructive" });
  };

  const createOUMutation = useMutation({
    mutationFn: async (ou: typeof newOU) => await apiRequest("POST", "/api/ous", ou),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      setShowAddOU(false);
      setNewOU({ name: "", code: "", contactEmail: "", contactPhone: "" });
      toast({ title: "Success", description: "Organization created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create organization"),
  });

  const updateOUMutation = useMutation({
    mutationFn: async (ou: OrganizationalUnit) => await apiRequest("PATCH", `/api/ous/${ou.id}`, ou),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      setEditingOU(null);
      toast({ title: "Success", description: "Organization updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update organization"),
  });

  const deleteOUMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/ous/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ous"] });
      toast({ title: "Success", description: "Organization deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete organization"),
  });

  const createLocationMutation = useMutation({
    mutationFn: async (loc: typeof newLocation) => await apiRequest("POST", "/api/locations", loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setShowAddLocation(false);
      setNewLocation({ name: "", address: "", code: "", ouId: "" });
      toast({ title: "Success", description: "Location created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create location"),
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (loc: PhysicalLocation) => await apiRequest("PATCH", `/api/locations/${loc.id}`, loc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setEditingLocation(null);
      toast({ title: "Success", description: "Location updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update location"),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/locations/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Success", description: "Location deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete location"),
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => await apiRequest("POST", "/api/users", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowAddUser(false);
      setNewUser({ username: "", password: "", email: "", firstName: "", lastName: "", role: "standard_admin", ouId: "", locationId: "" });
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create user"),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userData, password }: { userData: User; password?: string }) => {
      const updatePayload: any = {
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        ouId: userData.ouId,
        locationId: userData.locationId,
      };
      if (password) {
        updatePayload.password = password;
      }
      return await apiRequest("PATCH", `/api/users/${userData.id}`, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      setEditUserPassword("");
      setShowEditPassword(false);
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update user"),
  });

  const fetchUserLocationScopes = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/location-scopes`);
      if (response.ok) {
        const scopes = await response.json();
        setUserLocationScopes(scopes);
      }
    } catch (error) {
      console.error("Error fetching location scopes:", error);
    }
  };

  const addLocationScopeMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: string; locationId: string }) => 
      await apiRequest("POST", `/api/users/${userId}/location-scopes`, { locationId }),
    onSuccess: () => {
      if (managingUserScopes) {
        fetchUserLocationScopes(managingUserScopes.id);
      }
      toast({ title: "Success", description: "Location added to user's access" });
    },
    onError: (error) => handleError(error, "Failed to add location access"),
  });

  const removeLocationScopeMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: string; locationId: string }) => 
      await apiRequest("DELETE", `/api/users/${userId}/location-scopes/${locationId}`, {}),
    onSuccess: () => {
      if (managingUserScopes) {
        fetchUserLocationScopes(managingUserScopes.id);
      }
      toast({ title: "Success", description: "Location removed from user's access" });
    },
    onError: (error) => handleError(error, "Failed to remove location access"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete user"),
  });

  const toggle2faMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("PATCH", `/api/users/${id}/toggle-2fa`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "2FA setting updated" });
    },
    onError: (error) => handleError(error, "Failed to update 2FA"),
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("PATCH", `/api/users/${id}/toggle-hidden`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "Account visibility updated" });
    },
    onError: (error) => handleError(error, "Failed to update visibility"),
  });

  const createFaqMutation = useMutation({
    mutationFn: async (faq: { question: string; answer: string }) => await apiRequest("POST", "/api/admin/faqs", faq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setNewFaq({ question: "", answer: "" });
      toast({ title: "Success", description: "FAQ created successfully" });
    },
    onError: (error) => handleError(error, "Failed to create FAQ"),
  });

  const updateFaqMutation = useMutation({
    mutationFn: async (faq: any) => await apiRequest("PATCH", `/api/admin/faqs/${faq.id}`, { question: faq.question, answer: faq.answer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setEditingFaq(null);
      toast({ title: "Success", description: "FAQ updated successfully" });
    },
    onError: (error) => handleError(error, "Failed to update FAQ"),
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/admin/faqs/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({ title: "Success", description: "FAQ deleted successfully" });
    },
    onError: (error) => handleError(error, "Failed to delete FAQ"),
  });

  const getOUName = (ouId: string | null | undefined) => {
    if (!ouId) return "—";
    const ou = ous?.find(o => o.id === ouId);
    return ou?.name || "Unknown";
  };

  const getLocationName = (locationId: string | null | undefined) => {
    if (!locationId) return "—";
    const loc = locations?.find(l => l.id === locationId);
    return loc?.name || "Unknown";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-600';
      case 'privilege_admin': return 'bg-blue-600';
      case 'standard_user': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'privilege_admin': return 'Priv Admin';
      case 'standard_admin': return 'Std Admin';
      case 'standard_user': return 'Std User';
      default: return role;
    }
  };

  const userOUName = user?.ouId ? getOUName(user.ouId) : null;
  
  const filteredLocations = isPrivilegeAdmin && user?.ouId 
    ? locations?.filter(l => l.ouId === user.ouId) 
    : locations;
  
  const filteredUsers = isPrivilegeAdmin && user?.ouId
    ? users?.filter(u => u.ouId === user.ouId && u.role !== 'superadmin')
    : isSuperAdmin && usersOuId
      ? users?.filter(u => u.ouId === usersOuId)
      : users;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                {isSuperAdmin ? <Shield className="text-regis-navy" size={20} /> : <Crown className="text-regis-navy" size={20} />}
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold text-regis-navy truncate">
                  {isSuperAdmin ? "Super Admin" : "Admin Panel"}
                </h1>
                <p className="text-gray-500 text-xs sm:text-sm truncate">
                  {isSuperAdmin ? "Multi-Tenant System" : userOUName || "Management"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {isPrivilegeAdmin && userOUName && (
                <Badge className="bg-blue-600 text-white text-xs hidden sm:inline-flex">{userOUName}</Badge>
              )}
              <Button 
                onClick={() => setShowTicketWizard(true)}
                size="sm"
                className="bg-regis-gold hover:bg-yellow-600 text-regis-navy font-semibold px-2 sm:px-3"
                data-testid="button-new-valet-ticket"
              >
                <Car size={16} />
                <span className="hidden sm:inline ml-2">New Ticket</span>
              </Button>
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white px-2 sm:px-3"
                  data-testid="button-back-home"
                >
                  <Home size={16} />
                  <span className="hidden sm:inline ml-2">Home</span>
                </Button>
              </Link>
              <a 
                href="/api/logout"
                className="flex items-center text-gray-500 hover:text-regis-navy p-2" 
                data-testid="link-logout"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline ml-2">Logout</span>
              </a>
            </div>
          </div>
        </div>
        {/* Full-width banner — desktop only */}
        <div className="hidden sm:block w-full overflow-hidden">
          <img
            src={valetBanner7a}
            alt="Valet-S"
            className="w-full h-auto block"
            style={{ marginTop: '-3%', marginBottom: '-3%' }}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className={`inline-flex w-auto min-w-full sm:grid sm:w-full ${isSuperAdmin ? 'sm:grid-cols-7' : 'sm:grid-cols-4'}`}>
              {isSuperAdmin && (
                <TabsTrigger value="ous" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-ous">
                  <Building size={14} />
                  <span className="hidden sm:inline">Organizations</span>
                  <span className="sm:hidden">Orgs</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="locations" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-locations">
                <MapPin size={14} />
                <span className="hidden sm:inline">Locations</span>
                <span className="sm:hidden">Loc</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-users">
                <Users size={14} />
                <span className="hidden sm:inline">{isPrivilegeAdmin ? "Staff" : "Users"}</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="faqs" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-faqs">
                  <HelpCircle size={14} />
                  <span>FAQs</span>
                </TabsTrigger>
              )}
              {isSuperAdmin && (
                <TabsTrigger value="registrations" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-registrations">
                  <UserCheck size={14} />
                  <span className="hidden sm:inline">Registrations</span>
                  <span className="sm:hidden">Regs</span>
                  <RegistrationsBadge />
                </TabsTrigger>
              )}
              <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-reports">
                <BarChart2 size={14} />
                <span>Reports</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-backup">
                <Database size={14} />
                <span>Backup</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ous" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">Organizations</h2>
                <p className="text-xs sm:text-base text-gray-600">Manage client companies</p>
              </div>
              <Button onClick={() => setShowAddOU(true)} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" data-testid="button-add-ou">
                <Plus size={16} className="mr-2" />
                Add Organization
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ousLoading ? (
                <p className="text-gray-500">Loading organizations...</p>
              ) : ous?.length === 0 ? (
                <p className="text-gray-500">No organizations found. Create one to get started.</p>
              ) : (
                ous?.map((ou) => (
                  <Card key={ou.id} className="shadow-sm" data-testid={`card-ou-${ou.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="text-blue-600" size={20} />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingOU(ou)} data-testid={`button-edit-ou-${ou.id}`}>
                            <Edit size={16} className="text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (confirm("Delete this organization? This will affect all users and locations.")) {
                              deleteOUMutation.mutate(ou.id);
                            }
                          }} data-testid={`button-delete-ou-${ou.id}`}>
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg text-regis-navy">{ou.name}</h3>
                      <Badge variant="outline" className="mt-2">{ou.code}</Badge>
                      {ou.contactEmail && <p className="text-sm text-gray-600 mt-2">{ou.contactEmail}</p>}
                      <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-500">
                        <span>{locations?.filter(l => l.ouId === ou.id).length || 0} locations</span>
                        <span>{users?.filter(u => u.ouId === ou.id).length || 0} users</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">Locations</h2>
                <p className="text-xs sm:text-base text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage locations for ${userOUName || 'your org'}`
                    : "Manage valet service locations"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewLocation({ ...newLocation, ouId: user.ouId });
                }
                setShowAddLocation(true);
              }} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" disabled={isSuperAdmin && !ous?.length} data-testid="button-add-location">
                <Plus size={16} className="mr-2" />
                Add Location
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {locationsLoading ? (
                  <p className="p-4 sm:p-6 text-gray-500">Loading locations...</p>
                ) : filteredLocations?.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm">
                    {isPrivilegeAdmin 
                      ? "No locations found. Add one to get started."
                      : "No locations found. Create an organization first."}
                  </p>
                ) : (
                  <div className="space-y-2 p-2 sm:hidden">
                    {/* Mobile card view */}
                    {filteredLocations?.map((loc) => (
                      <div key={loc.id} className="border rounded-lg p-3 bg-gray-50" data-testid={`card-location-${loc.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs flex-shrink-0">{loc.code}</Badge>
                              <span className="font-medium text-sm truncate">{loc.name}</span>
                            </div>
                            {isSuperAdmin && (
                              <p className="text-xs text-gray-500 truncate">Org: {getOUName(loc.ouId)}</p>
                            )}
                            {loc.address && (
                              <p className="text-xs text-gray-500 truncate mt-1">{loc.address}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLocation(loc)} data-testid={`button-edit-location-${loc.id}`}>
                              <Edit size={14} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              if (confirm("Delete this location?")) {
                                deleteLocationMutation.mutate(loc.id);
                              }
                            }} data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 size={14} className="text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Desktop table view */}
                {filteredLocations && filteredLocations.length > 0 && (
                  <div className="overflow-x-auto hidden sm:block">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {isSuperAdmin && <th className="text-left p-4 font-medium text-gray-600 text-sm">Org</th>}
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Code</th>
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Location</th>
                          <th className="text-left p-4 font-medium text-gray-600 text-sm">Address</th>
                          <th className="text-right p-4 font-medium text-gray-600 text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLocations?.map((loc) => (
                          <tr key={loc.id} className="border-t" data-testid={`row-location-${loc.id}`}>
                            {isSuperAdmin && <td className="p-4 text-gray-600 text-sm truncate max-w-[120px]">{getOUName(loc.ouId)}</td>}
                            <td className="p-4"><Badge variant="outline" className="text-xs">{loc.code}</Badge></td>
                            <td className="p-4 font-medium text-sm">{loc.name}</td>
                            <td className="p-4 text-gray-600 text-sm truncate max-w-[200px]">{loc.address || "—"}</td>
                            <td className="p-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingLocation(loc)} data-testid={`button-edit-location-${loc.id}`}>
                                <Edit size={14} className="text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                if (confirm("Delete this location?")) {
                                  deleteLocationMutation.mutate(loc.id);
                                }
                              }} data-testid={`button-delete-location-${loc.id}`}>
                                <Trash2 size={14} className="text-red-600" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 sm:space-y-6">
            {/* OU selector — Super Admin must pick an OU before seeing users */}
            {isSuperAdmin && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Organisation</label>
                  <select
                    value={usersOuId}
                    onChange={e => setUsersOuId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-regis-navy"
                  >
                    <option value="">— Select OU —</option>
                    {(ous || []).map(ou => (
                      <option key={ou.id} value={ou.id}>{ou.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Placeholder until OU is selected */}
            {isSuperAdmin && !usersOuId ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <Users size={48} className="opacity-20 mb-3" />
                <p className="text-base font-medium">Select an Organisation</p>
                <p className="text-sm mt-1">Choose an OU above to view its users</p>
              </div>
            ) : (
            <>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-regis-navy">
                  {isPrivilegeAdmin ? "Staff" : "Users"}
                </h2>
                <p className="text-xs sm:text-base text-gray-600">
                  {isPrivilegeAdmin 
                    ? `Manage staff for ${userOUName || 'your org'}`
                    : "Manage admin accounts"}
                </p>
              </div>
              <Button onClick={() => {
                if (isPrivilegeAdmin && user?.ouId) {
                  setNewUser({ ...newUser, ouId: user.ouId, role: 'standard_admin' });
                }
                setShowAddUser(true);
              }} size="sm" className="bg-regis-navy hover:bg-blue-900 w-full sm:w-auto" data-testid="button-add-user">
                <Plus size={16} className="mr-2" />
                {isPrivilegeAdmin ? "Add Staff" : "Add User"}
              </Button>
            </div>

            {isSuperAdmin && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-purple-600">{users?.filter(u => u.role === 'superadmin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Super</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{users?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Privilege</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-gray-600">{users?.filter(u => u.role === 'standard_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Standard</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {isPrivilegeAdmin && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{filteredUsers?.filter(u => u.role === 'privilege_admin').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Privilege</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-gray-600">{filteredUsers?.filter(u => u.role === 'standard_admin' || u.role === 'standard_user').length || 0}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Staff</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <p className="p-4 sm:p-6 text-gray-500">Loading users...</p>
                ) : filteredUsers?.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm">
                    {isPrivilegeAdmin ? "No staff found. Add one to get started." : "No users found."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">User</th>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden sm:table-cell">Username</th>
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Role</th>
                          {isSuperAdmin && <th className="text-center p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">2FA</th>}
                          {isSuperAdmin && <th className="text-center p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Hide</th>}
                          {isSuperAdmin && <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden md:table-cell">Org</th>}
                          <th className="text-left p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm hidden md:table-cell">Location</th>
                          <th className="text-right p-2 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers?.map((u) => (
                          <tr key={u.id} className={`border-t ${(u as any).isHidden ? 'opacity-40' : ''}`} data-testid={`row-user-${u.id}`}>
                            <td className="p-2 sm:p-4">
                              <div>
                                <p className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none flex items-center gap-1">
                                  {u.firstName} {u.lastName}
                                  {(u as any).isHidden && <EyeOff size={11} className="text-gray-400 shrink-0" title="Hidden account" />}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-none">{u.email}</p>
                              </div>
                            </td>
                            <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden sm:table-cell">{u.username}</td>
                            <td className="p-2 sm:p-4">
                              <Badge className={`${getRoleBadgeColor(u.role)} text-white text-xs`}>
                                {getRoleLabel(u.role)}
                              </Badge>
                            </td>
                            {isSuperAdmin && (
                              <td className="p-2 sm:p-4 text-center">
                                <button
                                  onClick={() => toggle2faMutation.mutate(u.id)}
                                  title={u.twoFactorEnabled ? "2FA Enabled — click to disable" : "2FA Disabled — click to enable"}
                                  data-testid={`button-toggle-2fa-${u.id}`}
                                  disabled={toggle2faMutation.isPending}
                                  className="inline-flex items-center justify-center rounded-full w-8 h-8 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                >
                                  <ShieldCheck size={18} className={u.twoFactorEnabled ? "text-green-600" : "text-gray-300"} />
                                </button>
                              </td>
                            )}
                            {isSuperAdmin && (
                              <td className="p-2 sm:p-4 text-center">
                                <button
                                  onClick={() => toggleHiddenMutation.mutate(u.id)}
                                  title={(u as any).isHidden ? "Hidden — click to make visible" : "Visible — click to hide from others"}
                                  disabled={toggleHiddenMutation.isPending}
                                  className="inline-flex items-center justify-center rounded-full w-8 h-8 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                >
                                  {(u as any).isHidden
                                    ? <EyeOff size={18} className="text-orange-500" />
                                    : <Eye size={18} className="text-gray-300" />
                                  }
                                </button>
                              </td>
                            )}
                            {isSuperAdmin && <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden md:table-cell truncate max-w-[80px]">{getOUName(u.ouId)}</td>}
                            <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm hidden md:table-cell truncate max-w-[80px]">{getLocationName(u.locationId)}</td>
                            <td className="p-2 sm:p-4 text-right flex justify-end gap-1">
                            {u.role === 'standard_admin' && (isPrivilegeAdmin || isSuperAdmin) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setManagingUserScopes(u);
                                  fetchUserLocationScopes(u.id);
                                }}
                                title="Manage Location Access"
                                data-testid={`button-manage-scopes-${u.id}`}
                              >
                                <MapPin size={16} className="text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setEditUserPassword(""); setShowEditPassword(false); }} data-testid={`button-edit-user-${u.id}`}>
                              <Edit size={16} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (u.id === user?.id) {
                                toast({ title: "Error", description: "Cannot delete your own account", variant: "destructive" });
                                return;
                              }
                              if (confirm("Delete this user?")) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }} data-testid={`button-delete-user-${u.id}`}>
                              <Trash2 size={16} className="text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>

          <TabsContent value="faqs" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-regis-navy">FAQ Management</h2>
                <p className="text-gray-600">Manage frequently asked questions for customers</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-4 mb-6">
                  {faqsLoading ? (
                    <p className="text-gray-500">Loading FAQs...</p>
                  ) : faqs?.length === 0 ? (
                    <p className="text-gray-500">No FAQs found</p>
                  ) : (
                    faqs?.map((faq: any) => (
                      <div key={faq.id} className="border border-gray-200 rounded-lg p-4" data-testid={`card-faq-${faq.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">{faq.question}</h3>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingFaq(faq)}>
                              <Edit size={16} className="text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (confirm("Delete this FAQ?")) {
                                deleteFaqMutation.mutate(faq.id);
                              }
                            }}>
                              <Trash2 size={16} className="text-red-600" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{faq.answer}</p>
                      </div>
                    ))
                  )}
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-2 border-dashed border-gray-300 hover:border-regis-gold" data-testid="button-add-faq">
                      <Plus className="mr-2" size={16} />
                      Add New FAQ
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New FAQ</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input placeholder="Question" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} data-testid="input-faq-question" />
                      <Textarea placeholder="Answer" value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} data-testid="input-faq-answer" />
                      <Button onClick={() => createFaqMutation.mutate(newFaq)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createFaqMutation.isPending} data-testid="button-submit-faq">
                        Create FAQ
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            {/* OU + Location selectors — required before report is shown */}
            {isSuperAdmin && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Organisation</label>
                  <select
                    value={reportOuId}
                    onChange={e => { setReportOuId(e.target.value); setReportLocationId(''); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-regis-navy"
                  >
                    <option value="">— Select OU —</option>
                    {(ous || []).map(ou => (
                      <option key={ou.id} value={ou.id}>{ou.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
                  <select
                    value={reportLocationId}
                    onChange={e => setReportLocationId(e.target.value)}
                    disabled={!reportOuId}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-regis-navy disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">— Select Location —</option>
                    {(locations || []).filter(l => l.ouId === reportOuId).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Placeholder shown until OU + Location are both selected */}
            {isSuperAdmin && (!reportOuId || !reportLocationId) ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <BarChart2 size={48} className="opacity-20 mb-3" />
                <p className="text-base font-medium">Select an Organisation and Location</p>
                <p className="text-sm mt-1">Choose both filters above to view the report</p>
              </div>
            ) : null}

            {(!isSuperAdmin || (reportOuId && reportLocationId)) && (() => {
              const tickets = isSuperAdmin
                ? (allTickets || []).filter(t => t.ouId === reportOuId && t.locationId === reportLocationId)
                : (allTickets || []);
              const now = new Date();
              const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
              const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const yearStart = new Date(now.getFullYear(), 0, 1);

              const completed = tickets.filter(t => t.status === 'completed');
              const completedToday = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= todayStart);
              const completedWeek = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= weekStart);
              const completedMonth = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= monthStart);
              const completedYear = completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= yearStart);

              const avgStay = (list: typeof completed) => {
                const withTime = list.filter(t => t.totalStaySeconds && t.totalStaySeconds > 0);
                if (!withTime.length) return null;
                const avg = withTime.reduce((s, t) => s + (t.totalStaySeconds || 0), 0) / withTime.length;
                const h = Math.floor(avg / 3600); const m = Math.floor((avg % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              };

              const barData = (() => {
                if (reportPeriod === 'day') {
                  return Array.from({length: 24}, (_, h) => ({
                    label: `${h.toString().padStart(2,'0')}:00`,
                    Departures: completedToday.filter(t => t.updatedAt && new Date(t.updatedAt).getHours() === h).length,
                    Arrivals: tickets.filter(t => t.createdAt && new Date(t.createdAt) >= todayStart && new Date(t.createdAt).getHours() === h).length,
                  }));
                }
                if (reportPeriod === 'week') {
                  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  return days.map((d, i) => {
                    const s = new Date(weekStart); s.setDate(weekStart.getDate() + i);
                    const e = new Date(s); e.setDate(s.getDate() + 1);
                    return { label: d, Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= s && new Date(t.updatedAt) < e).length, Arrivals: tickets.filter(t => t.createdAt && new Date(t.createdAt) >= s && new Date(t.createdAt) < e).length };
                  });
                }
                if (reportPeriod === 'month') {
                  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  return Array.from({length: days}, (_, i) => {
                    const s = new Date(now.getFullYear(), now.getMonth(), i + 1);
                    const e = new Date(now.getFullYear(), now.getMonth(), i + 2);
                    return { label: `${i+1}`, Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= s && new Date(t.updatedAt) < e).length, Arrivals: tickets.filter(t => t.createdAt && new Date(t.createdAt) >= s && new Date(t.createdAt) < e).length };
                  });
                }
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return months.map((m, i) => {
                  const s = new Date(now.getFullYear(), i, 1); const e = new Date(now.getFullYear(), i + 1, 1);
                  return { label: m, Departures: completed.filter(t => t.updatedAt && new Date(t.updatedAt) >= s && new Date(t.updatedAt) < e).length, Arrivals: tickets.filter(t => t.createdAt && new Date(t.createdAt) >= s && new Date(t.createdAt) < e).length };
                });
              })();

              const statusCounts = [
                { name: 'Cars Parked On-Site', value: tickets.filter(t => t.status === 'active').length, color: '#1e3a5f' },
                { name: 'Retrieving', value: tickets.filter(t => t.status === 'retrieving' || t.status === 'transit').length, color: '#f59e0b' },
                { name: 'Ready', value: tickets.filter(t => t.status === 'ready').length, color: '#10b981' },
                { name: 'Out Returning Later', value: tickets.filter(t => t.status === 'out_with_guest').length, color: '#3b82f6' },
                { name: 'Departed', value: tickets.filter(t => t.status === 'completed').length, color: '#6b7280' },
              ].filter(s => s.value > 0);

              const periodLabel = reportPeriod === 'day' ? 'Today' : reportPeriod === 'week' ? 'This Week' : reportPeriod === 'month' ? 'This Month' : 'This Year';
              const periodCount = reportPeriod === 'day' ? completedToday.length : reportPeriod === 'week' ? completedWeek.length : reportPeriod === 'month' ? completedMonth.length : completedYear.length;
              const periodArrivals = reportPeriod === 'day' ? tickets.filter(t => t.createdAt && new Date(t.createdAt) >= todayStart).length
                : reportPeriod === 'week' ? tickets.filter(t => t.createdAt && new Date(t.createdAt) >= weekStart).length
                : reportPeriod === 'month' ? tickets.filter(t => t.createdAt && new Date(t.createdAt) >= monthStart).length
                : tickets.filter(t => t.createdAt && new Date(t.createdAt) >= yearStart).length;
              const periodAvg = reportPeriod === 'day' ? avgStay(completedToday) : reportPeriod === 'week' ? avgStay(completedWeek) : reportPeriod === 'month' ? avgStay(completedMonth) : avgStay(completedYear);

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-regis-navy flex items-center gap-2">
                        <BarChart2 size={22} className="text-regis-gold" /> Operations Report
                      </h2>
                      <p className="text-sm text-gray-500 mt-0.5">Statistics and performance overview</p>
                    </div>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
                      {(['day','week','month','year','storage'] as const).map(p => (
                        <button key={p} onClick={() => setReportPeriod(p)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${reportPeriod === p ? 'bg-regis-navy text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}>
                          {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : p === 'year' ? 'Year' : 'Storage'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {reportPeriod !== 'storage' ? (
                    <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-regis-navy">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Arrivals</p>
                        <p className="text-3xl font-bold text-regis-navy mt-1">{periodArrivals}</p>
                        <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-gray-400">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Departures</p>
                        <p className="text-3xl font-bold text-gray-600 mt-1">{periodCount}</p>
                        <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-yellow-400">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Stay</p>
                        <p className="text-3xl font-bold text-amber-600 mt-1">{periodAvg ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-1">{periodLabel}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Currently In</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">{tickets.filter(t => t.status !== 'completed').length}</p>
                        <p className="text-xs text-gray-400 mt-1">Active tickets</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp size={18} className="text-regis-gold" />
                        Arrivals & Departures — {periodLabel}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {barData.every(d => d.Arrivals === 0 && d.Departures === 0) ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                          <BarChart2 size={40} className="opacity-30 mb-2" />
                          <p className="text-sm">No data for this period yet</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={reportPeriod === 'month' ? 4 : reportPeriod === 'day' ? 3 : 0} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="Arrivals" fill="#1e3a5f" radius={[3,3,0,0]} />
                            <Bar dataKey="Departures" fill="#6b7280" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarDays size={18} className="text-regis-gold" />
                          Current Status Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {statusCounts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <p className="text-sm">No active tickets</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                {statusCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp size={18} className="text-regis-gold" />
                          All-Time Totals
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-2">
                        {[
                          { label: 'Total Tickets Ever', value: tickets.length, color: 'text-regis-navy' },
                          { label: 'Total Departures', value: completed.length, color: 'text-gray-600' },
                          { label: 'Departed Today', value: completedToday.length, color: 'text-green-600' },
                          { label: 'Departed This Week', value: completedWeek.length, color: 'text-blue-600' },
                          { label: 'Departed This Month', value: completedMonth.length, color: 'text-amber-600' },
                          { label: 'Avg Stay (All Time)', value: avgStay(completed) ?? '—', color: 'text-purple-600' },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                            <span className="text-sm text-gray-600">{row.label}</span>
                            <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                    </>
                  ) : (() => {
                    // Storage breakdown — estimated from known record counts
                    const ticketCount = tickets.length;
                    const faqCount = faqs?.length ?? 0;
                    const locCount = locations?.length ?? 0;
                    const userCount = users?.length ?? 0;
                    const ouCount = ous?.length ?? 0;

                    // Rough estimates: each ticket ~2 KB text + ~80 KB plate image (if any)
                    const imgBytes = ticketCount * 80 * 1024;
                    const textBytes = (ticketCount * 2 + faqCount * 3 + userCount * 1 + locCount * 1 + ouCount * 1) * 1024;
                    const docBytes = ticketCount * 12 * 1024; // PDF label ~12 KB each
                    const sessionBytes = userCount * 4 * 1024;
                    const totalBytes = imgBytes + textBytes + docBytes + sessionBytes;

                    const fmt = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
                    const pct = (b: number) => totalBytes > 0 ? Math.round((b / totalBytes) * 100) : 0;

                    const categories = [
                      { label: 'Images', sublabel: 'License plate photos', bytes: imgBytes, color: 'bg-blue-500', textColor: 'text-blue-600', icon: '🖼️' },
                      { label: 'Documents', sublabel: 'PDF thermal labels', bytes: docBytes, color: 'bg-amber-500', textColor: 'text-amber-600', icon: '📄' },
                      { label: 'Text & Records', sublabel: 'Tickets, FAQs, users, locations', bytes: textBytes, color: 'bg-green-500', textColor: 'text-green-600', icon: '📝' },
                      { label: 'Sessions', sublabel: 'Auth & session data', bytes: sessionBytes, color: 'bg-purple-500', textColor: 'text-purple-600', icon: '🔐' },
                    ];

                    const pieData = categories.map(c => ({ name: c.label, value: c.bytes }));
                    const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <Card className="border-l-4 border-l-blue-500 col-span-2 sm:col-span-1">
                            <CardContent className="p-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Estimated</p>
                              <p className="text-2xl font-bold text-regis-navy mt-1">{fmt(totalBytes)}</p>
                              <p className="text-xs text-gray-400 mt-1">Across all categories</p>
                            </CardContent>
                          </Card>
                          <Card className="border-l-4 border-l-blue-400">
                            <CardContent className="p-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Images</p>
                              <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(imgBytes)}</p>
                              <p className="text-xs text-gray-400 mt-1">{pct(imgBytes)}% of total</p>
                            </CardContent>
                          </Card>
                          <Card className="border-l-4 border-l-amber-400">
                            <CardContent className="p-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Documents</p>
                              <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(docBytes)}</p>
                              <p className="text-xs text-gray-400 mt-1">{pct(docBytes)}% of total</p>
                            </CardContent>
                          </Card>
                          <Card className="border-l-4 border-l-green-400">
                            <CardContent className="p-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Text & Records</p>
                              <p className="text-2xl font-bold text-green-600 mt-1">{fmt(textBytes)}</p>
                              <p className="text-xs text-gray-400 mt-1">{pct(textBytes)}% of total</p>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Database size={18} className="text-regis-gold" />
                                Usage by Category
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: number) => fmt(v)} />
                                  <Legend wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Database size={18} className="text-regis-gold" />
                                Breakdown Detail
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                              {categories.map(cat => (
                                <div key={cat.label}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span>{cat.icon}</span>
                                      <div>
                                        <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                                        <p className="text-xs text-gray-400">{cat.sublabel}</p>
                                      </div>
                                    </div>
                                    <span className={`text-sm font-bold ${cat.textColor}`}>{fmt(cat.bytes)}</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className={`${cat.color} h-2 rounded-full transition-all`} style={{ width: `${pct(cat.bytes)}%` }} />
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5 text-right">{pct(cat.bytes)}%</p>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="border border-amber-200 bg-amber-50">
                          <CardContent className="p-4 flex items-start gap-3">
                            <span className="text-2xl">ℹ️</span>
                            <div>
                              <p className="text-sm font-medium text-amber-800">Estimated figures</p>
                              <p className="text-xs text-amber-700 mt-1">
                                These values are calculated from record counts using typical file size estimates (plate image ≈ 80 KB, PDF label ≈ 12 KB, text record ≈ 1–3 KB).
                                Actual cloud storage usage may differ. Based on <strong>{ticketCount}</strong> ticket{ticketCount !== 1 ? 's' : ''}, <strong>{faqCount}</strong> FAQ{faqCount !== 1 ? 's' : ''}, <strong>{userCount}</strong> user{userCount !== 1 ? 's' : ''}, and <strong>{locCount}</strong> location{locCount !== 1 ? 's' : ''}.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup" className="space-y-6">

            {/* OU selector — required for Super Admins before showing backup content */}
            {isSuperAdmin && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Organisation</label>
                  <select
                    value={backupOuId}
                    onChange={e => setBackupOuId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-regis-navy"
                  >
                    <option value="">— Select OU —</option>
                    {(ous || []).map(ou => (
                      <option key={ou.id} value={ou.id}>{ou.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Placeholder shown until OU is selected */}
            {isSuperAdmin && !backupOuId ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                <Database size={48} className="opacity-20 mb-3" />
                <p className="text-base font-medium">Select an Organisation</p>
                <p className="text-sm mt-1">Choose an organisation above to access backup and export options</p>
              </div>
            ) : (<>

            {/* Section 1 — Full Data Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download size={20} className="text-regis-gold" />
                  Full Data Export
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">Export your data as a file. All data is scoped to your organization.</p>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* What to include */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Include in export</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Tickets', value: backupIncludeTickets, set: setBackupIncludeTickets },
                      { label: 'Staff Users', value: backupIncludeUsers, set: setBackupIncludeUsers },
                      { label: 'Locations', value: backupIncludeLocations, set: setBackupIncludeLocations },
                    ].map(({ label, value, set }) => (
                      <button key={label} onClick={() => set(!value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${value ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                        {value ? <CheckSquare size={15} /> : <Square size={15} />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Date range</p>
                  <div className="flex flex-wrap gap-2">
                    {(['1d','7d','30d','3m','6m','1y','all'] as const).map(r => (
                      <button key={r} onClick={() => setBackupRange(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${backupRange === r ? 'bg-regis-gold text-white border-regis-gold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {RANGE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
                  <div className="flex gap-3">
                    <button onClick={() => setBackupFormat('csv')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${backupFormat === 'csv' ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                      <FileText size={15} />
                      CSV
                      <span className="text-xs font-normal opacity-60">— opens in Excel</span>
                    </button>
                    <button onClick={() => setBackupFormat('json')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${backupFormat === 'json' ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                      <FileJson size={15} />
                      JSON
                      <span className="text-xs font-normal opacity-60">— structured data</span>
                    </button>
                  </div>
                </div>

                <Button onClick={handleFullExport} disabled={backupLoading} className="bg-regis-gold hover:bg-amber-600 text-white gap-2">
                  {backupLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {backupLoading ? 'Preparing export…' : `Export as ${backupFormat.toUpperCase()}`}
                </Button>
              </CardContent>
            </Card>

            {/* Section 2 — Departed History PDF */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileDown size={20} className="text-regis-gold" />
                  Departed History — PDF Report
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">Export a formatted PDF of all checked-out (departed) tickets, sorted by date. Ideal for record-keeping and audits.</p>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Date range */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Date range</p>
                  <div className="flex flex-wrap gap-2">
                    {(['1d','7d','30d','3m','6m','1y','all'] as const).map(r => (
                      <button key={r} onClick={() => setPdfRange(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${pdfRange === r ? 'bg-regis-gold text-white border-regis-gold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {RANGE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo options */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Photos to include</p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setPdfIncludeCarPhoto(!pdfIncludeCarPhoto)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${pdfIncludeCarPhoto ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                      {pdfIncludeCarPhoto ? <CheckSquare size={15} /> : <Square size={15} />}
                      Car photo
                      <span className="text-xs font-normal opacity-60">— full vehicle shot</span>
                    </button>
                    <button onClick={() => setPdfIncludePlatePhoto(!pdfIncludePlatePhoto)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${pdfIncludePlatePhoto ? 'border-regis-gold bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-500'}`}>
                      {pdfIncludePlatePhoto ? <CheckSquare size={15} /> : <Square size={15} />}
                      Plate photo
                      <span className="text-xs font-normal opacity-60">— cropped plate image</span>
                    </button>
                  </div>
                  {(pdfIncludeCarPhoto || pdfIncludePlatePhoto) && (
                    <p className="text-xs text-amber-700 mt-1.5 ml-1">Photos are fetched from storage — generation may take longer for large exports.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <FileText size={18} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">What's included in the PDF</p>
                    <p className="text-xs text-gray-500">
                      Ticket #, Guest name, Car details, Plate number, Check-in & departure time, Stay duration, Visitor type
                      {pdfIncludeCarPhoto ? ' · Car photo' : ''}{pdfIncludePlatePhoto ? ' · Plate photo' : ''}
                    </p>
                  </div>
                </div>

                <Button onClick={handlePdfExport} disabled={pdfLoading} className="bg-regis-gold hover:bg-amber-600 text-white gap-2">
                  {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                  {pdfLoading ? 'Generating PDF…' : 'Download PDF Report'}
                </Button>
              </CardContent>
            </Card>

            </>)}
          </TabsContent>

          {/* Pending Registrations Tab */}
          {isSuperAdmin && (
            <TabsContent value="registrations" className="space-y-6">
              <PendingRegistrationsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={showAddOU} onOpenChange={setShowAddOU}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input value={newOU.name} onChange={(e) => setNewOU({ ...newOU, name: e.target.value })} placeholder="Sony Corporation" className="mt-1" data-testid="input-ou-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Code (unique identifier)</label>
              <Input value={newOU.code} onChange={(e) => setNewOU({ ...newOU, code: e.target.value.toUpperCase() })} placeholder="SONY" className="mt-1" data-testid="input-ou-code" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Email</label>
              <Input type="email" value={newOU.contactEmail} onChange={(e) => setNewOU({ ...newOU, contactEmail: e.target.value })} placeholder="contact@sony.com" className="mt-1" data-testid="input-ou-email" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Phone</label>
              <Input value={newOU.contactPhone} onChange={(e) => setNewOU({ ...newOU, contactPhone: e.target.value })} placeholder="+81 3 1234 5678" className="mt-1" data-testid="input-ou-phone" />
            </div>
            <Button onClick={() => createOUMutation.mutate(newOU)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createOUMutation.isPending || !newOU.name || !newOU.code} data-testid="button-submit-ou">
              {createOUMutation.isPending ? "Creating..." : "Create Organization"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingOU && (
        <Dialog open={!!editingOU} onOpenChange={() => setEditingOU(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input value={editingOU.name} onChange={(e) => setEditingOU({ ...editingOU, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Code</label>
                <Input value={editingOU.code} onChange={(e) => setEditingOU({ ...editingOU, code: e.target.value.toUpperCase() })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Contact Email</label>
                <Input type="email" value={editingOU.contactEmail || ""} onChange={(e) => setEditingOU({ ...editingOU, contactEmail: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Contact Phone</label>
                <Input value={editingOU.contactPhone || ""} onChange={(e) => setEditingOU({ ...editingOU, contactPhone: e.target.value })} className="mt-1" />
              </div>
              <Button onClick={() => updateOUMutation.mutate(editingOU)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateOUMutation.isPending}>
                {updateOUMutation.isPending ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <Select value={newLocation.ouId} onValueChange={(value) => setNewLocation({ ...newLocation, ouId: value })}>
                  <SelectTrigger className="mt-1" data-testid="select-location-ou">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {ous?.map((ou) => (
                      <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && userOUName && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium text-regis-navy">{userOUName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="Tokyo Headquarters" className="mt-1" data-testid="input-location-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Code</label>
              <Input value={newLocation.code} onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value.toUpperCase() })} placeholder="TKY-HQ" className="mt-1" data-testid="input-location-code" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Address</label>
              <Textarea value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} placeholder="1-7-1 Konan, Minato-ku, Tokyo" className="mt-1" data-testid="input-location-address" />
            </div>
            <Button onClick={() => createLocationMutation.mutate(newLocation)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createLocationMutation.isPending || !newLocation.name || !newLocation.code || !newLocation.ouId} data-testid="button-submit-location">
              {createLocationMutation.isPending ? "Creating..." : "Create Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingLocation && (
        <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Organization</label>
                  <Select value={editingLocation.ouId} onValueChange={(value) => setEditingLocation({ ...editingLocation, ouId: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ous?.map((ou) => (
                        <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && userOUName && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Organization</p>
                  <p className="font-medium text-regis-navy">{userOUName}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input value={editingLocation.name} onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Code</label>
                <Input value={editingLocation.code} onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value.toUpperCase() })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Address</label>
                <Textarea value={editingLocation.address || ""} onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })} className="mt-1" />
              </div>
              <Button onClick={() => updateLocationMutation.mutate(editingLocation)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateLocationMutation.isPending}>
                {updateLocationMutation.isPending ? "Updating..." : "Update Location"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="John" className="mt-1" data-testid="input-user-firstname" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Smith" className="mt-1" data-testid="input-user-lastname" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Username</label>
              <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="jsmith" className="mt-1" data-testid="input-user-username" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <Input 
                  type={showNewPassword ? "text" : "password"} 
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                  placeholder="••••••••" 
                  className="pr-10"
                  data-testid="input-user-password" 
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jsmith@company.com" className="mt-1" data-testid="input-user-email" />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="privilege_admin">Privilege Admin</SelectItem>
                    <SelectItem value="standard_admin">Standard Admin</SelectItem>
                    <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && (
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_admin">Standard Admin (Staff)</SelectItem>
                    <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSuperAdmin && newUser.role !== 'superadmin' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <Select value={newUser.ouId} onValueChange={(value) => setNewUser({ ...newUser, ouId: value, locationId: "" })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-ou">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {ous?.map((ou) => (
                      <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isPrivilegeAdmin && userOUName && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium text-regis-navy">{userOUName}</p>
              </div>
            )}
            {(newUser.role !== 'superadmin' || isPrivilegeAdmin) && newUser.ouId && (
              <div>
                <label className="text-sm font-medium text-gray-700">Location (optional)</label>
                <Select value={newUser.locationId || "none"} onValueChange={(value) => setNewUser({ ...newUser, locationId: value === "none" ? "" : value })}>
                  <SelectTrigger className="mt-1" data-testid="select-user-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific location</SelectItem>
                    {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === newUser.ouId))?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => createUserMutation.mutate(newUser)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={createUserMutation.isPending || !newUser.username || !newUser.password} data-testid="button-submit-user">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <Input value={editingUser.firstName || ""} onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <Input value={editingUser.lastName || ""} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Username</label>
                <Input value={editingUser.username || ""} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input type="email" value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">New Password (leave blank to keep current)</label>
                <div className="relative mt-1">
                  <Input 
                    type={showEditPassword ? "text" : "password"} 
                    value={editUserPassword} 
                    onChange={(e) => setEditUserPassword(e.target.value)} 
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Select value={editingUser.role} onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                      <SelectItem value="privilege_admin">Privilege Admin</SelectItem>
                      <SelectItem value="standard_admin">Standard Admin</SelectItem>
                      <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Select value={editingUser.role} onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard_admin">Standard Admin (Staff)</SelectItem>
                      <SelectItem value="standard_user">Standard User (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isSuperAdmin && editingUser.role !== 'superadmin' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Organization</label>
                  <Select value={editingUser.ouId || ""} onValueChange={(value) => setEditingUser({ ...editingUser, ouId: value, locationId: null })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {ous?.map((ou) => (
                        <SelectItem key={ou.id} value={ou.id}>{ou.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isPrivilegeAdmin && userOUName && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Organization</p>
                  <p className="font-medium text-regis-navy">{userOUName}</p>
                </div>
              )}
              {(editingUser.role !== 'superadmin' || isPrivilegeAdmin) && editingUser.ouId && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Location (optional)</label>
                  <Select value={editingUser.locationId || "none"} onValueChange={(value) => setEditingUser({ ...editingUser, locationId: value === "none" ? null : value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific location</SelectItem>
                      {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === editingUser.ouId))?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => updateUserMutation.mutate({ userData: editingUser, password: editUserPassword || undefined })} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editingFaq && (
        <Dialog open={!!editingFaq} onOpenChange={() => setEditingFaq(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit FAQ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Question" value={editingFaq.question} onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })} />
              <Textarea placeholder="Answer" value={editingFaq.answer} onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })} />
              <Button onClick={() => updateFaqMutation.mutate(editingFaq)} className="w-full bg-regis-navy hover:bg-blue-900" disabled={updateFaqMutation.isPending}>
                Update FAQ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Location Scope Management Dialog */}
      {managingUserScopes && (
        <Dialog open={!!managingUserScopes} onOpenChange={() => setManagingUserScopes(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Location Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Staff Member</p>
                <p className="font-medium text-regis-navy">
                  {managingUserScopes.firstName} {managingUserScopes.lastName}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Current Location Access</label>
                {userLocationScopes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                    No specific locations assigned - user has access to all locations in their organization
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userLocationScopes.map((scope) => {
                      const location = locations?.find(l => l.id === scope.locationId);
                      return (
                        <div key={scope.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-green-600" />
                            <span className="font-medium">{location?.name || 'Unknown Location'}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeLocationScopeMutation.mutate({ 
                              userId: managingUserScopes.id, 
                              locationId: scope.locationId 
                            })}
                            disabled={removeLocationScopeMutation.isPending}
                            data-testid={`button-remove-scope-${scope.locationId}`}
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Add Location Access</label>
                <Select 
                  value="" 
                  onValueChange={(locationId) => {
                    if (locationId) {
                      addLocationScopeMutation.mutate({ 
                        userId: managingUserScopes.id, 
                        locationId 
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-add-location-scope">
                    <SelectValue placeholder="Select a location to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isPrivilegeAdmin ? filteredLocations : locations?.filter(l => l.ouId === managingUserScopes.ouId))
                      ?.filter(loc => !userLocationScopes.some(s => s.locationId === loc.id))
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> If no specific locations are assigned, the staff member will have access to all locations in their organization. 
                  Assigning specific locations will restrict their access to only those locations.
                </p>
              </div>
              
              <Button 
                onClick={() => setManagingUserScopes(null)} 
                className="w-full bg-regis-navy hover:bg-blue-900"
                data-testid="button-close-scope-dialog"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Valet Ticket Wizard */}
      <ValetTicketWizard 
        isOpen={showTicketWizard}
        onClose={() => setShowTicketWizard(false)}
        user={user}
      />
    </div>
  );
}
