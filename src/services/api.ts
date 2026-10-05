import { AFSFindingRecord, ProjectLinkConfig } from "../types";
import { fetchLiveFindingsFromGAS, isStaticHosting } from "./gasService";

export async function fetchCsvFromGoogleSheet(url: string): Promise<string> {
  const res = await fetch(`/api/proxy-sheet?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("Gagal mengambil CSV");
  return await res.text();
}

export async function syncAuditData(data: any): Promise<any> {
  if (isStaticHosting()) return { success: true };
  try {
    const res = await fetch("/api/sync-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function fetchProjectsFromBackend(): Promise<{ projects: any[]; customRows?: any[]; deletedKeys?: string[] }> {
  try {
    const gasData = await fetchLiveFindingsFromGAS();
    if (gasData && gasData.success) {
      return {
        projects: gasData.projects || [],
        customRows: gasData.rows || [],
        deletedKeys: []
      };
    }
  } catch (e) {}
  return { projects: [], customRows: [], deletedKeys: [] };
}
