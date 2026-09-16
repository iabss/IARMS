export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

export async function fetchAuditData(): Promise<any> {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Gagal mengambil data dari Google Apps Script:", error);
    throw error;
  }
}

export async function syncAuditData(payload: Record<string, any>): Promise<any> {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    return text ? JSON.parse(text) : { status: "success", success: true };
  } catch (error) {
    console.error("Gagal menyinkronkan data ke Google Apps Script:", error);
    throw error;
  }
}

/**
 * Send delete project request to Google Apps Script backend
 */
export async function deleteProjectFromBackend(item: {
  defaultProject?: string;
  project?: string;
  projectName?: string;
  site?: string;
  siteName?: string;
  year?: string | number;
}): Promise<any> {
  const payload = {
    action: "delete_project",
    project: item.defaultProject || item.project || item.projectName || "",
    site: item.site || item.siteName || "HEAD OFFICE",
    year: item.year ? String(item.year).trim() : ""
  };

  return await syncAuditData(payload);
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
      console.error(`Google Apps Script merespon HTTP status error: ${response.status} ${response.statusText}`);
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
      console.error("Gagal parse JSON response dari GAS:", parseErr, text);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    return json;
  } catch (error: any) {
    console.error("Gagal mengirim payload registrasi ke Google Apps Script:", error);
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
      console.error(`Google Apps Script merespon HTTP status error: ${response.status} ${response.statusText}`);
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
  } catch (error) {
    console.error("Gagal mengirim payload reset_password ke Google Apps Script:", error);
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
      console.error(`Google Apps Script merespon HTTP status error: ${response.status} ${response.statusText}`);
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
      console.error("Gagal parse JSON response dari GAS:", parseErr, text);
      throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
    }

    return json;
  } catch (error) {
    console.error("Gagal mengirim payload resend_password ke Google Apps Script:", error);
    throw new Error("Gagal mengirim password ke email. Silakan coba lagi.");
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
      console.error(`Google Apps Script merespon HTTP status error: ${response.status} ${response.statusText}`);
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
  } catch (error) {
    console.error("Gagal mengirim payload resend_verification ke Google Apps Script:", error);
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

  // Direct array of projects if backend provides it
  if (Array.isArray(json.projects)) {
    return json.projects;
  }

  const rawList = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item) continue;

    // Case 1: item is an object
    if (typeof item === 'object' && !Array.isArray(item)) {
      const act = item.action || 'sync_sheet_url';
      const proj = (item.project || item.defaultProject || item.projectName || '').trim().toUpperCase();
      const site = (item.site || item.siteName || 'HEAD OFFICE').trim().toUpperCase();
      const year = item.year ? String(item.year).trim() : '';
      const key = `${proj}|${site}${year ? `|${year}` : ''}`;

      if (act === 'delete_project') {
        deletedSet.add(key);
        deletedSet.add(proj);
        projectMap.delete(key);
      } else {
        if (!deletedSet.has(key)) {
          projectMap.set(key, {
            id: key,
            projectName: proj,
            project: proj,
            defaultProject: proj,
            siteName: site,
            site: site,
            year: year || undefined,
            sheetUrl: item.sheetUrl || '',
            lastSyncedAt: item.timestamp || new Date().toISOString(),
            status: item.sheetUrl ? 'synced' : 'pending',
            rowCount: item.rowCount || item.count || 0
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

/**
 * Fetch project configurations from Google Apps Script backend
 */
export async function fetchProjectsFromGasBackend(): Promise<any[]> {
  try {
    const data = await fetchAuditData();
    return parseGasProjectsResponse(data);
  } catch (error) {
    console.error("Gagal memuat project dari backend GAS:", error);
    return [];
  }
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
