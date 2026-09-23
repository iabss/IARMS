import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const STATE_FILE_PATH = path.join(process.cwd(), 'server_app_state.json');

interface ServerAppState {
  projectConfigs: any[];
  customRows: any[];
  deletedKeys: string[];
  trendExclusions: string[];
  snapshots: any[];
  lastUpdated: string;
}

// Helper to load persisted server app state
function loadServerState(): ServerAppState {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error('Error loading server app state:', err);
  }
  return {
    projectConfigs: [],
    customRows: [],
    deletedKeys: [],
    trendExclusions: [],
    snapshots: [],
    lastUpdated: new Date().toISOString()
  };
}

// Helper to save persisted server app state
function saveServerState(state: Partial<ServerAppState>): ServerAppState {
  try {
    const current = loadServerState();
    const updated: ServerAppState = {
      ...current,
      ...state,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error saving server app state:', err);
    return loadServerState();
  }
}

// Trust Cloudflare and reverse proxy headers (CF-Connecting-IP, X-Forwarded-For, X-Forwarded-Proto)
app.set('trust proxy', true);

// Enable CORS and Security headers for Cloudflare tunnels, custom domains, and local preview
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, CF-Connecting-IP, CF-Ray');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to fetch URL content with redirects handling
function fetchUrl(targetUrl: string, maxRedirects = 5): Promise<{ statusCode: number; data: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) {
      return reject(new Error('Terlalu banyak pengalihan (Too many redirects)'));
    }

    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv;q=0.8,*/*;q=0.7'
      }
    }, (res) => {
      const statusCode = res.statusCode || 500;
      const contentType = res.headers['content-type'] || '';

      if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(targetUrl);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode, data, contentType });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('Waktu permintaan habis (Timeout) saat mengakses Google Sheets'));
    });
  });
}

// Helper to parse Google Sheets URL to obtain Sheet ID and GID
function parseGoogleSheetUrl(urlStr: string) {
  let sheetId = '';
  let gid = '0';

  const idMatch = urlStr.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    sheetId = idMatch[1];
  }

  const gidMatch = urlStr.match(/[?&]gid=([0-9]+)/) || urlStr.match(/#gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }

  return { sheetId, gid };
}

// Helper to parse CSV / TSV text into array of row objects
function parseCsvRows(text: string, defaultProject = 'PR-PAYMENT') {
  if (!text || !text.trim()) return [];

  // Robust RFC 4180 CSV / TSV parser respecting multiline quoted strings
  const firstLineSample = text.split(/\r?\n/)[0] || '';
  const delimiter = firstLineSample.includes('\t') ? '\t' : ',';

  const rows: string[][] = [];
  let curRow: string[] = [];
  let curCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nextC = text[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        curCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      curRow.push(curCell.trim().replace(/^"(.*)"$/, '$1'));
      curCell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && nextC === '\n') {
        i++; // handle \r\n
      }
      curRow.push(curCell.trim().replace(/^"(.*)"$/, '$1'));
      if (curRow.some(cell => cell.length > 0)) {
        rows.push(curRow);
      }
      curRow = [];
      curCell = '';
    } else {
      curCell += c;
    }
  }

  if (curCell.length > 0 || curRow.length > 0) {
    curRow.push(curCell.trim().replace(/^"(.*)"$/, '$1'));
    if (curRow.some(cell => cell.length > 0)) {
      rows.push(curRow);
    }
  }

  if (rows.length < 2) return [];

  // Automatically find header row index by scanning candidate rows for common audit column keywords
  let headerIndex = 0;
  let maxScore = 0;
  const headerKeywords = [
    'NO', 'NUM', 'NOMOR', 'ITEM',
    'PROJECT', 'PROGRAM', 'SEKTOR', 'AUDIT',
    'SITE', 'LOKASI', 'JOB SITE',
    'PROBLEM', 'FINDING', 'TEMUAN', 'JUDUL', 'URAIAN', 'KONDISI',
    'STATUS', 'CLOSING', 'STATUS TEMUAN',
    'REKOMENDASI', 'ACTION', 'TINDAK LANJUT', 'ACTION PLAN',
    'KRITERIA', 'SOP', 'KATEGORI', 'SEVERITY', 'RISK',
    'PIC', 'AUDITEE', 'DUE DATE', 'TARGET', 'DEPT', 'DEPARTMENT'
  ];

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const candidateCells = rows[r].map(c => c.trim().toUpperCase());
    let score = 0;
    for (const cell of candidateCells) {
      if (headerKeywords.some(kw => cell === kw || cell.includes(kw))) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      headerIndex = r;
    }
  }

  const rawHeaders = rows[headerIndex];
  const headers = rawHeaders.map(h => h.trim().toUpperCase());

  // Helper to find column value flexibly by alias with exact-match priority
  const findVal = (values: string[], aliases: string[]): string => {
    // Pass 1: Exact match
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h === alias);
      if (idx !== -1 && values[idx] !== undefined) {
        return values[idx].trim();
      }
    }
    // Pass 2: Contains alias, excluding misleading columns like STATUS DUE / DUE DATE when looking for STATUS
    for (const alias of aliases) {
      const idx = headers.findIndex(h => {
        if (!h.includes(alias)) return false;
        if (alias === 'STATUS' && (h.includes('DUE') || h.includes('REMARK') || h.includes('TANGGAL') || h.includes('DATE') || h.includes('DOKUMEN'))) {
          return false;
        }
        return true;
      });
      if (idx !== -1 && values[idx] !== undefined) {
        return values[idx].trim();
      }
    }
    return '';
  };

  const parsedRows: any[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length < 2) continue;

    const no = findVal(values, ['NO', 'NO.', '#', 'NUM', 'NOMOR', 'ITEM']);
    const proj = findVal(values, ['PROJECT AUDIT', 'PROJECT', 'NAMA PROJECT', 'SEKTOR', 'AUDIT PROGRAM', 'PENUGASAN']) || defaultProject;
    const site = findVal(values, ['SITE', 'JOB SITE', 'LOKASI', 'CABANG', 'LOCATION']) || 'HO';
    const dept = findVal(values, ['DEPT', 'DEPARTMENT', 'DEPARTEMEN', 'DIVISI', 'UNIT', 'BAGIAN', 'AUDITEE']);
    const problem = findVal(values, ['PROBLEM/FINDING', 'PROBLEM', 'FINDING', 'TEMUAN', 'RINGKASAN TEMUAN', 'URAIAN TEMUAN', 'KONDISI', 'CONDITION', 'JUDUL TEMUAN', 'POKOK TEMUAN']);
    const detail = findVal(values, ['DETAIL TEMUAN', 'DETAIL', 'PENJELASAN', 'DESKRIPSI', 'DESKRIPSI TEMUAN', 'FAKTA']);
    const docTemuan = findVal(values, ['DOKUMENTASI TEMUAN', 'DOKUMENTASI', 'EVIDENCE', 'BUKTI TEMUAN']);
    const kriteria = findVal(values, ['KRITERIA', 'CRITERIA', 'DASAR ATURAN', 'SOP', 'REGULASI']) || 'SOP';
    const kategori = findVal(values, ['KATEGORI', 'SEVERITY', 'RISK LEVEL', 'TINGKAT RISIKO', 'KLASIFIKASI']) || 'MINOR';
    const rekomendasi = findVal(values, ['REKOMENDASI', 'ACTION PLAN', 'TINDAK LANJUT', 'SARAN PERBAIKAN', 'RECOMMENDATION', 'ACTION']);
    
    const rawStatus = findVal(values, ['STATUS', 'STATUS TEMUAN', 'STATUS AUDIT', 'STATUS AKHIR', 'STATUS CLOSING', 'STATUS ITEM', 'STATUS TINDAK LANJUT', 'HASIL REVIEW']).toUpperCase();
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

    const picSite = findVal(values, ['PIC SITE', 'PIC LOKASI', 'AUDITEE SITE', 'PIC']);
    const picHo = findVal(values, ['PIC HO', 'PIC PUSAT', 'AUDITEE HO']);
    const dueDate = findVal(values, ['DUE DATE', 'TARGET CLOSING', 'TANGGAL DUE', 'TARGET DATE', 'TANGGAL JATUH TEMPO', 'BATAS WAKTU']);
    const remarks = findVal(values, ['REMARKS', 'KETERANGAN', 'STATUS DUE', 'CATATAN STATUS']);
    const docClosing = findVal(values, ['DOKUMENTASI CLOSING', 'BUKTI CLOSING', 'BUKTI TINDAK LANJUT', 'LAMPIRAN CLOSING']);
    const reviewedUser = findVal(values, ['REVIEWED CLOSING FROM USER', 'REVIEW USER', 'FEEDBACK USER']);
    const reviewedIa = findVal(values, ['REVIEWED CLOSING FROM IA', 'REVIEW IA', 'VERIFIKASI IA']);
    const note = findVal(values, ['NOTE', 'CATATAN', 'KETERANGAN TAMBAHAN']);

    // Extract Year
    const rawYear = findVal(values, ['PERIODE AUDIT', 'PERIODE', 'TAHUN', 'YEAR', 'TANGGAL AUDIT', 'TAHUN PELAKSANAAN']);
    let finalYear = rawYear;
    if (!finalYear) {
      const matchDoc = (`${docTemuan} ${dueDate} ${problem}`).match(/\b(202[0-9])\b/);
      finalYear = matchDoc ? matchDoc[1] : '2026';
    }

    // Skip empty lines or header repetitions that don't have problem or rekomendasi or no
    if (!no && !problem && !rekomendasi) continue;
    if (no.toUpperCase() === 'NO' || problem.toUpperCase() === 'PROBLEM/FINDING') continue;

    parsedRows.push({
      _rowId: i,
      NO: no || String(parsedRows.length + 1),
      'PROJECT AUDIT': proj,
      SITE: site,
      'PERIODE AUDIT': finalYear,
      ...(dept ? { DEPARTMENT: dept } : {}),
      'PROBLEM/FINDING': problem || 'Temuan Audit',
      'DETAIL TEMUAN': detail,
      'DOKUMENTASI TEMUAN': docTemuan,
      KRITERIA: kriteria,
      KATEGORI: kategori,
      REKOMENDASI: rekomendasi,
      STATUS: status,
      'PIC SITE': picSite,
      'PIC HO': picHo,
      'DUE DATE': dueDate,
      REMARKS: remarks,
      'DOKUMENTASI CLOSING': docClosing,
      'REVIEWED CLOSING FROM USER': reviewedUser,
      'REVIEWED CLOSING FROM IA': reviewedIa,
      NOTE: note,
      'KOLOM BANTU': ''
    });
  }

  return parsedRows;
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Google Sheet Sync Endpoint
app.post('/api/sync-sheet', async (req, res) => {
  try {
    const { sheetUrl, defaultProject = 'PR-PAYMENT', rawCsvData } = req.body;

    // If raw CSV/TSV was pasted directly
    if (rawCsvData && typeof rawCsvData === 'string' && rawCsvData.trim().length > 0) {
      const rows = parseCsvRows(rawCsvData, defaultProject);
      return res.json({
        success: true,
        method: 'paste_csv',
        count: rows.length,
        rows,
        project: defaultProject,
        timestamp: new Date().toISOString()
      });
    }

    if (!sheetUrl || typeof sheetUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL Google Sheet tidak valid'
      });
    }

    const { sheetId, gid } = parseGoogleSheetUrl(sheetUrl);

    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: 'ID Google Sheet tidak ditemukan pada URL yang diberikan.'
      });
    }

    // List candidate URLs to fetch CSV export
    const candidateUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`
    ];

    // If the input was already a direct published URL
    if (sheetUrl.includes('/pub?') || sheetUrl.includes('output=csv') || sheetUrl.includes('format=csv')) {
      candidateUrls.unshift(sheetUrl);
    }

    let fetchedData = '';
    let fetchSuccess = false;
    let isPrivateSheet = false;

    for (const url of candidateUrls) {
      try {
        const result = await fetchUrl(url);
        if (result.data) {
          const lowerData = result.data.toLowerCase();
          // Check if response is HTML login page, redirect page, or unauthorized
          if (
            result.statusCode === 401 || 
            result.statusCode === 403 || 
            lowerData.includes('sign in') || 
            lowerData.includes('accounts.google.com') || 
            lowerData.includes('<!doctype html>') || 
            lowerData.includes('<html') || 
            lowerData.includes('google-site-verification') ||
            lowerData.includes('denied')
          ) {
            isPrivateSheet = true;
            continue;
          }

          // Verify it has CSV content
          if (result.statusCode === 200 && (result.data.includes(',') || result.data.includes('\t') || result.data.includes('\n'))) {
            fetchedData = result.data;
            fetchSuccess = true;
            break;
          }
        }
      } catch (err) {
        console.warn(`Failed fetching from candidate URL ${url}:`, err);
      }
    }

    if (!fetchSuccess) {
      return res.json({
        success: false,
        isPrivate: true,
        sheetId,
        gid,
        message: 'Google Sheet berstatus Akses Terbatas/Privat. Agar server dapat mengunduh data secara otomatis, ubah Akses Umum di Google Sheet menjadi "Siapa saja yang memiliki link" (Viewer) ATAU gunakan tab "Copy-Paste Tabel".'
      });
    }

    const rows = parseCsvRows(fetchedData, defaultProject);

    return res.json({
      success: true,
      method: 'url_sync',
      sheetId,
      gid,
      count: rows.length,
      rows,
      project: defaultProject,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in /api/sync-sheet:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Terjadi kesalahan saat memproses sinkronisasi Google Sheet.'
    });
  }
});

// API Get Persistent Server App State
app.get('/api/app-state', (req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, state });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Update Persistent Server App State
app.post('/api/app-state', (req, res) => {
  try {
    const { projectConfigs, customRows, deletedKeys, trendExclusions, snapshots } = req.body;
    const updated = saveServerState({
      ...(Array.isArray(projectConfigs) ? { projectConfigs } : {}),
      ...(Array.isArray(customRows) ? { customRows } : {}),
      ...(Array.isArray(deletedKeys) ? { deletedKeys } : {}),
      ...(Array.isArray(trendExclusions) ? { trendExclusions } : {}),
      ...(Array.isArray(snapshots) ? { snapshots } : {}),
    });
    return res.json({ success: true, state: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Get AFS Projects List (Server Master Database)
app.get('/api/afs-projects', (req, res) => {
  try {
    const current = loadServerState();
    const configs = Array.isArray(current.projectConfigs) ? current.projectConfigs : [];
    const deletedKeys = Array.isArray(current.deletedKeys) ? new Set(current.deletedKeys.map((k: string) => k.trim().toUpperCase())) : new Set<string>();

    const filtered = configs.filter((c: any) => {
      const pName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
      const pSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
      const pYear = c.year ? String(c.year).trim() : '';
      const pKey = (c.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`).toUpperCase();

      if (deletedKeys.has(pKey) || deletedKeys.has(pName)) return false;
      return true;
    });

    return res.json({
      success: true,
      afs_projects: filtered,
      projects: filtered,
      total: filtered.length,
      isEmpty: filtered.length === 0,
      lastUpdated: current.lastUpdated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, afs_projects: [], projects: [] });
  }
});

// API Save / Update AFS Projects List to Server Master Database
app.post('/api/afs-projects', (req, res) => {
  try {
    const current = loadServerState();
    const body = req.body;
    const rawProjects = Array.isArray(body)
      ? body
      : (Array.isArray(body.afs_projects) ? body.afs_projects : (Array.isArray(body.projects) ? body.projects : [body]));

    let configs = Array.isArray(current.projectConfigs) ? [...current.projectConfigs] : [];
    let deletedKeys = Array.isArray(current.deletedKeys) ? [...current.deletedKeys] : [];

    for (const item of rawProjects) {
      if (!item) continue;
      const targetName = (item.projectName || item.project || item.defaultProject || '').trim().toUpperCase();
      if (!targetName) continue;
      const targetSite = (item.siteName || item.site || 'HEAD OFFICE').trim().toUpperCase();
      const targetYear = item.year ? String(item.year).trim() : '';
      const targetKey = item.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

      // Remove from deletedKeys
      deletedKeys = deletedKeys.filter(k => k !== targetKey && k !== targetName);

      const newConfigItem = {
        id: targetKey,
        projectName: targetName,
        defaultProject: targetName,
        project: targetName,
        siteName: targetSite,
        site: targetSite,
        year: targetYear || undefined,
        sheetUrl: item.sheetUrl || '',
        status: item.status || (item.sheetUrl && item.sheetUrl.trim() ? 'synced' : 'pending'),
        rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
        lastSyncedAt: item.lastSyncedAt || new Date().toISOString()
      };

      const existingIndex = configs.findIndex(c => {
        if (item.id && c.id && item.id === c.id) return true;
        const cName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
        const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
        const cYear = c.year ? String(c.year).trim() : '';
        const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
        return cKey === targetKey;
      });

      if (existingIndex >= 0) {
        configs[existingIndex] = {
          ...configs[existingIndex],
          ...newConfigItem,
          rowCount: item.rowCount !== undefined ? Number(item.rowCount) : configs[existingIndex].rowCount,
          lastSyncedAt: item.lastSyncedAt || configs[existingIndex].lastSyncedAt || new Date().toISOString()
        };
      } else {
        configs.push(newConfigItem);
      }
    }

    const updated = saveServerState({ projectConfigs: configs, deletedKeys });
    return res.json({
      success: true,
      afs_projects: updated.projectConfigs,
      projects: updated.projectConfigs,
      total: updated.projectConfigs?.length || 0,
      state: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Centralized Save / Update Project Link Configuration
app.post('/api/save-project', (req, res) => {
  try {
    const config = req.body;
    if (!config || (!config.projectName && !config.project && !config.defaultProject)) {
      return res.status(400).json({ success: false, error: 'Nama project audit diperlukan' });
    }

    const current = loadServerState();
    let configs = current.projectConfigs ? [...current.projectConfigs] : [];
    const targetName = (config.projectName || config.project || config.defaultProject || '').trim().toUpperCase();
    const targetSite = (config.siteName || config.site || 'HEAD OFFICE').trim().toUpperCase();
    const targetYear = config.year ? String(config.year).trim() : '';
    const targetKey = config.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

    // Remove from deletedKeys if previously deleted
    let deletedKeys = current.deletedKeys ? [...current.deletedKeys] : [];
    deletedKeys = deletedKeys.filter(k => k !== targetKey && k !== targetName);

    const existingIndex = configs.findIndex(c => {
      if (config.id && c.id && config.id === c.id) return true;
      const cName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
      const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
      const cYear = c.year ? String(c.year).trim() : '';
      const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
      return cKey === targetKey;
    });

    const newConfigItem = {
      id: targetKey,
      projectName: targetName,
      defaultProject: targetName,
      project: targetName,
      siteName: targetSite,
      site: targetSite,
      year: targetYear || undefined,
      sheetUrl: config.sheetUrl || '',
      status: config.status || (config.sheetUrl && config.sheetUrl.trim() ? 'synced' : 'pending'),
      rowCount: config.rowCount !== undefined ? Number(config.rowCount) : 0,
      lastSyncedAt: config.lastSyncedAt || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      configs[existingIndex] = {
        ...configs[existingIndex],
        ...newConfigItem,
        rowCount: config.rowCount !== undefined ? Number(config.rowCount) : configs[existingIndex].rowCount,
        lastSyncedAt: config.lastSyncedAt || configs[existingIndex].lastSyncedAt || new Date().toISOString()
      };
    } else {
      configs.push(newConfigItem);
    }

    const updated = saveServerState({ projectConfigs: configs, deletedKeys });
    return res.json({ success: true, projectConfigs: updated.projectConfigs, state: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Centralized Delete Project Link Configuration
app.post('/api/delete-project', (req, res) => {
  try {
    const { id, project, site, year } = req.body;
    const targetName = (project || '').trim().toUpperCase();
    const targetSite = (site || '').trim().toUpperCase();
    const targetYear = year ? String(year).trim() : '';
    const targetKey = id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

    const current = loadServerState();
    let configs = current.projectConfigs ? [...current.projectConfigs] : [];
    let customRows = current.customRows ? [...current.customRows] : [];
    let deletedKeys = current.deletedKeys ? [...current.deletedKeys] : [];

    if (!deletedKeys.includes(targetKey)) deletedKeys.push(targetKey);
    if (targetName && !deletedKeys.includes(targetName) && (!targetSite || targetSite === 'HEAD OFFICE')) {
      deletedKeys.push(targetName);
    }

    configs = configs.filter(c => {
      if (id && c.id && c.id === id) return false;
      const cName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
      const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
      const cYear = c.year ? String(c.year).trim() : '';
      const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
      if (cKey === targetKey) return false;
      if (targetName && cName === targetName) {
        if (!targetSite || cSite === targetSite) {
          if (!targetYear || cYear === targetYear) return false;
        }
      }
      return true;
    });

    // Also remove matching rows from customRows
    customRows = customRows.filter(r => {
      const rProj = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      if (targetName && rProj === targetName) {
        if (!targetSite || rSite === targetSite) {
          if (!targetYear || rYear === targetYear) return false;
        }
      }
      return true;
    });

    const updated = saveServerState({ projectConfigs: configs, customRows, deletedKeys });
    return res.json({ success: true, projectConfigs: updated.projectConfigs, state: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Server-Side Sync All Configured Sheets in Background
app.post('/api/sync-all-server', async (req, res) => {
  try {
    const state = loadServerState();
    const configs = state.projectConfigs || [];
    const configsWithUrl = configs.filter((c: any) => c.sheetUrl && c.sheetUrl.trim() !== '');

    let syncedCount = 0;
    let newMergedRows = [...(state.customRows || [])];

    for (const proj of configsWithUrl) {
      try {
        const { sheetId, gid } = parseGoogleSheetUrl(proj.sheetUrl);
        if (!sheetId) continue;

        const candidateUrls = [
          `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
          `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
          `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`
        ];

        let fetchedData = '';
        for (const url of candidateUrls) {
          try {
            const result = await fetchUrl(url);
            if (result.statusCode === 200 && result.data && (result.data.includes(',') || result.data.includes('\t'))) {
              fetchedData = result.data;
              break;
            }
          } catch (e) {}
        }

        if (fetchedData) {
          const parsed = parseCsvRows(fetchedData, proj.projectName);
          if (parsed.length > 0) {
            // Remove previous rows for this project
            const tProj = (proj.projectName || '').trim().toUpperCase();
            newMergedRows = newMergedRows.filter(r => (r['PROJECT AUDIT'] || '').trim().toUpperCase() !== tProj);
            newMergedRows.push(...parsed);
            proj.rowCount = parsed.length;
            proj.status = 'synced';
            proj.lastSyncedAt = new Date().toISOString();
            syncedCount++;
          }
        }
      } catch (err) {
        console.warn(`Error syncing project ${proj.projectName} on server:`, err);
      }
    }

    const updated = saveServerState({
      projectConfigs: configs,
      customRows: newMergedRows
    });

    return res.json({ success: true, syncedCount, totalRows: newMergedRows.length, state: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Google Apps Script Proxy Endpoints (Avoid CORS & handle fallback gracefully)
const GAS_BACKEND_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

app.get('/api/gas-audit-data', async (req, res) => {
  try {
    const result = await fetchUrl(GAS_BACKEND_URL, 3);
    if (result.statusCode === 200 && result.data) {
      const trimmed = result.data.trim();
      if (!trimmed.startsWith('<') && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (!res.headersSent) {
            return res.json({ success: true, data: parsed });
          }
        } catch {
          // parse error
        }
      }
    }
    // Return graceful fallback with 200 status
    if (!res.headersSent) {
      return res.json({ success: true, data: null, message: 'GAS returning non-JSON or offline' });
    }
  } catch (err: any) {
    if (!res.headersSent) {
      return res.json({ success: true, data: null, message: 'GAS unavailable' });
    }
  }
});

app.post('/api/gas-proxy', async (req, res) => {
  let responded = false;
  const safeJson = (data: any, status = 200) => {
    if (responded || res.headersSent) return;
    responded = true;
    try {
      res.status(status).json(data);
    } catch {}
  };

  try {
    const payload = req.body || {};
    const postData = JSON.stringify(payload);

    const client = GAS_BACKEND_URL.startsWith('https') ? https : http;
    const gasReq = client.request(GAS_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (IARMS Server Proxy)'
      }
    }, (gasRes) => {
      let data = '';
      gasRes.on('data', chunk => { data += chunk; });
      gasRes.on('end', () => {
        const text = data.trim();
        if (text && !text.startsWith('<')) {
          try {
            return safeJson(JSON.parse(text));
          } catch {}
        }
        return safeJson({ status: 'success', success: true });
      });
    });

    gasReq.on('error', (err) => {
      console.warn('[GAS Proxy] Warning requesting GAS:', err.message);
      safeJson({ status: 'offline', success: true });
    });

    gasReq.setTimeout(8000, () => {
      safeJson({ status: 'timeout', success: true });
      try {
        gasReq.destroy();
      } catch {}
    });

    gasReq.write(postData);
    gasReq.end();
  } catch (err: any) {
    safeJson({ status: 'offline', success: true });
  }
});

// Employee Master Data Endpoints
const EMPLOYEE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'employeeMasterData.json');

app.get('/api/employees', (req, res) => {
  try {
    if (fs.existsSync(EMPLOYEE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(EMPLOYEE_FILE_PATH, 'utf-8'));
      return res.json({ success: true, total: data.length, employees: data });
    }
    return res.json({ success: true, total: 0, employees: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/employees/bulk', (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Data karyawan tidak valid atau kosong' });
    }

    // Clean and validate employee list
    const validEmployees = employees.map((emp: any) => ({
      nik: String(emp.nik || emp.Nik || emp.NIK || '').trim(),
      name: String(emp.name || emp.nama || emp.Nama || emp.NAMA || '').trim(),
      jobTitle: String(emp.jobTitle || emp.jabatan || emp.Jabatan || emp.JABATAN || 'Staff').trim(),
      department: String(emp.department || emp.departemen || emp.Departemen || emp.DEPARTEMEN || 'Umum').trim(),
      site: String(emp.site || emp.Site || emp.SITE || 'BAYAN').trim(),
      joinDate: String(emp.joinDate || emp.masuk || emp.Masuk || emp.MASUK || '').trim()
    })).filter(e => e.nik && e.name);

    if (validEmployees.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ditemukan data NIK dan Nama valid' });
    }

    // Save to employeeMasterData.json
    fs.writeFileSync(EMPLOYEE_FILE_PATH, JSON.stringify(validEmployees, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `Berhasil memperbarui database master dengan ${validEmployees.length} karyawan`,
      total: validEmployees.length
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/employees/sync-sheet', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    if (!sheetUrl) {
      return res.status(400).json({ success: false, error: 'sheetUrl wajib diisi' });
    }

    const { sheetId, gid } = parseGoogleSheetUrl(sheetUrl);
    if (!sheetId) {
      return res.status(400).json({ success: false, error: 'Format URL Google Spreadsheet tidak valid' });
    }

    const candidateUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`
    ];

    let csvText = '';
    for (const url of candidateUrls) {
      try {
        const result = await fetchUrl(url);
        if (result.statusCode === 200 && result.data && (result.data.includes(',') || result.data.includes('\t'))) {
          csvText = result.data;
          break;
        }
      } catch (e) {}
    }

    if (!csvText) {
      return res.status(400).json({ success: false, error: 'Gagal mengunduh CSV dari Google Spreadsheet. Pastikan link dapat diakses publik (Anyone with the link can view).' });
    }

    // Parse CSV lines
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, error: 'Spreadsheet tidak berisi data karyawan' });
    }

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase().replace(/^"(.*)"$/, '$1'));

    const findIdx = (keywords: string[]) => {
      return headers.findIndex(h => keywords.some(kw => h === kw || h.includes(kw)));
    };

    const nikIdx = findIdx(['NIK', 'NO INDUK', 'NOMOR INDUK', 'ID']);
    const namaIdx = findIdx(['NAMA', 'NAME', 'KARYAWAN', 'EMPLOYEE']);
    const jabatanIdx = findIdx(['JABATAN', 'TITLE', 'POSITION', 'POSISI', 'JOB']);
    const deptIdx = findIdx(['DEPARTEMEN', 'DEPT', 'DEPARTMENT', 'DIVISI']);
    const siteIdx = findIdx(['SITE', 'LOKASI', 'LOCATION', 'CABANG']);
    const masukIdx = findIdx(['MASUK', 'JOIN', 'TANGGAL', 'DATE']);

    const employees: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      const nik = nikIdx !== -1 ? row[nikIdx] : row[0];
      const name = namaIdx !== -1 ? row[namaIdx] : row[1];
      if (!nik || !name) continue;

      employees.push({
        nik: nik.trim(),
        name: name.trim(),
        jobTitle: jabatanIdx !== -1 && row[jabatanIdx] ? row[jabatanIdx].trim() : 'Staff',
        department: deptIdx !== -1 && row[deptIdx] ? row[deptIdx].trim() : 'Umum',
        site: siteIdx !== -1 && row[siteIdx] ? row[siteIdx].trim() : 'BAYAN',
        joinDate: masukIdx !== -1 && row[masukIdx] ? row[masukIdx].trim() : ''
      });
    }

    if (employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada baris karyawan yang valid ditemukan dalam spreadsheet' });
    }

    fs.writeFileSync(EMPLOYEE_FILE_PATH, JSON.stringify(employees, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `Berhasil mengimpor ${employees.length} karyawan dari Google Sheets`,
      total: employees.length,
      employees
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Gemini Client Lazy Initializer
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// AI Scoring & Executive Prioritization Analysis Endpoint
app.post('/api/ai/prioritize-recommendations', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        success: false,
        message: 'GEMINI_API_KEY tidak dikonfigurasi, sistem menggunakan algoritma internal multi-faktor',
        enrichedItems: []
      });
    }

    const promptText = `Anda adalah Chief Audit Executive (CAE) dan Pakar Manajemen Risiko Enterprise di sistem IARMS (Internal Audit Risk Management Systems).
Berikut adalah daftar temuan audit yang menjadi kandidat Top Prioritas Kritis berdasarkan analisis dampak finansial dan disrupsi operasional.

Tugas Anda:
Analisis setiap temuan di bawah ini. Berikan penjelasan rasional eksekutif ringkas (1-2 kalimat padat profesional dalam Bahasa Indonesia) yang menjelaskan MENGAPA temuan ini kritis, potensi dampak terburuk jika diabaikan, serta 1 aksi mitigasi prioritas taktis.

Daftar Temuan:
${JSON.stringify(items.slice(0, 10), null, 2)}

Harap kembalikan respon HANYA dalam format JSON valid tanpa markdown, dengan struktur array berikut:
{
  "enrichedItems": [
    {
      "rank": <nomor rank yang sama>,
      "aiRationale": "<alasan eksekutif 1-2 kalimat tajam dan berbobot>",
      "keyMitigationAction": "<tindakan mitigasi taktis prioritas>"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const responseText = response.text || '';
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    return res.json({
      success: true,
      enrichedItems: parsed.enrichedItems || [],
      source: 'gemini-3.8-flash'
    });
  } catch (err: any) {
    console.error('Error in AI prioritization endpoint:', err);
    return res.json({
      success: false,
      error: err.message,
      enrichedItems: []
    });
  }
});

// Vite Middleware & Static Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
