/**
 * Helper utility for robust and flexible AFS finding status detection and normalization.
 * Handles diverse spreadsheet conventions (CLOSE, CLOSED, DONE, SELESAI, 100%, OPEN, IN PROGRESS, etc.)
 */

export function isStatusClosed(status?: string, remarks?: string, iaReview?: string): boolean {
  const st = (status || '').toUpperCase().trim();
  const rm = (remarks || '').toUpperCase().trim();
  const ia = (iaReview || '').toUpperCase().trim();

  // If IA review explicitly approved
  if (ia === 'APPROVE' || ia === 'APPROVED' || ia === 'SETUJU' || ia === 'OK') {
    return true;
  }

  // Check status column
  if (
    st === 'CLOSE' ||
    st === 'CLOSED' ||
    st === 'SELESAI' ||
    st === 'DONE' ||
    st === '100%' ||
    st === 'TERPENUHI' ||
    st === 'RESOLVED' ||
    st === 'C' ||
    st.startsWith('CLOSE') ||
    st.startsWith('CLOSED') ||
    st.includes('SELESAI')
  ) {
    return true;
  }

  // Secondary check on remarks if remarks is DONE / CLOSED and status is not explicitly OPEN
  if ((rm === 'DONE' || rm === 'CLOSED' || rm === 'CLOSE') && st !== 'OPEN') {
    return true;
  }

  return false;
}

export function isStatusOpen(status?: string, remarks?: string, iaReview?: string): boolean {
  if (isStatusClosed(status, remarks, iaReview)) return false;
  const st = (status || '').toUpperCase().trim();
  if (st === 'OPEN' || st === 'BUKA' || st === 'BELUM' || st === 'O' || st === '' || st === '-') return true;
  if (st.includes('PROGRESS') || st.includes('PROSES') || st.includes('ON GOING') || st.includes('ON-GOING')) return false;
  return true;
}

export function isStatusProgress(status?: string, remarks?: string, iaReview?: string): boolean {
  if (isStatusClosed(status, remarks, iaReview)) return false;
  const st = (status || '').toUpperCase().trim();
  return (
    st === 'IN PROGRESS' ||
    st === 'PROGRESS' ||
    st === 'PROSES' ||
    st === 'ON PROGRESS' ||
    st === 'ON-PROGRESS' ||
    st.includes('PROGRESS') ||
    st.includes('PROSES') ||
    st.includes('ON GOING') ||
    st.includes('ON-GOING') ||
    st.includes('PARTIAL')
  );
}

export function getNormalizedStatus(status?: string, remarks?: string, iaReview?: string): 'CLOSE' | 'OPEN' | 'PROGRESS' {
  if (isStatusClosed(status, remarks, iaReview)) return 'CLOSE';
  if (isStatusProgress(status, remarks, iaReview)) return 'PROGRESS';
  return 'OPEN';
}

/**
 * Extract audit year accurately from row fields
 */
export function extractFindingYear(item: Record<string, any>, defaultYear: string = '2026'): string {
  if (!item) return defaultYear;

  // 1. Direct year columns
  const directYear = (item['PERIODE AUDIT'] || item['TAHUN'] || item['YEAR'] || item['PERIODE'] || '').toString().trim();
  if (directYear && /20\d{2}/.test(directYear)) {
    const match = directYear.match(/20\d{2}/);
    if (match) return match[0];
  }

  // 2. Dokumentasi Temuan (e.g. LHA-OPS-IT 11 SEPTEMBER - 6 OKTOBER 2025, LHA-OPS IT 2 - 10 Mar 2026)
  const docTemuan = (item['DOKUMENTASI TEMUAN'] || '').toString();
  if (docTemuan) {
    const match = docTemuan.match(/20\d{2}/);
    if (match) return match[0];
  }

  // 3. Due date (e.g. 4/19/2026)
  const dueDate = (item['DUE DATE'] || '').toString();
  if (dueDate) {
    const match = dueDate.match(/20\d{2}/);
    if (match) return match[0];
  }

  // 4. Dokumentasi Closing
  const docClosing = (item['DOKUMENTASI CLOSING'] || '').toString();
  if (docClosing) {
    const match = docClosing.match(/20\d{2}/);
    if (match) return match[0];
  }

  return defaultYear;
}

/**
 * Standardized Dashboard Project Summaries Calculation
 * Groups all findings by Jobsite / Project Scope / Year exactly as done on the Main Dashboard.
 */
export function computeDashboardProjectSummaries(rows: any[]) {
  const map = new Map<string, {
    siteName: string;
    scopeAudit: string;
    year: string;
    total: number;
    close: number;
    open: number;
    progress: number;
  }>();

  (rows || []).forEach((item: any) => {
    const siteStr = (item.SITE || 'HEAD OFFICE').trim();
    const scopeStr = (item['PROJECT AUDIT'] || 'LAINNYA').trim();
    const rowYear = extractFindingYear(item, '2026');

    const key = `${siteStr.toUpperCase()}___${scopeStr.toUpperCase()}___${rowYear.toUpperCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        siteName: siteStr,
        scopeAudit: scopeStr,
        year: rowYear,
        total: 0,
        close: 0,
        open: 0,
        progress: 0,
      });
    }

    const entry = map.get(key)!;
    entry.total += 1;

    const isItemClosed = isStatusClosed(item.STATUS, item.REMARKS, item['REVIEWED CLOSING FROM IA']);
    const isItemOpen = isStatusOpen(item.STATUS, item.REMARKS, item['REVIEWED CLOSING FROM IA']);

    if (isItemClosed) entry.close += 1;
    else if (isItemOpen) entry.open += 1;
    else entry.progress += 1;
  });

  const list: { siteName: string; scopeAudit: string; year: string; total: number; close: number; rate: number }[] = [];
  map.forEach((val) => {
    const closingRate = val.total > 0 ? (val.close / val.total) * 100 : 0;
    list.push({
      siteName: val.siteName,
      scopeAudit: val.scopeAudit,
      year: val.year,
      total: val.total,
      close: val.close,
      rate: parseFloat(closingRate.toFixed(2))
    });
  });

  return list;
}

/**
 * Calculate the overall average achievement rate across all audit projects (Unweighted Average).
 * Matches the Dashboard KPI card exactly.
 */
export function calculateOverallAchievementRate(rows: any[]): number {
  if (!rows || rows.length === 0) return 0;
  const list = computeDashboardProjectSummaries(rows);
  const valid = list.filter(p => p.total > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, p) => acc + p.rate, 0);
  return parseFloat((sum / valid.length).toFixed(2));
}

