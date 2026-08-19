import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

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

    // Skip empty lines or header repetitions that don't have problem or rekomendasi or no
    if (!no && !problem && !rekomendasi) continue;
    if (no.toUpperCase() === 'NO' || problem.toUpperCase() === 'PROBLEM/FINDING') continue;

    parsedRows.push({
      _rowId: i,
      NO: no || String(parsedRows.length + 1),
      'PROJECT AUDIT': proj,
      SITE: site,
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
