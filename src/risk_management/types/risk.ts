export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type SiteOption = 'MHU' | 'CDI' | 'MBL' | 'HAULING (MSJ, TD)';

export const SITE_OPTIONS: SiteOption[] = [
  'MHU',
  'CDI',
  'MBL',
  'HAULING (MSJ, TD)',
];

export type RiskCategory =
  | 'Operational'
  | 'Financial'
  | 'Legal & Regulation'
  | 'Entity Company'
  | 'Human Resources';

export const RISK_CATEGORIES: RiskCategory[] = [
  'Operational',
  'Financial',
  'Legal & Regulation',
  'Entity Company',
  'Human Resources',
];

export type Department =
  | 'Supply Management'
  | 'Logistic'
  | 'Engineering'
  | 'Business Development'
  | 'Legal'
  | 'Production'
  | 'Corporate Planning Management Development'
  | 'Information Technology'
  | 'Plant'
  | 'Health, Safety, Environment'
  | 'General Service'
  | 'Civil Project Management'
  | 'Human Capital'
  | 'Accounting & Tax'
  | 'Finance'
  | 'Internal Audit Risk Management'
  | 'FKAP'
  | 'CSR';

export const DEPARTMENTS: Department[] = [
  'Supply Management',
  'Logistic',
  'Engineering',
  'Business Development',
  'Legal',
  'Production',
  'Corporate Planning Management Development',
  'Information Technology',
  'Plant',
  'Health, Safety, Environment',
  'General Service',
  'Civil Project Management',
  'Human Capital',
  'Accounting & Tax',
  'Finance',
  'Internal Audit Risk Management',
  'FKAP',
  'CSR',
];

export const FINANCIAL_IMPACT_RANGES = [
  '1 - 50 Juta',
  '51 - 100 Juta',
  '101 - 500 Juta',
  '501 - 1 M',
  '> 1 M',
] as const;

export type FinancialImpactRange = (typeof FINANCIAL_IMPACT_RANGES)[number];

export type RiskStatus = 'Open' | 'Mitigating' | 'Monitored' | 'Closed';

export type ControlEffectiveness = 'Strong' | 'Adequate' | 'Weak' | 'Deficient';

export interface ActionItem {
  id: string;
  action: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface RiskItem {
  id: string;
  code: string; // e.g. "RSK-OPS-01"
  title: string;
  description: string;
  rootCause: string;
  consequences: string;
  site: SiteOption;
  category: RiskCategory;
  department: Department;
  owner: string;
  // Inherent Risk (Sebelum Mitigasi)
  inherentLikelihood: number; // 1-5
  inherentImpact: number; // 1-5
  inherentScore: number; // 1-25
  inherentLevel: RiskLevel;
  inherentWorstCaseScenario?: string; // Catatan / Skenario Terburuk Inherent
  // Kontrol & Mitigasi
  existingControls: string;
  controlEffectiveness: ControlEffectiveness;
  mitigationPlan: string;
  mitigationProgress: number; // 0-100
  // Residual Risk (Setelah Mitigasi)
  residualLikelihood: number; // 1-5
  residualImpact: number; // 1-5
  residualScore: number; // 1-25
  residualLevel: RiskLevel;
  // Governance & Metadata
  riskAppetiteStatus: 'Within Appetite' | 'At Limit' | 'Breached';
  status: RiskStatus;
  financialImpactEstimate: string; // e.g. "1 - 50 Juta", "51 - 100 Juta", etc.
  velocity: 'Rapid' | 'Moderate' | 'Slow';
  lastReviewDate: string;
  targetDate: string;
  actionItems: ActionItem[];
  quarter: string;
}

export interface KRIItem {
  id: string;
  code: string;
  name: string;
  metric: string;
  unit: string;
  currentValue: number;
  previousValue: number;
  thresholdGreen: string;
  thresholdAmber: string;
  thresholdRed: string;
  status: 'Normal' | 'Warning' | 'Critical';
  trend: 'up' | 'down' | 'stable';
  associatedRiskCode: string;
  frequency: string;
}

export interface RiskFilterState {
  search: string;
  site?: string;
  category: string;
  department: string;
  level: string;
  status: string;
  matrixCell: { likelihood: number; impact: number } | null;
  quarter: string;
}
