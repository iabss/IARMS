export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

export async function fetchAuditData(): Promise<any> {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Gagal mengambil data dari Google Apps Script:", error);
    throw error;
  }
}

export async function syncAuditData(payload: Record<string, any>): Promise<any> {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    return text ? JSON.parse(text) : { status: "success", success: true };
  } catch (error) {
    console.error("Gagal menyinkronkan data ke Google Apps Script:", error);
    throw error;
  }
}

/**
 * Fetch and parse CSV directly from a public Google Sheet URL on client side
 */
export async function fetchCsvFromGoogleSheet(url: string): Promise<string> {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error('Format Link Google Sheet tidak valid.');
  }

  const sheetId = match[1];
  let gid = '0';
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gid = gidMatch[1];
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;

  // Try direct export
  try {
    const res = await fetch(exportUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('<!DOCTYPE html>') && !text.includes('Sign in')) {
        return text;
      }
    }
  } catch (e) {
    // try gviz
  }

  // Try gviz fallback
  const res2 = await fetch(gvizUrl);
  if (!res2.ok) {
    throw new Error('Google Sheet terkunci atau tidak dapat diakses.');
  }
  const text2 = await res2.text();
  if (text2.includes('<!DOCTYPE html>') || text2.includes('Sign in')) {
    throw new Error('Google Sheet privat. Ubah akses ke "Anyone with the link can view".');
  }
  return text2;
}
