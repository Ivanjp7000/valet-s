// Audit — unified security scanner for Valet-s
// Powered by: semgrep (code security), gitleaks (secret history), npm audit (dependencies)
//
// Usage: npx tsx scripts/audit.ts [--json]

import { spawn } from "child_process";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ── Types ──────────────────────────────────────────────────────

interface AuditFinding {
  source: "npm" | "semgrep" | "gitleaks";
  level: 1 | 2;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  fix?: string;
  cwe?: string;
  advisory_url?: string;
}

interface AuditSummary {
  timestamp: string;
  npm: { vulnerabilities: number; outdated: number };
  semgrep: { total: number; errors: number; warnings: number; infos: number };
  gitleaks: { total: number };
  findings: AuditFinding[];
}

// ── Helpers ────────────────────────────────────────────────────

function runCommand(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: PROJECT_ROOT });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

function severityEmoji(sev: string): string {
  const map: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "⚪",
  };
  return map[sev] || "⚪";
}

// ── Level 1: Dependency Audit (npm audit + npm outdated) ──────

async function auditDependencies(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  // npm audit — CVEs
  try {
    const { stdout } = await runCommand("npm", ["audit", "--json"]);
    const auditData = JSON.parse(stdout);

    if (auditData.vulnerabilities) {
      for (const [pkg, info] of Object.entries(auditData.vulnerabilities) as [string, any][]) {
        const severity = mapSeverity(info.severity || "info");
        const via: any = info.via;
        let fixText = "No automatic fix available";
        let advisoryUrl = "";

        if (info.fixAvailable) {
          if (Array.isArray(via)) {
            fixText = via.map((v: any) => v.label || v.name || "latest").join(" or ");
          } else if (typeof via === "object" && via.label) {
            fixText = via.label;
          } else {
            fixText = "update to latest";
          }
        }

        if (Array.isArray(via)) {
          advisoryUrl = via.map((v: any) => v.url).filter(Boolean)[0] || "";
        } else if (typeof via === "object" && via.url) {
          advisoryUrl = via.url;
        }

        findings.push({
          source: "npm",
          level: 1,
          category: "CVE",
          severity,
          title: `Vulnerability in ${pkg}`,
          description: info.title || info.description || "Known vulnerability",
          fix: fixText,
          advisory_url: advisoryUrl,
        });
      }
    }
  } catch {
    // npm audit may fail in orphaned projects; skip gracefully
  }

  // npm outdated — stale packages
  try {
    const { stdout } = await runCommand("npm", ["outdated", "--json"]);
    const outdated = JSON.parse(stdout) as Record<string, any>;

    for (const [pkg, info] of Object.entries(outdated)) {
      const current = info.current;
      const latest = info.latest;
      if (current && current !== latest) {
        const publishedDate = info.datePublished;
        const age = publishedDate
          ? Math.floor((Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        findings.push({
          source: "npm",
          level: 1,
          category: "Outdated",
          severity: age > 365 ? "high" : age > 180 ? "medium" : "low",
          title: `${pkg} is outdated`,
          description: `Current: ${current}, Latest: ${latest}`,
          fix: `npm install ${pkg}@${latest}`,
        });
      }
    }
  } catch {
    // no outdated packages
  }

  return findings;
}

function mapSeverity(s: string): "critical" | "high" | "medium" | "low" | "info" {
  const map: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
    critical: "critical",
    high: "high",
    moderate: "medium",
    medium: "medium",
    low: "low",
    info: "info",
  };
  return map[s.toLowerCase()] || "info";
}

// ── Level 2a: Code Security (semgrep) ─────────────────────────

async function auditSemgrep(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  // Run semgrep with community rules + custom rules
  try {
    const { stdout, stderr } = await runCommand("semgrep", [
      "scan",
      "--config", "auto",
      "--config", ".semgrep/rules.yaml",
      "--json",
      "--exclude", "node_modules",
      "--exclude", "dist",
      "--error",
    ]);

    const data = JSON.parse(stdout);
    const results = data.results || [];

    for (const r of results) {
      const extra = r.extra || {};
      const metadata = extra.metadata || {};
      const sev = mapSemgrepSeverity(extra.severity || "WARNING");
      const checkId = r.check_id || "unknown";
      const path = r.path || "";
      const startLine = (r.start?.line) || 0;

      // Extract CWE
      let cwe = "";
      if (metadata.cwe && Array.isArray(metadata.cwe)) {
        cwe = metadata.cwe[0];
      } else if (typeof metadata.cwe === "string") {
        cwe = metadata.cwe;
      }

      findings.push({
        source: "semgrep",
        level: 2,
        category: extra.vulnerability_class?.[0] || metadata.category || "security",
        severity: sev,
        title: extra.message?.split("\n")[0] || checkId,
        description: extra.message || "",
        file: path,
        line: startLine,
        cwe,
        advisory_url: metadata.references?.[0] || extra.shortlink || "",
      });
    }
  } catch {
    // semgrep not installed or failed
  }

  return findings;
}

function mapSemgrepSeverity(s: string): "critical" | "high" | "medium" | "low" | "info" {
  const map: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
    ERROR: "high",
    WARNING: "medium",
    INFO: "info",
  };
  return map[s.toUpperCase()] || "info";
}

// ── Level 2b: Secret Scanning (gitleaks) ─────────────────────

async function auditGitleaks(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  try {
    const { stdout, stderr, code } = await runCommand("gitleaks", [
      "detect",
      "--source", ".",
      "--report-format", "json",
      "-v",
    ]);

    // gitleaks exits 1 when findings exist; that's normal
    if (code === 0) return findings; // no findings

    // Parse JSON report from stdout (gitleaks writes report to stdout when no --report-path is writable)
    let lines = stdout.trim().split("\n");
    // Filter out log lines, find JSON array or JSONL
    let jsonLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("{")) {
        jsonLines.push(line);
      }
    }

    if (jsonLines.length === 0) return findings;

    // Try as JSON array first, then JSONL
    let entries: any[] = [];
    try {
      entries = JSON.parse("[" + jsonLines.join(",") + "]");
    } catch {
      for (const line of jsonLines) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip */ }
      }
    }

    for (const e of entries) {
      const rule = e.RuleID || "unknown";
      const file = e.File || "";
      const lineNum = e.LineNumber || 0;
      const secretPreview = (e.Secret || "").slice(0, 20) + "…";

      findings.push({
        source: "gitleaks",
        level: 2,
        category: "Secret Leak",
        severity: "critical",
        title: `Hardcoded secret detected (${rule})`,
        description: `Rule: ${rule}. Found in ${file}. Partial: ${secretPreview}`,
        file,
        line: lineNum,
        fix: "Remove secret from source code. Use environment variables or secrets manager.",
      });
    }
  } catch {
    // gitleaks not installed
  }

  return findings;
}

// ── Main ───────────────────────────────────────────────────────

async function runAudit(): Promise<AuditSummary> {
  const allFindings: AuditFinding[] = [];

  console.log("🔍 Running Valet-s Security Audit...\n");

  // Level 1
  console.log("📦 Level 1: Scanning dependencies...");
  const depFindings = await auditDependencies();
  allFindings.push(...depFindings);
  const vulnCount = depFindings.filter(f => f.category === "CVE").length;
  const outdatedCount = depFindings.filter(f => f.category === "Outdated").length;
  console.log(`   Found ${vulnCount} vulnerabilities, ${outdatedCount} outdated packages\n`);

  // Level 2a
  console.log("🔒 Level 2a: Scanning code with semgrep...");
  const semgrepFindings = await auditSemgrep();
  allFindings.push(...semgrepFindings);
  console.log(`   Found ${semgrepFindings.length} issues\n`);

  // Level 2b
  console.log("🔑 Level 2b: Scanning git history with gitleaks...");
  const gitleaksFindings = await auditGitleaks();
  allFindings.push(...gitleaksFindings);
  console.log(`   Found ${gitleaksFindings.length} issues\n`);

  // Summary
  const semgrepErrors = semgrepFindings.filter(f => f.severity === "high").length;
  const semgrepWarnings = semgrepFindings.filter(f => f.severity === "medium").length;
  const semgrepInfos = semgrepFindings.filter(f => f.severity === "info").length;

  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    npm: { vulnerabilities: vulnCount, outdated: outdatedCount },
    semgrep: { total: semgrepFindings.length, errors: semgrepErrors, warnings: semgrepWarnings, infos: semgrepInfos },
    gitleaks: { total: gitleaksFindings.length },
    findings: allFindings,
  };

  // Terminal report
  console.log("═".repeat(60));
  console.log("  AUDIT REPORT");
  console.log("═".repeat(60));
  console.log(`  Timestamp: ${summary.timestamp}`);
  console.log(`  Total findings: ${allFindings.length}`);
  console.log("");

  console.log("  Level 1 — Dependencies:");
  console.log(`    CVE vulnerabilities: ${vulnCount}`);
  console.log(`    Outdated packages: ${outdatedCount}`);
  console.log("");

  console.log("  Level 2 — Code Security:");
  console.log(`    Semgrep (high): ${semgrepErrors}`);
  console.log(`    Semgrep (medium): ${semgrepWarnings}`);
  console.log(`    Semgrep (info): ${semgrepInfos}`);
  console.log(`    Gitleaks: ${gitleaksFindings.length}`);
  console.log("");

  // Show critical/high/medium findings with detail
  const important = allFindings.filter(f =>
    f.severity === "critical" || f.severity === "high" || f.severity === "medium"
  );

  if (important.length > 0) {
    console.log("  ─── FINDINGS ───────────────────────────────────────────────────────");
    for (const f of important) {
      const emoji = severityEmoji(f.severity);
      const sourceTag = f.source.toUpperCase();
      console.log(`  ${emoji} [${sourceTag}] ${f.title}`);
      console.log(`     ${f.description.split("\n")[0]}`);
      if (f.file) console.log(`     📁 ${f.file}${f.line ? `:${f.line}` : ""}`);
      if (f.cwe) console.log(`     CWE: ${f.cwe}`);
      if (f.fix) console.log(`     💡 ${f.fix}`);
      console.log("");
    }
  } else {
    console.log("  ✅ No critical/high/medium issues found.");
  }

  console.log("═".repeat(60));

  return summary;
}

// Export for inline server use
export { runAudit, auditDependencies, auditSemgrep, auditGitleaks };
export type { AuditSummary, AuditFinding };

// Run if called directly
if (process.argv[1] && (process.argv[1].endsWith("audit.ts") || process.argv[1].endsWith("audit.js"))) {
  const jsonMode = process.argv.includes("--json");
  runAudit().then((result) => {
    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    }
  }).catch(console.error);
}
