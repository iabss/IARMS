import { AFSFindingRecord, ProjectLinkConfig } from "../types";
import { 
  DEFAULT_GAS_ENDPOINT,
  getGasEndpointUrl, 
  fetchLiveFindingsFromGAS, 
  postToGAS,
  saveFindingToGAS,
  deleteFindingFromGAS,
  updateIaReviewInGAS,
  syncBatchToGAS,
  syncProjectsListToGAS
} from "./gasService";

export const GOOGLE_SCRIPT_URL = DEFAULT_GAS_ENDPOINT;

/**
 * Pure direct fetch to Google Apps Script endpoint using header 'text/plain;charset=utf-8'
 * Bypasses local backend entirely so it works flawlessly on static hosting (Netlify, Pages, etc.)
 */
export async function postDirectToGAS(payload: any): Promise<any> {
  const url = getGasEndpointUrl();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (text && !text.trim().startsWith("<")) {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true, text };
      }
    }
    return { success: true, status: "ok" };
  } catch (err) {
    console.warn("[GAS Direct API] Direct POST error:", err);
    return { success: false, error: String(err) };
  }
}

// ==========================================
// 1. AFS FINDING OPERATIONS (Direct GAS)
// ==========================================
export async function saveFinding(finding: AFSFindingRecord): Promise<any> {
  return postDirectToGAS({ action: "save_finding", ...finding });
}

export async function deleteFinding(no: string, rowId?: number): Promise<any> {
  return postDirectToGAS({ action: "delete_finding", NO: no, no, _rowId: rowId });
}

export async function updateIaReview(no: string, review: string, status: string, rowId?: number): Promise<any> {
  return postDirectToGAS({ action: "update_ia_review", NO: no, no, review, status, _rowId: rowId });
}

export async function syncBatchFindings(rows: AFSFindingRecord[]): Promise<any> {
  return postDirectToGAS({ action: "sync_batch", rows });
}

// ==========================================
// 2. PROJECT OPERATIONS (Backend Database & Direct GAS)
// ==========================================
export async function saveProject(project: ProjectLinkConfig): Promise<any> {
  try {
    await fetch("/api/save-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project)
    });
  } catch (err) {
    console.warn("Backend save project warning:", err);
  }
  return postDirectToGAS({ 
    action: "sync_sheet_url", 
    project: project.defaultProject || project.project || project.projectName,
    site: project.siteName || project.site || "HEAD OFFICE",
    year: project.year,
    sheetUrl: project.sheetUrl
  });
}

export async function deleteProject(project: { id?: string; project?: string; site?: string; year?: string }): Promise<any> {
  try {
    await fetch("/api/delete-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project)
    });
  } catch (err) {
    console.warn("Backend delete project warning:", err);
  }
  return postDirectToGAS({ action: "delete_project", ...project });
}

export async function syncProjectsList(projects: ProjectLinkConfig[]): Promise<any> {
  try {
    await fetch("/api/afs-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projects)
    });
  } catch (err) {
    console.warn("Backend sync projects warning:", err);
  }
  return postDirectToGAS({ action: "sync_projects_list", projects });
}

export async function fetchProjectsFromBackend(): Promise<{ projects: any[]; customRows?: any[]; deletedKeys?: string[] }> {
  try {
    const res = await fetch("/api/afs-projects");
    if (res.ok) {
      const data = await res.json();
      const projects = data.afs_projects || data.projects || [];
      if (Array.isArray(projects) && projects.length > 0) {
        return {
          projects,
          customRows: [],
          deletedKeys: []
        };
      }
    }
  } catch (e) {
    console.warn("Error fetching projects from local backend:", e);
  }
  try {
    const gasData = await fetchLiveFindingsFromGAS();
    if (gasData && gasData.success) {
      return {
        projects: gasData.projects || [],
        customRows: gasData.rows || [],
        deletedKeys: []
      };
    }
  } catch (e) {
    console.warn("Error fetching projects from GAS:", e);
  }
  return { projects: [], customRows: [], deletedKeys: [] };
}

// ==========================================
// 3. RISK REGISTER OPERATIONS (Direct GAS)
// ==========================================
export const MAIN_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit";
export const RISK_REGISTER_SHEET_URL = MAIN_SPREADSHEET_URL;

export async function saveRiskRegister(risk: any): Promise<any> {
  return postDirectToGAS({
    action: "save_risk_register",
    sheetUrl: MAIN_SPREADSHEET_URL,
    ...risk
  });
}

export async function deleteRiskRegister(riskNumber: string): Promise<any> {
  return postDirectToGAS({
    action: "delete_risk_register",
    sheetUrl: MAIN_SPREADSHEET_URL,
    riskNumber
  });
}

export async function fetchLiveRiskRegister(): Promise<{ success: boolean; rows: any[] }> {
  try {
    const url = getGasEndpointUrl();
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, rows: data.rows || [] };
    }
  } catch (e) {
    console.warn("Direct fetch risk register error:", e);
  }
  return { success: false, rows: [] };
}

// Legacy helpers without any /api/ calls
export async function syncAuditData(data: any): Promise<any> {
  return postDirectToGAS({ action: "sync_sheet", ...data });
}

export async function fetchCsvFromGoogleSheet(url: string): Promise<string> {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("URL Google Sheet tidak valid");
  const sheetId = match[1];
  const gidMatch = url.match(/[?&]gid=([0-9]+)/) || url.match(/#gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("Gagal mengambil CSV");
  return await res.text();
}
