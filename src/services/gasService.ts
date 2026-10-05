import { AFSFindingRecord, ProjectLinkConfig } from "../types";

export const DEFAULT_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzLmowu47-PCtKiSLmXDcTuEnEjnupdCWnQQIqMnYaEIP0jD2c5VOnCFrLX9-8EXmwc2w/exec";
const STORAGE_KEY_GAS_ENDPOINT = "iarms_gas_endpoint_url_v1";

export function getGasEndpointUrl(): string {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_GAS_ENDPOINT);
    if (custom && custom.trim().startsWith("http")) return custom.trim();
  } catch {}
  return DEFAULT_GAS_ENDPOINT;
}

export function setGasEndpointUrl(url: string): void {
  try {
    if (url && url.trim().startsWith("http")) {
      localStorage.setItem(STORAGE_KEY_GAS_ENDPOINT, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_GAS_ENDPOINT);
    }
  } catch {}
}

export function isStaticHosting(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("netlify.app") || host.includes("pages.dev") || host.includes("github.io");
}

export function normalizeFindingRecord(raw: any, index: number): AFSFindingRecord {
  const norm: AFSFindingRecord = { ...raw };
  norm._rowId = raw._rowId || (index + 1);
  norm.NO = raw.NO || raw.no || String(index + 1);
  norm["PROJECT AUDIT"] = raw["PROJECT AUDIT"] || raw.PROJECT || raw.projectName || "AUDIT";
  norm.SITE = raw.SITE || raw.site || "HEAD OFFICE";
  norm["PERIODE AUDIT"] = raw["PERIODE AUDIT"] || raw.TAHUN || raw.year || "2026";
  norm["PROBLEM/FINDING"] = raw["PROBLEM/FINDING"] || raw.problem || raw.finding || "";
  norm["DETAIL TEMUAN"] = raw["DETAIL TEMUAN"] || raw.detail || "";
  norm.REKOMENDASI = raw.REKOMENDASI || raw.rekomendasi || "";
  norm["PIC SITE"] = raw["PIC SITE"] || raw.pic_site || "";
  norm["PIC HO"] = raw["PIC HO"] || raw.pic_ho || "";
  norm.STATUS = raw.STATUS || raw.status || "OPEN";
  norm.REMARKS = raw.REMARKS || raw.remarks || "";
  norm["REVIEWED CLOSING FROM IA"] = raw["REVIEWED CLOSING FROM IA"] || raw.ia_review || "";
  norm["DOKUMEN PENDUKUNG CLOSING"] = raw["DOKUMEN PENDUKUNG CLOSING"] || raw.closing_doc || "";
  norm.KATEGORI = raw.KATEGORI || raw.kategori || "MINOR";
  return norm;
}

export async function fetchLiveFindingsFromGAS(): Promise<{
  success: boolean;
  rows: AFSFindingRecord[];
  projects?: any[];
  count?: number;
  timestamp?: string;
}> {
  const gasUrl = getGasEndpointUrl();
  try {
    const res = await fetch(gasUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith("<")) {
        const json = JSON.parse(text);
        if (json && Array.isArray(json.rows) && json.rows.length > 0) {
          const normalizedRows = json.rows.map((r: any, idx: number) => normalizeFindingRecord(r, idx));
          let projects = Array.isArray(json.projects) && json.projects.length > 0 ? json.projects : [];
          if (projects.length === 0 && normalizedRows.length > 0) {
            const projectMap = new Map<string, any>();
            normalizedRows.forEach((r: any) => {
              const pName = (r["PROJECT AUDIT"] || "AUDIT").trim().toUpperCase();
              const pSite = (r["SITE"] || "HEAD OFFICE").trim().toUpperCase();
              const pYear = String(r["PERIODE AUDIT"] || r["TAHUN"] || "2026").trim();
              const key = `${pName}|${pSite}${pYear ? `|${pYear}` : ""}`;
              if (!projectMap.has(key)) {
                projectMap.set(key, {
                  id: key,
                  projectName: pName,
                  defaultProject: pName,
                  project: pName,
                  siteName: pSite,
                  site: pSite,
                  year: pYear,
                  status: "synced",
                  rowCount: 1,
                  sheetUrl: ""
                });
              } else {
                projectMap.get(key).rowCount += 1;
              }
            });
            projects = Array.from(projectMap.values());
          }
          return {
            success: true,
            rows: normalizedRows,
            projects: projects,
            count: normalizedRows.length,
            timestamp: json.timestamp || new Date().toISOString()
          };
        }
      }
    }
  } catch (err) {
    console.warn("[GAS Service] Error:", err);
  }
  return { success: false, rows: [], projects: [], count: 0 };
}

export async function postToGAS(payload: any): Promise<any> {
  const gasUrl = getGasEndpointUrl();
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function saveFindingToGAS(finding: AFSFindingRecord): Promise<any> {
  return postToGAS({ action: "save_finding", ...finding });
}

export async function deleteFindingFromGAS(no: string, rowId?: number): Promise<any> {
  return postToGAS({ action: "delete_finding", NO: no, no, _rowId: rowId });
}

export async function updateIaReviewInGAS(no: string, review: string, status: string, rowId?: number): Promise<any> {
  return postToGAS({ action: "update_ia_review", NO: no, no, review, status, _rowId: rowId });
}

export async function updateClosingDocInGAS(no: string, docUrl: string, rowId?: number): Promise<any> {
  return postToGAS({ action: "update_closing_doc", NO: no, no, doc: docUrl, _rowId: rowId });
}

export async function syncBatchToGAS(rows: AFSFindingRecord[]): Promise<any> {
  return postToGAS({ action: "sync_batch", rows });
}

export async function syncProjectsListToGAS(projects: ProjectLinkConfig[]): Promise<any> {
  return postToGAS({ action: "sync_projects_list", projects });
}
