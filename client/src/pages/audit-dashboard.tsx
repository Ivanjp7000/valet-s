// Audit Dashboard — web UI for security scan results
// Shows Level 1 (dependencies) and Level 2 (code security) findings

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface AuditFinding {
  level: 1 | 2;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  fix?: string;
}

interface AuditData {
  timestamp: string;
  level1Count: Record<string, number>;
  level2Count: Record<string, number>;
  findings: AuditFinding[];
}

const SEVERITY_CONFIG = {
  critical: { emoji: "🔴", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  high: { emoji: "🟠", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  medium: { emoji: "🟡", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  low: { emoji: "🔵", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  info: { emoji: "⚪", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {cfg.emoji} {severity.toUpperCase()}
    </span>
  );
}

function FindingCard({ finding }: { finding: AuditFinding }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[finding.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;

  return (
    <div className={`border rounded-lg p-3 ${cfg.border} ${cfg.bg} transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500">L{finding.level}</span>
            <SeverityBadge severity={finding.severity} />
            <span className="text-xs text-gray-400">{finding.category}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-white hover:text-blue-300 transition-colors text-left"
          >
            {finding.title}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">{finding.description}</p>
          {finding.file && (
            <p className="text-xs text-gray-500 mt-1 font-mono">
              📁 {finding.file}{finding.line ? `:${finding.line}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-white transition-colors text-xs"
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && finding.fix && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <p className="text-xs text-green-400">💡 {finding.fix}</p>
        </div>
      )}
    </div>
  );
}

function CountCard({ label, counts, level }: { label: string; counts: Record<string, number>; level: number }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{label}</h3>
      <div className="grid grid-cols-5 gap-2">
        {["critical", "high", "medium", "low", "info"].map((sev) => {
          const cfg = SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG];
          const count = counts[sev] || 0;
          return (
            <div key={sev} className={`text-center p-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
              <div className="text-lg">{cfg.emoji}</div>
              <div className={`text-xl font-bold ${cfg.color}`}>{count}</div>
              <div className="text-[10px] text-gray-400 uppercase">{sev}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuditDashboard() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<"all" | 1 | 2>("all");
  const [filterSeverity, setFilterSeverity] = useState<"all" | "critical" | "high" | "medium" | "low" | "info">("all");

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/sro");
      return;
    }
    fetchAudit();
  }, [isAuthenticated, setLocation, fetchAudit]);

  const filtered = (data?.findings || []).filter((f) => {
    if (filterLevel !== "all" && f.level !== filterLevel) return false;
    if (filterSeverity !== "all" && f.severity !== filterSeverity) return false;
    return true;
  });

  const totalFindings = (data?.findings || []).length;
  const criticalCount = (data?.findings || []).filter((f) => f.severity === "critical").length;
  const highCount = (data?.findings || []).filter((f) => f.severity === "high").length;

  const healthStatus = criticalCount > 0 ? "🔴 Critical Issues"
    : highCount > 0 ? "🟠 High Issues"
    : totalFindings > 20 ? "🟡 Needs Attention"
    : "✅ Healthy";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <h1 className="text-xl font-bold">Security Audit</h1>
                <p className="text-sm text-gray-400">Dependency health & code security analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold ${
                criticalCount > 0 ? "text-red-400" : highCount > 0 ? "text-orange-400" : "text-green-400"
              }`}>
                {healthStatus}
              </span>
              <button
                onClick={fetchAudit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "⏳ Scanning..." : "↻ Re-scan"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
            <button onClick={fetchAudit} className="text-sm text-red-300 underline mt-2">Try again</button>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🔍</div>
              <p className="text-gray-400">Scanning dependencies and code security...</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Timestamp */}
            <div className="text-xs text-gray-500 mb-4">
              Last scan: {new Date(data.timestamp).toLocaleString()}
            </div>

            {/* Count Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <CountCard label="Level 1 — Dependencies" counts={data.level1Count} level={1} />
              <CountCard label="Level 2 — Code Security" counts={data.level2Count} level={2} />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-gray-400">Filter:</span>
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                {(["all", 1, 2] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setFilterLevel(level)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      filterLevel === level
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {level === "all" ? "All Levels" : `Level ${level}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                {(["all", "critical", "high", "medium", "low", "info"] as const).map((sev) => {
                  const cfg = SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG];
                  return (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        filterSeverity === sev
                          ? "bg-gray-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {sev === "all" ? "All" : `${cfg.emoji}`}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-gray-500">{filtered.length} findings</span>
            </div>

            {/* Findings List */}
            <div className="space-y-2">
              {filtered.map((finding, i) => (
                <FindingCard key={`${finding.file}-${finding.line}-${i}`} finding={finding} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <p>No findings match your filters.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
