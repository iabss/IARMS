const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

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
    return text ? JSON.parse(text) : { status: "success" };
  } catch (error) {
    console.error("Gagal menyinkronkan data ke Google Apps Script:", error);
    throw error;
  }
}