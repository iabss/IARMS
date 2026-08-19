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

// Initialize Firebase App instance safely (singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider with Google Drive scopes
export const DRIVE_FOLDER_ID = '1zDCtRFoFEDWzakB0I5lpr88PP2vwDAAs';
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
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

// Initialize auth state listener
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onFailure) onFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Drive.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get current cached token
export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Sign out
export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

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

// Find or create dedicated folder for IAMS backups if specified folder is not accessible
export async function getOrCreateAppFolder(token: string, folderName: string = 'IAMS_Audit_Backup'): Promise<string> {
  try {
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,webViewLink)`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create new folder in Drive
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (createRes.ok) {
      const createdData = await createRes.json();
      return createdData.id;
    }
  } catch (err) {
    console.error('Error finding/creating App folder:', err);
  }
  return '';
}

// Helper: Raw multipart upload request
async function executeMultipartUpload(
  token: string,
  fileName: string,
  contentString: string,
  mimeType: string,
  targetFolderId?: string
): Promise<Response> {
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType
  };

  if (targetFolderId && targetFolderId.trim()) {
    metadata.parents = [targetFolderId.trim()];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    contentString +
    closeDelimiter;

  return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,parents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });
}

// Upload file to Google Drive folder with smart fallback
export async function uploadToDrive(
  token: string,
  fileName: string,
  content: string | Blob,
  mimeType: string,
  folderId: string = activeFolderId
): Promise<DriveUploadedFile> {
  let contentString: string;
  if (content instanceof Blob) {
    contentString = await content.text();
  } else {
    contentString = content;
  }

  // 1. First Attempt: Upload to the targeted folderId
  let response = await executeMultipartUpload(token, fileName, contentString, mimeType, folderId);

  // 2. If 404 (e.g. Folder not found under current OAuth scope or permissions)
  if (response.status === 404) {
    console.warn(`Target folder ${folderId} returned 404. Creating/using IAMS_Audit_Backup folder...`);
    
    // Automatically find or create an accessible IAMS_Audit_Backup folder in the user's Google Drive
    const fallbackFolderId = await getOrCreateAppFolder(token, 'IAMS_Audit_Backup');
    
    if (fallbackFolderId) {
      setActiveFolderId(fallbackFolderId);
      response = await executeMultipartUpload(token, fileName, contentString, mimeType, fallbackFolderId);
    } else {
      // Direct root upload fallback
      response = await executeMultipartUpload(token, fileName, contentString, mimeType, undefined);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Drive Upload Error:', errorText);
    throw new Error(`Upload ke Google Drive gagal: ${response.status} ${response.statusText} (${errorText})`);
  }

  const data = await response.json();
  return data;
}

// List files in the target Google Drive folder or recent IAMS backup files
export async function listFolderFiles(token: string, folderId: string = activeFolderId): Promise<DriveUploadedFile[]> {
  try {
    let query = `'${folderId}' in parents and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink,createdTime,size)&orderBy=createdTime desc&pageSize=15`;

    let res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 404 || !res.ok) {
      // Fallback search: files with IAMS_ prefix in name
      const fallbackQuery = `name contains 'IAMS_' and trashed = false`;
      const fallbackUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fallbackQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink,createdTime,size)&orderBy=createdTime desc&pageSize=15`;
      res = await fetch(fallbackUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Failed to list files in Drive folder:', err);
    return [];
  }
}
