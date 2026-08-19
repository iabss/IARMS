import { AFSFindingRecord } from '../types';
import rawSheetData from './sheetData.json';

const STORAGE_KEY_ROWS = 'afs_synced_custom_rows_v2';
const STORAGE_KEY_META = 'afs_synced_metadata_v2';
const STORAGE_KEY_CLEARED = 'afs_data_is_cleared_v2';
const STORAGE_KEY_PROJECT_LINKS = 'afs_project_links_v1';
const STORAGE_KEY_DELETED_PROJECTS = 'afs_deleted_project_keys_v1';
const STORAGE_KEY_SNAPSHOTS = 'afs_achievement_snapshots_v2';

export interface SyncMetadata {
  lastSyncTimestamp: string | null;
  syncedProject: string;
  sourceType: 'url' | 'paste' | 'file' | 'initial';
  totalSyncedRows: number;
  sheetUrl?: string;
}

export interface ProjectSnapshotStat {
  projectName: string;
  siteName?: string;
  total: number;
  closed: number;
  open: number;
  progress: number;
  closeRate: number;
  siteRate: number;
  hoRate: number;
}

export interface AchievementSnapshot {
  id: string;
  timestamp: string; // ISO string e.g. 2026-08-06T19:30:00.000Z
  date: string; // YYYY-MM-DD
  note: string;
  sourceType: 'sync' | 'manual' | 'initial' | 'edit';
  totalRows: number;
  closedRows: number;
  openRows: number;
  progressRows: number;
  closeRate: number;
  projectStats: ProjectSnapshotStat[];
}

export interface ProjectLinkConfig {
  id?: string;
  projectName: string;
  siteName?: string;
  year?: string | number;
  sheetUrl?: string;
  lastSyncedAt?: string | null;
  rowCount?: number;
  status?: 'synced' | 'error' | 'pending' | 'private';
  errorMessage?: string;
}

// Default standard list of audit projects
export const DEFAULT_PROJECT_LIST = [
  'PR-PAYMENT',
  'AUDIT OPERASIONAL',
  'CLOSING PROJECT',
  'INVESTIGASI'
];

// Check if data was explicitly cleared
export function isDataCleared(): boolean {
  try {
    const cleared = localStorage.getItem(STORAGE_KEY_CLEARED);
    return cleared === 'true';
  } catch {
    return false;
  }
}

// Manage deleted projects keys
export function getDeletedProjectKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(k => k.trim().toUpperCase()));
    }
  } catch (e) {
    console.error('Error reading deleted project keys:', e);
  }
  return new Set<string>();
}

export function addDeletedProjectKey(key: string, projName?: string) {
  try {
    const keys = getDeletedProjectKeys();
    if (key) keys.add(key.trim().toUpperCase());
    if (projName) keys.add(projName.trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY_DELETED_PROJECTS, JSON.stringify(Array.from(keys)));
  } catch (e) {
    console.error('Error adding deleted project key:', e);
  }
}

export function removeDeletedProjectKey(key: string, projName?: string) {
  try {
    const keys = getDeletedProjectKeys();
    if (key) keys.delete(key.trim().toUpperCase());
    if (projName) keys.delete(projName.trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY_DELETED_PROJECTS, JSON.stringify(Array.from(keys)));
  } catch (e) {
    console.error('Error removing deleted project key:', e);
  }
}

// Deduplicate finding rows by exact composite content key
export function deduplicateRows(rows: AFSFindingRecord[]): AFSFindingRecord[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const result: AFSFindingRecord[] = [];

  for (const r of rows) {
    if (!r) continue;
    const proj = (r['PROJECT AUDIT'] || '').toString().trim().toUpperCase();
    const site = (r['SITE'] || '').toString().trim().toUpperCase();
    const year = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim().toUpperCase();
    const no = (r['NO'] || '').toString().trim().toUpperCase();
    const prob = (r['PROBLEM/FINDING'] || '').toString().trim().toUpperCase();
    const rec = (r['REKOMENDASI'] || '').toString().trim().toUpperCase();

    const uniqueKey = `${proj}|${site}|${year}|${no}|${prob}|${rec}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      result.push(r);
    }
  }

  return result;
}

// Deduplicate project link configs by project name + site name + year composite key
export function deduplicateProjectConfigs(configs: ProjectLinkConfig[]): ProjectLinkConfig[] {
  if (!Array.isArray(configs)) return [];
  
  const map = new Map<string, ProjectLinkConfig>();

  for (const c of configs) {
    if (!c || !c.projectName) continue;
    const projName = c.projectName.trim().toUpperCase();
    const siteName = (c.siteName || 'HEAD OFFICE').trim().toUpperCase();
    const yearVal = c.year ? String(c.year).trim() : undefined;
    const key = c.id || getProjectCompositeKey(projName, siteName, yearVal);

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...c,
        id: key,
        projectName: projName,
        siteName: siteName,
        year: yearVal,
      });
    } else {
      // Merge best attributes
      const preferNewUrl = c.sheetUrl && c.sheetUrl.trim() !== '' ? c.sheetUrl.trim() : existing.sheetUrl;
      const maxCount = Math.max(c.rowCount || 0, existing.rowCount || 0);
      const latestSyncedAt = c.lastSyncedAt || existing.lastSyncedAt;
      const bestStatus = (c.status === 'synced' || existing.status === 'synced') ? 'synced' : (c.status || existing.status || 'pending');

      map.set(key, {
        ...existing,
        ...c,
        id: key,
        projectName: projName,
        siteName: siteName,
        year: yearVal !== undefined ? yearVal : existing.year,
        sheetUrl: preferNewUrl,
        rowCount: maxCount,
        lastSyncedAt: latestSyncedAt,
        status: bestStatus
      });
    }
  }

  return Array.from(map.values());
}

// Sanitizer to clean up row data and prevent multiline fragment duplicate rows
export function sanitizeRows(rows: AFSFindingRecord[]): AFSFindingRecord[] {
  if (!Array.isArray(rows)) return [];
  const filtered = rows.filter(r => {
    if (!r) return false;
    const no = (r.NO || '').toString().trim().toUpperCase();
    const prob = (r['PROBLEM/FINDING'] || '').trim().toUpperCase();
    const rec = (r.REKOMENDASI || '').trim();
    // Exclude header repetitions
    if (no === 'NO' || prob === 'PROBLEM/FINDING' || prob === 'PROBLEM') return false;
    // Must have at least a valid problem or recommendation
    if (!prob && !rec) return false;
    return true;
  });

  return deduplicateRows(filtered);
}

// Load custom synced rows from localStorage if present
export function getCustomSyncedRows(): AFSFindingRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROWS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sanitizeRows(parsed as AFSFindingRecord[]);
    }
    return null;
  } catch (err) {
    console.error('Error reading custom synced rows:', err);
    return null;
  }
}

// Get dataset: returns synced rows if present, otherwise initial dataset or [] when cleared
export function getMergedSheetRows(): AFSFindingRecord[] {
  if (isDataCleared()) {
    return [];
  }
  const deletedKeys = getDeletedProjectKeys();
  const custom = getCustomSyncedRows();

  let baseRows: AFSFindingRecord[] = [];
  if (custom !== null) {
    baseRows = deduplicateRows(custom);
  } else {
    baseRows = deduplicateRows(sanitizeRows((rawSheetData.rows || []) as AFSFindingRecord[]));
  }

  if (deletedKeys.size === 0) return baseRows;

  return baseRows.filter(r => {
    if (!r) return false;
    const projName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
    const siteName = (r['SITE'] || 'HEAD OFFICE').trim().toUpperCase();
    const yearVal = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
    const compositeKey = getProjectCompositeKey(projName, siteName, yearVal);

    if (deletedKeys.has(projName)) return false;
    if (deletedKeys.has(compositeKey)) return false;
    return true;
  });
}

// Save synced rows for a specific project (merges with existing rows of other projects/sites/years)
export function saveSyncedRows(
  newRows: AFSFindingRecord[], 
  targetProject = 'PR-PAYMENT', 
  meta: Omit<SyncMetadata, 'lastSyncTimestamp' | 'totalSyncedRows'>,
  targetSite?: string,
  targetYear?: string | number
) {
  try {
    localStorage.removeItem(STORAGE_KEY_CLEARED);

    const tProj = targetProject.trim().toUpperCase();
    const tSite = (targetSite || '').trim().toUpperCase();
    const tYear = targetYear ? String(targetYear).trim() : '';
    const tKey = getProjectCompositeKey(tProj, tSite, tYear);

    // Remove from deleted list if user explicitly re-synced it
    removeDeletedProjectKey(tKey, tProj);

    const deletedKeys = getDeletedProjectKeys();

    // Get existing custom rows or default initial dataset
    const customRows = getCustomSyncedRows();
    const existing = customRows !== null ? customRows : sanitizeRows((rawSheetData.rows || []) as AFSFindingRecord[]);
    
    // Filter out previous rows belonging to this EXACT project + site + year combination,
    // AND filter out any rows belonging to deleted projects!
    const otherProjectsRows = existing.filter(r => {
      const rProj = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      const rKey = getProjectCompositeKey(rProj, rSite, rYear);

      if (deletedKeys.has(rProj) || deletedKeys.has(rKey)) return false;

      if (rProj !== tProj) return true; // Keep rows from other project names
      if (tSite && rSite && rSite !== tSite) return true; // Keep rows from other sites
      if (tYear && rYear && rYear !== tYear) return true; // Keep rows from other years
      return false; // Remove old rows for this exact composite project/site/year
    });

    // Sanitize new rows to eliminate headers or empty lines
    const sanitizedNew = sanitizeRows(newRows);

    // Ensure all new rows have the target project tag, site tag, and year tag
    const taggedNewRows = sanitizedNew.map(r => {
      const currentSite = (r['SITE'] || '').trim();
      const finalSite = targetSite && targetSite.trim() !== '' 
        ? targetSite.trim().toUpperCase()
        : (currentSite !== '' && currentSite !== '-' ? currentSite : 'HEAD OFFICE');

      const currentYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      const finalYear = tYear !== '' ? tYear : currentYear;

      return {
        ...r,
        'PROJECT AUDIT': tProj, // Enforce target project tag so raw sheet column values don't inject deleted projects
        'SITE': finalSite,
        ...(finalYear ? { 'PERIODE AUDIT': finalYear } : {})
      };
    });

    const merged = [...taggedNewRows, ...otherProjectsRows];

    // Helper to safely set item in localStorage with quota overflow handling
    function safeSetLocalStorage(key: string, data: string): boolean {
      try {
        localStorage.setItem(key, data);
        return true;
      } catch (e) {
        console.warn(`localStorage quota warning for key ${key}:`, e);
        try {
          // If quota reached, trim achievement snapshots to free up space
          const snapshots = getAchievementSnapshots();
          if (snapshots.length > 5) {
            saveSnapshotsSafe(snapshots.slice(snapshots.length - 5));
          }
          localStorage.setItem(key, data);
          return true;
        } catch (err) {
          console.error('Critical localStorage failure:', err);
        }
        return false;
      }
    }

    // Update project link config status FIRST before writing heavy rows data
    saveProjectLinkConfig({
      projectName: targetProject.toUpperCase(),
      siteName: targetSite,
      year: targetYear,
      ...(meta.sheetUrl && meta.sheetUrl.trim() !== '' ? { sheetUrl: meta.sheetUrl.trim() } : {}),
      lastSyncedAt: new Date().toISOString(),
      rowCount: sanitizedNew.length,
      status: 'synced'
    });

    safeSetLocalStorage(STORAGE_KEY_ROWS, JSON.stringify(merged));

    const syncMeta: SyncMetadata = {
      lastSyncTimestamp: new Date().toISOString(),
      syncedProject: targetProject,
      sourceType: meta.sourceType,
      totalSyncedRows: merged.length,
      sheetUrl: meta.sheetUrl
    };

    safeSetLocalStorage(STORAGE_KEY_META, JSON.stringify(syncMeta));

    // Automatically record achievement history snapshot
    recordAchievementSnapshot(`Sync Google Sheet: ${targetProject}`, 'sync');

    // Dispatch browser event for real-time reactivity
    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { syncMeta, merged } }));

    return true;
  } catch (err) {
    console.error('Error saving synced rows:', err);
    return false;
  }
}

// In-memory cache for project link configs to guarantee zero data loss during session or quota limits
let inMemoryProjectConfigs: ProjectLinkConfig[] | null = null;

// Helper to safely write critical configs to localStorage with quota protection
function safeSaveProjectLinks(configs: ProjectLinkConfig[]): boolean {
  const deduped = deduplicateProjectConfigs(configs);
  inMemoryProjectConfigs = deduped;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(deduped));
    return true;
  } catch (e) {
    console.warn('Quota exceeded when saving project links. Attempting storage cleanup...', e);
    try {
      // If quota is reached, remove old metadata/temp rows to guarantee room for link configs
      localStorage.removeItem(STORAGE_KEY_META);
      localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(deduped));
      return true;
    } catch (err) {
      console.error('Critical failure saving project links:', err);
      return false;
    }
  }
}

// Helper to generate composite unique key for project + site + optional year
export function getProjectCompositeKey(projectName: string, siteName?: string, year?: string | number): string {
  const p = (projectName || '').trim().toUpperCase();
  const s = (siteName || '').trim().toUpperCase();
  const y = year ? String(year).trim() : '';

  if (s && y) return `${p}|${s}|${y}`;
  if (s) return `${p}|${s}`;
  if (y) return `${p}||${y}`;
  return p;
}

// Manage Project Links Configuration
export function getProjectLinkConfigs(): ProjectLinkConfig[] {
  let configs: ProjectLinkConfig[] = [];
  const deletedKeys = getDeletedProjectKeys();
  
  // 1. Try reading from in-memory cache first
  if (inMemoryProjectConfigs && inMemoryProjectConfigs.length > 0) {
    configs = [...inMemoryProjectConfigs];
  }

  // 2. Try reading from localStorage if memory cache is empty
  const rawSavedLinks = localStorage.getItem(STORAGE_KEY_PROJECT_LINKS);
  const hasSavedLinksInStorage = rawSavedLinks !== null;

  if (configs.length === 0 && hasSavedLinksInStorage) {
    try {
      if (rawSavedLinks) {
        const parsed = JSON.parse(rawSavedLinks);
        if (Array.isArray(parsed)) {
          configs = parsed;
        }
      }
    } catch (err) {
      console.error('Error reading project link configs:', err);
    }
  }

  // 3. Fall back to standard defaults ONLY if no configs exist anywhere AND user never saved or deleted project links
  if (configs.length === 0 && !hasSavedLinksInStorage && deletedKeys.size === 0) {
    configs = [
      {
        projectName: 'PR-PAYMENT',
        siteName: 'HEAD OFFICE',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/1EbW-jLKB93mRXgcPfLh8LGuzj-AiJA9uwdTj-Tjl3dE/edit?pli=1&gid=1675231303#gid=1675231303',
        lastSyncedAt: new Date().toISOString(),
        rowCount: 93,
        status: 'synced'
      },
      {
        projectName: 'AUDIT OPERASIONAL',
        siteName: 'OPERATIONAL SITE',
        sheetUrl: '',
        lastSyncedAt: null,
        rowCount: 0,
        status: 'pending'
      },
      {
        projectName: 'CLOSING PROJECT',
        siteName: 'PROJECT SITE',
        sheetUrl: '',
        lastSyncedAt: null,
        rowCount: 0,
        status: 'pending'
      },
      {
        projectName: 'INVESTIGASI',
        siteName: 'HEAD OFFICE',
        sheetUrl: '',
        lastSyncedAt: null,
        rowCount: 0,
        status: 'pending'
      }
    ];
  }

  // Filter out any deleted configs
  if (deletedKeys.size > 0) {
    configs = configs.filter(c => {
      const projName = (c.projectName || '').trim().toUpperCase();
      const siteName = (c.siteName || '').trim().toUpperCase();
      const yearVal = c.year ? String(c.year).trim() : '';
      const compositeKey = c.id || getProjectCompositeKey(projName, siteName, yearVal);

      if (deletedKeys.has(projName)) return false;
      if (deletedKeys.has(compositeKey)) return false;
      return true;
    });
  }

  // Ensure each config has an explicit ID
  configs = configs.map(c => ({
    ...c,
    id: c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year)
  }));

  // 4. Auto-discover projects existing in current merged dataset so synced projects never disappear
  const currentMerged = getMergedSheetRows();
  const existingKeys = new Set(configs.map(c => c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year)));

  currentMerged.forEach(r => {
    const projName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
    const siteName = (r['SITE'] || 'HEAD OFFICE').trim().toUpperCase();
    const yearVal = r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '';
    const compositeKey = getProjectCompositeKey(projName, siteName, yearVal);

    if (projName && !existingKeys.has(compositeKey) && !deletedKeys.has(projName) && !deletedKeys.has(compositeKey)) {
      existingKeys.add(compositeKey);
      configs.push({
        id: compositeKey,
        projectName: projName,
        siteName: siteName,
        year: yearVal || undefined,
        sheetUrl: '',
        lastSyncedAt: new Date().toISOString(),
        rowCount: 0,
        status: 'synced'
      });
    }
  });

  // Reconcile rowCount & status dynamically
  const reconciled = configs.map(c => {
    const targetProj = c.projectName.trim().toUpperCase();
    const targetSite = (c.siteName || '').trim().toUpperCase();
    const targetYear = c.year ? String(c.year).trim() : '';

    const matchingRows = currentMerged.filter(r => {
      const rProj = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();

      if (rProj !== targetProj) return false;
      if (targetSite && rSite && rSite !== targetSite) return false;
      if (targetYear && rYear && rYear !== targetYear) return false;
      return true;
    });

    const count = matchingRows.length;
    return {
      ...c,
      id: c.id || getProjectCompositeKey(targetProj, targetSite, c.year),
      rowCount: count > 0 ? count : (c.rowCount || 0),
      status: count > 0 ? 'synced' : (c.status || 'pending')
    };
  });

  inMemoryProjectConfigs = reconciled;
  return reconciled;
}

export function saveProjectLinkConfig(config: ProjectLinkConfig) {
  try {
    const targetName = (config.projectName || '').trim().toUpperCase();
    const targetSite = (config.siteName || '').trim().toUpperCase();
    const targetYear = config.year ? String(config.year).trim() : undefined;
    const targetKey = config.id || getProjectCompositeKey(targetName, targetSite, targetYear);

    // Remove from deleted list if explicitly saved/re-added by user
    removeDeletedProjectKey(targetKey, targetName);

    const configs = getProjectLinkConfigs();

    const existingIndex = configs.findIndex(c => {
      const cKey = c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year);
      if (config.id && c.id) return c.id === config.id;
      return cKey === targetKey;
    });

    if (existingIndex >= 0) {
      const existing = configs[existingIndex];
      configs[existingIndex] = {
        ...existing,
        ...config,
        id: targetKey,
        projectName: targetName,
        year: targetYear !== undefined ? targetYear : existing.year,
        // Preserve existing sheetUrl if new config doesn't supply one or supplies empty string in generic update
        sheetUrl: (config.sheetUrl !== undefined && config.sheetUrl !== null)
          ? config.sheetUrl 
          : existing.sheetUrl,
        siteName: targetSite || existing.siteName || 'HEAD OFFICE',
        status: config.status || existing.status || 'pending',
        rowCount: config.rowCount !== undefined ? config.rowCount : existing.rowCount,
        lastSyncedAt: config.lastSyncedAt || existing.lastSyncedAt
      };
    } else {
      configs.push({
        ...config,
        id: targetKey,
        projectName: targetName,
        siteName: targetSite || 'HEAD OFFICE',
        year: targetYear,
        sheetUrl: config.sheetUrl || '',
        status: config.status || 'pending',
        rowCount: config.rowCount || 0,
        lastSyncedAt: config.lastSyncedAt || null
      });
    }

    safeSaveProjectLinks(configs);
    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: configs }));
  } catch (err) {
    console.error('Error saving project link config:', err);
  }
}

export function deleteProjectLinkConfig(projectName: string, siteName?: string, year?: string | number) {
  try {
    const targetName = projectName.trim().toUpperCase();
    const targetSite = (siteName || '').trim().toUpperCase();
    const targetYear = year ? String(year).trim() : '';
    const targetKey = getProjectCompositeKey(targetName, targetSite, targetYear);

    // Persist as deleted (both full composite key and project name)
    addDeletedProjectKey(targetKey, targetName);

    inMemoryProjectConfigs = null;

    const deletedKeys = getDeletedProjectKeys();
    const configs = getProjectLinkConfigs();
    const filtered = configs.filter(c => {
      const cProj = (c.projectName || '').trim().toUpperCase();
      const cKey = c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year);

      if (deletedKeys.has(cProj) || deletedKeys.has(cKey)) return false;
      if (cProj === targetName || cKey === targetKey) return false;
      return true;
    });
    
    safeSaveProjectLinks(filtered);

    // Also remove rows belonging to this project & site & year
    const customRows = getCustomSyncedRows() || [];
    const remainingRows = customRows.filter(r => {
      const rName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      const rKey = getProjectCompositeKey(rName, rSite, rYear);

      if (deletedKeys.has(rName) || deletedKeys.has(rKey)) return false;
      if (rName === targetName || rKey === targetKey) return false;
      return true;
    });

    try {
      localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(remainingRows));
    } catch (e) {
      console.warn('Failed to save remaining rows after delete:', e);
    }

    const merged = getMergedSheetRows();
    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { merged } }));
    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: filtered }));
  } catch (err) {
    console.error('Error deleting project link config:', err);
  }
}

// Explicit cleanup function to deduplicate project link configs and audit finding rows
export function cleanupDuplicates(): { removedRows: number; removedConfigs: number } {
  let removedRows = 0;
  let removedConfigs = 0;

  try {
    const deletedKeys = getDeletedProjectKeys();

    // 1. Clean custom synced rows
    const customRows = getCustomSyncedRows();
    if (customRows && customRows.length > 0) {
      const filteredByDeleted = customRows.filter(r => {
        const projName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
        const siteName = (r['SITE'] || '').trim().toUpperCase();
        const yearVal = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
        const compositeKey = getProjectCompositeKey(projName, siteName, yearVal);
        return !deletedKeys.has(projName) && !deletedKeys.has(compositeKey);
      });
      const dedupedRows = deduplicateRows(filteredByDeleted);
      removedRows = customRows.length - dedupedRows.length;
      localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(dedupedRows));
    }

    // 2. Clean project link configs
    const rawConfigs = getProjectLinkConfigs();
    const filteredConfigs = rawConfigs.filter(c => {
      const projName = (c.projectName || '').trim().toUpperCase();
      const siteName = (c.siteName || '').trim().toUpperCase();
      const yearVal = c.year ? String(c.year).trim() : '';
      const compositeKey = c.id || getProjectCompositeKey(projName, siteName, yearVal);
      return !deletedKeys.has(projName) && !deletedKeys.has(compositeKey);
    });
    const dedupedConfigs = deduplicateProjectConfigs(filteredConfigs);
    removedConfigs = rawConfigs.length - dedupedConfigs.length;

    safeSaveProjectLinks(dedupedConfigs);

    // Dispatch events to refresh all components live
    const merged = getMergedSheetRows();
    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { merged } }));
    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: dedupedConfigs }));

    console.log(`Cleanup complete: Removed ${removedRows} duplicate/deleted rows and ${removedConfigs} duplicate/deleted project configs.`);
  } catch (err) {
    console.error('Error during cleanupDuplicates:', err);
  }

  return { removedRows, removedConfigs };
}

// Clear all data (user request: bersihkan data)
export function clearAllData() {
  try {
    inMemoryProjectConfigs = null;
    localStorage.setItem(STORAGE_KEY_CLEARED, 'true');
    localStorage.removeItem(STORAGE_KEY_ROWS);
    localStorage.removeItem(STORAGE_KEY_META);
    localStorage.removeItem(STORAGE_KEY_PROJECT_LINKS);
    localStorage.removeItem(STORAGE_KEY_DELETED_PROJECTS);

    const emptyMeta: SyncMetadata = {
      lastSyncTimestamp: null,
      syncedProject: 'PR-PAYMENT',
      sourceType: 'initial',
      totalSyncedRows: 0,
      sheetUrl: ''
    };

    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { syncMeta: emptyMeta, merged: [] } }));
  } catch (err) {
    console.error('Error clearing data:', err);
  }
}

// Automatic background sync for all projects with configured Google Sheet URLs
export async function autoSyncAllProjects(
  onProgress?: (projName: string, success: boolean, count: number) => void
): Promise<{ totalRows: number; syncedCount: number }> {
  window.dispatchEvent(new CustomEvent('afs_sync_status_changed', { detail: { isSyncing: true } }));
  const configs = getProjectLinkConfigs();
  const projectsWithUrl = configs.filter(c => c.sheetUrl && c.sheetUrl.trim() !== '');
  let totalRows = 0;
  let syncedCount = 0;

  try {
    for (const proj of projectsWithUrl) {
      try {
        const response = await fetch('/api/sync-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetUrl: proj.sheetUrl!.trim(),
            defaultProject: proj.projectName.trim()
          })
        });

        const data = await response.json();
        if (data.success && data.rows) {
          saveSyncedRows(
            data.rows,
            proj.projectName.trim(),
            {
              syncedProject: proj.projectName.trim(),
              sourceType: 'url',
              sheetUrl: proj.sheetUrl!.trim()
            },
            proj.siteName,
            proj.year
          );
          syncedCount++;
          totalRows += (data.count || 0);
          if (onProgress) onProgress(proj.projectName, true, data.count || 0);
        } else {
          if (onProgress) onProgress(proj.projectName, false, 0);
        }
      } catch (err) {
        console.warn(`Background auto-sync failed for ${proj.projectName}:`, err);
        if (onProgress) onProgress(proj.projectName, false, 0);
      }
    }
  } finally {
    window.dispatchEvent(new CustomEvent('afs_sync_status_changed', { detail: { isSyncing: false } }));
  }

  return { totalRows, syncedCount };
}

// Get sync metadata
export function getSyncMetadata(): SyncMetadata {
  if (isDataCleared()) {
    return {
      lastSyncTimestamp: null,
      syncedProject: 'PR-PAYMENT',
      sourceType: 'initial',
      totalSyncedRows: 0,
      sheetUrl: ''
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}

  const rows = getMergedSheetRows();
  return {
    lastSyncTimestamp: null,
    syncedProject: 'PR-PAYMENT',
    sourceType: 'url',
    totalSyncedRows: rows.length,
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1EbW-jLKB93mRXgcPfLh8LGuzj-AiJA9uwdTj-Tjl3dE/edit?pli=1&gid=1675231303#gid=1675231303'
  };
}

// Default baseline history data points if none recorded yet
function getDefaultBaselineSnapshots(): AchievementSnapshot[] {
  return [
    {
      id: 'snap_2026_07_20',
      timestamp: '2026-07-20T08:00:00.000Z',
      date: '2026-07-20',
      note: 'Baseline Review Awal - Juli 2026',
      sourceType: 'initial',
      totalRows: 135,
      closedRows: 101,
      openRows: 24,
      progressRows: 10,
      closeRate: 74.81,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 122, open: 22, progress: 3, closeRate: 83.33, siteRate: 92.98, hoRate: 85.00 },
        { projectName: 'IP BAYAN', total: 166, closed: 110, open: 50, progress: 6, closeRate: 86.67, siteRate: 80.00, hoRate: 50.00 },
        { projectName: 'AGM', total: 43, closed: 26, open: 14, progress: 3, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 18, open: 11, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    },
    {
      id: 'snap_2026_07_27',
      timestamp: '2026-07-27T09:30:00.000Z',
      date: '2026-07-27',
      note: 'Sync Google Sheet: Pekan ke-4 Juli 2026',
      sourceType: 'sync',
      totalRows: 1046,
      closedRows: 818,
      openRows: 200,
      progressRows: 28,
      closeRate: 78.17,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 126, open: 18, progress: 3, closeRate: 86.11, siteRate: 92.98, hoRate: 87.50 },
        { projectName: 'IP BAYAN', total: 166, closed: 110, open: 50, progress: 6, closeRate: 86.67, siteRate: 80.00, hoRate: 50.00 },
        { projectName: 'AGM', total: 43, closed: 26, open: 14, progress: 3, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 18, open: 11, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    },
    {
      id: 'snap_2026_08_03',
      timestamp: '2026-08-03T14:15:00.000Z',
      date: '2026-08-03',
      note: 'Sync Google Sheet: Pekan ke-1 Agustus 2026',
      sourceType: 'sync',
      totalRows: 1046,
      closedRows: 835,
      openRows: 185,
      progressRows: 26,
      closeRate: 79.86,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 126, open: 18, progress: 3, closeRate: 86.11, siteRate: 92.98, hoRate: 87.50 },
        { projectName: 'IP BAYAN', total: 166, closed: 113, open: 48, progress: 5, closeRate: 86.67, siteRate: 80.00, hoRate: 50.00 },
        { projectName: 'AGM', total: 43, closed: 29, open: 12, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 20, open: 9, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    },
    {
      id: 'snap_2026_08_10',
      timestamp: '2026-08-10T09:00:00.000Z',
      date: '2026-08-10',
      note: 'Sync Google Sheet: 10 Agustus 2026',
      sourceType: 'sync',
      totalRows: 1046,
      closedRows: 857,
      openRows: 165,
      progressRows: 24,
      closeRate: 81.94,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 129, open: 16, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 90.00 },
        { projectName: 'IP BAYAN', total: 166, closed: 113, open: 48, progress: 5, closeRate: 86.67, siteRate: 80.00, hoRate: 50.00 },
        { projectName: 'AGM', total: 43, closed: 29, open: 12, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 20, open: 9, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    },
    {
      id: 'snap_2026_08_17',
      timestamp: '2026-08-17T10:00:00.000Z',
      date: '2026-08-17',
      note: 'Sync Google Sheet: 17 Agustus 2026',
      sourceType: 'sync',
      totalRows: 1046,
      closedRows: 860,
      openRows: 162,
      progressRows: 24,
      closeRate: 82.18,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 129, open: 16, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 90.00 },
        { projectName: 'IP BAYAN', total: 166, closed: 113, open: 48, progress: 5, closeRate: 86.67, siteRate: 80.00, hoRate: 50.00 },
        { projectName: 'AGM', total: 43, closed: 29, open: 12, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 20, open: 9, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 114, open: 101, progress: 7, closeRate: 51.40, siteRate: 74.07, hoRate: 50.51 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    }
  ];
}

// Helper to safely write snapshots with automatic quota management & trimming
function saveSnapshotsSafe(snapshots: AchievementSnapshot[]): AchievementSnapshot[] {
  const MAX_SNAPSHOTS = 25;
  let list = snapshots.length > MAX_SNAPSHOTS 
    ? snapshots.slice(snapshots.length - MAX_SNAPSHOTS) 
    : [...snapshots];

  while (list.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(list));
      return list;
    } catch (err) {
      console.warn(`localStorage quota warning saving snapshots (${list.length} items). Trimming oldest snapshot...`, err);
      list = list.slice(1);
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY_SNAPSHOTS);
  } catch (e) {}
  return [];
}

// Read recorded achievement snapshots history
export function getAchievementSnapshots(): AchievementSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
    }
  } catch (err) {
    console.error('Error loading achievement snapshots:', err);
  }

  // Seed default history
  const defaults = getDefaultBaselineSnapshots();
  saveSnapshotsSafe(defaults);
  return defaults;
}

// Record a new achievement snapshot from current dataset
export function recordAchievementSnapshot(
  note = 'Sinkronisasi Spreadsheet',
  sourceType: 'sync' | 'manual' | 'initial' | 'edit' = 'sync'
): AchievementSnapshot {
  const rows = getMergedSheetRows();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  let totalRows = rows.length;
  let closedRows = 0;
  let openRows = 0;
  let progressRows = 0;

  // Group by project
  const projMap = new Map<string, { total: number; closed: number; open: number; progress: number; siteTotal: number; siteClosed: number; hoTotal: number; hoClosed: number }>();

  rows.forEach(r => {
    const st = (r.STATUS || '').toUpperCase().trim();
    if (st === 'CLOSE') closedRows++;
    else if (st === 'OPEN') openRows++;
    else progressRows++;

    const rawProj = (r['PROJECT AUDIT'] || 'LAINNYA').trim().toUpperCase();
    if (!projMap.has(rawProj)) {
      projMap.set(rawProj, { total: 0, closed: 0, open: 0, progress: 0, siteTotal: 0, siteClosed: 0, hoTotal: 0, hoClosed: 0 });
    }
    const stat = projMap.get(rawProj)!;
    stat.total++;
    if (st === 'CLOSE') stat.closed++;
    else if (st === 'OPEN') stat.open++;
    else stat.progress++;

    const site = (r.SITE || '').trim().toUpperCase();
    if (site && site !== 'HEAD OFFICE') {
      stat.siteTotal++;
      if (st === 'CLOSE') stat.siteClosed++;
    } else {
      stat.hoTotal++;
      if (st === 'CLOSE') stat.hoClosed++;
    }
  });

  const closeRate = totalRows > 0 ? parseFloat(((closedRows / totalRows) * 100).toFixed(2)) : 0;

  const projectStats: ProjectSnapshotStat[] = Array.from(projMap.entries()).map(([pName, st]) => {
    const pRate = st.total > 0 ? parseFloat(((st.closed / st.total) * 100).toFixed(2)) : 0;
    const sRate = st.siteTotal > 0 ? parseFloat(((st.siteClosed / st.siteTotal) * 100).toFixed(2)) : pRate;
    const hRate = st.hoTotal > 0 ? parseFloat(((st.hoClosed / st.hoTotal) * 100).toFixed(2)) : pRate;

    return {
      projectName: pName,
      total: st.total,
      closed: st.closed,
      open: st.open,
      progress: st.progress,
      closeRate: pRate,
      siteRate: sRate,
      hoRate: hRate
    };
  });

  const newSnapshot: AchievementSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now.toISOString(),
    date: dateStr,
    note,
    sourceType,
    totalRows,
    closedRows,
    openRows,
    progressRows,
    closeRate,
    projectStats
  };

  const existing = getAchievementSnapshots();
  const updated = [...existing, newSnapshot].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const savedList = saveSnapshotsSafe(updated);

  window.dispatchEvent(new CustomEvent('afs_snapshot_recorded', { detail: { newSnapshot, history: savedList } }));
  return newSnapshot;
}

export function deleteSnapshot(id: string) {
  const existing = getAchievementSnapshots();
  const filtered = existing.filter(s => s.id !== id);
  const savedList = saveSnapshotsSafe(filtered);
  window.dispatchEvent(new CustomEvent('afs_snapshot_recorded', { detail: { history: savedList } }));
}

export function clearSnapshotHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY_SNAPSHOTS);
  } catch (err) {}
  window.dispatchEvent(new CustomEvent('afs_snapshot_recorded', { detail: { history: [] } }));
}

// ----------------------------------------------------
// DAILY 00:00 CUT-OFF & GOOGLE DRIVE AUTO-BACKUP ENGINE
// ----------------------------------------------------
const STORAGE_KEY_DAILY_CUTOFF_CONFIG = 'iams_daily_cutoff_config_v1';
const STORAGE_KEY_DAILY_CUTOFF_LOGS = 'iams_daily_cutoff_logs_v1';

export interface DailyCutoffConfig {
  enabled: boolean;
  autoDriveBackup: boolean;
  cutoffHour: number; // default 0 (00:00)
  cutoffMinute: number; // default 0
  lastCutoffDate: string; // YYYY-MM-DD
  lastCutoffTimestamp: string | null;
  targetFolderId?: string;
}

export interface DailyCutoffLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  closeRate: number;
  totalRows: number;
  closedRows: number;
  openRows: number;
  progressRows: number;
  driveSyncStatus: 'success' | 'failed' | 'skipped' | 'pending';
  driveFileName?: string;
  driveFileLink?: string;
  errorMessage?: string;
  isManualTrigger?: boolean;
}

export function getDailyCutoffConfig(): DailyCutoffConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_CUTOFF_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        autoDriveBackup: parsed.autoDriveBackup ?? true,
        cutoffHour: parsed.cutoffHour ?? 0,
        cutoffMinute: parsed.cutoffMinute ?? 0,
        lastCutoffDate: parsed.lastCutoffDate || '',
        lastCutoffTimestamp: parsed.lastCutoffTimestamp || null,
        targetFolderId: parsed.targetFolderId || '1zDCtRFoFEDWzakB0I5lpr88PP2vwDAAs'
      };
    }
  } catch (e) {
    console.error('Error reading daily cutoff config:', e);
  }
  return {
    enabled: true,
    autoDriveBackup: true,
    cutoffHour: 0,
    cutoffMinute: 0,
    lastCutoffDate: '',
    lastCutoffTimestamp: null,
    targetFolderId: '1zDCtRFoFEDWzakB0I5lpr88PP2vwDAAs'
  };
}

export function saveDailyCutoffConfig(config: Partial<DailyCutoffConfig>): DailyCutoffConfig {
  const current = getDailyCutoffConfig();
  const updated: DailyCutoffConfig = { ...current, ...config };
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_CUTOFF_CONFIG, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving daily cutoff config:', e);
  }
  window.dispatchEvent(new CustomEvent('iams_cutoff_config_updated', { detail: updated }));
  return updated;
}

export function getDailyCutoffLogs(): DailyCutoffLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_CUTOFF_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    }
  } catch (e) {
    console.error('Error reading cutoff logs:', e);
  }
  return [];
}

export function saveDailyCutoffLog(log: DailyCutoffLog): DailyCutoffLog[] {
  const logs = getDailyCutoffLogs();
  const updated = [log, ...logs.filter(l => l.id !== log.id)].slice(0, 30);
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_CUTOFF_LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving cutoff log:', e);
  }
  window.dispatchEvent(new CustomEvent('iams_cutoff_log_updated', { detail: { log, history: updated } }));
  return updated;
}

