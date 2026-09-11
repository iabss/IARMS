import rawEmployees from './employeeMasterData.json';

export interface MasterEmployee {
  nik: string;
  name: string;
  jobTitle: string;
  department: string;
  site: string;
  joinDate?: string;
  isCustom?: boolean;
}

const STORAGE_KEY = 'iarms_custom_master_employees';

function getCustomEmployees(): MasterEmployee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAllEmployees(): MasterEmployee[] {
  const custom = getCustomEmployees();
  // If custom has a large master set (imported), we can use it or merge
  const map = new Map<string, MasterEmployee>();
  (rawEmployees as MasterEmployee[]).forEach(e => map.set(e.nik.trim().toLowerCase(), e));
  custom.forEach(e => map.set(e.nik.trim().toLowerCase(), e));
  return Array.from(map.values());
}

export function bulkSetEmployees(employees: MasterEmployee[]): void {
  try {
    const valid = employees.filter(e => e.nik && e.name).map(e => ({
      ...e,
      nik: e.nik.trim(),
      name: e.name.trim(),
      isCustom: true
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    // Also send to backend
    fetch('/api/employees/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: valid })
    }).catch(() => {});
  } catch (e) {
    console.error('Error saving bulk employees:', e);
  }
}

export function addCustomEmployee(emp: MasterEmployee): boolean {
  try {
    const custom = getCustomEmployees();
    const cleanNik = emp.nik.trim();
    if (getAllEmployees().some(e => e.nik.toLowerCase() === cleanNik.toLowerCase())) {
      return false; // Already exists
    }
    const newEmp: MasterEmployee = {
      ...emp,
      nik: cleanNik,
      isCustom: true
    };
    custom.unshift(newEmp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    return true;
  } catch {
    return false;
  }
}

/**
 * Find an employee from master data by exact NIK
 */
export function findEmployeeByNik(nik: string): MasterEmployee | undefined {
  if (!nik) return undefined;
  const clean = nik.trim().toLowerCase();
  const all = getAllEmployees();
  return all.find(e => e.nik.trim().toLowerCase() === clean);
}

/**
 * Search employee master data by partial NIK or Name
 */
export function searchEmployees(query: string, limit = 10): MasterEmployee[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const results: MasterEmployee[] = [];
  const all = getAllEmployees();

  for (const emp of all) {
    if (
      emp.nik.toLowerCase().includes(q) ||
      emp.name.toLowerCase().includes(q)
    ) {
      results.push(emp);
      if (results.length >= limit) break;
    }
  }

  return results;
}

