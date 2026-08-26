import { 
  getMergedSheetRows, 
  recordAchievementSnapshot, 
  getDailyCutoffConfig, 
  saveDailyCutoffConfig, 
  saveDailyCutoffLog, 
  DailyCutoffLog,
  DailyCutoffConfig
} from '../data/dataSyncManager';
import { 
  getDriveAccessToken, 
  compileFullDatabase, 
  compileFindingsToCsv, 
  uploadToDrive,
  getActiveFolderId 
} from './googleDriveService';

let isCutoffRunning = false;

// Helper to get local date formatted as YYYY-MM-DD
export function getLocalFormattedDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Execute the 09:00 Daily Cutoff snapshot & Google Drive cloud backup
export async function runDailyCutoffProcess(
  isManual: boolean = false,
  tokenOverride?: string,
  customDate?: string
): Promise<{ success: boolean; log: DailyCutoffLog; message: string }> {
  if (isCutoffRunning) {
    throw new Error('Proses Cut-Off sedang berjalan, silakan tunggu...');
  }

  isCutoffRunning = true;
  const now = new Date();
  const dateStr = customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate.trim()) 
    ? customDate.trim() 
    : getLocalFormattedDate(now);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const config = getDailyCutoffConfig();

  try {
    // 1. Calculate and record snapshot
    const note = isManual 
      ? `Cut-Off Manual: ${dateStr} (Pukul ${timeStr} WIB)`
      : `Cut-Off Harian Otomatis (09:00 WIB)`;

    const snapshot = recordAchievementSnapshot(note, isManual ? 'manual' : 'sync', dateStr);

    // 2. Prepare daily log record
    const logId = `cutoff_${dateStr}_${Date.now()}`;
    const cutoffLog: DailyCutoffLog = {
      id: logId,
      date: dateStr,
      timestamp: customDate ? `${dateStr}T00:00:00.000Z` : now.toISOString(),
      closeRate: snapshot.closeRate,
      totalRows: snapshot.totalRows,
      closedRows: snapshot.closedRows,
      openRows: snapshot.openRows,
      progressRows: snapshot.progressRows,
      driveSyncStatus: 'pending',
      isManualTrigger: isManual
    };

    // 3. Perform Google Drive auto-backup if enabled
    let driveMessage = '';
    if (config.autoDriveBackup) {
      let token = tokenOverride || await getDriveAccessToken();

      if (token) {
        try {
          const dbData = compileFullDatabase();
          // Annotate cutoff metadata in the backup payload
          const backupPayload = {
            ...dbData,
            cutoffType: isManual ? 'manual_cutoff' : 'daily_09_00_cutoff',
            cutoffDate: dateStr,
            cutoffTime: '09:00:00',
            cutoffMetrics: {
              closeRate: snapshot.closeRate,
              totalFindings: snapshot.totalRows,
              closedFindings: snapshot.closedRows,
              openFindings: snapshot.openRows,
              progressFindings: snapshot.progressRows
            }
          };

          const fileName = `IAMS_Daily_Cutoff_09_00_${dateStr}.json`;
          const targetFolder = config.targetFolderId || getActiveFolderId();

          const uploaded = await uploadToDrive(
            token,
            fileName,
            JSON.stringify(backupPayload, null, 2),
            'application/json',
            targetFolder
          );

          cutoffLog.driveSyncStatus = 'success';
          cutoffLog.driveFileName = fileName;
          cutoffLog.driveFileLink = uploaded.webViewLink;
          driveMessage = ' Data berhasil otomatis di-backup ke Google Drive!';
        } catch (driveErr: any) {
          console.error('Auto Drive Cutoff Upload Failed:', driveErr);
          cutoffLog.driveSyncStatus = 'failed';
          cutoffLog.errorMessage = driveErr.message || 'Gagal upload ke Google Drive';
          driveMessage = ' (Upload ke Drive gagal, periksa koneksi akun Google).';
        }
      } else {
        cutoffLog.driveSyncStatus = 'skipped';
        cutoffLog.errorMessage = 'Akun Google belum terhubung';
        driveMessage = ' (Opsi Google Drive aktif, namun akun Google belum login).';
      }
    } else {
      cutoffLog.driveSyncStatus = 'skipped';
    }

    // 4. Update configuration & persist logs
    saveDailyCutoffConfig({
      lastCutoffDate: dateStr,
      lastCutoffTimestamp: now.toISOString()
    });

    saveDailyCutoffLog(cutoffLog);

    return {
      success: true,
      log: cutoffLog,
      message: `Cut-off ${dateStr} berhasil dieksekusi dengan Closing Rate ${snapshot.closeRate}%.${driveMessage}`
    };
  } catch (err: any) {
    console.error('Daily Cutoff Error:', err);
    throw err;
  } finally {
    isCutoffRunning = false;
  }
}

// Background Scheduler: checks every 30 seconds if today's 09:00 cutoff should run
export function initDailyCutoffScheduler(onNotify?: (msg: string, type: 'info' | 'success' | 'warning') => void) {
  const triggerCheck = async () => {
    const config = getDailyCutoffConfig();
    if (!config.enabled) return;

    const now = new Date();
    const todayStr = getLocalFormattedDate(now);
    const targetHour = typeof config.cutoffHour === 'number' ? config.cutoffHour : 9;
    const targetMinute = typeof config.cutoffMinute === 'number' ? config.cutoffMinute : 0;

    // Check if current time is at or past 09:00 WIB
    const isPastCutoffTime = (now.getHours() > targetHour) || 
      (now.getHours() === targetHour && now.getMinutes() >= targetMinute);

    // If cutoff time reached today and hasn't run for today yet
    if (isPastCutoffTime && config.lastCutoffDate !== todayStr) {
      try {
        console.log(`[Daily Cutoff] Auto-executing daily cutoff (09:00 WIB) for ${todayStr}...`);
        const res = await runDailyCutoffProcess(false);
        if (onNotify) {
          onNotify(res.message, 'success');
        }
      } catch (e: any) {
        console.error('[Daily Cutoff] Auto-execution error:', e);
      }
    }
  };

  // Run initial check on app start
  const initialTimer = setTimeout(() => {
    triggerCheck();
  }, 2500);

  const checkInterval = setInterval(triggerCheck, 30000); // check every 30 seconds

  return () => {
    clearTimeout(initialTimer);
    clearInterval(checkInterval);
  };
}
