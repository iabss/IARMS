const KNOWN_JOBSITES = new Set([
  'MBL', 'MME', 'BIB', 'MIP', 'HO', 'SITE', 'MAS', 'SMM', 'KIM', 'AGM', 'BSS', 'KCM', 'TCM', 'PT BSS', 'JOB SITE', 'JOBSITE'
]);

const VALID_DEPARTMENT_CODES = new Set([
  'ENGINEERING',
  'PRODUKSI',
  'PLANT',
  'LOGISTIK',
  'SHE',
  'DNB',
  'GS',
  'IC',
  'IT',
  'SM',
  'COST CONTROL',
  'CIVIL',
  'BUSDEV',
  'LEGAL',
  'FINANCE',
  'ACCOUNTING',
  'DC',
  'OPS',
  'MINE PLAN',
  'MANAGEMENT',
  'HR',
  'PR',
  'GA', 'EXTERNAL',
  'PURCHASING',
  'PORT',
  'HAULING',
  'SURVEY',
  'ALL DEPARTEMEN'
]);

export function normalizeDepartment(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^[0-9]+[\.\)\-]\s*/, '').trim();
  let u = cleaned.toUpperCase();

  // Exclude explicit jobsites and non-dept strings
  if (KNOWN_JOBSITES.has(u) || u === '-' || u === 'N/A' || u === 'NA' || u === '0' || u === 'NONE' || u === 'NULL' || u === 'TBD' || u === 'NIL') {
    return '';
  }

  if (
    u === 'ENG' || u === 'ENGINEERING' || u === 'ENGGINEERING' || u === 'ENGINEEERING' ||
    u === 'ENG MBL' || u === 'ENG DEWATERING' || u === 'ENG SITE' || u === 'ENG HO' ||
    u.startsWith('ENG ') || u.startsWith('ENGINEERING ') || u.startsWith('ENGINEEERING ')
  ) {
    return 'ENGINEERING';
  }

  if (
    u === 'PROD' || u === 'PRODUKSI' || u === 'PRO' || u === 'PROD DEWATERING' || u === 'PROD MBL' ||
    u === 'PROD SITE' || u === 'PROD HO' || u === 'PRODUKSI SITE' || u === 'PRODUKSI HO' ||
    u.startsWith('PROD ') || u.startsWith('PRODUKSI ')
  ) {
    return 'PRODUKSI';
  }

  if (
    u === 'PLANT' || u === 'PLAN' || u === 'PLANT SITE' || u === 'PLANT HO' ||
    u.startsWith('PLANT ') || u.startsWith('PLAN ')
  ) {
    return 'PLANT';
  }

  if (
    u === 'LOG' || u === 'LOGISTIK' || u === 'LOGISTIK SITE' || u === 'LOGISTIK HO' ||
    u.startsWith('LOG ') || u.startsWith('LOGISTIK ')
  ) {
    return 'LOGISTIK';
  }

  if (u === 'SHE' || u === 'HSE' || u === 'K3' || u === 'SHE SITE' || u === 'SHE HO' || u.startsWith('SHE ')) return 'SHE';
  if (u === 'SM' || u === 'SM HO' || u === 'SM SITE' || u.startsWith('SM ')) return 'SM';
  if (u === 'IT' || u === 'IT HO' || u === 'IT SITE' || u.startsWith('IT ')) return 'IT';
  if (u === 'GS' || u === 'GS HO' || u === 'GS SITE' || u.startsWith('GS ')) return 'GS';
  if (u === 'IC' || u === 'IC C&B' || u === 'IC CNB' || u === 'IC HO' || u === 'IC SITE' || u.startsWith('IC ')) return 'IC';
  if (u === 'CIVIL' || u.startsWith('CIVIL ')) return 'CIVIL';
  if (u === 'BUSDEV' || u.startsWith('BUSDEV ')) return 'BUSDEV';
  if (u === 'LEGAL' || u.startsWith('LEGAL ')) return 'LEGAL';
  if (u === 'FINANCE' || u.startsWith('FINANCE ')) return 'FINANCE';
  if (u === 'ACCOUNTING' || u.startsWith('ACCOUNTING ')) return 'ACCOUNTING';
  if (u === 'DC' || u === 'DC HO' || u === 'DC SITE' || u.startsWith('DC ')) return 'DC';
  if (u === 'DNB' || u === 'DRILLING' || u.startsWith('DNB ') || u.startsWith('DNB') || u.includes('DNB')) return 'DNB';
  if (u === 'OPS' || u.startsWith('OPS ')) return 'OPS';
  if (u === 'MINE PLAN' || u.startsWith('MINE PLAN ')) return 'MINE PLAN';
  if (u === 'CC' || u === 'CC SITE' || u === 'COST CONTROL' || u === 'COST CONTROL SITE' || u === 'COST CONTROL HO') return 'COST CONTROL';
  if (u === 'HR' || u === 'HRD' || u === 'HC' || u === 'HUMAN CAPITAL') return 'HR';
  if (u === 'GA' || u === 'GENERAL AFFAIRS') return 'GA';
  if (u === 'PR' || u === 'PUBLIC RELATIONS') return 'PR';
  if (u === 'PORT') return 'PORT';
  if (u === 'HAULING') return 'HAULING';
  if (u === 'SURVEY') return 'SURVEY';

  if (
    u.includes('MANAGEMENT') || u.includes('MANAJEMEN') || u.includes('MANAJEMENT')
  ) {
    return 'MANAGEMENT';
  }

  if (u === 'ALL DEPARTEMEN' || u === 'ALL DEPARTEMEN SITE') return 'ALL DEPARTEMEN';

  // If it doesn't match any known department pattern, return empty
  return '';
}

export function isDepartment(str?: string | null): boolean {
  if (!str) return false;
  const norm = normalizeDepartment(str);
  return norm !== '' && VALID_DEPARTMENT_CODES.has(norm);
}

export function parseDepartments(str?: string | null): string[] {
  if (!str) return [];

  // Pre-expand compound forms like 'ENG-PROD', 'IT. ENG', 'ICGS', 'Logistik Site PLANT SITE'
  let s = str
    .replace(/\bENG-PROD\b/gi, 'ENGINEERING, PRODUKSI')
    .replace(/\bENG-PRODUKSI\b/gi, 'ENGINEERING, PRODUKSI')
    .replace(/\bIT\.\s*ENG\b/gi, 'IT, ENGINEERING')
    .replace(/\bICGS\b/gi, 'IC, GS')
    .replace(/\bLogistik Site PLANT SITE\b/gi, 'Logistik, PLANT')
    .replace(/\bLogistik HO PLANT HO\b/gi, 'Logistik, PLANT');

  const rawParts = s.split(/[,/\n&;]|(?:\s+and\s+)|(?:\s+dan\s+)|(?:\s+[0-9]+[\.\)\-]\s*)/i);
  const result: string[] = [];
  rawParts.forEach(p => {
    let cleaned = p.trim().replace(/^[0-9]+[\.\)\-]\s*/, '').trim();
    if (cleaned) {
      const norm = normalizeDepartment(cleaned);
      if (norm && VALID_DEPARTMENT_CODES.has(norm)) {
        result.push(norm);
      }
    }
  });
  return result;
}

export function getRecordDepartments(r: { "PIC HO"?: string; "PIC SITE"?: string; KRITERIA?: string; SITE?: string }, deptTypeFilter: 'all' | 'ho' | 'site' = 'all'): string[] {
  let deptSource = '';
  if (deptTypeFilter === 'ho') {
    deptSource = r['PIC HO'] || '';
  } else if (deptTypeFilter === 'site') {
    deptSource = r['PIC SITE'] || '';
  } else {
    const hoStr = r['PIC HO'] || '';
    const siteStr = r['PIC SITE'] || '';
    deptSource = [hoStr, siteStr].filter(Boolean).join(', ');
  }

  let depts = parseDepartments(deptSource);
  if (depts.length === 0) {
    if (r.KRITERIA) depts = parseDepartments(r.KRITERIA);
    if (depts.length === 0 && deptSource.trim()) {
      depts = ['IC'];
    }
  }

  const rowDeptsMap = new Map<string, string>();
  depts.forEach(d => {
    const key = d.toUpperCase();
    if (!rowDeptsMap.has(key)) rowDeptsMap.set(key, d);
  });
  return Array.from(rowDeptsMap.values());
}

export function matchesDepartmentRecord(r: { "PIC HO"?: string; "PIC SITE"?: string; KRITERIA?: string; SITE?: string }, targetDept?: string | null): boolean {
  if (!targetDept || targetDept === 'ALL') return true;
  const depts = getRecordDepartments(r);
  const normTarget = normalizeDepartment(targetDept) || targetDept.toUpperCase().trim();
  return depts.some(d => d.toUpperCase() === normTarget);
}


