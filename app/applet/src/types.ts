export interface AFSFindingRecord {
  _rowId?: number;
  NO?: string | number;
  no?: string | number;
  "PROJECT AUDIT"?: string;
  PROJECT?: string;
  project?: string;
  SITE?: string;
  site?: string;
  "PERIODE AUDIT"?: string;
  TAHUN?: string | number;
  year?: string | number;
  DEPARTMENT?: string;
  department?: string;
  "PROBLEM/FINDING"?: string;
  problem?: string;
  finding?: string;
  "DETAIL TEMUAN"?: string;
  detail?: string;
  KRITERIA?: string;
  kriteria?: string;
  "DAMPAK / RISK"?: string;
  dampak?: string;
  risk?: string;
  REKOMENDASI?: string;
  rekomendasi?: string;
  "TANGGAPAN AUDITEE"?: string;
  auditee_response?: string;
  "TARGET SELESAI"?: string;
  target_date?: string;
  "PIC SITE"?: string;
  pic_site?: string;
  "PIC HO"?: string;
  pic_ho?: string;
  STATUS?: string;
  status?: string;
  REMARKS?: string;
  remarks?: string;
  "REVIEWED CLOSING FROM IA"?: string;
  ia_review?: string;
  "DOKUMEN PENDUKUNG CLOSING"?: string;
  closing_doc?: string;
  evidence_url?: string;
  KATEGORI?: string;
  kategori?: string;
  "ACTION PLAN"?: string;
  action_plan?: string;
  [key: string]: any;
}

export interface ProjectLinkConfig {
  id: string;
  projectName: string;
  siteName?: string;
  year?: string | number;
  sheetUrl?: string;
  status?: string;
  rowCount?: number;
  lastSyncedAt?: string | null;
  defaultProject?: string;
  project?: string;
  site?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface SyncMetadata {
  lastSyncTimestamp: string | null;
  syncedProject: string;
  sourceType: "url" | "paste" | "file" | "initial" | "manual" | "server";
  totalSyncedRows: number;
  sheetUrl?: string;
}

export interface AchievementSnapshot {
  id: string;
  timestamp: string;
  date: string;
  note: string;
  sourceType: "sync" | "manual" | "initial" | "edit";
  totalRows: number;
  closedRows: number;
  openRows: number;
  progressRows: number;
  closeRate: number;
  projectStats?: {
    projectName: string;
    siteName?: string;
    total: number;
    closed: number;
    open: number;
    progress: number;
    closeRate: number;
    siteRate: number;
    hoRate: number;
  }[];
}
