/**
 * Risk Synchronization Engine between UI 1 (Risk Register) and UI 2 (Enterprise Risk Management / ERM Dashboard)
 * Ensures changes in either interface are instantly reflected in both local storage, React states, and backend Google Apps Script / database.
 */

import { saveRiskRegister, deleteRiskRegister } from "./api";

export const UI1_STORAGE_KEY = "iarms_custom_risk_register_items";
export const UI2_STORAGE_KEY = "erm_dashboard_risks_v2";
export const SYNC_EVENT_NAME = "iarms-risk-sync";

// Helper to determine risk level from score
export function getScoreLevel(score: number): string {
  if (score >= 16) return "Critical";
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

// Convert an item from UI 1 (Risk Register) to UI 2 (ERM Dashboard format)
export function convertRiskRegisterToErm(item: any): any {
  if (!item) return null;
  const code = (item.riskNumber || item.code || `RR-${item.no || Date.now().toString().slice(-4)}`).trim();
  const rawInhLikelihood = parseInt(item.inherentLikelihood, 10);
  const inhLikelihood = isNaN(rawInhLikelihood) || rawInhLikelihood < 1 ? 3 : Math.min(5, rawInhLikelihood);
  
  const rawInhImpact = parseInt(item.inherentImpact, 10);
  const inhImpact = isNaN(rawInhImpact) || rawInhImpact < 1 ? 3 : Math.min(5, rawInhImpact);
  
  const inhScore = inhLikelihood * inhImpact;
  const inhLevel = item.inherentRiskLevel || getScoreLevel(inhScore);

  const rawResLikelihood = parseInt(item.residualLikelihood, 10);
  const resLikelihood = isNaN(rawResLikelihood) || rawResLikelihood < 1 ? 2 : Math.min(5, rawResLikelihood);

  const rawResImpact = parseInt(item.residualImpact, 10);
  const resImpact = isNaN(rawResImpact) || rawResImpact < 1 ? 2 : Math.min(5, rawResImpact);

  const resScore = resLikelihood * resImpact;
  const resLevel = item.residualRiskLevel || getScoreLevel(resScore);

  const desc = item.riskDescription || item.description || "";
  const title = (desc.split("\n")[0] || desc).trim() || item.title || `Risiko ${code}`;

  return {
    id: item.id || `rsk-${code.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    code: code,
    title: title.slice(0, 120),
    description: desc,
    rootCause: item.businessProcess || item.rootCause || item.activity || "",
    consequences: item.lossEvent || item.consequences || "",
    site: (item.site || "HO").trim(),
    category: item.executiveCategory || item.category || "Operational",
    department: (item.department || "OPERATIONAL").trim(),
    owner: item.pic || item.owner || "Tim Manajemen Risiko",
    inherentLikelihood: inhLikelihood,
    inherentImpact: inhImpact,
    inherentScore: inhScore,
    inherentLevel: inhLevel,
    inherentWorstCaseScenario: item.inherentNotes || item.lossEvent || "",
    existingControls: item.controlDescription || item.existingControls || "Standard Operating Procedure (SOP) divisi.",
    controlEffectiveness: item.controlEffectiveness || "Adequate",
    mitigationPlan: item.treatmentPlan || item.mitigationPlan || "Rencana mitigasi dan perbaikan berkala.",
    mitigationProgress: typeof item.mitigationProgress === "number" ? item.mitigationProgress : (item.controlStatus === "Closed" ? 100 : 35),
    residualLikelihood: resLikelihood,
    residualImpact: resImpact,
    residualScore: resScore,
    residualLevel: resLevel,
    riskAppetiteStatus: resScore <= 9 ? "Within Appetite" : "At Limit",
    status: item.controlStatus === "Closed" ? "Closed" : (item.status || "Mitigating"),
    financialImpactEstimate: item.inherentFinImpact || item.financialImpactEstimate || "1 - 50 Juta",
    velocity: item.velocity || "Moderate",
    lastReviewDate: item.updatedAt ? item.updatedAt.split("T")[0] : new Date().toISOString().split("T")[0],
    targetDate: item.dueDate || item.targetDate || "2026-12-31",
    quarter: item.quarter || "Q3 2026",
    actionItems: Array.isArray(item.actionItems) && item.actionItems.length > 0 ? item.actionItems : (
      item.treatmentPlan ? [{
        id: `act-${Date.now()}`,
        action: item.treatmentPlan,
        assignee: item.pic || "Tim Pelaksana",
        dueDate: item.dueDate || "2026-12-31",
        completed: item.controlStatus === "Closed",
        status: item.controlStatus === "Closed" ? "Completed" : "In Progress"
      }] : []
    )
  };
}

// Convert an item from UI 2 (ERM Dashboard format) to UI 1 (Risk Register format)
export function convertErmToRiskRegister(item: any): any {
  if (!item) return null;
  const code = (item.code || item.id || `RR-${Date.now().toString().slice(-4)}`).trim();
  const inhL = String(item.inherentLikelihood || 3);
  const inhI = String(item.inherentImpact || 3);
  const resL = String(item.residualLikelihood || 2);
  const resI = String(item.residualImpact || 2);

  return {
    no: item.no || String(Date.now()).slice(-4),
    riskNumber: code,
    site: item.site || "HO",
    department: (item.department || "OPERATIONAL").trim().toUpperCase(),
    companyObjective: item.companyObjective || "",
    kpiObjective: item.kpiObjective || "",
    businessProcess: item.rootCause || item.businessProcess || "",
    activity: item.description || item.activity || "",
    riskDescription: item.description || item.title || "",
    top10Risk: item.top10Risk || "0",
    executiveCategory: item.category || "OPERATIONAL",
    lossEvent: item.consequences || item.lossEvent || "",
    inherentLikelihood: inhL,
    inherentImpact: inhI,
    inherentRiskLevel: item.inherentLevel || getScoreLevel(Number(inhL) * Number(inhI)),
    inherentFinImpact: item.financialImpactEstimate || "",
    inherentNotes: item.inherentWorstCaseScenario || "",
    controlDescription: item.existingControls || "",
    controlStatus: item.status === "Closed" ? "Closed" : "Active",
    controlEffectiveness: item.controlEffectiveness || "Adequate",
    residualLikelihood: resL,
    residualImpact: resI,
    residualRiskLevel: item.residualLevel || getScoreLevel(Number(resL) * Number(resI)),
    residualFinImpact: item.residualFinImpact || "",
    residualNotes: item.residualNotes || "",
    treatmentPlan: item.mitigationPlan || "",
    pic: item.owner || "",
    dueDate: item.targetDate || "2026-12-31",
    expectedRiskLevel: item.residualLevel || "Low",
    syncStatus: "synced"
  };
}

// Sync from UI 1 into UI 2
export function syncRiskRegisterToUI2(ui1Item: any): void {
  if (!ui1Item) return;
  try {
    const ermItem = convertRiskRegisterToErm(ui1Item);
    const raw = localStorage.getItem(UI2_STORAGE_KEY);
    let items: any[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const idx = items.findIndex(it => it.code === ermItem.code || it.id === ermItem.id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...ermItem };
    } else {
      items.unshift(ermItem);
    }

    localStorage.setItem(UI2_STORAGE_KEY, JSON.stringify(items));
    dispatchSyncEvent({ source: "ui1", item: ermItem });
  } catch (err) {
    console.error("Failed to sync Risk Register to UI 2:", err);
  }
}

// Sync from UI 2 into UI 1 and backend
export function syncErmRiskToUI1(ermItem: any): void {
  if (!ermItem) return;
  try {
    const rrItem = convertErmToRiskRegister(ermItem);
    const raw = localStorage.getItem(UI1_STORAGE_KEY);
    let items: any[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const idx = items.findIndex(it => it.riskNumber === rrItem.riskNumber || it.code === rrItem.riskNumber);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...rrItem };
    } else {
      items.unshift(rrItem);
    }

    localStorage.setItem(UI1_STORAGE_KEY, JSON.stringify(items));

    // Save to backend database & Google Apps Script
    saveRiskRegister(rrItem).catch(err => {
      console.warn("Auto save risk from UI 2 to backend:", err);
    });

    dispatchSyncEvent({ source: "ui2", item: rrItem });
  } catch (err) {
    console.error("Failed to sync ERM to UI 1:", err);
  }
}

// Sync deletion across both interfaces and backend
export function syncDeleteRiskFromAll(identifier: string): void {
  if (!identifier) return;
  try {
    // 1. Remove from UI 1 storage
    const rawUi1 = localStorage.getItem(UI1_STORAGE_KEY);
    if (rawUi1) {
      try {
        const list1 = JSON.parse(rawUi1);
        if (Array.isArray(list1)) {
          const filtered1 = list1.filter(it => it.riskNumber !== identifier && it.code !== identifier && it.id !== identifier);
          localStorage.setItem(UI1_STORAGE_KEY, JSON.stringify(filtered1));
        }
      } catch {}
    }

    // 2. Remove from UI 2 storage
    const rawUi2 = localStorage.getItem(UI2_STORAGE_KEY);
    if (rawUi2) {
      try {
        const list2 = JSON.parse(rawUi2);
        if (Array.isArray(list2)) {
          const filtered2 = list2.filter(it => it.code !== identifier && it.id !== identifier && it.riskNumber !== identifier);
          localStorage.setItem(UI2_STORAGE_KEY, JSON.stringify(filtered2));
        }
      } catch {}
    }

    // 3. Delete from backend / GAS
    deleteRiskRegister(identifier).catch(err => {
      console.warn("Delete risk backend call:", err);
    });

    dispatchSyncEvent({ source: "delete", identifier });
  } catch (err) {
    console.error("Failed to delete risk across interfaces:", err);
  }
}

export function dispatchSyncEvent(detail: any): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail }));
    } catch {}
  }
}

/**
 * Initialize bidirectional synchronization on startup.
 * Seeds UI 2 from UI 1 custom items or baseline items if UI 2 is empty.
 */
export function initializeBidirectionalRiskSync(): void {
  if (typeof window === "undefined") return;

  try {
    const rawUi1 = localStorage.getItem(UI1_STORAGE_KEY);
    const rawUi2 = localStorage.getItem(UI2_STORAGE_KEY);

    let list1: any[] = [];
    if (rawUi1) {
      try {
        const p = JSON.parse(rawUi1);
        if (Array.isArray(p)) list1 = p;
      } catch {}
    }

    let list2: any[] = [];
    if (rawUi2) {
      try {
        const p = JSON.parse(rawUi2);
        if (Array.isArray(p)) list2 = p;
      } catch {}
    }

    // If UI 2 is empty but UI 1 has custom items, populate UI 2
    if (list2.length === 0 && list1.length > 0) {
      const converted = list1.map(convertRiskRegisterToErm);
      localStorage.setItem(UI2_STORAGE_KEY, JSON.stringify(converted));
    } else if (list1.length > 0) {
      // Merge any UI 1 items that are missing from UI 2
      let modified = false;
      const existingCodes = new Set(list2.map(it => it.code || it.id));
      for (const item of list1) {
        const code = item.riskNumber || item.code;
        if (code && !existingCodes.has(code)) {
          list2.unshift(convertRiskRegisterToErm(item));
          existingCodes.add(code);
          modified = true;
        }
      }
      if (modified) {
        localStorage.setItem(UI2_STORAGE_KEY, JSON.stringify(list2));
      }
    }
  } catch (err) {
    console.warn("Risk sync initialization error:", err);
  }
}

// Expose utilities on global window
if (typeof window !== "undefined") {
  const win = window as any;
  win.convertRiskRegisterToErm = convertRiskRegisterToErm;
  win.convertErmToRiskRegister = convertErmToRiskRegister;
  win.syncRiskRegisterToUI2 = syncRiskRegisterToUI2;
  win.syncErmRiskToUI1 = syncErmRiskToUI1;
  win.syncDeleteRiskFromAll = syncDeleteRiskFromAll;
  win.initializeBidirectionalRiskSync = initializeBidirectionalRiskSync;
}
