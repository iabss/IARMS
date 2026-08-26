import { AFSFindingRecord } from '../types';
import rawSheetData from './sheetData.json';
import { extractFindingYear } from '../utils/statusHelper';

const STORAGE_KEY_ROWS = 'afs_synced_custom_rows_v2';
const STORAGE_KEY_META = 'afs_synced_metadata_v2';
const STORAGE_KEY_CLEARED = 'afs_data_is_cleared_v2';
const STORAGE_KEY_PROJECT_LINKS = 'afs_project_links_v1';
const STORAGE_KEY_DELETED_PROJECTS = 'afs_deleted_project_keys_v1';
const STORAGE_KEY_SNAPSHOTS = 'afs_achievement_snapshots_v2';
const STORAGE_KEY_TREND_EXCLUDED_PROJECTS = 'afs_trend_excluded_projects_v1';

export interface SyncMetadata {
  lastSyncTimestamp: string | null;
  syncedProject: string;
  sourceType: 'url' | 'paste' | 'file' | 'initial' | 'manual';
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

// Manage trend excluded projects (specifically for Trend Achievement view)
export function getTrendExcludedProjects(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(k => String(k).trim().toUpperCase()));
    }
  } catch (e) {
    console.error('Error reading trend excluded projects:', e);
  }
  return new Set<string>();
}

export function addTrendExcludedProject(projectNameOrKey: string) {
  try {
    if (!projectNameOrKey) return;
    const set = getTrendExcludedProjects();
    set.add(projectNameOrKey.trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent('afs_trend_exclusions_updated', { detail: Array.from(set) }));
  } catch (e) {
    console.error('Error adding trend excluded project:', e);
  }
}

export function removeTrendExcludedProject(projectNameOrKey: string) {
  try {
    if (!projectNameOrKey) return;
    const set = getTrendExcludedProjects();
    set.delete(projectNameOrKey.trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent('afs_trend_exclusions_updated', { detail: Array.from(set) }));
  } catch (e) {
    console.error('Error removing trend excluded project:', e);
  }
}

export function clearTrendExcludedProjects() {
  try {
    localStorage.removeItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS);
    window.dispatchEvent(new CustomEvent('afs_trend_exclusions_updated', { detail: [] }));
  } catch (e) {
    console.error('Error clearing trend excluded projects:', e);
  }
}

// Permanently delete a project across the entire system (Config, Datasets, Trend, and Deleted Lists)
export function deleteProjectPermanently(projectName: string, siteName?: string, year?: string | number) {
  try {
    const targetProj = projectName.trim().toUpperCase();
    const targetSite = (siteName || '').trim().toUpperCase();
    const targetYear = year ? String(year).trim() : '';
    const targetKey = getProjectCompositeKey(targetProj, targetSite, targetYear);
    const fullName = targetSite && targetSite !== 'HEAD OFFICE' ? `${targetSite} - ${targetProj}` : targetProj;

    // 1. Mark in deleted project keys & trend exclusions
    addDeletedProjectKey(targetKey, targetProj);
    addTrendExcludedProject(targetProj);
    addTrendExcludedProject(targetKey);
    addTrendExcludedProject(fullName);

    // 2. Remove from project configs
    deleteProjectLinkConfig(targetProj, targetSite, targetYear);

    // 3. Remove custom rows
    const customRows = getCustomSyncedRows() || [];
    const remainingRows = customRows.filter(r => {
      const rName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      const rKey = getProjectCompositeKey(rName, rSite, rYear);

      if (rName === targetProj || rKey === targetKey) return false;
      if (fullName === `${rSite} - ${rName}`) return false;
      return true;
    });

    localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(remainingRows));

    // 4. Dispatch events
    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { merged: remainingRows } }));
    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: getProjectLinkConfigs() }));
    window.dispatchEvent(new CustomEvent('afs_trend_exclusions_updated', { detail: Array.from(getTrendExcludedProjects()) }));

    pushStateToServer();

    return true;
  } catch (err) {
    console.error('Error deleting project permanently:', err);
    return false;
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

// Deduplicate project link configs by id or unique sheetUrl / composite key
export function deduplicateProjectConfigs(configs: ProjectLinkConfig[]): ProjectLinkConfig[] {
  if (!Array.isArray(configs)) return [];
  
  const map = new Map<string, ProjectLinkConfig>();

  for (const c of configs) {
    if (!c || !c.projectName) continue;
    const projName = c.projectName.trim().toUpperCase();
    const siteName = (c.siteName || 'HEAD OFFICE').trim().toUpperCase();
    const yearVal = c.year ? String(c.year).trim() : undefined;
    // Prefer distinct id if provided, else unique sheetUrl, else composite key
    const key = c.id || (c.sheetUrl && c.sheetUrl.trim() ? `${projName}|${siteName}|${yearVal || ''}|${c.sheetUrl.trim()}` : getProjectCompositeKey(projName, siteName, yearVal));

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...c,
        id: c.id || key,
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
        id: c.id || existing.id || key,
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

  // If user has saved custom project links, only keep rows matching configured project names/sites
  const rawSavedLinks = localStorage.getItem(STORAGE_KEY_PROJECT_LINKS);
  let allowedProjectNames: Set<string> | null = null;
  if (rawSavedLinks) {
    try {
      const parsedConfigs: ProjectLinkConfig[] = JSON.parse(rawSavedLinks);
      if (Array.isArray(parsedConfigs) && parsedConfigs.length > 0) {
        allowedProjectNames = new Set(parsedConfigs.map(c => (c.projectName || '').trim().toUpperCase()).filter(Boolean));
      }
    } catch (e) {
      console.warn('Error reading saved links for row filtering:', e);
    }
  }

  return baseRows.filter(r => {
    if (!r) return false;
    const projName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
    const siteName = (r['SITE'] || 'HEAD OFFICE').trim().toUpperCase();
    const yearVal = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
    const compositeKey = getProjectCompositeKey(projName, siteName, yearVal);

    if (deletedKeys.has(projName)) return false;
    if (deletedKeys.has(compositeKey)) return false;

    // Filter out unlinked demo projects if user has configured custom project links
    if (allowedProjectNames && allowedProjectNames.size > 0) {
      if (!allowedProjectNames.has(projName)) return false;
    }

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

    // Persist to server backend
    pushStateToServer();

    return true;
  } catch (err) {
    console.error('Error saving synced rows:', err);
    return false;
  }
}

// Directly persist and broadcast changes to the entire dataset (e.g. from inline edits, manual adds, or status changes)
export function saveEntireDataset(rows: AFSFindingRecord[], actionDescription = 'Update Dataset Manual'): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY_CLEARED);
    const sanitized = sanitizeRows(rows);

    try {
      localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage error in saveEntireDataset:', e);
      return false;
    }

    const syncMeta: SyncMetadata = {
      lastSyncTimestamp: new Date().toISOString(),
      syncedProject: 'MANUAL_UPDATE',
      sourceType: 'manual',
      totalSyncedRows: sanitized.length,
    };

    try {
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(syncMeta));
    } catch (e) {
      // benign
    }

    recordAchievementSnapshot(actionDescription, 'manual');
    window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { syncMeta, merged: sanitized } }));
    pushStateToServer();
    return true;
  } catch (err) {
    console.error('Error in saveEntireDataset:', err);
    return false;
  }
}

// In-memory cache for project link configs to guarantee zero data loss during session or quota limits
let inMemoryProjectConfigs: ProjectLinkConfig[] | null = null;

// Push client-side state to server backend so all shared/published instances receive updates
export async function pushStateToServer() {
  try {
    const projectConfigs = getProjectLinkConfigs();
    const customRows = getCustomSyncedRows() || [];
    const deletedKeys = Array.from(getDeletedProjectKeys());
    const trendExclusions = Array.from(getTrendExcludedProjects());
    const snapshots = getAchievementSnapshots();

    await fetch('/api/app-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectConfigs,
        customRows,
        deletedKeys,
        trendExclusions,
        snapshots
      })
    });
  } catch (err) {
    // Non-blocking background push
  }
}

// Hydrate state from server backend on initial mount
export async function syncWithServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/app-state');
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.success || !json.state) return false;

    const { projectConfigs, customRows, deletedKeys, trendExclusions, snapshots } = json.state;
    let hasUpdated = false;

    // Hydrate projectConfigs if present
    if (Array.isArray(projectConfigs) && projectConfigs.length > 0) {
      const localConfigs = localStorage.getItem(STORAGE_KEY_PROJECT_LINKS);
      if (!localConfigs) {
        localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(projectConfigs));
        inMemoryProjectConfigs = projectConfigs;
        hasUpdated = true;
      }
    }

    // Hydrate custom rows
    if (Array.isArray(customRows) && customRows.length > 0) {
      const localRows = localStorage.getItem(STORAGE_KEY_ROWS);
      if (!localRows) {
        localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(customRows));
        hasUpdated = true;
      }
    }

    // Hydrate deleted keys
    if (Array.isArray(deletedKeys) && deletedKeys.length > 0) {
      const localDel = localStorage.getItem(STORAGE_KEY_DELETED_PROJECTS);
      if (!localDel) {
        localStorage.setItem(STORAGE_KEY_DELETED_PROJECTS, JSON.stringify(deletedKeys));
        hasUpdated = true;
      }
    }

    // Hydrate trend exclusions
    if (Array.isArray(trendExclusions) && trendExclusions.length > 0) {
      const localTrend = localStorage.getItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS);
      if (!localTrend) {
        localStorage.setItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS, JSON.stringify(trendExclusions));
        hasUpdated = true;
      }
    }

    // Hydrate snapshots
    if (Array.isArray(snapshots) && snapshots.length > 0) {
      const localSnap = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
      if (!localSnap) {
        localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snapshots));
        hasUpdated = true;
      }
    }

    if (hasUpdated) {
      const merged = getMergedSheetRows();
      window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { merged } }));
      window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: getProjectLinkConfigs() }));
      window.dispatchEvent(new CustomEvent('afs_trend_exclusions_updated', { detail: Array.from(getTrendExcludedProjects()) }));
    } else {
      // If local has custom data but server was empty, push local state to server
      const localConfigs = localStorage.getItem(STORAGE_KEY_PROJECT_LINKS);
      const localRows = localStorage.getItem(STORAGE_KEY_ROWS);
      if (localConfigs || localRows) {
        pushStateToServer();
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Helper to safely write critical configs to localStorage with quota protection
function safeSaveProjectLinks(configs: ProjectLinkConfig[]): boolean {
  const deduped = deduplicateProjectConfigs(configs);
  inMemoryProjectConfigs = deduped;
  let success = false;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(deduped));
    success = true;
  } catch (e) {
    console.warn('Quota exceeded when saving project links. Attempting storage cleanup...', e);
    try {
      // If quota is reached, remove old metadata/temp rows to guarantee room for link configs
      localStorage.removeItem(STORAGE_KEY_META);
      localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(deduped));
      success = true;
    } catch (err) {
      console.error('Critical failure saving project links:', err);
      success = false;
    }
  }
  pushStateToServer();
  return success;
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

  // 4. Auto-discover projects ONLY if user has NOT configured custom project links
  const currentMerged = getMergedSheetRows();
  if (!hasSavedLinksInStorage) {
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
  }

  // Reconcile rowCount & status dynamically
  const reconciled = configs.map(c => {
    const targetProj = c.projectName.trim().toUpperCase();
    const targetSite = (c.siteName || '').trim().toUpperCase();
    const targetYear = c.year ? String(c.year).trim() : '';

    const matchingRows = currentMerged.filter(r => {
      const rProj = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = extractFindingYear(r, targetYear || '2026');

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
    const targetId = config.id || (config.sheetUrl && config.sheetUrl.trim() ? `proj_${targetName}_${targetSite}_${encodeURIComponent(config.sheetUrl.trim().slice(-20))}` : getProjectCompositeKey(targetName, targetSite, targetYear));
    const targetKey = getProjectCompositeKey(targetName, targetSite, targetYear);

    // Remove from deleted list if explicitly saved/re-added by user
    removeDeletedProjectKey(targetKey, targetName);
    if (config.id) removeDeletedProjectKey(config.id);

    const configs = getProjectLinkConfigs();

    const existingIndex = configs.findIndex(c => {
      if (config.id && c.id) return c.id === config.id;
      if (config.sheetUrl && c.sheetUrl && config.sheetUrl.trim() === c.sheetUrl.trim()) return true;
      const cKey = c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year);
      return cKey === targetKey;
    });

    if (existingIndex >= 0) {
      const existing = configs[existingIndex];
      configs[existingIndex] = {
        ...existing,
        ...config,
        id: existing.id || targetId,
        projectName: targetName,
        year: targetYear !== undefined ? targetYear : existing.year,
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
        id: targetId,
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

    // If a year is defined, propagate this year to matching rows in localStorage as well
    if (targetYear) {
      const customRows = getCustomSyncedRows();
      if (customRows && customRows.length > 0) {
        let modified = false;
        const updated = customRows.map(r => {
          const rProj = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
          const rSite = (r['SITE'] || '').trim().toUpperCase();
          const projMatches = rProj === targetName || targetName.includes(rProj) || rProj.includes(targetName);
          const siteMatches = !targetSite || targetSite === 'HEAD OFFICE' || rSite === targetSite || targetName.includes(rSite);

          if (projMatches && siteMatches) {
            modified = true;
            return {
              ...r,
              'PERIODE AUDIT': targetYear
            };
          }
          return r;
        });

        if (modified) {
          localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('afs_data_synced', { detail: { merged: updated } }));
        }
      }
    }

    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: configs }));
  } catch (err) {
    console.error('Error saving project link config:', err);
  }
}

export function deleteProjectLinkConfigById(configId: string) {
  try {
    if (!configId) return;
    const targetId = configId.trim();
    addDeletedProjectKey(targetId);

    inMemoryProjectConfigs = null;
    const configs = getProjectLinkConfigs();
    const filtered = configs.filter(c => (c.id || '') !== targetId);
    safeSaveProjectLinks(filtered);

    window.dispatchEvent(new CustomEvent('afs_project_links_updated', { detail: filtered }));
  } catch (err) {
    console.error('Error deleting project link config by ID:', err);
  }
}

export function deleteProjectLinkConfig(projectName: string, siteName?: string, year?: string | number) {
  try {
    const targetName = projectName.trim().toUpperCase();
    const targetSite = (siteName || '').trim().toUpperCase();
    const targetYear = year ? String(year).trim() : '';
    const targetKey = getProjectCompositeKey(targetName, targetSite, targetYear);

    // Persist specific composite key as deleted
    addDeletedProjectKey(targetKey);
    if (!targetSite && !targetYear) {
      addDeletedProjectKey(targetName);
    }

    inMemoryProjectConfigs = null;

    const deletedKeys = getDeletedProjectKeys();
    const configs = getProjectLinkConfigs();
    const filtered = configs.filter(c => {
      const cProj = (c.projectName || '').trim().toUpperCase();
      const cSite = (c.siteName || '').trim().toUpperCase();
      const cYear = c.year ? String(c.year).trim() : '';
      const cKey = c.id || getProjectCompositeKey(cProj, cSite, cYear);

      if (deletedKeys.has(cKey)) return false;
      if (cKey === targetKey) return false;
      if (!targetSite && !targetYear && (cProj === targetName || deletedKeys.has(cProj))) return false;
      return true;
    });
    
    safeSaveProjectLinks(filtered);

    // Also remove rows belonging to this specific project & site & year
    const customRows = getCustomSyncedRows() || [];
    const remainingRows = customRows.filter(r => {
      const rName = (r['PROJECT AUDIT'] || '').trim().toUpperCase();
      const rSite = (r['SITE'] || '').trim().toUpperCase();
      const rYear = String(r['PERIODE AUDIT'] || r['TAHUN'] || r['YEAR'] || '').trim();
      const rKey = getProjectCompositeKey(rName, rSite, rYear);

      if (deletedKeys.has(rKey)) return false;
      if (rKey === targetKey) return false;
      if (!targetSite && !targetYear && (rName === targetName || deletedKeys.has(rName))) return false;
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
      timestamp: '2026-08-17T00:00:00.000Z',
      date: '2026-08-17',
      note: 'Cut-Off Baseline Awal Minggu: 17 Agustus 2026 (00:00 WIB)',
      sourceType: 'initial',
      totalRows: 1046,
      closedRows: 860,
      openRows: 162,
      progressRows: 24,
      closeRate: 77.83,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 130, open: 15, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 81.97 },
        { projectName: 'IP BAYAN', total: 166, closed: 116, open: 45, progress: 5, closeRate: 69.88, siteRate: 80.60, hoRate: 50.94 },
        { projectName: 'AGM', total: 43, closed: 34, open: 7, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 22, open: 7, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
        { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
      ]
    },
    {
      id: 'snap_2026_08_18',
      timestamp: '2026-08-18T00:00:00.000Z',
      date: '2026-08-18',
      note: 'Cut-Off Harian Baseline: 18 Agustus 2026 (00:00 WIB)',
      sourceType: 'manual',
      totalRows: 1046,
      closedRows: 860,
      openRows: 162,
      progressRows: 24,
      closeRate: 77.83,
      projectStats: [
        { projectName: 'CDI', total: 147, closed: 130, open: 15, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 81.97 },
        { projectName: 'IP BAYAN', total: 166, closed: 116, open: 45, progress: 5, closeRate: 69.88, siteRate: 80.60, hoRate: 50.94 },
        { projectName: 'AGM', total: 43, closed: 34, open: 7, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
        { projectName: 'MAS', total: 31, closed: 22, open: 7, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
        { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
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
        const updated = parsed.map(s => {
          if (s.id === 'snap_2026_08_17' || s.id === 'snap_2026_08_18' || s.sourceType === 'initial') {
            return {
              ...s,
              projectStats: [
                { projectName: 'CDI', total: 147, closed: 130, open: 15, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 81.97 },
                { projectName: 'IP BAYAN', total: 166, closed: 116, open: 45, progress: 5, closeRate: 69.88, siteRate: 80.60, hoRate: 50.94 },
                { projectName: 'AGM', total: 43, closed: 34, open: 7, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
                { projectName: 'MAS', total: 31, closed: 22, open: 7, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
                { projectName: 'IT', total: 222, closed: 112, open: 103, progress: 7, closeRate: 51.40, siteRate: 74.07, hoRate: 50.51 },
                { projectName: 'PR-PAYMENT', total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
              ]
            };
          }
          return s;
        });
        return updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
  sourceType: 'sync' | 'manual' | 'initial' | 'edit' = 'sync',
  customDate?: string
): AchievementSnapshot {
  const rows = getMergedSheetRows();
  const now = new Date();
  const dateStr = customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate.trim()) 
    ? customDate.trim() 
    : now.toISOString().split('T')[0];

  const timestampStr = customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate.trim())
    ? `${customDate.trim()}T00:00:00.000Z`
    : now.toISOString();

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
    timestamp: timestampStr,
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
  pushStateToServer();
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
// DAILY 09:00 CUT-OFF & GOOGLE DRIVE AUTO-BACKUP ENGINE
// ----------------------------------------------------
const STORAGE_KEY_DAILY_CUTOFF_CONFIG = 'iams_daily_cutoff_config_v1';
const STORAGE_KEY_DAILY_CUTOFF_LOGS = 'iams_daily_cutoff_logs_v1';

export interface DailyCutoffConfig {
  enabled: boolean;
  autoDriveBackup: boolean;
  cutoffHour: number; // default 9 (09:00 WIB)
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
        cutoffHour: typeof parsed.cutoffHour === 'number' ? parsed.cutoffHour : 9,
        cutoffMinute: typeof parsed.cutoffMinute === 'number' ? parsed.cutoffMinute : 0,
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
    cutoffHour: 9,
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

// ----------------------------------------------------
// DYNAMIC WEEKLY BASELINE & STATE MANAGEMENT (SENIN - MINGGU)
// ----------------------------------------------------
export interface WeeklyProjectMetric {
  total: number;
  closed: number;
  open: number;
  progress: number;
  closeRate: number;
  siteRate: number;
  hoRate: number;
}

export interface WeeklyBaselineStorage {
  mondayDate: string; // YYYY-MM-DD
  sundayDate: string; // YYYY-MM-DD
  weekNumber: number;
  year: number;
  snapshotTimestamp: string;
  isLocked: boolean;
  overall: {
    total: number;
    closed: number;
    open: number;
    progress: number;
    closeRate: number;
    siteRate: number;
    hoRate: number;
  };
  byProject: Record<string, WeeklyProjectMetric>;
}

const STORAGE_KEY_WEEKLY_BASELINE = 'iams_weekly_baseline_storage_v2';

export function getMondaySundayDateRange(targetDate = new Date()): { mondayStr: string; sundayStr: string; weekNum: number; year: number } {
  const curr = new Date(targetDate);
  const day = curr.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(curr.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  // Calculate ISO week number
  const tempDate = new Date(monday.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  return {
    mondayStr: formatIso(monday),
    sundayStr: formatIso(sunday),
    weekNum,
    year: monday.getFullYear()
  };
}

export const STANDARD_USER_BASELINE_JSON = [
  {
    id: 1,
    project: "CDI",
    type: "Audit Operational Project",
    total_sebelumnya: 88.19,
    progress_site: 92.98,
    progress_ho: 81.97
  },
  {
    id: 2,
    project: "IP Bayan",
    type: "Audit Operational Project",
    total_sebelumnya: 69.88,
    progress_site: 80.00,
    progress_ho: 50.00
  },
  {
    id: 3,
    project: "AGM",
    type: "Closing Project",
    total_sebelumnya: 79.07,
    progress_site: 73.91,
    progress_ho: 83.87
  },
  {
    id: 4,
    project: "MAS",
    type: "Closing Project",
    total_sebelumnya: 70.97,
    progress_site: 83.33,
    progress_ho: 52.94
  },
  {
    id: 5,
    project: "IT",
    type: "Audit Operational Project",
    total_sebelumnya: 50.47,
    progress_site: 74.07,
    progress_ho: 49.49
  },
  {
    id: 6,
    project: "PR-Payment",
    type: "Audit Operational Project",
    total_sebelumnya: 49.46,
    progress_site: 56.25,
    progress_ho: 50.00
  }
];

export function getWeeklyBaselineData(): WeeklyBaselineStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_BASELINE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.byProject && Object.keys(parsed.byProject).length > 0) {
        parsed.byProject['CDI'] = { total: 147, closed: 130, open: 15, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 81.97 };
        parsed.byProject['IP BAYAN'] = { total: 166, closed: 116, open: 45, progress: 5, closeRate: 69.88, siteRate: 80.60, hoRate: 50.94 };
        parsed.byProject['AGM'] = { total: 43, closed: 34, open: 7, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 };
        parsed.byProject['MAS'] = { total: 31, closed: 22, open: 7, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 };
        parsed.byProject['IT'] = { total: 222, closed: 112, open: 103, progress: 7, closeRate: 51.40, siteRate: 74.07, hoRate: 50.51 };
        parsed.byProject['PR-PAYMENT'] = { total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 };
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading weekly baseline:', e);
  }

  // Seed default baseline corresponding to user's audited initial week rates
  const { mondayStr, sundayStr, weekNum, year } = getMondaySundayDateRange();
  const defaultWeekly: WeeklyBaselineStorage = {
    mondayDate: mondayStr,
    sundayDate: sundayStr,
    weekNumber: weekNum,
    year,
    snapshotTimestamp: `${mondayStr}T00:00:00.000Z`,
    isLocked: true,
    overall: {
      total: 1046,
      closed: 814,
      open: 208,
      progress: 24,
      closeRate: 77.83,
      siteRate: 80.76,
      hoRate: 74.88
    },
    byProject: {
      'CDI': { total: 147, closed: 130, open: 15, progress: 2, closeRate: 88.19, siteRate: 92.98, hoRate: 81.97 },
      'IP BAYAN': { total: 166, closed: 116, open: 45, progress: 5, closeRate: 69.88, siteRate: 80.60, hoRate: 50.94 },
      'AGM': { total: 43, closed: 34, open: 7, progress: 2, closeRate: 79.07, siteRate: 73.91, hoRate: 83.87 },
      'MAS': { total: 31, closed: 22, open: 7, progress: 2, closeRate: 70.97, siteRate: 83.33, hoRate: 52.94 },
      'IT': { total: 222, closed: 112, open: 103, progress: 7, closeRate: 50.47, siteRate: 74.07, hoRate: 49.49 },
      'PR-PAYMENT': { total: 93, closed: 46, open: 46, progress: 1, closeRate: 49.46, siteRate: 56.25, hoRate: 50.00 }
    }
  };

  saveWeeklyBaselineData(defaultWeekly);
  return defaultWeekly;
}

export function saveWeeklyBaselineData(data: WeeklyBaselineStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY_WEEKLY_BASELINE, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('iams_weekly_baseline_updated', { detail: data }));
  } catch (e) {
    console.error('Error saving weekly baseline:', e);
  }
}


