import { AFSFindingRecord } from '../types';

export function parseAuditCsvClient(text: string, defaultProject: string = 'AUDIT'): any[] {
  if (!text || !text.trim()) return [];

  // Determine delimiter: tab or comma or semicolon
  let delimiter = ',';
  const firstLine = text.split('\n')[0] || '';
  if (firstLine.split('\t').length > firstLine.split(',').length && firstLine.split('\t').length > firstLine.split(';').length) {
    delimiter = '\t';
  } else if (firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';';
  }

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

  // Automatically find header row index by scanning candidate rows
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

  // Helper to find column value flexibly
  const findVal = (values: string[], aliases: string[]): string => {
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h === alias);
      if (idx !== -1 && values[idx] !== undefined) {
        return values[idx].trim();
      }
    }
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

    const rawYear = findVal(values, ['PERIODE AUDIT', 'PERIODE', 'TAHUN', 'YEAR', 'TANGGAL AUDIT', 'TAHUN PELAKSANAAN']);
    let finalYear = rawYear;
    if (!finalYear) {
      const matchDoc = (`${docTemuan} ${dueDate} ${problem}`).match(/\b(202[0-9])\b/);
      finalYear = matchDoc ? matchDoc[1] : '2026';
    }

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
      NOTE: note
    });
  }

  return parsedRows;
}
