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
