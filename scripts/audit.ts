// Audit — comprehensive security and code quality scanner for Valet-s
// Level 1: Dependency health (CVEs, outdated packages, licenses)
// Level 2: Code security (XSS, SQL injection, secrets, auth gaps)
//
// Usage: npx tsx scripts/audit.ts  (dev only)

import { spawn } from "child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Types ──────────────────────────────────────────────────────
interface AuditResult {
  level: 1 | 2;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  fix?: string;
}

interface AuditSummary {
  timestamp: string;
  level1Count: { critical: number; high: number; medium: number; low: number; info: number };
  level2Count: { critical: number; high: number; medium: number; low: number; info: number };
  findings: AuditResult[];
}

// ── Helpers ────────────────────────────────────────────────────
const PROJECT_ROOT = resolve(__dirname, "..");
const CODE_DIRS = ["server", "client", "shared"];

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", () => resolve({ stdout, stderr }));
  });
}

function getAllSourceFiles(): string[] {
  const files: string[] = [];
  for (const dir of CODE_DIRS) {
    const dirPath = join(PROJECT_ROOT, dir);
    if (!existsSync(dirPath)) continue;
    const walk = (d: string) => {
      for (const entry of readdirSync(d)) {
        const fullPath = join(d, entry);
        if (entry.startsWith(".")) continue;
        if (entry === "node_modules") continue;
        if (entry === "dist") continue;
        if (entry === "public") continue;
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
          files.push(fullPath);
        }
      }
    };
    walk(dirPath);
  }
  return files;
}

// ── Level 1: Dependency Health ─────────────────────────────────
async function auditDependencies(): Promise<AuditResult[]> {
  const findings: AuditResult[] = [];

  // npm audit
  try {
    const { stdout } = await runCommand("npm", ["audit", "--json"]);
    const auditData = JSON.parse(stdout);

    if (auditData.vulnerabilities) {
      for (const [pkg, info] of Object.entries(auditData.vulnerabilities) as [string, any][]) {
        const severity = (info.severity || "info") as "critical" | "high" | "medium" | "low" | "info";
        const via = info.via;
        const fixVer = Array.isArray(via) ? via.join(", ") : (typeof via === "string" ? via : "latest");
        findings.push({
          level: 1,
          category: "CVE",
          severity,
          title: `Vulnerability in ${pkg}`,
          description: info.title || info.description || "Known vulnerability",
          fix: info.fixAvailable ? `Update to ${fixVer}` : "No automatic fix available",
        });
      }
    }
  } catch {}

  // npm outdated
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
          level: 1,
          category: "Outdated",
          severity: age > 365 ? "high" : age > 180 ? "medium" : "low",
          title: `${pkg} is outdated`,
          description: `Current: ${current}, Latest: ${latest}`,
          fix: `npm install ${pkg}@${latest}`,
        });
      }
    }
  } catch {}

  return findings;
}

// ── Level 2: Code Security ─────────────────────────────────────
function auditCodeSecurity(): AuditResult[] {
  const findings: AuditResult[] = [];
  const files = getAllSourceFiles();

  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const relativePath = filePath.replace(PROJECT_ROOT + "/", "");
    const lines = content.split("\n");

    // 1. XSS: dangerouslySetInnerHTML
    const xssRegex = /dangerouslySetInnerHTML/g;
    let match;
    while ((match = xssRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({
        level: 2,
        category: "XSS",
        severity: "high",
        title: "Potential XSS via dangerouslySetInnerHTML",
        description: "Direct HTML injection detected",
        file: relativePath,
        line: lineNum,
        fix: "Sanitize HTML with DOMPurify or use React fragments instead",
      });
    }

    // 2. SQL Injection: raw SQL strings
    const rawSqlRegex = /(?:query|execute|raw)\s*\(\s*['"`]*SELECT\s.*?\s*FROM\s/gi;
    while ((match = rawSqlRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({
        level: 2,
        category: "SQL Injection",
        severity: "critical",
        title: "Potential SQL injection",
        description: "Raw SQL query with possible string interpolation",
        file: relativePath,
        line: lineNum,
        fix: "Use Drizzle ORM parameterized queries",
      });
    }

    // 3. Secret leaks
    const secretPatterns = [
      { regex: /(?:api[_-]?key|apikey)\s*=\s*['"][A-Za-z0-9]{20,}['"]/gi, label: "API key" },
      { regex: /password\s*=\s*['"][^'\s]{8,}['"]/gi, label: "Password" },
      { regex: /secret\s*=\s*['"][A-Za-z0-9/+]{20,}['"]/gi, label: "Secret" },
      { regex: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/gi, label: "Bearer token" },
      { regex: /AKIA[0-9A-Z]{16}/gi, label: "AWS access key" },
    ];

    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      while ((match = pattern.regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        const lineContent = lines[lineNum - 1]?.trim();
        if (lineContent?.includes("process.env") || lineContent?.includes("YOUR_") || lineContent?.includes("CHANGE_ME")) continue;
        findings.push({
          level: 2,
          category: "Secret Leak",
          severity: "critical",
          title: `Possible ${pattern.label} in source code`,
          description: `Hardcoded ${pattern.label.toLowerCase()} detected`,
          file: relativePath,
          line: lineNum,
          fix: "Move to environment variables or secrets.json",
        });
      }
    }

    // 4. Missing auth guards on routes
    if (relativePath.includes("routes") && relativePath.includes("server")) {
      const routeRegex = /app\.(get|post|put|patch|delete)\s*\(\s*['"`]\/api\/(?!auth|health|faqs|logout|audit)/gi;
      while ((match = routeRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        const context = lines.slice(lineNum - 1, lineNum + 5).join(" ");
        if (!context.includes("isAuthenticated") && !context.includes("require")) {
          findings.push({
            level: 2,
            category: "Auth Gap",
            severity: "high",
            title: "Route without authentication guard",
            description: "API route may be accessible without authentication",
            file: relativePath,
            line: lineNum,
            fix: "Add isAuthenticated middleware to this route",
          });
        }
      }
    }

    // 5. eval() usage
    const evalRegex = /\beval\s*\(/g;
    while ((evalRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, evalRegex.lastIndex).split("\n").length;
      findings.push({
        level: 2,
        category: "Code Injection",
        severity: "critical",
        title: "eval() usage detected",
        description: "eval() can execute arbitrary code",
        file: relativePath,
        line: lineNum,
        fix: "Remove eval() and use safer alternatives",
      });
    }

    // 6. Console logging sensitive data
    const consoleSecretRegex = /console\.(log|info|warn)\s*\([^)]*(password|secret|token|key|credential)/gi;
    while ((consoleSecretRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, consoleSecretRegex.lastIndex).split("\n").length;
      findings.push({
        level: 2,
        category: "Info Leak",
        severity: "medium",
        title: "Sensitive data in console output",
        description: "Console logging may expose sensitive data in production",
        file: relativePath,
        line: lineNum,
        fix: "Remove sensitive data from console output",
      });
    }

    // 7. Wildcard CORS
    const corsRegex = /Access-Control-Allow-Origin.*\*|cors\s*\(\s*\{\s*origin:\s*['"]\*['"]\s*\}/gi;
    while ((corsRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, corsRegex.lastIndex).split("\n").length;
      findings.push({
        level: 2,
        category: "CORS",
        severity: "medium",
        title: "Wildcard CORS origin",
        description: "Allowing all origins is a security risk",
        file: relativePath,
        line: lineNum,
        fix: "Restrict CORS to specific trusted origins",
      });
    }
  }

  return findings;
}

// ── Main ───────────────────────────────────────────────────────
async function runAudit(): Promise<AuditSummary> {
  const findings: AuditResult[] = [];

  console.log("🔍 Running Valet-s Security Audit...\n");

  console.log("📦 Level 1: Scanning dependencies...");
  const depFindings = await auditDependencies();
  findings.push(...depFindings);
  console.log(`   Found ${depFindings.length} issues\n`);

  console.log("🔒 Level 2: Scanning code security...");
  const codeFindings = auditCodeSecurity();
  findings.push(...codeFindings);
  console.log(`   Found ${codeFindings.length} issues\n`);

  const level1Count = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const level2Count = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const f of findings) {
    if (f.level === 1) level1Count[f.severity]++;
    else level2Count[f.severity]++;
  }

  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    level1Count,
    level2Count,
    findings,
  };

  // Terminal report
  console.log("═".repeat(60));
  console.log("  AUDIT REPORT");
  console.log("═".repeat(60));
  console.log(`  Timestamp: ${summary.timestamp}`);
  console.log(`  Total findings: ${findings.length}`);
  console.log("");

  console.log("  Level 1 (Dependencies):");
  for (const sev of ["critical", "high", "medium", "low", "info"]) {
    if (level1Count[sev] > 0) {
      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵", info: "⚪" }[sev];
      console.log(`    ${emoji} ${sev.toUpperCase()}: ${level1Count[sev]}`);
    }
  }
  console.log("");
  console.log("  Level 2 (Code Security):");
  for (const sev of ["critical", "high", "medium", "low", "info"]) {
    if (level2Count[sev] > 0) {
      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵", info: "⚪" }[sev];
      console.log(`    ${emoji} ${sev.toUpperCase()}: ${level2Count[sev]}`);
    }
  }
  console.log("");

  if (findings.length > 0) {
    console.log("  ─── FINDINGS ───────────────────────────────────────────────────────");
    for (const f of findings) {
      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵", info: "⚪" }[f.severity];
      console.log(`  ${emoji} [${f.level === 1 ? "L1" : "L2"}] ${f.title}`);
      console.log(`     ${f.description}`);
      if (f.file) console.log(`     📁 ${f.file}${f.line ? `:${f.line}` : ""}`);
      if (f.fix) console.log(`     💡 ${f.fix}`);
      console.log("");
    }
  } else {
    console.log("  ✅ All clear! No issues found.");
  }
  console.log("═".repeat(60));

  return summary;
}

// Export for inline use in server
export { runAudit, auditDependencies, auditCodeSecurity };
export type { AuditSummary, AuditResult };

// Run if called directly
import { argv } from "process";
if (process.argv[1] && (process.argv[1].endsWith("audit.ts") || process.argv[1].endsWith("audit.js"))) {
  const jsonMode = process.argv.includes("--json");
  runAudit().then((result) => {
    if (jsonMode) {
      console.log(JSON.stringify(result));
    }
  }).catch(console.error);
}
