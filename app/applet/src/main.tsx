import "./index.css";
import "./App";
import { saveRiskRegister, deleteRiskRegister, fetchLiveRiskRegister } from "./services/api";
import { 
  convertRiskRegisterToErm, 
  convertErmToRiskRegister, 
  syncRiskRegisterToUI2, 
  syncErmRiskToUI1, 
  syncDeleteRiskFromAll, 
  initializeBidirectionalRiskSync,
  UI1_STORAGE_KEY,
  UI2_STORAGE_KEY
} from "./services/riskSync";

// Expose risk register operations & sync engine to global window for seamless binding across all UI modules
(window as any).saveRiskRegister = saveRiskRegister;
(window as any).deleteRiskRegister = deleteRiskRegister;
(window as any).fetchLiveRiskRegister = fetchLiveRiskRegister;
(window as any).convertRiskRegisterToErm = convertRiskRegisterToErm;
(window as any).convertErmToRiskRegister = convertErmToRiskRegister;
(window as any).syncRiskRegisterToUI2 = syncRiskRegisterToUI2;
(window as any).syncErmRiskToUI1 = syncErmRiskToUI1;
(window as any).syncDeleteRiskFromAll = syncDeleteRiskFromAll;
(window as any).initializeBidirectionalRiskSync = initializeBidirectionalRiskSync;

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

// Hydrate state from server on startup and run bidirectional risk sync
if (typeof window !== "undefined") {
  initializeBidirectionalRiskSync();

  fetch("/api/app-state")
    .then(r => r.json())
    .then(data => {
      if (data && data.state) {
        const { customRows, projectConfigs, riskRegisterItems } = data.state;
        if (Array.isArray(customRows) && customRows.length > 0 && !localStorage.getItem("afs_synced_custom_rows_v2") && !localStorage.getItem("iarms_custom_rows_v1")) {
          localStorage.setItem("afs_synced_custom_rows_v2", JSON.stringify(customRows));
          localStorage.setItem("iarms_custom_rows_v1", JSON.stringify(customRows));
        }
        if (Array.isArray(projectConfigs) && projectConfigs.length > 0 && !localStorage.getItem("afs_project_links_v1") && !localStorage.getItem("iarms_project_links_v1")) {
          localStorage.setItem("afs_project_links_v1", JSON.stringify(projectConfigs));
          localStorage.setItem("iarms_project_links_v1", JSON.stringify(projectConfigs));
        }
        if (Array.isArray(riskRegisterItems) && riskRegisterItems.length > 0) {
          if (!localStorage.getItem(UI1_STORAGE_KEY)) {
            localStorage.setItem(UI1_STORAGE_KEY, JSON.stringify(riskRegisterItems));
          }
          if (!localStorage.getItem(UI2_STORAGE_KEY)) {
            const ermItems = riskRegisterItems.map(convertRiskRegisterToErm);
            localStorage.setItem(UI2_STORAGE_KEY, JSON.stringify(ermItems));
          }
          initializeBidirectionalRiskSync();
        }
      }
    })
    .catch(() => {});

  fetch("/api/employees")
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data.employees) && data.employees.length > 0) {
        const key = "iarms_custom_employees_v3";
        const cur = localStorage.getItem(key);
        if (!cur || cur === "[]") {
          localStorage.setItem(key, JSON.stringify(data.employees));
        }
      }
    })
    .catch(() => {});
}

import "./bundle.js";
