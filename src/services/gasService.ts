import { AFSFindingRecord } from '../types';
import { ProjectLinkConfig } from '../data/dataSyncManager';

// Default Google Apps Script Web App Deployment URL
export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbzLmowu47-PCtKiSLmXDcTuEnEjnupdCWnQQIqMnYaEIP0jD2c5VOnCFrLX9-8EXmwc2w/exec";
const STORAGE_KEY_GAS_URL = 'iarms_configured_gas_url_v1';

/**
 * Get currently configured Google Apps Script Web App URL
 */
export function getGasEndpointUrl(): string {
  try {
    // 1. Check environment variable (configured in Netlify Site Configuration)
    const envUrl = (import.meta as any).env?.VITE_GAS_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('https://script.google.com/macros/s/')) {
      return envUrl.trim();
    }

    // 2. Check localStorage custom configuration
    const custom = localStorage.getItem(STORAGE_KEY_GAS_URL);
    if (custom && custom.trim().startsWith('https://script.google.com/macros/s/')) {
      return custom.trim();
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_GAS_URL;
}

/**
 * Set custom Google Apps Script Web App URL
 */
export function setGasEndpointUrl(url: string): boolean {
  try {
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://script.google.com/macros/s/')) {
      return false;
    }
    localStorage.setItem(STORAGE_KEY_GAS_URL, trimmed);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iarms_gas_url_changed', { detail: { url: trimmed } }));
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Reset GAS Endpoint URL to default
 */
export function resetGasEndpointUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_GAS_URL);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iarms_gas_url_changed', { detail: { url: DEFAULT_GAS_URL } }));
    }
  } catch (e) {}
}

// Helper to detect if running on static hosting (Netlify, etc.)
export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('netlify.app') || host.includes('vercel.app') || host.includes('pages.dev');
}

/**
 * Unified POST to Google Apps Script Web App with proxy and direct fallback
 */
export async function postToGAS(payload: Record<string, any>): Promise<any> {
  const gasUrl = getGasEndpointUrl();

  // If on Netlify or static host, execute direct client fetch immediately
  if (!isStaticHosting()) {
    try {
      const proxyRes = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, _targetGasUrl: gasUrl })
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && data.success !== false) {
          return data;
        }
      }
    } catch (err) {
      // Continue to direct fetch
    }
  }

  // Direct fetch to Google Apps Script (Standard for Netlify)
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (text && !text.trim().startsWith('<')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: true, text };
      }
    }
    return { success: true, status: 'ok' };
  } catch (error: any) {
    console.warn('[GAS Service] Warning posting to Google Apps Script:', error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Normalizer cerdas untuk memastikan data dengan format header/kolom yang berbeda
 * tetap dapat terbaca dan diproses dengan sempurna oleh IARMS.
 */
export function normalizeFindingRecord(raw: any, index: number = 0): AFSFindingRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      _rowId: index + 1,
      NO: String(index + 1),
      'PROJECT AUDIT': 'AUDIT',
      SITE: 'HEAD OFFICE',
      'PROBLEM/FINDING': '',
      STATUS: 'OPEN'
    };
  }

  // Helper untuk mengecek banyak alias kolom sekaligus (case-insensitive & spasi/tanda baca fleksibel)
  const get = (aliases: string[]): string => {
    for (const a of aliases) {
      if (raw[a] !== undefined && raw[a] !== null && String(raw[a]).trim() !== '') {
        return String(raw[a]).trim();
      }
    }
    const rawKeys = Object.keys(raw);
    for (const a of aliases) {
      const cleanAlias = a.toLowerCase().replace(/[\/\s-_]/g, '');
      const matchedKey = rawKeys.find(k => k.toLowerCase().replace(/[\/\s-_]/g, '') === cleanAlias);
      if (matchedKey && raw[matchedKey] !== undefined && raw[matchedKey] !== null && String(raw[matchedKey]).trim() !== '') {
        return String(raw[matchedKey]).trim();
      }
    }
    return '';
  };

  // Normalisasi Status agar kompatibel dengan ragam penulisan status
  const rawStatus = get(['STATUS', 'STATUS TEMUAN', 'STATUS AUDIT', 'STATUS AKHIR', 'STATUS CLOSING', 'STATUS ITEM', 'STATUS TINDAK LANJUT', 'HASIL REVIEW']).toUpperCase();
  let status = 'OPEN';
  if (
    rawStatus.includes('CLOSE') || 
    rawStatus.includes('SELESAI') || 
    rawStatus.includes('DONE') || 
    rawStatus.includes('100%') || 
    rawStatus.includes('TERPENUHI') ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'C'
  ) {
    status = 'CLOSE';
  } else if (
    rawStatus.includes('PROGRESS') || 
    rawStatus.includes('PROSES') || 
    rawStatus.includes('PARTIAL') ||
    rawStatus.includes('ON GOING') ||
    rawStatus.includes('ON-GOING')
  ) {
    status = 'PROGRESS';
  } else {
    status = 'OPEN';
  }

  // Normalisasi Periode / Tahun
  let finalYear = get(['PERIODE AUDIT', 'PERIODE', 'TAHUN', 'YEAR', 'TANGGAL AUDIT', 'TAHUN PELAKSANAAN']);
  if (!finalYear) {
    const docText = `${get(['DOKUMENTASI TEMUAN', 'BUKTI TEMUAN'])} ${get(['DUE DATE', 'TARGET'])} ${get(['PROBLEM/FINDING', 'TEMUAN'])}`;
    const match = docText.match(/\b(202[0-9])\b/);
    finalYear = match ? match[1] : '2026';
  }

  return {
    _rowId: raw._rowId !== undefined ? Number(raw._rowId) : (index + 1),
    NO: get(['NO', 'NO.', '#', 'NUM', 'NOMOR', 'ITEM']) || String(index + 1),
    'PROJECT AUDIT': get(['PROJECT AUDIT', 'PROJECT', 'NAMA PROJECT', 'SEKTOR', 'AUDIT PROGRAM', 'PENUGASAN']) || 'AUDIT',
    SITE: get(['SITE', 'JOB SITE', 'LOKASI', 'CABANG', 'LOCATION']) || 'HEAD OFFICE',
    'PERIODE AUDIT': finalYear,
    DEPARTMENT: get(['DEPARTMENT', 'DEPT', 'DEPARTEMEN', 'DIVISI', 'UNIT', 'BAGIAN', 'AUDITEE']),
    'PROBLEM/FINDING': get(['PROBLEM/FINDING', 'PROBLEM', 'FINDING', 'TEMUAN', 'RINGKASAN TEMUAN', 'URAIAN TEMUAN', 'KONDISI', 'CONDITION', 'JUDUL TEMUAN', 'POKOK TEMUAN']) || 'Temuan Audit',
    'DETAIL TEMUAN': get(['DETAIL TEMUAN', 'DETAIL', 'PENJELASAN', 'DESKRIPSI', 'DESKRIPSI TEMUAN', 'FAKTA']),
    'DOKUMENTASI TEMUAN': get(['DOKUMENTASI TEMUAN', 'DOKUMENTASI', 'EVIDENCE', 'BUKTI TEMUAN', 'LAMPIRAN TEMUAN']),
    KRITERIA: get(['KRITERIA', 'CRITERIA', 'DASAR ATURAN', 'SOP', 'REGULASI']) || 'SOP',
    KATEGORI: get(['KATEGORI', 'SEVERITY', 'RISK LEVEL', 'TINGKAT RISIKO', 'KLASIFIKASI']) || 'MINOR',
    REKOMENDASI: get(['REKOMENDASI', 'ACTION PLAN', 'TINDAK LANJUT', 'SARAN PERBAIKAN', 'RECOMMENDATION', 'ACTION']),
    STATUS: status,
    'PIC SITE': get(['PIC SITE', 'PIC LOKASI', 'AUDITEE SITE', 'PIC']),
    'PIC HO': get(['PIC HO', 'PIC PUSAT', 'AUDITEE HO']),
    'DUE DATE': get(['DUE DATE', 'TARGET CLOSING', 'TANGGAL DUE', 'TARGET DATE', 'TANGGAL JATUH TEMPO', 'BATAS WAKTU']),
    REMARKS: get(['REMARKS', 'KETERANGAN', 'STATUS DUE', 'CATATAN STATUS']),
    'DOKUMENTASI CLOSING': get(['DOKUMENTASI CLOSING', 'BUKTI CLOSING', 'BUKTI TINDAK LANJUT', 'LAMPIRAN CLOSING']),
    'REVIEWED CLOSING FROM USER': get(['REVIEWED CLOSING FROM USER', 'REVIEW USER', 'FEEDBACK USER']),
    'REVIEWED CLOSING FROM IA': get(['REVIEWED CLOSING FROM IA', 'REVIEW IA', 'VERIFIKASI IA']),
    NOTE: get(['NOTE', 'CATATAN', 'KETERANGAN TAMBAHAN']),
    'KOLOM BANTU': get(['KOLOM BANTU', 'KOLOM_BANTU', 'BANTU']),
    UPDATED_AT: get(['UPDATED_AT', 'UPDATED AT', 'LAST_MODIFIED']) || raw.UPDATED_AT
  };
}

/**
 * Unified GET to pull live findings from Google Sheets via Google Apps Script
 */
export async function fetchLiveFindingsFromGAS(): Promise<{
  success: boolean;
  rows: AFSFindingRecord[];
  projects?: any[];
  count?: number;
  timestamp?: string;
  source?: 'gas' | 'server_proxy' | 'fallback';
}> {
  const gasUrl = getGasEndpointUrl();

  // 1. Try server proxy route first (only if not on Netlify)
  if (!isStaticHosting()) {
    try {
      const res = await fetch(`/api/gas-audit-data?targetUrl=${encodeURIComponent(gasUrl)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data?.rows) && json.data.rows.length > 0) {
          const normalizedRows = json.data.rows.map((r: any, idx: number) => normalizeFindingRecord(r, idx));
          return {
            success: true,
            rows: normalizedRows,
            projects: json.data.projects || [],
            count: normalizedRows.length,
            timestamp: json.data.timestamp || new Date().toISOString(),
            source: 'server_proxy'
          };
        }
      }
    } catch (e) {}
  }

  // 2. Direct GET from GAS
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 9000) : null;

    const res = await fetch(gasUrl, {
      signal: controller?.signal
    });

    if (timeout) clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        const json = JSON.parse(text);
        if (json && Array.isArray(json.rows) && json.rows.length > 0) {
          const normalizedRows = json.rows.map((r: any, idx: number) => normalizeFindingRecord(r, idx));
          return {
            success: true,
            rows: normalizedRows,
            projects: json.projects || [],
            count: normalizedRows.length,
            timestamp: json.timestamp || new Date().toISOString(),
            source: 'gas'
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[GAS Service] Warning fetching live data from Google Apps Script:', err?.message || err);
  }

  // 3. Fallback: load from persistent server state (/api/app-state)
  try {
    const res = await fetch('/api/app-state');
    if (res.ok) {
      const json = await res.json();
      if (json && json.state && Array.isArray(json.state.customRows) && json.state.customRows.length > 0) {
        const normalizedRows = json.state.customRows.map((r: any, idx: number) => normalizeFindingRecord(r, idx));
        return {
          success: true,
          rows: normalizedRows,
          projects: json.state.projectConfigs || [],
          count: normalizedRows.length,
          timestamp: json.state.lastUpdated,
          source: 'fallback'
        };
      }
    }
  } catch (e) {}

  return {
    success: false,
    rows: [],
    projects: [],
    count: 0
  };
}

/**
 * Save / Update a Finding in Google Sheets via GAS
 */
export async function saveFindingToGAS(finding: AFSFindingRecord): Promise<any> {
  const payload = {
    action: 'save_finding',
    ...finding
  };
  return postToGAS(payload);
}

/**
 * Delete a Finding from Google Sheets via GAS
 */
export async function deleteFindingFromGAS(no: string, rowId?: number): Promise<any> {
  const payload = {
    action: 'delete_finding',
    NO: no,
    no: no,
    _rowId: rowId
  };
  return postToGAS(payload);
}

/**
 * Update IA Review in Google Sheets via GAS
 */
export async function updateIaReviewInGAS(no: string, review: string, status: string, rowId?: number): Promise<any> {
  const payload = {
    action: 'update_ia_review',
    NO: no,
    no: no,
    review: review,
    status: status,
    _rowId: rowId
  };
  return postToGAS(payload);
}

/**
 * Update Closing Documentation in Google Sheets via GAS
 */
export async function updateClosingDocInGAS(no: string, docUrl: string, rowId?: number): Promise<any> {
  const payload = {
    action: 'update_closing_doc',
    NO: no,
    no: no,
    doc: docUrl,
    _rowId: rowId
  };
  return postToGAS(payload);
}

/**
 * Batch save dataset to Google Sheets via GAS
 */
export async function syncBatchToGAS(rows: AFSFindingRecord[]): Promise<any> {
  const payload = {
    action: 'sync_batch',
    rows: rows
  };
  return postToGAS(payload);
}

/**
 * Save Project Configuration to Google Sheets via GAS
 */
export async function saveProjectToGAS(project: ProjectLinkConfig): Promise<any> {
  const payload = {
    action: 'save_project',
    id: project.id || `${project.projectName}|${project.siteName || 'HO'}`,
    projectName: project.projectName,
    siteName: project.siteName || 'HEAD OFFICE',
    year: project.year || '2026',
    sheetUrl: project.sheetUrl || '',
    status: project.status || 'synced',
    rowCount: project.rowCount || 0
  };
  return postToGAS(payload);
}

/**
 * Delete Project Configuration from Google Sheets via GAS
 */
export async function deleteProjectFromGAS(id: string, projectName?: string, siteName?: string): Promise<any> {
  const payload = {
    action: 'delete_project',
    id: id,
    projectName: projectName || '',
    siteName: siteName || 'HEAD OFFICE'
  };
  return postToGAS(payload);
}

/**
 * Sync entire projects list to Google Sheets via GAS
 */
export async function syncProjectsListToGAS(projects: ProjectLinkConfig[]): Promise<any> {
  const payload = {
    action: 'sync_projects_list',
    projects: projects
  };
  return postToGAS(payload);
}
