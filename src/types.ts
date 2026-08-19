export interface AuditEngagement {
  id: number;
  title: string;
  auditor: string;
  planDays: number;
  actDays: number;
  progress: number;
  status: 'Completed' | 'Overdue' | 'On-Going' | 'Planned';
}

export interface PublicAuditItem {
  id: string;
  projectId: string;
  projectName: string;
  deptId: string;
  deptName: string;
  closingRate: number;
  closedItems: number;
  totalItems: number;
  targetDays: number;
  realDays: number;
  qualityScore: number;
  status: 'Selesai' | 'On-Progress';
}

export interface AuditFindingStatementItem {
  id: string;
  no: number;
  jobsite: string;
  scopeAudit: string;
  linkStatement: string;
  achClosingSite: number;
  achClosingHO: number;
  achClosing: number;
  achQuality: number;
}

export interface AFSFindingRecord {
  _rowId: number;
  NO: string;
  "PROJECT AUDIT": string;
  SITE: string;
  "PROBLEM/FINDING"?: string;
  "DETAIL TEMUAN"?: string;
  "DOKUMENTASI TEMUAN"?: string;
  KRITERIA?: string;
  KATEGORI?: string;
  REKOMENDASI?: string;
  STATUS?: string;
  "PIC SITE"?: string;
  "PIC HO"?: string;
  "DUE DATE"?: string;
  REMARKS?: string;
  "DOKUMENTASI CLOSING"?: string;
  "REVIEWED CLOSING FROM USER"?: string;
  "REVIEWED CLOSING FROM IA"?: string;
  NOTE?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface RiskRegisterItem {
  no: string;
  riskNumber: string;
  site: string;
  department: string;
  companyObjective?: string;
  kpiObjective?: string;
  businessProcess?: string;
  activity?: string;
  riskDescription: string;
  top10Risk?: string;
  executiveCategory?: string;
  lossEvent?: string;

  // Inherent Risk
  inherentNotes?: string;
  inherentWorstCase?: string;
  inherentFinImpact?: string;
  inherentImpact?: string;
  inherentLikelihood?: string;
  inherentRiskLevel: string;

  // Control
  controlDescription?: string;
  controlStatus?: string;
  controlEffectiveness?: string;

  // Residual Risk
  residualNotes?: string;
  residualWorstCase?: string;
  residualFinImpact?: string;
  residualImpact?: string;
  residualLikelihood?: string;
  residualRiskLevel: string;

  // Treatment Plan
  treatmentPlan?: string;
  pic?: string;
  dueDate?: string;
  expectedImpact?: string;
  expectedLikelihood?: string;
  expectedRiskLevel?: string;
}
