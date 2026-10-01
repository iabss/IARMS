/**
 * ==============================================================================
 * IARMS - GOOGLE APPS SCRIPT (GAS) BACKEND ENGINE UNTUK FRONTEND NETLIFY
 * ==============================================================================
 * Script ini berfungsi sebagai backend API resmi & database bridge antara
 * Frontend Netlify dengan Google Sheets (Single Source of Truth).
 * 
 * FITUR UTAMA:
 * 1. Menerima payload JSON dari frontend Netlify tanpa kendala CORS.
 * 2. Menyimpan data temuan (AFS), review IA, bukti closing, dan data proyek.
 * 3. Dilengkapi LockService untuk mencegah konflik saat banyak user submit bersamaan.
 * 4. Otomatis membuat Sheet & Header jika spreadsheet masih kosong.
 * 
 * PANDUAN DEPLOYMENT (PENTING DIIKUTI DENGAN BENAR):
 * 1. Buka Google Spreadsheet yang akan dijadikan database.
 * 2. Klik menu: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus seluruh isi editor, lalu tempel (paste) seluruh kode ini.
 * 4. Klik ikon "Simpan" (Save / Ctrl+S).
 * 5. Klik tombol biru "Deploy" (Terapkan) di kanan atas > "Deployment baru" (New deployment).
 * 6. Klik ikon gerigi (Select type) > Pilih "Aplikasi Web" (Web app).
 * 7. Konfigurasi Wajib:
 *    - Deskripsi: IARMS Netlify Backend Live
 *    - Jalankan sebagai (Execute as): "Saya" (Me / akun Google Anda)
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone)  <-- MUTLAK HARUS ANYONE!
 * 8. Klik "Deploy", lalu klik "Review Permissions" > Pilih akun Google Anda >
 *    Klik "Advanced" > Klik "Go to ... (unsafe)" > Klik "Allow".
 * 9. Salin "Web App URL" (URL berakhiran /exec) dan pasang di konfigurasi Netlify Anda.
 * ==============================================================================
 */

// Konfigurasi Nama Sheet
var SHEET_FINDINGS = "Finding Statement";
var SHEET_PROJECTS = "AFS_Projects";
var SHEET_LOGS = "Audit_Logs";

// Header Standar Finding Statement (AFS)
var HEADERS_FINDINGS = [
  "NO",
  "PROJECT AUDIT",
  "SITE",
  "PERIODE AUDIT",
  "DEPARTMENT",
  "PROBLEM/FINDING",
  "DETAIL TEMUAN",
  "DOKUMENTASI TEMUAN",
  "KRITERIA",
  "KATEGORI",
  "REKOMENDASI",
  "STATUS",
  "PIC SITE",
  "PIC HO",
  "DUE DATE",
  "REMARKS",
  "DOKUMENTASI CLOSING",
  "REVIEWED CLOSING FROM USER",
  "REVIEWED CLOSING FROM IA",
  "NOTE",
  "KOLOM BANTU",
  "UPDATED_AT"
];

// Helper: Memastikan Sheet dan Header tersedia secara otomatis
function getOrCreateSheet(sheetName, defaultHeaders) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length)
           .setFontWeight("bold")
           .setBackground("#0f172a")
           .setFontColor("#f8fafc");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// Helper: Membaca data baris secara aman tanpa melebihi batas memori range Google Apps Script
function getSheetSafeData(sheet, maxCols) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  var cols = maxCols ? Math.min(lastCol, maxCols) : Math.min(lastCol, HEADERS_FINDINGS.length);
  return sheet.getRange(1, 1, lastRow, cols).getValues();
}

// ==============================================================================
// 1. GET HANDLER: Mengambil data dari Google Sheets ke Netlify
// ==============================================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "get_all";

    // Ping check
    if (action === "ping") {
      return jsonResponse({
        success: true,
        message: "IARMS GAS Backend is online & ready!",
        timestamp: new Date().toISOString()
      });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_FINDINGS) || ss.getSheets()[0];
    
    // Gunakan getSheetSafeData untuk mencegah: "Requested data exceeds the maximum allowed size"
    var data = getSheetSafeData(sheet, HEADERS_FINDINGS.length);

    if (data.length <= 1) {
      return jsonResponse({
        success: true,
        count: 0,
        rows: [],
        projects: getProjectsList(),
        timestamp: new Date().toISOString()
      });
    }

    var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
    var rows = [];

    // Filter opsional via query params (misal: ?site=CDI atau ?status=OPEN)
    var filterSite = params.site ? params.site.trim().toUpperCase() : null;
    var filterStatus = params.status ? params.status.trim().toUpperCase() : null;
    var filterProject = params.project ? params.project.trim().toUpperCase() : null;

    for (var r = 1; r < data.length; r++) {
      var rowValues = data[r];
      var rowObj = { _rowId: r };
      var hasContent = false;

      for (var c = 0; c < headers.length; c++) {
        var headerKey = headers[c];
        var cellVal = rowValues[c] !== undefined && rowValues[c] !== null ? String(rowValues[c]).trim() : "";
        if (cellVal !== "") hasContent = true;
        rowObj[headerKey] = cellVal;
      }

      if (hasContent) {
        // Fallback nilai standar jika kolom kosong
        if (!rowObj["NO"]) rowObj["NO"] = String(r);
        if (!rowObj["PROJECT AUDIT"]) rowObj["PROJECT AUDIT"] = "AUDIT";
        if (!rowObj["SITE"]) rowObj["SITE"] = "HEAD OFFICE";
        if (!rowObj["STATUS"]) rowObj["STATUS"] = "OPEN";

        // Cek filter jika ada
        var matchSite = !filterSite || rowObj["SITE"].toUpperCase() === filterSite;
        var matchStatus = !filterStatus || rowObj["STATUS"].toUpperCase() === filterStatus;
        var matchProject = !filterProject || rowObj["PROJECT AUDIT"].toUpperCase() === filterProject;

        if (matchSite && matchStatus && matchProject) {
          rows.push(rowObj);
        }
      }
    }

    return jsonResponse({
      success: true,
      count: rows.length,
      rows: rows,
      projects: getProjectsList(),
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      rows: [],
      projects: []
    });
  }
}

// ==============================================================================
// 2. POST HANDLER: Menerima JSON dari Frontend Netlify & Simpan ke Sheets
// ==============================================================================
function doPost(e) {
  // Gunakan LockService agar aman saat multiple user submit bersamaan dari Netlify
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(20000); // Tunggu hingga 20 detik jika ada proses lain

  if (!hasLock) {
    return jsonResponse({
      success: false,
      error: "Server Google Sheets sedang sibuk melayani permintaan lain. Silakan coba 2 detik lagi."
    });
  }

  try {
    var payload = {};

    // 1. Parsing data JSON yang dikirim oleh Frontend Netlify
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        // Jika format url-encoded atau teks biasa
        payload = parseUrlEncoded(e.postData.contents);
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || "save_finding";
    var result = { success: true, action: action, timestamp: new Date().toISOString() };

    // Router Aksi
    if (action === "get_all" || action === "read") {
      result = doGet(e);
      return result;
    }
    else if (action === "save_finding" || action === "add_finding" || action === "submit_finding" || action === "update_finding") {
      result = handleSaveFinding(payload);
    }
    else if (action === "delete_finding") {
      result = handleDeleteFinding(payload);
    }
    else if (action === "update_ia_review") {
      result = handleUpdateIaReview(payload);
    }
    else if (action === "update_closing_doc") {
      result = handleUpdateClosingDoc(payload);
    }
    else if (action === "batch_save" || action === "sync_batch") {
      result = handleBatchSave(payload);
    }
    else if (action === "save_project") {
      result = handleSaveProject(payload);
    }
    else if (action === "delete_project") {
      result = handleDeleteProject(payload);
    }
    else if (action === "sync_projects_list") {
      result = handleSyncProjectsList(payload);
    }
    else if (action === "ping") {
      result = { success: true, message: "PONG! GAS Backend aktif menerima data dari Netlify." };
    }
    else {
      result = { success: false, message: "Aksi tidak dikenali: " + action };
    }

    // Catat log aktivitas jika aksi berhasil
    if (result.success) {
      logActivity(action, payload);
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      stack: err.stack ? err.stack.toString() : ""
    });
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 3. FUNGSI HANDLER DATA SHEET
// ==============================================================================

/**
 * Menyimpan temuan baru atau memperbarui baris temuan yang sudah ada
 */
function handleSaveFinding(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = getSheetSafeData(sheet, HEADERS_FINDINGS.length);
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h).trim().toUpperCase(); }) : HEADERS_FINDINGS;

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var foundRowIndex = -1;

  // 1. Cari baris yang cocok berdasarkan Row ID atau Nomor Temuan
  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    foundRowIndex = targetRowId;
  } else if (targetNo) {
    var noColIdx = headers.indexOf("NO");
    if (noColIdx !== -1) {
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][noColIdx]).trim() === targetNo) {
          foundRowIndex = r;
          break;
        }
      }
    }
  }

  // Waktu pembaruan
  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd HH:mm:ss");

  // 2. Susun baris nilai sesuai susunan header sheet
  var rowValues = [];
  for (var c = 0; c < headers.length; c++) {
    var key = headers[c];
    var val = "";

    if (key === "UPDATED_AT") {
      val = nowStr;
    } else if (payload[key] !== undefined && payload[key] !== null) {
      val = payload[key];
    } else {
      // Coba cari alternatif huruf kecil atau underscore
      var cleanKey = key.toLowerCase().replace(/[\/\s-]/g, "_");
      for (var prop in payload) {
        if (prop.toLowerCase().replace(/[\/\s-]/g, "_") === cleanKey) {
          val = payload[prop];
          break;
        }
      }
    }
    rowValues.push(val);
  }

  if (foundRowIndex > 0) {
    // UPDATE BARIS YANG SUDAH ADA
    sheet.getRange(foundRowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
    return {
      success: true,
      mode: "update",
      message: "Data temuan No. " + targetNo + " berhasil diperbarui di baris #" + (foundRowIndex + 1),
      rowId: foundRowIndex,
      NO: targetNo
    };
  } else {
    // APPEND BARIS BARU DI BAWAH
    sheet.appendRow(rowValues);
    var newRowIndex = sheet.getLastRow() - 1;
    return {
      success: true,
      mode: "create",
      message: "Temuan baru No. " + targetNo + " berhasil disimpan ke Google Sheets",
      rowId: newRowIndex,
      NO: targetNo
    };
  }
}

/**
 * Menghapus baris temuan berdasarkan NO atau Row ID
 */
function handleDeleteFinding(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = getSheetSafeData(sheet, HEADERS_FINDINGS.length);
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h).trim().toUpperCase(); }) : HEADERS_FINDINGS;

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var noColIdx = headers.indexOf("NO");

  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    sheet.deleteRow(targetRowId + 1);
    return { success: true, message: "Baris #" + targetRowId + " berhasil dihapus dari Google Sheets" };
  }

  if (noColIdx !== -1 && targetNo) {
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][noColIdx]).trim() === targetNo) {
        sheet.deleteRow(r + 1);
        return { success: true, message: "Temuan No. " + targetNo + " berhasil dihapus dari Google Sheets" };
      }
    }
  }

  return { success: false, message: "Temuan tidak ditemukan di Google Sheets untuk dihapus" };
}

/**
 * Memperbarui hasil Review Closing dari Internal Audit (Approve / Reject)
 */
function handleUpdateIaReview(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = getSheetSafeData(sheet, HEADERS_FINDINGS.length);
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h).trim().toUpperCase(); }) : HEADERS_FINDINGS;

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var reviewVal = payload.review || payload["REVIEWED CLOSING FROM IA"] || "";
  var statusVal = payload.status || payload.STATUS || (reviewVal === "Approve" ? "CLOSE" : "OPEN");

  var iaColIdx = headers.indexOf("REVIEWED CLOSING FROM IA");
  var statusColIdx = headers.indexOf("STATUS");
  var updateColIdx = headers.indexOf("UPDATED_AT");

  var rowIndex = -1;
  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    rowIndex = targetRowId;
  } else if (targetNo) {
    var noColIdx = headers.indexOf("NO");
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][noColIdx]).trim() === targetNo) {
        rowIndex = r;
        break;
      }
    }
  }

  if (rowIndex > 0) {
    if (iaColIdx !== -1) sheet.getRange(rowIndex + 1, iaColIdx + 1).setValue(reviewVal);
    if (statusColIdx !== -1) sheet.getRange(rowIndex + 1, statusColIdx + 1).setValue(statusVal);
    if (updateColIdx !== -1) {
      sheet.getRange(rowIndex + 1, updateColIdx + 1).setValue(new Date().toISOString());
    }
    return {
      success: true,
      message: "Review IA berhasil disimpan (" + reviewVal + " -> Status: " + statusVal + ")",
      NO: targetNo,
      review: reviewVal,
      status: statusVal
    };
  }

  return { success: false, message: "Baris tidak ditemukan untuk update Review IA" };
}

/**
 * Memperbarui tautan/file Dokumentasi Closing (Bukti Closing)
 */
function handleUpdateClosingDoc(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = getSheetSafeData(sheet, HEADERS_FINDINGS.length);
  var headers = data.length > 0 ? data[0].map(function(h) { return String(h).trim().toUpperCase(); }) : HEADERS_FINDINGS;

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var docVal = payload.doc || payload["DOKUMENTASI CLOSING"] || "";

  var docColIdx = headers.indexOf("DOKUMENTASI CLOSING");
  var updateColIdx = headers.indexOf("UPDATED_AT");
  var rowIndex = -1;

  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    rowIndex = targetRowId;
  } else if (targetNo) {
    var noColIdx = headers.indexOf("NO");
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][noColIdx]).trim() === targetNo) {
        rowIndex = r;
        break;
      }
    }
  }

  if (rowIndex > 0 && docColIdx !== -1) {
    sheet.getRange(rowIndex + 1, docColIdx + 1).setValue(docVal);
    if (updateColIdx !== -1) {
      sheet.getRange(rowIndex + 1, updateColIdx + 1).setValue(new Date().toISOString());
    }
    return {
      success: true,
      message: "Dokumentasi closing berhasil disimpan ke Google Sheets",
      NO: targetNo
    };
  }

  return { success: false, message: "Baris tidak ditemukan untuk update dokumentasi closing" };
}

/**
 * Menyimpan seluruh dataset (Batch Synchronize)
 */
function handleBatchSave(payload) {
  var rows = payload.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: "Array rows kosong atau tidak valid" };
  }

  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  sheet.clearContents();
  sheet.appendRow(HEADERS_FINDINGS);
  sheet.getRange(1, 1, 1, HEADERS_FINDINGS.length)
       .setFontWeight("bold")
       .setBackground("#0f172a")
       .setFontColor("#f8fafc");

  var matrix = [];
  var nowStr = new Date().toISOString();

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rowValues = [];
    for (var c = 0; c < HEADERS_FINDINGS.length; c++) {
      var key = HEADERS_FINDINGS[c];
      if (key === "UPDATED_AT") {
        rowValues.push(nowStr);
      } else {
        rowValues.push(r[key] !== undefined ? r[key] : "");
      }
    }
    matrix.push(rowValues);
  }

  if (matrix.length > 0) {
    sheet.getRange(2, 1, matrix.length, HEADERS_FINDINGS.length).setValues(matrix);
  }

  return {
    success: true,
    count: matrix.length,
    message: "Batch sync berhasil menyimpan " + matrix.length + " baris data ke Google Sheets"
  };
}

// ==============================================================================
// 4. MANAJEMEN DAFTAR PROYEK (AFS PROJECTS)
// ==============================================================================

function getProjectsList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    var list = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (r[0]) {
        list.push({
          id: String(r[0]),
          projectName: String(r[1] || r[0]),
          siteName: String(r[2] || "HEAD OFFICE"),
          year: String(r[3] || "2026"),
          sheetUrl: String(r[4] || ""),
          status: String(r[5] || "synced"),
          rowCount: Number(r[6]) || 0
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

function handleSaveProject(payload) {
  var sheet = getOrCreateSheet(SHEET_PROJECTS, ["ID", "PROJECT NAME", "SITE", "YEAR", "SHEET URL", "STATUS", "ROW COUNT"]);
  var data = sheet.getDataRange().getValues();
  var pId = String(payload.id || (payload.projectName + "|" + (payload.siteName || "HO")));

  var found = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === pId) {
      found = i;
      break;
    }
  }

  var row = [
    pId,
    payload.projectName || payload.project || "",
    payload.siteName || payload.site || "HEAD OFFICE",
    payload.year || "2026",
    payload.sheetUrl || "",
    payload.status || "synced",
    payload.rowCount || 0
  ];

  if (found > 0) {
    sheet.getRange(found + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { success: true, message: "Project " + payload.projectName + " berhasil disimpan ke database Google Sheets" };
}

function handleDeleteProject(payload) {
  var sheet = getOrCreateSheet(SHEET_PROJECTS, ["ID", "PROJECT NAME", "SITE", "YEAR", "SHEET URL", "STATUS", "ROW COUNT"]);
  var data = sheet.getDataRange().getValues();
  var pId = String(payload.id || (payload.projectName + "|" + (payload.siteName || "HO")));

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === pId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Project berhasil dihapus dari Google Sheets" };
    }
  }
  return { success: false, message: "Project tidak ditemukan di Google Sheets" };
}

function handleSyncProjectsList(payload) {
  var projects = payload.projects;
  if (!Array.isArray(projects)) return { success: false, message: "Daftar projects tidak valid" };

  var sheet = getOrCreateSheet(SHEET_PROJECTS, ["ID", "PROJECT NAME", "SITE", "YEAR", "SHEET URL", "STATUS", "ROW COUNT"]);
  sheet.clearContents();
  sheet.appendRow(["ID", "PROJECT NAME", "SITE", "YEAR", "SHEET URL", "STATUS", "ROW COUNT"]);

  var matrix = [];
  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    matrix.push([
      p.id || (p.projectName + "|" + (p.siteName || "HO")),
      p.projectName || p.project || "",
      p.siteName || p.site || "HEAD OFFICE",
      p.year || "2026",
      p.sheetUrl || "",
      p.status || "synced",
      p.rowCount || 0
    ]);
  }

  if (matrix.length > 0) {
    sheet.getRange(2, 1, matrix.length, 7).setValues(matrix);
  }

  return { success: true, count: matrix.length, message: "Daftar project berhasil disinkronkan ke Google Sheets" };
}

// ==============================================================================
// 5. HELPER UTILITY & LOGGING
// ==============================================================================

function logActivity(action, payload) {
  try {
    var sheet = getOrCreateSheet(SHEET_LOGS, ["TIMESTAMP", "ACTION", "TARGET_NO", "USER_EMAIL", "DETAILS"]);
    sheet.appendRow([
      new Date().toISOString(),
      action,
      payload.NO || payload.no || "-",
      Session.getActiveUser().getEmail() || "Netlify User",
      JSON.stringify(payload).substring(0, 500)
    ]);
  } catch (e) {
    // Non-blocking
  }
}

function parseUrlEncoded(str) {
  var obj = {};
  if (!str) return obj;
  var pairs = str.split("&");
  for (var i = 0; i < pairs.length; i++) {
    var kv = pairs[i].split("=");
    var k = decodeURIComponent(kv[0] || "");
    var v = decodeURIComponent(kv[1] || "");
    if (k) obj[k] = v;
  }
  return obj;
}

/**
 * JSON Response Helper dengan format MIME yang tepat untuk browser & Netlify
 */
function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
