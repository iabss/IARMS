import { RiskItem } from '../types/risk';

const SPREADSHEET_STORAGE_KEY = 'bss_risk_register_spreadsheet_id';
const SPREADSHEET_URL_STORAGE_KEY = 'bss_risk_register_spreadsheet_url';
const SYNCED_RISK_IDS_KEY = 'bss_synced_risk_ids';

export interface SheetSyncResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedCount: number;
  message: string;
  error?: string;
}

export const SPREADSHEET_HEADERS = [
  'Kode Risiko',
  'Site Proyek',
  'Judul Risiko / Peristiwa',
  'Kategori',
  'Departemen',
  'Periode / Kuartal',
  'Risk Owner',
  'Deskripsi Risiko',
  'Akar Masalah (Root Cause)',
  'Konsekuensi / Dampak',
  'Catatan / Skenario Terburuk Inherent',
  'Estimasi Dampak Finansial',
  'Inheren Likelihood (1-5)',
  'Inheren Impact (1-5)',
  'Skor Inheren',
  'Tingkat Risiko Inheren',
  'Pengendalian Eksisting',
  'Efektivitas Kontrol',
  'Rencana Tindakan Mitigasi',
  'Progress Mitigasi (%)',
  'Residual Likelihood (1-5)',
  'Residual Impact (1-5)',
  'Skor Residual',
  'Tingkat Risiko Residual',
  'Status Risiko',
  'Jumlah Action Items',
  'Target Penyelesaian',
  'Waktu Backup (WIB)',
];

export function riskToRow(risk: RiskItem): (string | number)[] {
  const timestamp = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return [
    risk.code || '',
    risk.site || '',
    risk.title || '',
    risk.category || '',
    risk.department || '',
    risk.quarter || '',
    risk.owner || '',
    risk.description || '',
    risk.rootCause || '',
    risk.consequences || '',
    risk.inherentWorstCaseScenario || '',
    risk.financialImpactEstimate || '',
    risk.inherentLikelihood || 1,
    risk.inherentImpact || 1,
    risk.inherentScore || 1,
    risk.inherentLevel || '',
    risk.existingControls || '',
    risk.controlEffectiveness || '',
    risk.mitigationPlan || '',
    `${risk.mitigationProgress || 0}%`,
    risk.residualLikelihood || 1,
    risk.residualImpact || 1,
    risk.residualScore || 1,
    risk.residualLevel || '',
    risk.status || 'Open',
    risk.actionItems ? risk.actionItems.length : 0,
    risk.targetDate || '',
    timestamp,
  ];
}

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_STORAGE_KEY);
}

export function getSavedSpreadsheetUrl(): string | null {
  return localStorage.getItem(SPREADSHEET_URL_STORAGE_KEY);
}

export function saveSpreadsheetInfo(id: string, url: string) {
  localStorage.setItem(SPREADSHEET_STORAGE_KEY, id);
  localStorage.setItem(SPREADSHEET_URL_STORAGE_KEY, url);
}

export function getSyncedRiskIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_RISK_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markRiskAsSynced(riskId: string) {
  const current = getSyncedRiskIds();
  current.add(riskId);
  localStorage.setItem(SYNCED_RISK_IDS_KEY, JSON.stringify(Array.from(current)));
}

export function markMultipleRisksAsSynced(riskIds: string[]) {
  const current = getSyncedRiskIds();
  riskIds.forEach((id) => current.add(id));
  localStorage.setItem(SYNCED_RISK_IDS_KEY, JSON.stringify(Array.from(current)));
}

export function resetSyncedStatus() {
  localStorage.removeItem(SYNCED_RISK_IDS_KEY);
}

/**
 * Creates a brand new Google Spreadsheet with standard headers.
 */
export async function createRiskSpreadsheet(accessToken: string): Promise<{ id: string; url: string }> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `BSS - Risk Register Backup & Audit Trail (${new Date().getFullYear()})`,
      },
      sheets: [
        {
          properties: {
            title: 'Risk Register',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal membuat spreadsheet baru (HTTP ${res.status})`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write header row
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Risk Register'!A1:AB1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: "'Risk Register'!A1:AB1",
      majorDimension: 'ROWS',
      values: [SPREADSHEET_HEADERS],
    }),
  });

  saveSpreadsheetInfo(spreadsheetId, spreadsheetUrl);
  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Checks if existing spreadsheet is valid and accessible.
 */
export async function verifySpreadsheet(spreadsheetId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Appends a newly input risk directly to Google Sheet for immediate backup.
 */
export async function appendRiskToSpreadsheet(
  risk: RiskItem,
  accessToken: string,
  providedSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  let spreadsheetId = providedSpreadsheetId || getSavedSpreadsheetId();
  let spreadsheetUrl = getSavedSpreadsheetUrl();

  // If no spreadsheet yet or invalid, create one
  if (!spreadsheetId || !(await verifySpreadsheet(spreadsheetId, accessToken))) {
    const created = await createRiskSpreadsheet(accessToken);
    spreadsheetId = created.id;
    spreadsheetUrl = created.url;
  }

  const row = riskToRow(risk);

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Risk Register'!A:AB:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'Risk Register'!A:AB",
        majorDimension: 'ROWS',
        values: [row],
      }),
    }
  );

  if (!appendRes.ok) {
    const errData = await appendRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal mencatat backup ke Google Sheet (HTTP ${appendRes.status})`);
  }

  markRiskAsSynced(risk.id);

  return {
    spreadsheetId,
    spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Performs full sync and refresh of all risks into the Google Spreadsheet.
 * Writes header + all rows cleanly so the spreadsheet is 100% in sync with the dashboard.
 */
export async function syncAllRisksToSpreadsheet(
  risks: RiskItem[],
  accessToken: string,
  providedSpreadsheetId?: string
): Promise<SheetSyncResult> {
  try {
    let spreadsheetId = providedSpreadsheetId || getSavedSpreadsheetId();
    let spreadsheetUrl = getSavedSpreadsheetUrl();

    // Verify or create
    if (!spreadsheetId || !(await verifySpreadsheet(spreadsheetId, accessToken))) {
      const created = await createRiskSpreadsheet(accessToken);
      spreadsheetId = created.id;
      spreadsheetUrl = created.url;
    }

    // Clear existing data range
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Risk Register'!A:AB:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => {
      // Ignore if sheet was just created
    });

    // Prepare header + all rows
    const rows: (string | number)[][] = [SPREADSHEET_HEADERS];
    risks.forEach((risk) => {
      rows.push(riskToRow(risk));
    });

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Risk Register'!A1:AB${rows.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'Risk Register'!A1:AB${rows.length}`,
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    if (!updateRes.ok) {
      const errData = await updateRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gagal menyinkronkan data ke Google Sheet (HTTP ${updateRes.status})`);
    }

    // Mark all risks as synced
    const allIds = risks.map((r) => r.id);
    markMultipleRisksAsSynced(allIds);

    const finalUrl = spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: finalUrl,
      syncedCount: risks.length,
      message: `Berhasil menyinkronkan ${risks.length} data risiko ke Google Spreadsheet.`,
    };
  } catch (err: any) {
    return {
      success: false,
      spreadsheetId: providedSpreadsheetId || getSavedSpreadsheetId() || '',
      spreadsheetUrl: getSavedSpreadsheetUrl() || '',
      syncedCount: 0,
      message: err.message || 'Terjadi kesalahan saat sinkronisasi Google Sheet.',
      error: err.toString(),
    };
  }
}
