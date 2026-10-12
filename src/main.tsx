import "./index.css";
import "./App";
import { saveRiskRegister, deleteRiskRegister, fetchLiveRiskRegister } from "./services/api";

// Expose risk register operations to global window for seamless binding across all UI modules
(window as any).saveRiskRegister = saveRiskRegister;
(window as any).deleteRiskRegister = deleteRiskRegister;
(window as any).fetchLiveRiskRegister = fetchLiveRiskRegister;

// In iframe environments, window.confirm may be silently suppressed by the sandbox.
// Safe fallback prevents actions from being swallowed silently.
if (typeof window !== "undefined") {
  const _origConfirm = window.confirm ? window.confirm.bind(window) : null;
  window.confirm = (msg?: string) => {
    try {
      if (_origConfirm) {
        const res = _origConfirm(msg);
        return res !== false;
      }
    } catch {}
    return true;
  };
}

// ============================================================================
// UNIFIED APP-STATE & LOCAL MENU SYNCHRONIZATION (OPTION D)
// Automatically persists and hydrates all menus across the application:
// - Timeframe Audit (Stages & Milestones)
// - Master Data Karyawan (Employees Directory)
// - Tim Internal Audit (IA Members)
// - Konfigurasi Akses Menu & Auditee
// - Manajemen User & Permissions
// - Daily Cut-off Configuration & Logs
// - Field Mobile Audit (Evidence Submissions)
// - Enterprise Risk Management (ERM Risks & KRIs)
// - Risk Register & Company Risk Profile
// - Project Configs, Snapshots, Custom Rows, Trend Exclusions
// ============================================================================

const STORAGE_KEYS = {
  TIMEFRAME_STAGES: "iams_timeframe_stages_v3",
  TIMEFRAME_MILESTONES: "iams_timeframe_milestones_v3",
  MASTER_EMPLOYEES: "iarms_custom_master_employees",
  MASTER_EMPLOYEES_ALT: "iarms_custom_employees_v3",
  IA_MEMBERS: "iarms_ia_members_v3",
  AUDITEE_MENUS: "iarms_auditee_menus_config_v3",
  REGISTERED_USERS: "iarms_registered_users_v3",
  MENU_PERMISSIONS: "iarms_menu_permissions_v3",
  DAILY_CUTOFF_CONFIG: "iams_daily_cutoff_config_v1",
  DAILY_CUTOFF_LOGS: "iams_daily_cutoff_logs_v1",
  EVIDENCE_SUBMISSIONS: "iarms_evidence_submissions_v1",
  ERM_RISKS: "erm_dashboard_risks_v2",
  ERM_KRIS: "erm_dashboard_kris_v2",
  CUSTOM_RISKS: "iarms_custom_risk_register_items",
  COMPANY_RISKS: "company_risk_register_items",
  COMPANY_RISK_LINK: "company_risk_profile_link",
  BACKUP_HISTORY: "iams_recent_backups_v2",
  PROJECT_CONFIGS: "afs_project_links_v1",
  PROJECT_CONFIGS_ALT: "iarms_project_links_v1",
  PROJECT_CONFIGS_AFS: "afsProjects",
  CUSTOM_ROWS: "afs_synced_custom_rows_v2",
  CUSTOM_ROWS_ALT: "iarms_custom_rows_v1",
  DELETED_KEYS: "afs_deleted_project_keys_v1",
  TREND_EXCLUSIONS: "afs_trend_excluded_projects_v1",
  SNAPSHOTS: "afs_achievement_snapshots_v2"
};

function safeJsonParse(val: string | null): any {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

let isHydrating = false;
let syncDebounceTimer: any = null;

// Collects state of all local menus into a unified payload for /api/app-state
export function gatherAllMenuPayload() {
  if (typeof window === "undefined") return {};

  const payload: Record<string, any> = {};

  // 1. Timeframe
  const stages = safeJsonParse(localStorage.getItem(STORAGE_KEYS.TIMEFRAME_STAGES));
  if (Array.isArray(stages)) payload.timeframeStages = stages;

  const milestones = safeJsonParse(localStorage.getItem(STORAGE_KEYS.TIMEFRAME_MILESTONES));
  if (Array.isArray(milestones)) payload.timeframeMilestones = milestones;

  // 2. Employees & IA Team
  const employees = safeJsonParse(localStorage.getItem(STORAGE_KEYS.MASTER_EMPLOYEES) || localStorage.getItem(STORAGE_KEYS.MASTER_EMPLOYEES_ALT));
  if (Array.isArray(employees)) payload.customMasterEmployees = employees;

  const iaMembers = safeJsonParse(localStorage.getItem(STORAGE_KEYS.IA_MEMBERS));
  if (Array.isArray(iaMembers)) payload.iaMembers = iaMembers;

  // 3. User & Menu Permissions
  const auditeeMenus = safeJsonParse(localStorage.getItem(STORAGE_KEYS.AUDITEE_MENUS));
  if (Array.isArray(auditeeMenus)) payload.auditeeMenusConfig = auditeeMenus;

  const users = safeJsonParse(localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS));
  if (Array.isArray(users)) payload.registeredUsers = users;

  const perms = safeJsonParse(localStorage.getItem(STORAGE_KEYS.MENU_PERMISSIONS));
  if (perms && typeof perms === "object") payload.menuPermissions = perms;

  // 4. Daily Cut-off
  const cutoffConfig = safeJsonParse(localStorage.getItem(STORAGE_KEYS.DAILY_CUTOFF_CONFIG));
  if (cutoffConfig) payload.dailyCutoffConfig = cutoffConfig;

  const cutoffLogs = safeJsonParse(localStorage.getItem(STORAGE_KEYS.DAILY_CUTOFF_LOGS));
  if (Array.isArray(cutoffLogs)) payload.dailyCutoffLogs = cutoffLogs;

  // 5. Mobile Field Evidence
  const evidence = safeJsonParse(localStorage.getItem(STORAGE_KEYS.EVIDENCE_SUBMISSIONS));
  if (Array.isArray(evidence)) payload.evidenceSubmissions = evidence;

  // 6. ERM Dashboard
  const ermRisks = safeJsonParse(localStorage.getItem(STORAGE_KEYS.ERM_RISKS));
  if (Array.isArray(ermRisks)) payload.ermRisks = ermRisks;

  const ermKris = safeJsonParse(localStorage.getItem(STORAGE_KEYS.ERM_KRIS));
  if (Array.isArray(ermKris)) payload.ermKris = ermKris;

  // 7. Risk Register
  const risks = safeJsonParse(localStorage.getItem(STORAGE_KEYS.CUSTOM_RISKS));
  if (Array.isArray(risks)) payload.riskRegisterItems = risks;

  const companyRisks = safeJsonParse(localStorage.getItem(STORAGE_KEYS.COMPANY_RISKS));
  if (Array.isArray(companyRisks)) payload.companyRiskRegisterItems = companyRisks;

  const riskLink = safeJsonParse(localStorage.getItem(STORAGE_KEYS.COMPANY_RISK_LINK));
  if (riskLink) payload.companyRiskProfileLink = riskLink;

  // 8. Backups
  const backups = safeJsonParse(localStorage.getItem(STORAGE_KEYS.BACKUP_HISTORY));
  if (Array.isArray(backups)) payload.backupHistory = backups;

  // 9. Core Projects & Findings
  const projects = safeJsonParse(localStorage.getItem(STORAGE_KEYS.PROJECT_CONFIGS) || localStorage.getItem(STORAGE_KEYS.PROJECT_CONFIGS_ALT));
  if (Array.isArray(projects)) payload.projectConfigs = projects;

  const customRows = safeJsonParse(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROWS) || localStorage.getItem(STORAGE_KEYS.CUSTOM_ROWS_ALT));
  if (Array.isArray(customRows)) payload.customRows = customRows;

  const deletedKeys = safeJsonParse(localStorage.getItem(STORAGE_KEYS.DELETED_KEYS));
  if (Array.isArray(deletedKeys)) payload.deletedKeys = deletedKeys;

  const trendExclusions = safeJsonParse(localStorage.getItem(STORAGE_KEYS.TREND_EXCLUSIONS));
  if (Array.isArray(trendExclusions)) payload.trendExclusions = trendExclusions;

  const snapshots = safeJsonParse(localStorage.getItem(STORAGE_KEYS.SNAPSHOTS));
  if (Array.isArray(snapshots)) payload.snapshots = snapshots;

  // 10. Capture any other local storage keys for completeness
  const menuStates: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("iarms_") || k.startsWith("iams_") || k.startsWith("erm_") || k.startsWith("timeframe_") || k.startsWith("kpi_"))) {
      if (!k.includes("expanded_sections") && !k.includes("manual_login")) {
        const val = safeJsonParse(localStorage.getItem(k));
        if (val !== null && val !== undefined) {
          menuStates[k] = val;
        }
      }
    }
  }
  if (Object.keys(menuStates).length > 0) {
    payload.menuStates = menuStates;
  }

  return payload;
}

// Global server sync helper
export async function syncAllMenusToServer(): Promise<boolean> {
  if (typeof window === "undefined" || isHydrating) return false;
  try {
    const payload = gatherAllMenuPayload();
    const res = await fetch("/api/app-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      window.dispatchEvent(new CustomEvent("iarms_server_state_synced", { detail: { success: true, timestamp: new Date().toISOString() } }));
      return true;
    }
  } catch (err) {
    console.warn("[App-State Sync] Failed to sync menu state to server:", err);
  }
  return false;
}

// Debounced wrapper
export function scheduleServerSync(delayMs = 400) {
  if (isHydrating) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncAllMenusToServer();
  }, delayMs);
}

// Expose utilities on window object
if (typeof window !== "undefined") {
  (window as any).syncAllMenusToServer = syncAllMenusToServer;
  (window as any).saveAppState = syncAllMenusToServer;
  (window as any).gatherAllMenuPayload = gatherAllMenuPayload;

  // Intercept localStorage.setItem & removeItem to automatically persist menu updates
  const _origSetItem = localStorage.setItem.bind(localStorage);
  const _origRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = (key: string, value: string) => {
    _origSetItem(key, value);
    if (!isHydrating) {
      if (
        key.startsWith("iarms_") ||
        key.startsWith("iams_") ||
        key.startsWith("erm_") ||
        key.startsWith("afs_") ||
        key.startsWith("risk_") ||
        key.startsWith("company_risk_") ||
        key.startsWith("timeframe_") ||
        key.startsWith("kpi_")
      ) {
        if (!key.includes("expanded_sections") && !key.includes("manual_login")) {
          scheduleServerSync();
        }
      }
    }
  };

  localStorage.removeItem = (key: string) => {
    _origRemoveItem(key);
    if (!isHydrating) {
      if (
        key.startsWith("iarms_") ||
        key.startsWith("iams_") ||
        key.startsWith("erm_") ||
        key.startsWith("afs_")
      ) {
        scheduleServerSync();
      }
    }
  };

  // Hydrate state from server on startup
  fetch("/api/app-state")
    .then(r => r.json())
    .then(data => {
      if (data && data.state) {
        isHydrating = true;
        const state = data.state;

        // 1. Timeframe
        if (Array.isArray(state.timeframeStages) && state.timeframeStages.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.TIMEFRAME_STAGES);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.TIMEFRAME_STAGES, JSON.stringify(state.timeframeStages));
          }
        }
        if (Array.isArray(state.timeframeMilestones) && state.timeframeMilestones.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.TIMEFRAME_MILESTONES);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.TIMEFRAME_MILESTONES, JSON.stringify(state.timeframeMilestones));
          }
        }

        // 2. Employees & IA Members
        if (Array.isArray(state.customMasterEmployees) && state.customMasterEmployees.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.MASTER_EMPLOYEES);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.MASTER_EMPLOYEES, JSON.stringify(state.customMasterEmployees));
            _origSetItem(STORAGE_KEYS.MASTER_EMPLOYEES_ALT, JSON.stringify(state.customMasterEmployees));
          }
        }
        if (Array.isArray(state.iaMembers) && state.iaMembers.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.IA_MEMBERS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.IA_MEMBERS, JSON.stringify(state.iaMembers));
          }
        }

        // 3. User & Menu Permissions
        if (Array.isArray(state.auditeeMenusConfig) && state.auditeeMenusConfig.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.AUDITEE_MENUS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.AUDITEE_MENUS, JSON.stringify(state.auditeeMenusConfig));
          }
        }
        if (Array.isArray(state.registeredUsers) && state.registeredUsers.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(state.registeredUsers));
          }
        }
        if (state.menuPermissions && typeof state.menuPermissions === "object" && Object.keys(state.menuPermissions).length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.MENU_PERMISSIONS);
          if (!cur || cur === "{}") {
            _origSetItem(STORAGE_KEYS.MENU_PERMISSIONS, JSON.stringify(state.menuPermissions));
          }
        }

        // 4. Daily Cut-off
        if (state.dailyCutoffConfig && typeof state.dailyCutoffConfig === "object") {
          const cur = localStorage.getItem(STORAGE_KEYS.DAILY_CUTOFF_CONFIG);
          if (!cur) {
            _origSetItem(STORAGE_KEYS.DAILY_CUTOFF_CONFIG, JSON.stringify(state.dailyCutoffConfig));
            window.dispatchEvent(new CustomEvent("iams_cutoff_config_updated", { detail: state.dailyCutoffConfig }));
          }
        }
        if (Array.isArray(state.dailyCutoffLogs) && state.dailyCutoffLogs.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.DAILY_CUTOFF_LOGS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.DAILY_CUTOFF_LOGS, JSON.stringify(state.dailyCutoffLogs));
            window.dispatchEvent(new CustomEvent("iams_cutoff_log_updated", { detail: state.dailyCutoffLogs }));
          }
        }

        // 5. Mobile Evidence
        if (Array.isArray(state.evidenceSubmissions) && state.evidenceSubmissions.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.EVIDENCE_SUBMISSIONS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.EVIDENCE_SUBMISSIONS, JSON.stringify(state.evidenceSubmissions));
            window.dispatchEvent(new CustomEvent("iarms_new_evidence_submitted", { detail: state.evidenceSubmissions }));
          }
        }

        // 6. ERM Risks & KRIs
        if (Array.isArray(state.ermRisks) && state.ermRisks.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.ERM_RISKS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.ERM_RISKS, JSON.stringify(state.ermRisks));
          }
        }
        if (Array.isArray(state.ermKris) && state.ermKris.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.ERM_KRIS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.ERM_KRIS, JSON.stringify(state.ermKris));
          }
        }

        // 7. Risk Register
        if (Array.isArray(state.riskRegisterItems) && state.riskRegisterItems.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.CUSTOM_RISKS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.CUSTOM_RISKS, JSON.stringify(state.riskRegisterItems));
          }
        }
        if (Array.isArray(state.companyRiskRegisterItems) && state.companyRiskRegisterItems.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.COMPANY_RISKS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.COMPANY_RISKS, JSON.stringify(state.companyRiskRegisterItems));
          }
        }
        if (state.companyRiskProfileLink) {
          const cur = localStorage.getItem(STORAGE_KEYS.COMPANY_RISK_LINK);
          if (!cur) {
            _origSetItem(STORAGE_KEYS.COMPANY_RISK_LINK, JSON.stringify(state.companyRiskProfileLink));
          }
        }

        // 8. Backups
        if (Array.isArray(state.backupHistory) && state.backupHistory.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.BACKUP_HISTORY);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.BACKUP_HISTORY, JSON.stringify(state.backupHistory));
          }
        }

        // 9. Core Projects & Custom Rows
        if (Array.isArray(state.projectConfigs) && state.projectConfigs.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.PROJECT_CONFIGS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.PROJECT_CONFIGS, JSON.stringify(state.projectConfigs));
            _origSetItem(STORAGE_KEYS.PROJECT_CONFIGS_ALT, JSON.stringify(state.projectConfigs));
            _origSetItem(STORAGE_KEYS.PROJECT_CONFIGS_AFS, JSON.stringify(state.projectConfigs));
          }
        }
        if (Array.isArray(state.customRows) && state.customRows.length > 0) {
          const cur = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROWS);
          if (!cur || cur === "[]") {
            _origSetItem(STORAGE_KEYS.CUSTOM_ROWS, JSON.stringify(state.customRows));
            _origSetItem(STORAGE_KEYS.CUSTOM_ROWS_ALT, JSON.stringify(state.customRows));
          }
        }

        // 10. Generic Menu States map
        if (state.menuStates && typeof state.menuStates === "object") {
          for (const [k, v] of Object.entries(state.menuStates)) {
            if (!localStorage.getItem(k) && v !== null && v !== undefined) {
              _origSetItem(k, typeof v === "string" ? v : JSON.stringify(v));
            }
          }
        }

        isHydrating = false;

        // Notify components that server hydration is complete
        window.dispatchEvent(new CustomEvent("iarms_server_state_hydrated", { detail: state }));
        window.dispatchEvent(new CustomEvent("iarms_permissions_changed", { detail: state.menuPermissions }));

        // Initial push of any pre-existing local data to server
        setTimeout(() => {
          syncAllMenusToServer();
        }, 1000);
      }
    })
    .catch((err) => {
      console.warn("[App-State] Hydration error:", err);
      isHydrating = false;
    });
}

import "./bundle.js";
