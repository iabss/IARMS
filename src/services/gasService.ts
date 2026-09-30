import { AFSFindingRecord } from '../types';
import { ProjectLinkConfig } from '../data/dataSyncManager';

// Default Google Apps Script Web App Deployment URL
export const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";
const STORAGE_KEY_GAS_URL = 'iarms_configured_gas_url_v1';

/**
 * Get currently configured Google Apps Script Web App URL
 */
export function getGasEndpointUrl(): string {
  try {
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

/**
 * Unified POST to Google Apps Script Web App with proxy and direct fallback
 */
export async function postToGAS(payload: Record<string, any>): Promise<any> {
  const gasUrl = getGasEndpointUrl();

  // 1. Try local server proxy first (avoids CORS issues in browser)
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

  // 2. Direct fetch fallback to Google Apps Script
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

  // 1. Try server proxy route first
  try {
    const res = await fetch(`/api/gas-audit-data?targetUrl=${encodeURIComponent(gasUrl)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data?.rows) && json.data.rows.length > 0) {
        return {
          success: true,
          rows: json.data.rows,
          projects: json.data.projects || [],
          count: json.data.rows.length,
          timestamp: json.data.timestamp || new Date().toISOString(),
          source: 'server_proxy'
        };
      }
    }
  } catch (e) {}

  // 2. Direct GET from GAS
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;

    const res = await fetch(gasUrl, {
      signal: controller?.signal
    });

    if (timeout) clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        const json = JSON.parse(text);
        if (json && Array.isArray(json.rows) && json.rows.length > 0) {
          return {
            success: true,
            rows: json.rows,
            projects: json.projects || [],
            count: json.rows.length,
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
        return {
          success: true,
          rows: json.state.customRows,
          projects: json.state.projectConfigs || [],
          count: json.state.customRows.length,
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
