/**
 * =========================================================================
 * IARMS (Internal Audit Management System) - Google Apps Script Backend
 * File: Code.gs
 * Target Deployment URL:
 * https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec
 * =========================================================================
 */

// Konfigurasi Folder Google Drive untuk Backup Otomatis
const BACKUP_FOLDER_ID = "1zDCtRFoFEDWzakB0I5lpr88PP2vwDAAs";
const APP_NAME = "IARMS (Internal Audit Management System)";
const APP_URL = "https://ais-pre-hrnw32kfhitmhm26bhpggh-804854985076.asia-southeast1.run.app";

/**
 * Handle HTTP POST requests from IARMS frontend
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = { raw: e.postData.contents };
      }
    }

    const action = (payload.action || "").trim();

    // 1. ACTION: register_user / send_welcome_email / resend_verification / update_user_email
    if (action === "register_user" || action === "send_welcome_email" || action === "resend_verification" || action === "update_user_email") {
      return handleRegisterUser(payload);
    }

    // 2. ACTION: reset_password
    if (action === "reset_password") {
      return handleResetPassword(payload);
    }

    // 3. ACTION: sync_sheet_url
    if (action === "sync_sheet_url") {
      return handleSyncSheetUrl(payload);
    }

    // 4. ACTION: delete_project
    if (action === "delete_project") {
      return handleDeleteProject(payload);
    }

    // 5. ACTION: backup_drive
    if (action === "backup_drive") {
      return handleBackupDrive(payload);
    }

    // 6. ACTION: password_updated
    if (action === "password_updated") {
      return handlePasswordUpdated(payload);
    }

    // Default fallback: log action
    return createJsonResponse({
      status: "success",
      success: true,
      message: "Action received: " + (action || "unknown"),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle HTTP GET requests (Health Check / Project Listing)
 */
function doGet(e) {
  try {
    const sheetData = getProjectsFromSheet();
    return createJsonResponse({
      status: "success",
      app: APP_NAME,
      version: "2.5",
      timestamp: new Date().toISOString(),
      projects: sheetData
    });
  } catch (error) {
    return createJsonResponse({
      status: "success",
      app: APP_NAME,
      version: "2.5",
      timestamp: new Date().toISOString(),
      projects: []
    });
  }
}

/**
 * Handler for action: "register_user"
 * Sends confirmation / welcome email to user using MailApp.sendEmail()
 */
function handleRegisterUser(payload) {
  const email = (payload.email || "").trim();
  const name = (payload.name || payload.displayName || "Rekan Kerja").trim();
  const role = (payload.role || "auditee").trim().toLowerCase();
  const nik = (payload.nik || "-").trim();
  const department = (payload.department || payload.departemen || "-").trim();
  const tempPassword = (payload.tempPassword || "").trim();

  if (!email || email.indexOf("@") === -1) {
    return createJsonResponse({
      status: "error",
      success: false,
      message: "Alamat email tidak valid atau kosong: " + email
    });
  }

  // Label peran (Role)
  let roleLabel = "Auditee / Unit Kerja";
  if (role === "auditor" || role === "lead auditor" || role === "internal audit") {
    roleLabel = "Internal Auditor (Akses Penuh 12 Menu)";
  } else if (role === "management") {
    roleLabel = "Manajemen / Eksekutif";
  }

  // Subjek Email
  const subject = "[IARMS] Pendaftaran Akun Berhasil - Kredensial Akses Sistem";

  // Plain text fallback
  let plainTextBody = "Halo " + name + ",\n\n" +
    "Selamat! Akun Anda telah berhasil didaftarkan di sistem " + APP_NAME + ".\n\n" +
    "Rincian Akun Anda:\n" +
    "- Nama: " + name + "\n" +
    "- NIK: " + nik + "\n" +
    "- Email: " + email + "\n" +
    "- Departemen: " + department + "\n" +
    "- Hak Akses / Peran: " + roleLabel + "\n\n";

  if (tempPassword) {
    plainTextBody += "Kata Sandi Sementara: " + tempPassword + "\n\n" +
      "* Perhatian: Demi keamanan, sistem mewajibkan Anda mengganti kata sandi ini saat pertama kali masuk ke aplikasi.\n\n";
  }

  plainTextBody += "Tautan Masuk Aplikasi: " + APP_URL + "\n\n" +
    "Terima kasih,\nTim Internal Audit IARMS";

  // Template HTML Email yang Elegan dan Responsif
  let htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pendaftaran Akun IARMS</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
            
            <!-- Header Banner -->
            <tr>
              <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 36px; text-align: left;">
                <div style="font-size: 11px; font-weight: 800; color: #e0f2fe; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">
                  Internal Audit Management System
                </div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  IARMS Portal
                </h1>
                <div style="font-size: 13px; color: #bae6fd; margin-top: 4px;">
                  Notifikasi Resmi Pendaftaran & Kredensial Pengguna
                </div>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 36px;">
                <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #f8fafc;">
                  Halo <strong style="color: #38bdf8;">${escapeHtml(name)}</strong>,
                </p>
                <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #94a3b8;">
                  Selamat! Pendaftaran akun Anda pada sistem <strong>IARMS (Internal Audit Management System)</strong> telah berhasil diproses. Berikut adalah rincian profil akses Anda:
                </p>

                <!-- Profile Info Card -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="35%" style="font-size: 12px; color: #94a3b8; font-weight: 600;">Nama Lengkap</td>
                          <td width="65%" style="font-size: 13px; color: #f8fafc; font-weight: 700;">${escapeHtml(name)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="35%" style="font-size: 12px; color: #94a3b8; font-weight: 600;">NIK</td>
                          <td width="65%" style="font-size: 13px; color: #38bdf8; font-family: monospace; font-weight: 700;">${escapeHtml(nik)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="35%" style="font-size: 12px; color: #94a3b8; font-weight: 600;">Email Terdaftar</td>
                          <td width="65%" style="font-size: 13px; color: #f8fafc;">${escapeHtml(email)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="35%" style="font-size: 12px; color: #94a3b8; font-weight: 600;">Departemen</td>
                          <td width="65%" style="font-size: 13px; color: #f8fafc;">${escapeHtml(department)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="35%" style="font-size: 12px; color: #94a3b8; font-weight: 600;">Hak Akses (Role)</td>
                          <td width="65%" style="font-size: 13px; color: #34d399; font-weight: 700;">${escapeHtml(roleLabel)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
  `;

  // Tampilkan box password jika ada kata sandi sementara
  if (tempPassword) {
    htmlBody += `
                <!-- Password Box -->
                <div style="background-color: #082f49; border: 1px solid #0284c7; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                  <div style="font-size: 11px; font-weight: 700; color: #7dd3fc; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                    Kata Sandi Sementara Anda
                  </div>
                  <div style="display: inline-block; background-color: #0b1120; border: 1px dashed #38bdf8; border-radius: 8px; padding: 10px 24px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 20px; font-weight: 800; color: #f59e0b; letter-spacing: 2px;">
                    ${escapeHtml(tempPassword)}
                  </div>
                  <div style="font-size: 12px; color: #bae6fd; margin-top: 12px; line-height: 18px;">
                    * <strong>Penting:</strong> Demi keamanan akun, saat pertama kali masuk ke aplikasi, Anda akan diminta untuk mengganti kata sandi ini dengan kata sandi pribadi Anda.
                  </div>
                </div>
    `;
  }

  htmlBody += `
                <!-- CTA Button -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px; margin-bottom: 28px;">
                  <tr>
                    <td align="center">
                      <a href="${APP_URL}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                        Masuk ke Aplikasi IARMS &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0; font-size: 12px; line-height: 20px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 20px;">
                  Jika Anda tidak merasa mendaftar atau merasa ada kesalahan pada data di atas, silakan hubungi Tim Internal Audit perusahaan.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #090d16; padding: 20px 36px; text-align: center; border-top: 1px solid #1e293b;">
                <div style="font-size: 11px; color: #64748b;">
                  &copy; ${new Date().getFullYear()} IARMS - Internal Audit Management System. Seluruh hak cipta dilindungi.
                </div>
                <div style="font-size: 10px; color: #475569; margin-top: 4px;">
                  Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas email ini secara langsung.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // Kirim email menggunakan MailApp.sendEmail
  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: plainTextBody,
      htmlBody: htmlBody,
      name: "IARMS Internal Audit System"
    });

    // Catat log registrasi di spreadsheet jika sheet tersedia
    logRegistrationToSheet({
      timestamp: new Date().toISOString(),
      email: email,
      name: name,
      nik: nik,
      role: roleLabel,
      action: "register_user"
    });

    return createJsonResponse({
      status: "success",
      success: true,
      message: "Email konfirmasi pendaftaran berhasil dikirim ke " + email,
      email: email,
      name: name,
      role: role
    });

  } catch (mailError) {
    return createJsonResponse({
      status: "error",
      success: false,
      message: "Gagal mengirim email: " + mailError.toString(),
      email: email
    });
  }
}

/**
 * Handler for action: "sync_sheet_url"
 */
function handleSyncSheetUrl(payload) {
  try {
    const project = (payload.project || payload.defaultProject || payload.projectName || "").trim();
    const site = (payload.site || payload.siteName || "HEAD OFFICE").trim();
    const year = payload.year ? String(payload.year).trim() : "";
    const sheetUrl = (payload.sheetUrl || "").trim();
    const timestamp = payload.timestamp || new Date().toISOString();

    const sheet = getOrCreateLogSheet("Sheet_Sync_Logs");
    sheet.appendRow([timestamp, project, site, year, sheetUrl, JSON.stringify(payload)]);

    return createJsonResponse({
      status: "success",
      success: true,
      action: "sync_sheet_url",
      project: project,
      site: site,
      year: year,
      sheetUrl: sheetUrl
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      success: false,
      error: err.toString()
    });
  }
}

/**
 * Handler for action: "delete_project"
 */
function handleDeleteProject(payload) {
  try {
    const project = (payload.project || payload.defaultProject || payload.projectName || "").trim();
    const site = (payload.site || payload.siteName || "HEAD OFFICE").trim();
    const year = payload.year ? String(payload.year).trim() : "";
    const timestamp = new Date().toISOString();

    const sheet = getOrCreateLogSheet("Sheet_Sync_Logs");
    sheet.appendRow([timestamp, project, site, year, "DELETED", JSON.stringify(payload)]);

    return createJsonResponse({
      status: "success",
      success: true,
      action: "delete_project",
      project: project,
      site: site,
      year: year
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      success: false,
      error: err.toString()
    });
  }
}

/**
 * Handler for action: "backup_drive"
 */
function handleBackupDrive(payload) {
  try {
    const folderId = payload.folderId || BACKUP_FOLDER_ID;
    const fileName = payload.fileName || ("IARMS_Backup_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
    const content = payload.content || payload.data || "";
    const mimeType = payload.backupType === "csv" ? "text/csv" : "application/json";

    const folder = DriveApp.getFolderById(folderId);
    const contentStr = typeof content === "object" ? JSON.stringify(content, null, 2) : String(content);
    const file = folder.createFile(fileName, contentStr, mimeType);

    return createJsonResponse({
      status: "success",
      success: true,
      action: "backup_drive",
      fileId: file.getId(),
      fileName: fileName,
      folderId: folderId,
      webViewLink: file.getUrl(),
      uploadedAt: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      success: false,
      error: err.toString()
    });
  }
}

/**
 * Handler for action: "reset_password"
 * Sends OTP verification code for password reset via MailApp.sendEmail()
 */
function handleResetPassword(payload) {
  const email = (payload.email || "").trim();
  const name = (payload.name || payload.displayName || "Karyawan").trim();
  const nik = (payload.nik || "-").trim();
  
  // Gunakan OTP yang dikirim frontend atau generate 6-digit acak jika kosong
  let otpCode = (payload.otp || "").trim();
  if (!otpCode) {
    otpCode = String(Math.floor(100000 + Math.random() * 900000));
  }

  if (!email || email.indexOf("@") === -1) {
    return createJsonResponse({
      status: "error",
      success: false,
      message: "Alamat email tidak valid atau kosong: " + email
    });
  }

  const subject = "[IARMS] Kode Verifikasi OTP Reset Kata Sandi (" + otpCode + ")";

  const plainTextBody = "Halo " + name + ",\n\n" +
    "Kami menerima permintaan reset kata sandi untuk akun IARMS Anda.\n\n" +
    "Kode OTP Verifikasi Anda adalah: " + otpCode + "\n\n" +
    "Kode OTP ini berlaku selama 15 menit. Masukkan kode ini pada aplikasi untuk menyelesaikan reset kata sandi.\n\n" +
    "Jika Anda tidak melakukan permintaan ini, abaikan email ini. Akun Anda tetap aman.\n\n" +
    "Salam,\nTim Internal Audit IARMS";

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode OTP Reset Kata Sandi IARMS</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 30px 10px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
            <tr>
              <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 36px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  IARMS SECURITY
                </h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; font-weight: 500;">
                  Permintaan Reset Kata Sandi Akun
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 36px;">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #cbd5e1;">
                  Halo <strong style="color: #ffffff;">${escapeHtml(name)}</strong> (NIK: ${escapeHtml(nik)}),
                </p>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #94a3b8;">
                  Kami menerima permintaan untuk mereset kata sandi akun IARMS Anda. Gunakan kode verifikasi OTP di bawah ini untuk melanjutkan:
                </p>

                <div style="background-color: #082f49; border: 2px dashed #0284c7; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                  <div style="font-size: 11px; font-weight: 700; color: #7dd3fc; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
                    Kode OTP Verifikasi (6-Digit)
                  </div>
                  <div style="display: inline-block; background-color: #0b1120; border: 1px solid #38bdf8; border-radius: 8px; padding: 12px 28px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 28px; font-weight: 900; color: #38bdf8; letter-spacing: 6px;">
                    ${escapeHtml(otpCode)}
                  </div>
                  <div style="font-size: 12px; color: #bae6fd; margin-top: 12px; line-height: 18px;">
                    * Berlaku selama 15 menit. JANGAN bagikan kode ini kepada siapapun.
                  </div>
                </div>

                <p style="margin: 0; font-size: 12px; line-height: 20px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px;">
                  Jika Anda tidak melakukan permintaan reset kata sandi, abaikan email ini atau segera hubungi Tim Internal Audit.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #090d16; padding: 20px 36px; text-align: center; border-top: 1px solid #1e293b;">
                <div style="font-size: 11px; color: #64748b;">
                  &copy; ${new Date().getFullYear()} IARMS - Internal Audit Management System.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: plainTextBody,
      htmlBody: htmlBody,
      name: "IARMS Security"
    });

    const sheet = getOrCreateLogSheet("User_Activity_Logs");
    if (sheet) {
      sheet.appendRow([new Date().toISOString(), "reset_password_otp_sent", nik, email]);
    }

    return createJsonResponse({
      status: "success",
      success: true,
      message: "Kode OTP reset password berhasil dikirim ke email " + email,
      email: email,
      otp: otpCode
    });
  } catch (mailError) {
    return createJsonResponse({
      status: "error",
      success: false,
      message: "Gagal mengirim email verifikasi: " + mailError.toString(),
      email: email
    });
  }
}

/**
 * Handler for action: "password_updated"
 */
function handlePasswordUpdated(payload) {
  try {
    const email = payload.email || "";
    const nik = payload.nik || "";
    const timestamp = payload.timestamp || new Date().toISOString();

    const sheet = getOrCreateLogSheet("User_Activity_Logs");
    sheet.appendRow([timestamp, "password_updated", nik, email]);

    return createJsonResponse({
      status: "success",
      success: true,
      action: "password_updated"
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      success: false,
      error: err.toString()
    });
  }
}

/**
 * Utility: Log registration to spreadsheet if available
 */
function logRegistrationToSheet(data) {
  try {
    const sheet = getOrCreateLogSheet("User_Registrations");
    sheet.appendRow([data.timestamp, data.nik, data.name, data.email, data.role, data.action]);
  } catch (e) {
    // Ignore if spreadsheet is not linked to avoid breaking email sending
  }
}

/**
 * Utility: Get or create sheet in active spreadsheet
 */
function getOrCreateLogSheet(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return null;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (sheetName === "User_Registrations") {
        sheet.appendRow(["Timestamp", "NIK", "Nama", "Email", "Role", "Action"]);
      } else if (sheetName === "Sheet_Sync_Logs") {
        sheet.appendRow(["Timestamp", "Project", "Site", "Year", "Sheet URL / Status", "Raw Payload"]);
      }
    }
    return sheet;
  } catch (e) {
    return null;
  }
}

/**
 * Utility: Get projects list from spreadsheet
 */
function getProjectsFromSheet() {
  try {
    const sheet = getOrCreateLogSheet("Sheet_Sync_Logs");
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) return [];

    const results = [];
    for (let i = 1; i < values.length; i++) {
      results.push({
        timestamp: values[i][0],
        project: values[i][1],
        site: values[i][2],
        year: values[i][3],
        sheetUrl: values[i][4]
      });
    }
    return results;
  } catch (e) {
    return [];
  }
}

/**
 * Utility: Return CORS compliant JSON response
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utility: HTML escape string
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
