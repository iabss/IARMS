import { AFSFindingRecord } from '../types';

export interface EvidenceSubmissionRecord {
  id: string;
  rowId: number;
  no: string;
  project: string;
  site: string;
  title: string;
  kategori: string;
  status: string;
  dokumentasiClosing: string;
  reviewedIA: string;
  picSite?: string;
  picHO?: string;
  timestamp: number;
  formattedDate: string;
}

const STORAGE_KEY_EVIDENCE_SUBMISSIONS = 'iarms_evidence_submissions_v1';

// Get start of today in local time (00:00:00.000)
export function getTodayStartTimestamp(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Get all recorded evidence submissions
export function getEvidenceSubmissions(): EvidenceSubmissionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVIDENCE_SUBMISSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
}

// Save or record a new/updated evidence submission
export function recordEvidenceSubmission(record: {
  rowId: number;
  no: string;
  project: string;
  site: string;
  title: string;
  kategori?: string;
  status?: string;
  dokumentasiClosing: string;
  reviewedIA?: string;
  picSite?: string;
  picHO?: string;
  timestamp?: number;
}): EvidenceSubmissionRecord {
  const now = record.timestamp || Date.now();
  const existingList = getEvidenceSubmissions();

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(now));

  const newEntry: EvidenceSubmissionRecord = {
    id: `ev-${record.rowId}-${record.no}-${now}`,
    rowId: record.rowId,
    no: record.no,
    project: record.project,
    site: record.site,
    title: record.title,
    kategori: record.kategori || 'MAJOR',
    status: record.status || 'OPEN',
    dokumentasiClosing: record.dokumentasiClosing,
    reviewedIA: record.reviewedIA || '',
    picSite: record.picSite || '',
    picHO: record.picHO || '',
    timestamp: now,
    formattedDate
  };

  // Replace existing entry for the same rowId or prepend
  const filtered = existingList.filter(item => item.rowId !== record.rowId);
  const updatedList = [newEntry, ...filtered].slice(0, 100);

  try {
    localStorage.setItem(STORAGE_KEY_EVIDENCE_SUBMISSIONS, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('Failed to save evidence submission:', e);
  }

  // Dispatch custom event to notify NotificationBell immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('iarms_new_evidence_submitted', { detail: newEntry }));
  }

  return newEntry;
}

// Get only evidence submissions inputted AFTER or on today's date
export function getEvidenceSubmissionsToday(): EvidenceSubmissionRecord[] {
  const todayStart = getTodayStartTimestamp();
  const all = getEvidenceSubmissions();
  return all.filter(item => item.timestamp >= todayStart);
}
