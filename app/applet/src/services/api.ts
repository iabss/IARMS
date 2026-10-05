import { AFSFindingRecord, ProjectLinkConfig } from '../types';

/**
 * URL Google Apps Script Web App (Deployment Exec).
 * Digunakan untuk Direct Fetch dari browser client (Netlify / Static Hosting).
 */
export const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzLmowu47-PCtKiSLmXDcTuEnEjnupdCWnQQIqMnYaEIP0jD2c5VOnCFrLX9-8EXmwc2w/exec';

const STORAGE_KEY_GAS_ENDPOINT = 'iarms_gas_endpoint_url_v1';

/**
 * Mendapatkan URL Google Apps Script yang aktif.
 * Memungkinkan override URL via localStorage jika dibutuhkan.
 */
export function getGasEndpointUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const custom = localStorage.getItem(STORAGE_KEY_GAS_ENDPOINT);
      if (custom && custom.trim().startsWith('http')) return custom.trim();
    }
  } catch {}
  return GOOGLE_SCRIPT_URL;
}

/**
 * Mengubah URL endpoint Google Apps Script jika pengguna memasukkan URL custom.
 */
export function setGasEndpointUrl(url: string): void {
  try {
    if (typeof window !== 'undefined') {
      if (url && url.trim().startsWith('http')) {
        localStorage.setItem(STORAGE_KEY_GAS_ENDPOINT, url.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_GAS_ENDPOINT);
      }
    }
  } catch {}
}

/**
 * Utility umum untuk Direct POST ke Google Apps Script.
 * Menggunakan format "Content-Type": "text/plain;charset=utf-8"
 * untuk mencegah masalah preflight CORS pada static hosting (Netlify / Vercel).
 */
export async function postDirectToGAS(payload: any): Promise<any> {
  const url = getGasEndpointUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`[GAS Direct Fetch] HTTP error ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    if (text && !text.trim().startsWith('<')) {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true, raw: text };
      }
    }
    return { success: true };
  } catch (error: any) {
    console.warn('[GAS Direct Fetch] Gagal mengirim data ke GAS:', error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Normalisasi objek data temuan audit dari respon Google Apps Script.
 */
export function normalizeFindingRecord(raw: any, index: number): AFSFindingRecord {
  const norm: AFSFindingRecord = { ...raw };
  norm._rowId = raw._rowId || (index + 1);
  norm.NO = raw.NO || raw.no || String(index + 1);
  norm['PROJECT AUDIT'] = raw['PROJECT AUDIT'] || raw.PROJECT || raw.projectName || 'AUDIT';
  norm.SITE = raw.SITE || raw.site || 'HEAD OFFICE';
  norm['PERIODE AUDIT'] = raw['PERIODE AUDIT'] || raw.TAHUN || raw.year || '2026';
  norm['PROBLEM/FINDING'] = raw['PROBLEM/FINDING'] || raw.problem || raw.finding || '';
  norm['DETAIL TEMUAN'] = raw['DETAIL TEMUAN'] || raw.detail || '';
  norm.REKOMENDASI = raw.REKOMENDASI || raw.rekomendasi || '';
  norm['PIC SITE'] = raw['PIC SITE'] || raw.pic_site || '';
  norm['PIC HO'] = raw['PIC HO'] || raw.pic_ho || '';
  norm.STATUS = raw.STATUS || raw.status || 'OPEN';
  norm.REMARKS = raw.REMARKS || raw.remarks || '';
  norm['REVIEWED CLOSING FROM IA'] = raw['REVIEWED CLOSING FROM IA'] || raw.ia_review || '';
  norm['DOKUMEN PENDUKUNG CLOSING'] = raw['DOKUMEN PENDUKUNG CLOSING'] || raw.closing_doc || '';
  norm.KATEGORI = raw.KATEGORI || raw.kategori || 'MINOR';
  return norm;
}

/**
 * 1. fetchAuditData:
 * Mengambil data audit langsung (Direct Fetch) dari Google Apps Script (GAS).
 * Seluruh endpoint lokal /api/gas-audit-data telah dihapus untuk menghindari error "Failed to fetch" di Netlify.
 */
export async function fetchAuditData(): Promise<{
  success: boolean;
  rows: AFSFindingRecord[];
  projects?: any[];
  count: number;
  timestamp: string;
  source: string;
}> {
  const url = getGasEndpointUrl();
  try {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        const json = JSON.parse(text);
        if (json && Array.isArray(json.rows) && json.rows.length > 0) {
          const normalizedRows = json.rows.map((r: any, idx: number) => normalizeFindingRecord(r, idx));
          let projects = Array.isArray(json.projects) && json.projects.length > 0 ? json.projects : [];

          // Buat daftar project otomatis dari temuan jika belum tersedia dari GAS
          if (projects.length === 0 && normalizedRows.length > 0) {
            const projectMap = new Map<string, any>();
            normalizedRows.forEach((r: any) => {
              const pName = (r['PROJECT AUDIT'] || 'AUDIT').trim().toUpperCase();
              const pSite = (r['SITE'] || 'HEAD OFFICE').trim().toUpperCase();
              const pYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || '2026').trim();
              const key = `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`;
              if (!projectMap.has(key)) {
                projectMap.set(key, {
                  id: key,
                  projectName: pName,
                  defaultProject: pName,
                  project: pName,
                  siteName: pSite,
                  site: pSite,
                  year: pYear,
                  status: 'synced',
                  rowCount: 1,
                  sheetUrl: ''
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
            timestamp: json.timestamp || new Date().toISOString(),
            source: 'gas_direct'
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[fetchAuditData] Direct fetch ke Google Apps Script error:', err?.message || err);
  }

  return {
    success: false,
    rows: [],
    projects: [],
    count: 0,
    timestamp: new Date().toISOString(),
    source: 'error'
  };
}

/**
 * 2. deleteProjectFromBackend:
 * Menghapus project secara langsung ke Google Apps Script.
 * Tidak ada pemanggilan fetch ke endpoint lokal /api/delete-project.
 */
export async function deleteProjectFromBackend(config: any): Promise<{
  status: string;
  success: boolean;
  deletedKey: string;
}> {
  const project = (config.projectName || config.defaultProject || config.project || '').trim().toUpperCase();
  const site = (config.siteName || config.site || 'HEAD OFFICE').trim().toUpperCase();
  const year = config.year ? String(config.year).trim() : '';
  const compositeKey = config.id || `${project}|${site}${year ? `|${year}` : ''}`;

  const payload = {
    action: 'delete_project',
    id: compositeKey,
    project,
    projectName: project,
    site,
    siteName: site,
    year
  };

  // Direct fetch POST ke Google Apps Script
  const result = await postDirectToGAS(payload);

  return {
    status: 'success',
    success: result.success !== false,
    deletedKey: compositeKey
  };
}

/**
 * 3. saveProjectToBackend:
 * Menyimpan data atau link project langsung ke Google Apps Script.
 * Tidak ada pemanggilan fetch ke endpoint lokal /api/save-project.
 */
export async function saveProjectToBackend(config: any): Promise<{
  status: string;
  success: boolean;
  savedProject?: any;
}> {
  const project = (config.projectName || config.defaultProject || config.project || '').trim().toUpperCase();
  const site = (config.siteName || config.site || 'HEAD OFFICE').trim().toUpperCase();
  const year = config.year ? String(config.year).trim() : '';
  const compositeKey = config.id || `${project}|${site}${year ? `|${year}` : ''}`;

  const projectObj: ProjectLinkConfig = {
    id: compositeKey,
    projectName: project,
    defaultProject: project,
    project,
    siteName: site,
    site,
    year,
    sheetUrl: config.sheetUrl || '',
    status: config.status || (config.sheetUrl && config.sheetUrl.trim() ? 'synced' : 'pending'),
    rowCount: config.rowCount !== undefined ? Number(config.rowCount) : 0,
    lastSyncedAt: config.lastSyncedAt || new Date().toISOString()
  };

  const payload = {
    action: 'save_project',
    project: projectObj
  };

  const result = await postDirectToGAS(payload);

  return {
    status: 'success',
    success: result.success !== false,
    savedProject: projectObj
  };
}

/**
 * 4. saveAfsProjectsToServer:
 * Menyimpan seluruh daftar project AFS langsung ke Google Apps Script.
 * Tidak ada pemanggilan fetch ke endpoint lokal /api/afs-projects.
 */
export async function saveAfsProjectsToServer(projects: ProjectLinkConfig[]): Promise<{
  status: string;
  success: boolean;
  count: number;
}> {
  const normalizedProjects = projects.map(p => {
    const proj = (p.projectName || p.defaultProject || p.project || '').trim().toUpperCase();
    const site = (p.siteName || p.site || 'HEAD OFFICE').trim().toUpperCase();
    const year = p.year ? String(p.year).trim() : '';
    const id = p.id || `${proj}|${site}${year ? `|${year}` : ''}`;
    return {
      ...p,
      id,
      projectName: proj,
      siteName: site,
      year,
      status: p.status || (p.sheetUrl && p.sheetUrl.trim() ? 'synced' : 'pending'),
      rowCount: p.rowCount !== undefined ? Number(p.rowCount) : 0,
      lastSyncedAt: p.lastSyncedAt || new Date().toISOString()
    };
  });

  const payload = {
    action: 'sync_projects_list',
    projects: normalizedProjects
  };

  const result = await postDirectToGAS(payload);

  return {
    status: 'success',
    success: result.success !== false,
    count: normalizedProjects.length
  };
}

/**
 * 5. syncAuditData:
 * Menyinkronkan batch audit data secara langsung ke Google Apps Script.
 */
export async function syncAuditData(data: any): Promise<any> {
  const payload = {
    action: 'sync_audit_data',
    ...data
  };
  return postDirectToGAS(payload);
}

/**
 * 6. fetchProjectsFromBackend:
 * Mengambil daftar project langsung dari Google Apps Script untuk sinkronisasi antar browser.
 */
export async function fetchProjectsFromBackend(): Promise<{
  projects: any[];
  customRows?: any[];
  deletedKeys?: string[];
}> {
  const auditData = await fetchAuditData();
  if (auditData.success) {
    return {
      projects: auditData.projects || [],
      customRows: auditData.rows || [],
      deletedKeys: []
    };
  }
  return { projects: [], customRows: [], deletedKeys: [] };
}

/**
 * 7. fetchCsvFromGoogleSheet:
 * Mengambil file CSV Google Sheet langsung dari URL sheet.
 */
export async function fetchCsvFromGoogleSheet(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengambil CSV langsung dari Google Sheet');
  return await res.text();
}
