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

// Hydrate state from server on startup if local storage is unseeded
if (typeof window !== "undefined") {
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
        if (Array.isArray(riskRegisterItems) && riskRegisterItems.length > 0 && !localStorage.getItem("iarms_custom_risk_register_items")) {
          localStorage.setItem("iarms_custom_risk_register_items", JSON.stringify(riskRegisterItems));
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
