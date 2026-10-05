export function isStatusClosed(status?: string, remarks?: string, iaReview?: string): boolean {
  const st = (status || "").toUpperCase().trim();
  const rm = (remarks || "").toUpperCase().trim();
  const ia = (iaReview || "").toUpperCase().trim();

  if (ia === "APPROVE" || ia === "APPROVED" || ia === "SETUJU" || ia === "OK") {
    return true;
  }

  if (
    st === "CLOSE" ||
    st === "CLOSED" ||
    st === "SELESAI" ||
    st === "DONE" ||
    st === "100%" ||
    st === "TERPENUHI" ||
    st === "RESOLVED" ||
    st === "C" ||
    st.startsWith("CLOSE") ||
    st.startsWith("CLOSED") ||
    st.includes("SELESAI")
  ) {
    return true;
  }

  if ((rm === "DONE" || rm === "CLOSED" || rm === "CLOSE") && st !== "OPEN") {
    return true;
  }

  return false;
}

export function isStatusOpen(status?: string, remarks?: string, iaReview?: string): boolean {
  if (isStatusClosed(status, remarks, iaReview)) return false;
  const st = (status || "").toUpperCase().trim();
  if (st === "OPEN" || st === "BUKA" || st === "BELUM" || st === "O" || st === "" || st === "-") return true;
  if (st.includes("PROGRESS") || st.includes("PROSES") || st.includes("ON GOING") || st.includes("ON-GOING")) return false;
  return true;
}

export function isStatusProgress(status?: string, remarks?: string, iaReview?: string): boolean {
  if (isStatusClosed(status, remarks, iaReview)) return false;
  const st = (status || "").toUpperCase().trim();
  return (
    st === "IN PROGRESS" ||
    st === "PROGRESS" ||
    st === "PROSES" ||
    st === "ON PROGRESS" ||
    st === "ON-PROGRESS" ||
    st.includes("PROGRESS") ||
    st.includes("PROSES") ||
    st.includes("ON GOING") ||
    st.includes("ON-GOING")
  );
}

export function extractFindingYear(item: any, fallbackYear = "2026"): string {
  if (!item) return String(fallbackYear);
  const pAudit = String(item["PERIODE AUDIT"] || item.PERIODE || item.TAHUN || item.year || "").trim();
  const m = pAudit.match(/20\d{2}/);
  if (m) return m[0];

  const dateStr = String(item["TARGET SELESAI"] || item.DATE || item.TIMESTAMP || "").trim();
  const mDate = dateStr.match(/20\d{2}/);
  if (mDate) return mDate[0];

  return String(fallbackYear);
}
