/**
 * ==============================================================================
 * IARMS - GOOGLE APPS SCRIPT (GAS) BACKEND DATABASE ENGINE
 * ==============================================================================
 * Script ini bertindak sebagai Database Pusat (Single Source of Truth) untuk IARMS.
 * Semua input, update, hapus data, dan verifikasi AFS tersimpan permanen di baris Google Sheets.
 * 
 * CARA DEPLOY / PASANG:
 * 1. Buka Google Sheets database Anda (atau buat Google Sheets baru).
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus semua kode default, lalu salin dan tempel (paste) seluruh isi file ini.
 * 4. Klik tombol "Deploy" (Terapkan) di pojok kanan atas > "Deployment baru" (New deployment).
 * 5. Pilih jenis deployment: "Aplikasi Web" (Web app).
 * 6. Pengaturan:
 *    - Deskripsi: IARMS Live Database Engine
 *    - Jalankan sebagai (Execute as): "Saya" (Me - akun Google Anda)
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone) -> PENTING!
 * 7. Klik "Deploy" / "Terapkan", berikan izin akses (Authorize access).
 * 8. Salin URL Aplikasi Web (Web App URL) yang dihasilkan, lalu tempelkan ke pengaturan IARMS.
 * ==============================================================================
 */

// Nama Sheet Database Utama
var SHEET_FINDINGS = "Finding Statement";
var SHEET_PROJECTS = "AFS_Projects";
var SHEET_CONFIG = "IARMS_Config";

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
  "KOLOM BANTU"
];

// Helper: Setup atau pastikan Sheet dan Header tersedia
function getOrCreateSheet(sheetName, defaultHeaders) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ==============================================================================
// 1. GET HANDLER: Mengambil data terbaru secara otomatis dari Google Sheets
// ==============================================================================
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_FINDINGS) || ss.getSheets()[0];
    
    var data = sheet.getDataRange().getValues();
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

      // Standarisasi key jika belum lengkap
      if (hasContent) {
        if (!rowObj["NO"]) rowObj["NO"] = String(rows.length + 1);
        if (!rowObj["PROJECT AUDIT"]) rowObj["PROJECT AUDIT"] = "AUDIT";
        if (!rowObj["SITE"]) rowObj["SITE"] = "HEAD OFFICE";
        if (!rowObj["STATUS"]) rowObj["STATUS"] = "OPEN";
        rows.push(rowObj);
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
// 2. POST HANDLER: Menerima aksi input, update, hapus, dan sinkronisasi
// ==============================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Cegah race condition saat input bersamaan

  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);
    var action = payload.action || "save_finding";

    var result = { success: true, action: action, timestamp: new Date().toISOString() };

    if (action === "get_all" || action === "read") {
      return doGet(e);
    } 
    else if (action === "save_finding" || action === "add_finding" || action === "update_finding") {
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
    else if (action === "save_project") {
      result = handleSaveProject(payload);
    } 
    else if (action === "delete_project") {
      result = handleDeleteProject(payload);
    } 
    else if (action === "sync_projects_list") {
      result = handleSyncProjectsList(payload);
    } 
    else if (action === "sync_batch" || action === "batch_save") {
      result = handleBatchSave(payload);
    } 
    else {
      result = { success: false, message: "Aksi tidak dikenali: " + action };
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// Handlers Implementations
// ------------------------------------------------------------------------------

function handleSaveFinding(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
  
  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var foundRowIndex = -1;

  // Cari baris jika update
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

  // Buat array nilai baris sesuai urutan header
  var rowValues = [];
  for (var c = 0; c < headers.length; c++) {
    var key = headers[c];
    var val = payload[key] !== undefined ? payload[key] : (payload[key.toLowerCase()] !== undefined ? payload[key.toLowerCase()] : "");
    rowValues.push(val);
  }

  if (foundRowIndex > 0) {
    // Update baris yang sudah ada
    sheet.getRange(foundRowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
    return { success: true, message: "Data temuan No. " + targetNo + " berhasil diperbarui di Google Sheets", rowId: foundRowIndex, NO: targetNo };
  } else {
    // Tambah baris baru di bawah
    sheet.appendRow(rowValues);
    var newRowId = sheet.getLastRow() - 1;
    return { success: true, message: "Temuan baru No. " + targetNo + " berhasil disimpan ke Google Sheets", rowId: newRowId, NO: targetNo };
  }
}

function handleDeleteFinding(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });

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

function handleUpdateIaReview(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var reviewVal = payload.review || payload["REVIEWED CLOSING FROM IA"] || "";
  var statusVal = payload.status || payload.STATUS || (reviewVal === "Approve" ? "CLOSE" : "OPEN");

  var iaColIdx = headers.indexOf("REVIEWED CLOSING FROM IA");
  var statusColIdx = headers.indexOf("STATUS");

  var rowIndexToUpdate = -1;
  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    rowIndexToUpdate = targetRowId;
  } else if (targetNo) {
    var noColIdx = headers.indexOf("NO");
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][noColIdx]).trim() === targetNo) {
        rowIndexToUpdate = r;
        break;
      }
    }
  }

  if (rowIndexToUpdate > 0) {
    if (iaColIdx !== -1) sheet.getRange(rowIndexToUpdate + 1, iaColIdx + 1).setValue(reviewVal);
    if (statusColIdx !== -1) sheet.getRange(rowIndexToUpdate + 1, statusColIdx + 1).setValue(statusVal);
    return { success: true, message: "Review IA berhasil disimpan ke Google Sheets", NO: targetNo, review: reviewVal, status: statusVal };
  }

  return { success: false, message: "Baris tidak ditemukan untuk update Review IA" };
}

function handleUpdateClosingDoc(payload) {
  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });

  var targetNo = String(payload.NO || payload.no || "").trim();
  var targetRowId = payload._rowId ? Number(payload._rowId) : null;
  var docVal = payload.doc || payload["DOKUMENTASI CLOSING"] || "";

  var docColIdx = headers.indexOf("DOKUMENTASI CLOSING");
  var rowIndexToUpdate = -1;

  if (targetRowId && targetRowId < data.length && targetRowId > 0) {
    rowIndexToUpdate = targetRowId;
  } else if (targetNo) {
    var noColIdx = headers.indexOf("NO");
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][noColIdx]).trim() === targetNo) {
        rowIndexToUpdate = r;
        break;
      }
    }
  }

  if (rowIndexToUpdate > 0 && docColIdx !== -1) {
    sheet.getRange(rowIndexToUpdate + 1, docColIdx + 1).setValue(docVal);
    return { success: true, message: "Dokumentasi closing berhasil disimpan ke Google Sheets", NO: targetNo };
  }

  return { success: false, message: "Baris tidak ditemukan untuk update dokumentasi closing" };
}

function handleBatchSave(payload) {
  var rows = payload.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: "Daftar rows kosong" };
  }

  var sheet = getOrCreateSheet(SHEET_FINDINGS, HEADERS_FINDINGS);
  // Simpan batch
  sheet.clearContents();
  sheet.appendRow(HEADERS_FINDINGS);
  sheet.getRange(1, 1, 1, HEADERS_FINDINGS.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");

  var matrix = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rowValues = [];
    for (var c = 0; c < HEADERS_FINDINGS.length; c++) {
      var key = HEADERS_FINDINGS[c];
      rowValues.push(r[key] !== undefined ? r[key] : "");
    }
    matrix.push(rowValues);
  }

  if (matrix.length > 0) {
    sheet.getRange(2, 1, matrix.length, HEADERS_FINDINGS.length).setValues(matrix);
  }

  return { success: true, count: matrix.length, message: "Batch save berhasil menyimpan " + matrix.length + " baris ke Google Sheets" };
}

// ------------------------------------------------------------------------------
// Projects List Management in Google Sheets
// ------------------------------------------------------------------------------
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
          id: r[0],
          projectName: r[1] || r[0],
          siteName: r[2] || "HEAD OFFICE",
          year: r[3] || "2026",
          sheetUrl: r[4] || "",
          status: r[5] || "synced",
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
  var pId = payload.id || (payload.projectName + "|" + (payload.siteName || "HO"));

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
  var pId = payload.id || (payload.projectName + "|" + (payload.siteName || "HO"));

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

// ------------------------------------------------------------------------------
// JSON Response Helper dengan Header CORS Lengkap
// ------------------------------------------------------------------------------
function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
