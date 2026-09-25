import { DEFAULT_DEV_AFS_PROJECTS } from '../data/defaultAfsProjects';

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

export async function fetchAuditData(): Promise<any> {
  // 1. Try local server proxy endpoint first (avoids CORS & browser network fetch exceptions)
  try {
    const localRes = await fetch('/api/gas-audit-data');
    if (localRes.ok) {
      const localJson = await localRes.json();
      if (localJson && localJson.data) {
        return localJson.data;
      }
    }
  } catch {
    // If local proxy is unavailable, proceed to direct fetch
  }

  // 2. Direct fetch with timeout & graceful fallback
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      signal: controller?.signal
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      if (text && !text.trim().startsWith('<')) {
        return JSON.parse(text);
      }
    }
  } catch (error: any) {
    console.warn("Koneksi langsung ke Google Apps Script backend timeout/offline:", error?.message || error);
  }

  // 3. Fallback to persisted server state if available
  try {
    const appStateRes = await fetch('/api/app-state');
    if (appStateRes.ok) {
      const appStateJson = await appStateRes.json();
      if (appStateJson?.state?.projectConfigs && appStateJson.state.projectConfigs.length > 0) {
        return { projects: appStateJson.state.projectConfigs };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function syncAuditData(payload: Record<string, any>): Promise<any> {
  try {
    // Try local server proxy first
    try {
      const proxyRes = await fetch("/api/gas-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        return data;
      }
    } catch {
      // Fallback to direct POST
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    return text && !text.trim().startsWith('<') ? JSON.parse(text) : { status: "success", success: true };
  } catch (error: any) {
    console.warn("Gagal menyinkronkan data ke Google Apps Script (background):", error?.message || error);
    return { status: "offline", success: false };
  }
}

/**
 * Send delete project request to centralized server backend and Google Apps Script
 * Handles Cloudflare KV quota limit exceeded gracefully
 */
export async function deleteProjectFromBackend(item: {
  id?: string;
  defaultProject?: string;
  project?: string;
  projectName?: string;
  site?: string;
  siteName?: string;
  year?: string | number;
}): Promise<{ status: string; success: boolean; deletedKey: string; message?: string; kvLimitExceeded?: boolean }> {
  const pName = (item.projectName || item.defaultProject || item.project || "").trim().toUpperCase();
  const pSite = (item.siteName || item.site || "HEAD OFFICE").trim().toUpperCase();
  const pYear = item.year ? String(item.year).trim() : "";
  const pKey = item.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ""}`;

  const payload = {
    id: pKey,
    project: pName,
    site: pSite,
    year: pYear
  };

  let kvLimitExceeded = false;
  let serverWarning = "";

  // 1. Centralized server delete (Node Express / Cloudflare Workers / KV)
  try {
    const res = await fetch('/api/delete-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {}
      
      const lower = errMsg.toLowerCase();
      if (lower.includes('limit') || lower.includes('quota') || lower.includes('exceeded')) {
        kvLimitExceeded = true;
        serverWarning = errMsg;
      } else {
        throw new Error(errMsg);
      }
    } else {
      const data = await res.json().catch(() => null);
      if (data) {
        if (data.kvLimitExceeded || (data.warning && data.warning.toLowerCase().includes('limit'))) {
          kvLimitExceeded = true;
          serverWarning = data.warning || data.message;
        }
        if (data.success === false && !kvLimitExceeded) {
          throw new Error(data.error || 'Server menolak penghapusan project');
        }
      }
    }
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    if (msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded')) {
      kvLimitExceeded = true;
      serverWarning = err?.message || 'KV put() limit exceeded for the day';
    } else {
      console.error("Gagal hapus project dari server backend /api/delete-project:", err);
      throw new Error(err?.message || "Gagal menghapus project dari server");
    }
  }

  // 2. Google Apps Script delete
  try {
    await syncAuditData({
      action: "delete_project",
      project: pName,
      site: pSite,
      year: pYear,
      id: pKey
    });
  } catch (err) {
    console.warn("Gagal kirim delete_project ke Google Apps Script:", err);
  }

  return { 
    status: "success", 
    success: true, 
    deletedKey: pKey,
    kvLimitExceeded,
    message: serverWarning
  };
}

/**
 * One-time purge of all AFS projects in Centralized Cloudflare KV / Server Master Database
 */
export async function purgeAfsProjectsFromServer(): Promise<any> {
  try {
    const res = await fetch('/api/purge-afs-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Gagal request /api/purge-afs-projects:", err);
  }
  return { success: false };
}

/**
 * Save / Update project link configuration to centralized server backend and Google Apps Script
 */
export async function saveProjectToBackend(item: {
  id?: string;
  projectName?: string;
  defaultProject?: string;
  project?: string;
  siteName?: string;
  site?: string;
  year?: string | number;
  sheetUrl?: string;
  status?: string;
  rowCount?: number;
  lastSyncedAt?: string;
}): Promise<any> {
  const pName = (item.projectName || item.defaultProject || item.project || "").trim().toUpperCase();
  const pSite = (item.siteName || item.site || "HEAD OFFICE").trim().toUpperCase();
  const pYear = item.year ? String(item.year).trim() : "";
  const pKey = item.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ""}`;

  const payload = {
    id: pKey,
    projectName: pName,
    defaultProject: pName,
    project: pName,
    siteName: pSite,
    site: pSite,
    year: pYear || undefined,
    sheetUrl: item.sheetUrl || "",
    status: item.status || (item.sheetUrl && item.sheetUrl.trim() ? "synced" : "pending"),
    rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
    lastSyncedAt: item.lastSyncedAt || new Date().toISOString()
  };

  // 1. Centralized server persist (Node Express / Cloudflare Workers / KV)
  let kvLimitExceeded = false;
  let serverSuccess = true;
  let serverMessage = "";

  try {
    const res = await fetch('/api/save-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {}

      const lower = errMsg.toLowerCase();
      if (lower.includes('limit') || lower.includes('quota') || lower.includes('exceeded') || lower.includes('put()')) {
        kvLimitExceeded = true;
        serverSuccess = false;
        serverMessage = errMsg;
      } else {
        serverSuccess = false;
        serverMessage = errMsg;
      }
    } else {
      const data = await res.json().catch(() => null);
      if (data) {
        if (data.kvLimitExceeded || (data.warning && String(data.warning).toLowerCase().includes('limit'))) {
          kvLimitExceeded = true;
          serverMessage = data.warning || data.message || 'KV put limit exceeded';
        }
        if (data.savedToKv === false && kvLimitExceeded) {
          serverSuccess = false;
        }
      }
    }
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    if (msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded') || msg.includes('put()')) {
      kvLimitExceeded = true;
      serverSuccess = false;
      serverMessage = err?.message || 'KV put() limit exceeded for the day';
    } else {
      console.warn("Gagal simpan project ke /api/save-project:", err);
      serverSuccess = false;
      serverMessage = err?.message || 'Gagal terhubung ke server';
    }
  }

  // 2. Google Apps Script sync
  try {
    await syncSheetUrlToBackend(payload);
  } catch (err) {
    console.warn("Gagal kirim sync_sheet_url ke Google Apps Script:", err);
  }

  return { 
    status: kvLimitExceeded ? "kv_limit_exceeded" : (serverSuccess ? "success" : "warning"), 
    success: serverSuccess, 
    kvLimitExceeded,
    message: serverMessage,
    project: payload 
  };
}

/**
 * Save full list of AFS projects directly to Centralized Server Master Database (Cloudflare KV / Express)
 * and Google Apps Script Backend
 */
export async function saveAfsProjectsToServer(projects: any[]): Promise<any> {
  if (!Array.isArray(projects)) return { status: "error", success: false };

  const sanitized = projects.map(item => {
    const pName = (item.projectName || item.defaultProject || item.project || "").trim().toUpperCase();
    const pSite = (item.siteName || item.site || "HEAD OFFICE").trim().toUpperCase();
    const pYear = item.year ? String(item.year).trim() : "";
    const pKey = item.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ""}`;

    return {
      id: pKey,
      projectName: pName,
      defaultProject: pName,
      project: pName,
      siteName: pSite,
      site: pSite,
      year: pYear || undefined,
      sheetUrl: item.sheetUrl || "",
      status: item.status || (item.sheetUrl && item.sheetUrl.trim() ? "synced" : "pending"),
      rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
      lastSyncedAt: item.lastSyncedAt || new Date().toISOString()
    };
  });

  // 1. Send to /api/afs-projects (Server / Cloudflare KV)
  try {
    await fetch('/api/afs-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afs_projects: sanitized })
    });
  } catch (err) {
    console.warn("Gagal kirim afs_projects ke /api/afs-projects:", err);
  }

  // 2. Send to Google Apps Script backend
  try {
    await syncAuditData({
      action: "sync_projects_list",
      projects: sanitized
    });
  } catch (err) {
    console.warn("Gagal sync daftar project ke Google Apps Script:", err);
  }

  return { status: "success", success: true, count: sanitized.length };
}

/**
 * Send sync sheet url request to Google Apps Script backend
 */
export async function syncSheetUrlToBackend(item: {
  defaultProject?: string;
  project?: string;
  projectName?: string;
  site?: string;
  siteName?: string;
  year?: string | number;
  sheetUrl?: string;
  timestamp?: string;
}): Promise<any> {
  const payload = {
    action: "sync_sheet_url",
    project: item.defaultProject || item.project || item.projectName || "",
    site: item.site || item.siteName || "HEAD OFFICE",
    year: item.year ? String(item.year).trim() : "",
    sheetUrl: item.sheetUrl || "",
    timestamp: item.timestamp || new Date().toISOString()
  };

  return await syncAuditData(payload);
}

/**
 * Send register notification to Google Apps Script backend
 * Triggering automatic welcome / confirmation email via MailApp.sendEmail()
 * 
 * Required Payload format:
 * {
 *   "action": "register_user",
 *   "nik": inputNik,
 *   "email": inputEmail,
 *   "name": inputNama,
 *   "department": inputDepartemen,
 *   "role": inputJabatan
 * }
 */
export async function sendRegisterUserToBackend(user: {
  nik: string;
  email: string;
  name: string;
  department?: string;
  role: string;
  tempPassword?: string;
}): Promise<any> {
  const payload: Record<string, any> = {
    action: "register_user",
    nik: user.nik,
    email: user.email,
    name: user.name,
    department: user.department || "",
    role: user.role,
    ...(user.tempPassword ? { tempPassword: user.tempPassword } : {}),
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify(payload),
    });

    // Check HTTP status (500, 403, 404, etc.)
    if (!response.ok) {
      console.warn(`[GAS] Status HTTP: ${response.status} ${response.statusText}`);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    // Google Apps Script HTML error page detection (e.g. 403 authorization required or 500 internal server error page)
    if (text.trim().startsWith("<")) {
      console.warn("GAS returned HTML error page instead of JSON:", text.substring(0, 150));
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.warn("Gagal parse JSON response dari GAS:", parseErr, text);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    return json;
  } catch (error: any) {
    console.warn("Koneksi registrasi ke Google Apps Script bermasalah:", error?.message || error);
    throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
  }
}

/**
 * Send password reset request to Google Apps Script backend
 * Triggering automatic OTP email via MailApp.sendEmail()
 * 
 * Required Payload format:
 * {
 *   "action": "reset_password",
 *   "nik": inputNik,
 *   "email": inputEmail,
 *   "name": inputNama,
 *   "otp": 6DigitOtp
 * }
 */
export async function sendResetPasswordToBackend(params: {
  nik: string;
  email: string;
  name?: string;
  otp?: string;
}): Promise<any> {
  const payload: Record<string, any> = {
    action: "reset_password",
    nik: params.nik.trim(),
    email: params.email.trim(),
    name: params.name || "",
    ...(params.otp ? { otp: params.otp } : {}),
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[GAS] Status HTTP error: ${response.status} ${response.statusText}`);
      throw new Error("Gagal memproses permintaan reset password. Silakan coba lagi.");
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Gagal memproses permintaan reset password. Silakan coba lagi.");
    }

    if (text.trim().startsWith("<")) {
      console.warn("GAS returned HTML error page instead of JSON for reset_password:", text.substring(0, 150));
      throw new Error("Gagal memproses permintaan reset password. Silakan coba lagi.");
    }

    const json = JSON.parse(text);
    return json;
  } catch (error: any) {
    console.warn("Koneksi reset_password ke Google Apps Script bermasalah:", error?.message || error);
    throw error;
  }
}

/**
 * Send resend_password action to Google Apps Script backend
 * Calls MailApp to generate a new random password and send it to the user's email
 */
export async function sendResendPasswordToBackend(params: {
  nik: string;
  email: string;
  name?: string;
  department?: string;
  role?: string;
  newPassword?: string;
}): Promise<any> {
  const payload: Record<string, any> = {
    action: "resend_password",
    subAction: "resend_password",
    nik: params.nik.trim(),
    email: params.email.trim(),
    name: params.name || "",
    department: params.department || "",
    role: params.role || "auditee",
    ...(params.newPassword ? { tempPassword: params.newPassword, newPassword: params.newPassword, password: params.newPassword } : {}),
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[GAS] Status HTTP error: ${response.status} ${response.statusText}`);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    if (text.trim().startsWith("<")) {
      console.warn("GAS returned HTML error page instead of JSON:", text.substring(0, 150));
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.warn("Gagal parse JSON response dari GAS:", parseErr, text);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    return json;
  } catch (error: any) {
    console.warn("Koneksi resend_password ke Google Apps Script bermasalah:", error?.message || error);
    throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
  }
}

/**
 * Send change_password action to Google Apps Script backend
 * Payload: { action: "change_password", nik, oldPassword, newPassword, timestamp }
 */
export async function sendChangePasswordToBackend(params: {
  nik: string;
  oldPassword: string;
  newPassword: string;
}): Promise<any> {
  const payload: Record<string, any> = {
    action: "change_password",
    nik: params.nik.trim(),
    oldPassword: params.oldPassword,
    newPassword: params.newPassword,
    password: params.newPassword,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[GAS] Status HTTP error: ${response.status} ${response.statusText}`);
      throw new Error("Gagal memperbarui password ke server backend. Silakan coba lagi.");
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return { status: "success", success: true };
    }

    if (text.trim().startsWith("<")) {
      console.warn("GAS returned HTML error page instead of JSON:", text.substring(0, 150));
      throw new Error("Gagal memperbarui password ke server backend. Silakan coba lagi.");
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.warn("Gagal parse JSON response dari GAS:", parseErr, text);
      return { status: "success", success: true };
    }

    return json;
  } catch (error: any) {
    console.warn("Koneksi change_password ke Google Apps Script bermasalah:", error?.message || error);
    throw error;
  }
}

/**
 * Send email update and resend verification credentials to Google Apps Script backend
 */
export async function sendResendVerificationToBackend(params: {
  nik: string;
  email: string;
  name?: string;
  department?: string;
  role?: string;
  tempPassword?: string;
}): Promise<any> {
  const payload: Record<string, any> = {
    action: "resend_password",
    subAction: "resend_verification",
    nik: params.nik.trim(),
    email: params.email.trim(),
    name: params.name || "",
    department: params.department || "",
    role: params.role || "auditee",
    ...(params.tempPassword ? { tempPassword: params.tempPassword, newPassword: params.tempPassword, password: params.tempPassword } : {}),
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[GAS] Status HTTP error: ${response.status} ${response.statusText}`);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    if (text.trim().startsWith("<")) {
      console.warn("GAS returned HTML error page instead of JSON:", text.substring(0, 150));
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    const json = JSON.parse(text);
    return json;
  } catch (error: any) {
    console.warn("Koneksi resend_verification ke Google Apps Script bermasalah:", error?.message || error);
    throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
  }
}

/**
 * Parse project list returned from Google Apps Script backend GET
 */
export function parseGasProjectsResponse(json: any): any[] {
  const projectMap = new Map<string, any>();
  const deletedSet = new Set<string>();

  if (!json) return [];

  const rawList = Array.isArray(json.projects)
    ? json.projects
    : (Array.isArray(json.data) 
        ? json.data 
        : (Array.isArray(json.state?.projectConfigs) 
            ? json.state.projectConfigs 
            : (Array.isArray(json) ? json : [])));

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item) continue;

    // Case 1: item is an object
    if (typeof item === 'object' && !Array.isArray(item)) {
      const act = item.action || (item.sheetUrl === 'DELETED' ? 'delete_project' : 'sync_sheet_url');
      const proj = (item.project || item.defaultProject || item.projectName || '').trim().toUpperCase();
      const site = (item.site || item.siteName || 'HEAD OFFICE').trim().toUpperCase();
      const year = item.year ? String(item.year).trim() : '';
      const key = `${proj}|${site}${year ? `|${year}` : ''}`;

      if (act === 'delete_project' || item.sheetUrl === 'DELETED') {
        deletedSet.add(key);
        deletedSet.add(proj);
        projectMap.delete(key);
      } else {
        if (!deletedSet.has(key) && proj) {
          projectMap.set(key, {
            id: key,
            projectName: proj,
            project: proj,
            defaultProject: proj,
            siteName: site,
            site: site,
            year: year || undefined,
            sheetUrl: item.sheetUrl && item.sheetUrl !== 'DELETED' ? item.sheetUrl : '',
            lastSyncedAt: item.timestamp || item.lastSyncedAt || new Date().toISOString(),
            status: item.sheetUrl && item.sheetUrl.trim() && item.sheetUrl !== 'DELETED' ? 'synced' : 'pending',
            rowCount: Number(item.rowCount || item.count || 0)
          });
        }
      }
      continue;
    }

    // Case 2: item is an array row from Google Sheets log
    if (Array.isArray(item)) {
      // Skip header row
      if (i === 0 && item.some(c => typeof c === 'string' && (c.toLowerCase().includes('timestamp') || c.toLowerCase().includes('project')))) {
        continue;
      }

      let payload: any = null;
      for (const col of item) {
        if (typeof col === 'string' && col.trim().startsWith('{') && col.trim().endsWith('}')) {
          try {
            payload = JSON.parse(col);
            break;
          } catch {
            // continue searching
          }
        }
      }

      if (payload) {
        const act = payload.action;
        const proj = (payload.project || payload.defaultProject || payload.projectName || '').trim().toUpperCase();
        const site = (payload.site || payload.siteName || 'HEAD OFFICE').trim().toUpperCase();
        const year = payload.year ? String(payload.year).trim() : '';
        const key = `${proj}|${site}${year ? `|${year}` : ''}`;

        if (act === 'delete_project') {
          deletedSet.add(key);
          deletedSet.add(proj);
          projectMap.delete(key);
        } else if (act === 'sync_sheet_url') {
          if (!deletedSet.has(key)) {
            projectMap.set(key, {
              id: key,
              projectName: proj,
              project: proj,
              defaultProject: proj,
              siteName: site,
              site: site,
              year: year || undefined,
              sheetUrl: payload.sheetUrl || '',
              lastSyncedAt: item[0] || payload.timestamp || new Date().toISOString(),
              status: payload.sheetUrl ? 'synced' : 'pending',
              rowCount: payload.count || payload.rowCount || 0
            });
          }
        }
      }
    }
  }

  return Array.from(projectMap.values());
}

export interface BackendProjectsResult {
  projects: any[];
  customRows?: any[];
  deletedKeys?: string[];
  totalRows?: number;
  source: 'server' | 'gas';
}

/**
 * Fetch project configurations and finding rows with Server-First priority
 * 1. Primary: Fetches from centralized server state (/api/app-state)
 * 2. Secondary: Checks Google Apps Script for any new / updated sheets
 * 3. Merges data cleanly, prioritizing the server master state
 */
export async function fetchProjectsFromBackend(): Promise<BackendProjectsResult> {
  let serverProjects: any[] = [];
  let serverCustomRows: any[] = [];
  let serverDeletedKeys: string[] = [];

  // 1. Fetch from centralized server state (/api/app-state)
  try {
    const res = await fetch('/api/app-state');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.state) {
        if (Array.isArray(json.state.projectConfigs) && json.state.projectConfigs.length > 0) {
          serverProjects = json.state.projectConfigs;
        }
        if (Array.isArray(json.state.customRows) && json.state.customRows.length > 0) {
          serverCustomRows = json.state.customRows;
        }
        if (Array.isArray(json.state.deletedKeys)) {
          serverDeletedKeys = json.state.deletedKeys;
        }
      }
    }
  } catch (e) {
    console.warn('Gagal membaca /api/app-state:', e);
  }

  // 2. Fetch from Google Apps Script backend
  let gasProjects: any[] = [];
  try {
    const gasData = await fetchAuditData();
    if (gasData) {
      gasProjects = parseGasProjectsResponse(gasData);
    }
  } catch (e) {
    console.warn('Gagal membaca data dari Google Apps Script:', e);
  }

  // 3. Merge server state and GAS data
  const projectMap = new Map<string, any>();
  const deletedSet = new Set(serverDeletedKeys.map(k => k.trim().toUpperCase()));

  // Add server projects first
  for (const sp of serverProjects) {
    const pName = (sp.projectName || sp.defaultProject || sp.project || '').trim().toUpperCase();
    const pSite = (sp.siteName || sp.site || 'HEAD OFFICE').trim().toUpperCase();
    const pYear = sp.year ? String(sp.year).trim() : '';
    const key = sp.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`;
    if (!deletedSet.has(key) && !deletedSet.has(pName)) {
      projectMap.set(key, { ...sp, id: key });
    }
  }

  // Add any valid GAS projects not yet in server
  for (const gp of gasProjects) {
    const pName = (gp.projectName || gp.defaultProject || gp.project || '').trim().toUpperCase();
    const pSite = (gp.siteName || gp.site || 'HEAD OFFICE').trim().toUpperCase();
    const pYear = gp.year ? String(gp.year).trim() : '';
    const key = gp.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`;
    if (!deletedSet.has(key) && !deletedSet.has(pName) && !projectMap.has(key)) {
      projectMap.set(key, { ...gp, id: key });
    }
  }

  const finalProjects = Array.from(projectMap.values());

  return {
    projects: finalProjects,
    customRows: serverCustomRows,
    deletedKeys: serverDeletedKeys,
    totalRows: serverCustomRows.length,
    source: serverProjects.length > 0 ? 'server' : 'gas'
  };
}

/**
 * Fetch project configurations from Google Apps Script backend (Legacy Alias)
 */
export async function fetchProjectsFromGasBackend(): Promise<any[]> {
  try {
    const result = await fetchProjectsFromBackend();
    return result.projects;
  } catch (error: any) {
    console.warn("Gagal memuat project dari backend GAS:", error?.message || error);
    return [];
  }
}

/**
 * Fetch AFS Projects directly from API Server (GET /api/afs-projects)
 * Reads project links directly from the server master database (Cloudflare KV / Express)
 */
export async function fetchAfsProjectsFromServer(): Promise<any[]> {
  try {
    const res = await fetch('/api/afs-projects');
    if (res.ok) {
      const json = await res.json();
      const list = json.afs_projects || json.projects || (Array.isArray(json) ? json : null);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err: any) {
    console.warn('Gagal membaca /api/afs-projects:', err?.message || err);
  }
  return [];
}

/**
 * Fetch project configurations from Cloudflare KV / Server.
 * If KV / Server database is empty, automatically seeds with the 11 default
 * AFS projects from dev via POST /api/afs-projects so they are permanently stored
 * for all users across devices.
 */
export async function fetchAndSeedAfsProjects(): Promise<{ projects: any[]; wasSeeded: boolean }> {
  // 1. Direct Server / Cloudflare KV call (GET /api/afs-projects)
  try {
    const res = await fetch('/api/afs-projects');
    if (res.ok) {
      const json = await res.json();
      const list = json.afs_projects || json.projects || [];
      if (Array.isArray(list) && list.length > 0) {
        return { projects: list, wasSeeded: false };
      }
    }
  } catch (e) {
    console.warn('Gagal memanggil GET /api/afs-projects:', e);
  }

  // 2. Check GAS backend fallback before seeding
  try {
    const backendResult = await fetchProjectsFromBackend();
    if (backendResult?.projects && backendResult.projects.length > 0) {
      // Simpan project yang ditemukan ke Cloudflare KV
      await saveAfsProjectsToServer(backendResult.projects).catch(() => {});
      return { projects: backendResult.projects, wasSeeded: false };
    }
  } catch (e) {}

  // 3. Database / Cloudflare KV masih kosong! Gunakan 11 Project AFS dev sebagai default data
  console.log('Cloudflare KV / Database kosong. Melakukan inisialisasi dengan 11 Project AFS dev...');
  try {
    // Kirimkan (POST) ke KV agar tersimpan secara permanen untuk semua user
    await fetch('/api/afs-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afs_projects: DEFAULT_DEV_AFS_PROJECTS })
    });
    saveAfsProjectsToServer(DEFAULT_DEV_AFS_PROJECTS).catch(() => {});
  } catch (err) {
    console.warn('Gagal melakukan seed 11 project ke Cloudflare KV:', err);
  }

  return { projects: DEFAULT_DEV_AFS_PROJECTS, wasSeeded: true };
}

/**
 * Primary fetchProjects function:
 * 1. Checks GET /api/afs-projects directly
 * 2. If empty, automatically seeds with the 11 dev projects into KV
 * 3. Falls back to fetchProjectsFromBackend() (/api/app-state + GAS)
 */
export async function fetchProjects(): Promise<any[]> {
  const result = await fetchAndSeedAfsProjects();
  return result.projects;
}

/**
 * Fetch and parse CSV directly from a public Google Sheet URL on client side
 */
export async function fetchCsvFromGoogleSheet(url: string): Promise<string> {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error('Format Link Google Sheet tidak valid.');
  }

  const sheetId = match[1];
  let gid = '0';
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gid = gidMatch[1];
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;

  // Try direct export
  try {
    const res = await fetch(exportUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('<!DOCTYPE html>') && !text.includes('Sign in')) {
        return text;
      }
    }
  } catch (e) {
    // try gviz
  }

  // Try gviz fallback
  const res2 = await fetch(gvizUrl);
  if (!res2.ok) {
    throw new Error('Google Sheet terkunci atau tidak dapat diakses.');
  }
  const text2 = await res2.text();
  if (text2.includes('<!DOCTYPE html>') || text2.includes('Sign in')) {
    throw new Error('Google Sheet privat. Ubah akses ke "Anyone with the link can view".');
  }
  return text2;
}
