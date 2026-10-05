const KNOWN_JOBSITES = new Set([
  "MBL", "MME", "BIB", "MIP", "HO", "SITE", "MAS", "SMM", "KIM", "AGM", "BSS", "KCM", "TCM", "PT BSS", "JOB SITE", "JOBSITE"
]);

export function normalizeDepartment(name: string): string {
  if (!name) return "";
  let cleaned = name.trim().replace(/^[0-9]+[\.\)\-]\s*/, "").trim();
  let u = cleaned.toUpperCase();

  if (KNOWN_JOBSITES.has(u) || u === "-" || u === "N/A" || u === "NA" || u === "0" || u === "NONE" || u === "NULL" || u === "TBD" || u === "NIL") {
    return "";
  }

  if (u === "ENG" || u === "ENGINEERING" || u.startsWith("ENG ") || u.startsWith("ENGINEERING ")) return "ENGINEERING";
  if (u === "PROD" || u === "PRODUKSI" || u.startsWith("PROD ") || u.startsWith("PRODUKSI ")) return "PRODUKSI";
  if (u === "PLANT" || u.startsWith("PLANT ")) return "PLANT";
  if (u === "LOG" || u === "LOGISTIK" || u.startsWith("LOG ")) return "LOGISTIK";
  if (u === "SHE" || u.startsWith("SHE ")) return "SHE";
  if (u === "GS" || u.startsWith("GS ")) return "GS";
  if (u === "IT" || u.startsWith("IT ")) return "IT";
  if (u === "IC" || u.startsWith("IC ")) return "IC";
  if (u === "SM" || u.startsWith("SM ")) return "SM";
  if (u === "ACCOUNTING" || u.startsWith("ACCOUNTING ")) return "ACCOUNTING";
  if (u === "FINANCE" || u.startsWith("FINANCE ")) return "FINANCE";
  if (u === "HR" || u === "HRD" || u === "HC") return "HR";
  if (u === "GA") return "GA";
  if (u === "PR" || u === "PR-PAYMENT" || u === "PRPAYMENT") return "PRPAYMENT";
  if (u === "ALL DEPARTEMEN") return "ALL DEPARTEMEN";

  return u;
}

export function isDepartment(str?: string | null): boolean {
  if (!str) return false;
  let cleaned = str.trim().replace(/^[0-9]+[\.\)\-]\s*/, "").trim().toUpperCase();
  if (KNOWN_JOBSITES.has(cleaned) || cleaned === "-" || cleaned === "N/A" || cleaned === "NA" || cleaned === "0" || cleaned === "NONE" || cleaned === "NULL" || cleaned === "TBD" || cleaned === "NIL" || cleaned === "") {
    return false;
  }
  return true;
}

export function parseDepartments(str?: string | null): string[] {
  if (!str) return [];
  const rawParts = str.split(/[,/\n&;]|(?:\s+and\s+)|(?:\s+dan\s+)/i);
  const result: string[] = [];
  rawParts.forEach(p => {
    let cleaned = p.trim().replace(/^[0-9]+[\.\)\-]\s*/, "").trim();
    if (cleaned) {
      const norm = normalizeDepartment(cleaned);
      if (norm && !result.includes(norm)) result.push(norm);
    }
  });
  return result;
}
