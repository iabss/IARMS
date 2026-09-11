import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getMergedSheetRows, getAchievementSnapshots, getProjectLinkConfigs } from '../data/dataSyncManager';
import { GOOGLE_SCRIPT_URL } from './api';

// Initialize Firebase App instance safely (singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Drive Target Folder ID
export const DRIVE_FOLDER_ID = '1zDCtRFoFEDWzakB0I5lpr88PP2vwDAAs';
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive'
];

let cachedAccessToken: string | null = null;
let activeFolderId: string = DRIVE_FOLDER_ID;

export function getActiveFolderId(): string {
  return activeFolderId;
}

export function setActiveFolderId(id: string) {
  if (id && id.trim()) {
    activeFolderId = id.trim();
  }
}

// Backup History in localStorage
const STORAGE_KEY_RECENT_BACKUPS = 'iams_recent_backups_v2';

export interface BackupHistoryItem {
  id: string;
  fileName: string;
  type: 'json' | 'csv';
  folderId: string;
  timestamp: string;
  recordCount?: number;
  status: 'success' | 'failed';
  webViewLink?: string;
  sizeFormatted?: string;
}

export function getRecentBackups(): BackupHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT_BACKUPS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveBackupHistoryItem(item: BackupHistoryItem): BackupHistoryItem[] {
  try {
    const existing = getRecentBackups();
    // Keep max 20 items, most recent first
    const updated = [item, ...existing.filter(x => x.id !== item.id)].slice(0, 20);
    localStorage.setItem(STORAGE_KEY_RECENT_BACKUPS, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('iams_backup_saved', { detail: { item, history: updated } }));
    return updated;
  } catch {
    return [];
  }
}

export function clearBackupHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_RECENT_BACKUPS);
    window.dispatchEvent(new CustomEvent('iams_backup_saved', { detail: { history: [] } }));
  } catch (err) {
    console.warn('Failed to clear backup history:', err);
  }
}

// Helper: Compile full application state into a clean backup JSON object
export function compileFullDatabase() {
  const findingRows = getMergedSheetRows();
  const snapshots = getAchievementSnapshots();
  const projectLinks = getProjectLinkConfigs();
  
  // Also collect any local items
  const localItems: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('afs_') || key.startsWith('iams_') || key.startsWith('risk_') || key.startsWith('kpi_') || key.startsWith('timeframe_') || key.startsWith('leadtime_') || key.startsWith('quality_'))) {
      const val = localStorage.getItem(key);
      if (val) localItems[key] = val;
    }
  }

  return {
    version: '2.0',
    appName: 'IAMS - Internal Audit Management System',
    exportedAt: new Date().toISOString(),
    folderId: DRIVE_FOLDER_ID,
    metrics: {
      totalFindings: findingRows.length,
      totalSnapshots: snapshots.length,
      totalProjects: projectLinks.length,
    },
    data: {
      findings: findingRows,
      snapshots: snapshots,
      projectLinks: projectLinks,
      localStorageDump: localItems
    }
  };
}

// Convert finding statements to CSV string
export function compileFindingsToCsv(): string {
  const rows = getMergedSheetRows();
  if (!rows || rows.length === 0) return 'No data';

  const headers = [
    'No',
    'Project Audit',
    'Site / Lokasi',
    'Problem / Finding',
    'Detail Temuan',
    'Kriteria',
    'Kategori',
    'Rekomendasi',
    'Status Closing',
    'PIC Site',
    'PIC HO',
    'Due Date',
    'Remarks',
    'Note'
  ];

  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = [headers.join(',')];

  rows.forEach((r, idx) => {
    csvRows.push([
      escapeCsv(r.NO || idx + 1),
      escapeCsv(r['PROJECT AUDIT'] || '-'),
      escapeCsv(r.SITE || '-'),
      escapeCsv(r['PROBLEM/FINDING'] || '-'),
      escapeCsv(r['DETAIL TEMUAN'] || '-'),
      escapeCsv(r.KRITERIA || '-'),
      escapeCsv(r.KATEGORI || '-'),
      escapeCsv(r.REKOMENDASI || '-'),
      escapeCsv(r.STATUS || 'OPEN'),
      escapeCsv(r['PIC SITE'] || '-'),
      escapeCsv(r['PIC HO'] || '-'),
      escapeCsv(r['DUE DATE'] || '-'),
      escapeCsv(r.REMARKS || '-'),
      escapeCsv(r.NOTE || '-')
    ].join(','));
  });

  return csvRows.join('\r\n');
}

export interface DriveUploadedFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
}

export interface GasBackupResponse {
  success: boolean;
  message?: string;
  status?: string;
  fileName: string;
  folderId: string;
  webViewLink?: string;
  fileId?: string;
  uploadedAt: string;
  type: 'json' | 'csv';
  recordCount?: number;
}

/**
 * Send backup payload directly to Google Apps Script backend URL
 * without requiring OAuth sign-in popups.
 */
export async function sendBackupToGasBackend(
  fileName: string,
  content: string | object,
  type: 'json' | 'csv',
  folderId: string = activeFolderId
): Promise<GasBackupResponse> {
  const contentString = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
  const contentBytes = new Blob([contentString]).size;
  const sizeFormatted = contentBytes > 1024 * 1024 
    ? `${(contentBytes / (1024 * 1024)).toFixed(2)} MB` 
    : `${Math.round(contentBytes / 1024)} KB`;

  let recordCount = 0;
  if (typeof content === 'object' && (content as any)?.metrics?.totalFindings !== undefined) {
    recordCount = (content as any).metrics.totalFindings;
  } else if (type === 'csv') {
    recordCount = getMergedSheetRows().length;
  }

  const payload = {
    action: "backup_drive",
    backupType: type,
    type: type === 'json' ? 'database_json' : 'findings_csv',
    fileName: fileName,
    folderId: folderId,
    timestamp: new Date().toISOString(),
    recordCount: recordCount,
    sizeBytes: contentBytes,
    fileContent: contentString,
    content: contentString,
    data: typeof content === 'object' ? content : undefined,
    metadata: {
      appName: 'IAMS - Internal Audit Management System',
      version: '2.0',
      folderId: folderId,
      exportedAt: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    let webViewLink = `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;
    let responseData: any = null;

    if (response.ok) {
      try {
        const text = await response.text();
        if (text) {
          responseData = JSON.parse(text);
          if (responseData.webViewLink || responseData.fileUrl || responseData.url) {
            webViewLink = responseData.webViewLink || responseData.fileUrl || responseData.url;
          }
        }
      } catch {
        // GAS response might be plain text or HTML, which is okay as long as HTTP status is ok
      }
    } else {
      throw new Error(`Google Apps Script merespon dengan status ${response.status}: ${response.statusText}`);
    }

    const backupResult: GasBackupResponse = {
      success: true,
      status: 'success',
      fileName: fileName,
      folderId: folderId,
      webViewLink: webViewLink,
      fileId: responseData?.fileId || responseData?.id,
      uploadedAt: new Date().toISOString(),
      type: type,
      recordCount: recordCount
    };

    // Record in local history
    saveBackupHistoryItem({
      id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fileName: fileName,
      type: type,
      folderId: folderId,
      timestamp: new Date().toISOString(),
      recordCount: recordCount,
      status: 'success',
      webViewLink: webViewLink,
      sizeFormatted: sizeFormatted
    });

    return backupResult;
  } catch (error: any) {
    console.error('Error sending backup to GAS Backend:', error);
    
    // Record failed attempt in local history for transparency
    saveBackupHistoryItem({
      id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fileName: fileName,
      type: type,
      folderId: folderId,
      timestamp: new Date().toISOString(),
      recordCount: recordCount,
      status: 'failed',
      sizeFormatted: sizeFormatted
    });

    throw error;
  }
}

// Backwards compatibility functions for other callers
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken && onSuccess) {
        onSuccess(user, cachedAccessToken);
      }
    } else {
      if (onFailure) onFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const provider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => provider.addScope(scope));
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error: any) {
    console.error('Google Drive Sign in error:', error);
    throw error;
  }
};

export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export async function uploadToDrive(
  _token: string,
  fileName: string,
  content: string | Blob,
  _mimeType: string,
  folderId: string = activeFolderId
): Promise<DriveUploadedFile> {
  const contentString = content instanceof Blob ? await content.text() : content;
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const res = await sendBackupToGasBackend(fileName, contentString, isCsv ? 'csv' : 'json', folderId);
  return {
    id: res.fileId || `drive_${Date.now()}`,
    name: fileName,
    mimeType: isCsv ? 'text/csv' : 'application/json',
    webViewLink: res.webViewLink,
    createdTime: res.uploadedAt
  };
}

export async function listFolderFiles(_token?: string, _folderId: string = activeFolderId): Promise<DriveUploadedFile[]> {
  const history = getRecentBackups();
  return history.map(h => ({
    id: h.id,
    name: h.fileName,
    mimeType: h.type === 'json' ? 'application/json' : 'text/csv',
    webViewLink: h.webViewLink,
    createdTime: h.timestamp
  }));
}

