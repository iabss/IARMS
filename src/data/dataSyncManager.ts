import { AFSFindingRecord, ProjectLinkConfig, AchievementSnapshot, SyncMetadata } from "../types";
import { isStatusClosed, isStatusOpen, extractFindingYear } from "../utils/statusHelper";
import { isDepartment } from "../utils/deptHelper";
import { syncBatchToGAS, syncProjectsListToGAS, fetchLiveFindingsFromGAS, isStaticHosting } from "../services/gasService";

const STORAGE_KEY_ROWS = "afs_synced_custom_rows_v2";
const STORAGE_KEY_META = "afs_synced_metadata_v2";
const STORAGE_KEY_CLEARED = "afs_data_is_cleared_v2";
const STORAGE_KEY_PROJECT_LINKS = "afs_project_links_v1";
const STORAGE_KEY_DELETED_PROJECTS = "afs_deleted_project_keys_v1";
const STORAGE_KEY_SNAPSHOTS = "afs_achievement_snapshots_v2";
const STORAGE_KEY_TREND_EXCLUDED_PROJECTS = "afs_trend_excluded_projects_v1";

let inMemoryProjectConfigs: ProjectLinkConfig[] | null = null;

export function getProjectCompositeKey(proj: string, site?: string, year?: string | number): string {
  const p = (proj || "").trim().toUpperCase();
  const s = (site || "HEAD OFFICE").trim().toUpperCase();
  const y = year ? String(year).trim() : "";
  return `${p}|${s}${y ? `|${y}` : ""}`;
}

export function deduplicateProjectConfigs(configs: ProjectLinkConfig[]): ProjectLinkConfig[] {
  const map = new Map<string, ProjectLinkConfig>();
  configs.forEach(c => {
    const k = c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, { ...c, id: k });
    } else {
      const mergedUrl = (c.sheetUrl && c.sheetUrl.trim()) ? c.sheetUrl.trim() : (existing.sheetUrl || "");
      map.set(k, {
        ...existing,
        ...c,
        id: k,
        sheetUrl: mergedUrl,
        status: mergedUrl ? "synced" : (c.status || existing.status || "pending")
      });
    }
  });
  return Array.from(map.values());
}

export function getProjectLinkConfigs(): ProjectLinkConfig[] {
  if (inMemoryProjectConfigs && inMemoryProjectConfigs.length > 0) return inMemoryProjectConfigs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECT_LINKS) || localStorage.getItem("afsProjects") || localStorage.getItem("afs_projects");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryProjectConfigs = deduplicateProjectConfigs(parsed);
        return inMemoryProjectConfigs;
      }
    }
  } catch {}
  return [];
}

export function overrideProjectLinkConfigs(configs: ProjectLinkConfig[]): void {
  const existing = getProjectLinkConfigs();
  const deduped = deduplicateProjectConfigs([...existing, ...configs]);
  inMemoryProjectConfigs = deduped;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECT_LINKS, JSON.stringify(deduped));
    localStorage.setItem("afsProjects", JSON.stringify(deduped));
    localStorage.setItem("afs_projects", JSON.stringify(deduped));
  } catch {}
  window.dispatchEvent(new CustomEvent("afs_project_links_updated", { detail: deduped }));
}

export function saveProjectLinkConfig(config: ProjectLinkConfig): void {
  const current = getProjectLinkConfigs();
  const k = config.id || getProjectCompositeKey(config.projectName, config.siteName, config.year);
  const updated = current.filter(c => (c.id || getProjectCompositeKey(c.projectName, c.siteName, c.year)) !== k);
  const newConfig = { ...config, id: k };
  updated.push(newConfig);
  overrideProjectLinkConfigs(updated);

  try {
    fetch("/api/save-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig)
    }).catch(e => console.warn("Background save project error:", e));
  } catch {}
}

export function deleteProjectLinkConfig(configId: string): void {
  const current = getProjectLinkConfigs();
  const updated = current.filter(c => c.id !== configId && getProjectCompositeKey(c.projectName, c.siteName, c.year) !== configId);
  overrideProjectLinkConfigs(updated);
}

export function getCustomSyncedRows(): AFSFindingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROWS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function getMergedSheetRows(): AFSFindingRecord[] {
  return getCustomSyncedRows();
}

export function saveSyncedRows(rows: AFSFindingRecord[], project = "AFS_SYNC", sourceType = "manual", sheetUrl = ""): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CLEARED);
    localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(rows));
    const meta: SyncMetadata = {
      lastSyncTimestamp: new Date().toISOString(),
      syncedProject: project,
      sourceType: sourceType as any,
      totalSyncedRows: rows.length,
      sheetUrl
    };
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  } catch {}
  window.dispatchEvent(new CustomEvent("afs_data_synced", { detail: { count: rows.length } }));
}

export function getSyncMetadata(): SyncMetadata | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function getDeletedProjectKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_PROJECTS);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function getTrendExcludedProjects(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveTrendExcludedProjects(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TREND_EXCLUDED_PROJECTS, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new CustomEvent("afs_trend_excluded_updated", { detail: list }));
}

export function getAchievementSnapshots(): AchievementSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveAchievementSnapshots(snaps: AchievementSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(snaps));
  } catch {}
}

export function createAchievementSnapshot(
  note = "Snapshot Cut-off",
  sourceType: "sync" | "manual" | "initial" | "edit" = "manual",
  customDate?: string
): AchievementSnapshot {
  const rows = getMergedSheetRows();
  const dateStr = customDate || new Date().toISOString().split("T")[0];
  let totalRows = rows.length;
  let closedRows = 0;
  let openRows = 0;
  let progressRows = 0;

  const projMap = new Map<string, { total: number; closed: number; open: number; progress: number; siteTotal: number; siteClosed: number; hoTotal: number; hoClosed: number }>();

  rows.forEach(r => {
    const isClose = isStatusClosed(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"]);
    const isOpen = isStatusOpen(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"]);
    if (isClose) closedRows++;
    else if (isOpen) openRows++;
    else progressRows++;

    const rawProj = (r["PROJECT AUDIT"] || "LAINNYA").trim().toUpperCase();
    if (!projMap.has(rawProj)) {
      projMap.set(rawProj, { total: 0, closed: 0, open: 0, progress: 0, siteTotal: 0, siteClosed: 0, hoTotal: 0, hoClosed: 0 });
    }
    const stat = projMap.get(rawProj)!;
    stat.total++;
    if (isClose) stat.closed++;
    else if (isOpen) stat.open++;
    else stat.progress++;

    const picSiteStr = (r["PIC SITE"] || "").trim();
    const picHOStr = (r["PIC HO"] || "").trim();

    if (picSiteStr && picSiteStr !== "-" && picSiteStr !== "0" && isDepartment(picSiteStr)) {
      stat.siteTotal++;
      if (isClose) stat.siteClosed++;
    }
    if (picHOStr && picHOStr !== "-" && picHOStr !== "0" && isDepartment(picHOStr)) {
      stat.hoTotal++;
      if (isClose) stat.hoClosed++;
    }
  });

  const closeRate = totalRows > 0 ? parseFloat(((closedRows / totalRows) * 100).toFixed(2)) : 0;
  const projectStats = Array.from(projMap.entries()).map(([pName, st]) => {
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

  const snap: AchievementSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
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
  existing.push(snap);
  saveAchievementSnapshots(existing);
  return snap;
}

export async function syncWithServer(): Promise<boolean> {
  try {
    try {
      const res = await fetch("/api/afs-projects");
      if (res.ok) {
        const data = await res.json();
        const serverProjects = data.afs_projects || data.projects;
        if (Array.isArray(serverProjects) && serverProjects.length > 0) {
          overrideProjectLinkConfigs(serverProjects);
        }
      }
    } catch (e) {
      console.warn("[syncWithServer] Backend fetch warning:", e);
    }

    const gasData = await fetchLiveFindingsFromGAS();
    if (gasData && gasData.success && Array.isArray(gasData.rows) && gasData.rows.length > 0) {
      saveSyncedRows(gasData.rows, "GAS_LIVE", "sync");
      if (Array.isArray(gasData.projects) && gasData.projects.length > 0) {
        overrideProjectLinkConfigs(gasData.projects);
      }
      return true;
    }
  } catch (e) {
    console.warn("[syncWithServer] Error:", e);
  }
  return false;
}

export async function autoSyncAllProjects(): Promise<{ totalRows: number; syncedCount: number }> {
  const success = await syncWithServer();
  const rows = getMergedSheetRows();
  return { totalRows: rows.length, syncedCount: success ? 1 : 0 };
}
