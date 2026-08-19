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

// Execute the 00:00 Daily Cutoff snapshot & Google Drive cloud backup
export async function runDailyCutoffProcess(
  isManual: boolean = false,
  tokenOverride?: string
): Promise<{ success: boolean; log: DailyCutoffLog; message: string }> {
  if (isCutoffRunning) {
    throw new Error('Proses Cut-Off sedang berjalan, silakan tunggu...');
  }

  isCutoffRunning = true;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const config = getDailyCutoffConfig();

  try {
    // 1. Calculate and record snapshot
    const note = isManual 
      ? `Cut-Off Manual (Pukul ${timeStr} WIB)`
      : `Cut-Off Harian Otomatis (00:00 WIB)`;

    const snapshot = recordAchievementSnapshot(note, 'sync');

    // 2. Prepare daily log record
    const logId = `cutoff_${dateStr}_${Date.now()}`;
    const cutoffLog: DailyCutoffLog = {
      id: logId,
      date: dateStr,
      timestamp: now.toISOString(),
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
            cutoffType: isManual ? 'manual_cutoff' : 'daily_00_00_cutoff',
            cutoffDate: dateStr,
            cutoffTime: '00:00:00',
            cutoffMetrics: {
              closeRate: snapshot.closeRate,
              totalFindings: snapshot.totalRows,
              closedFindings: snapshot.closedRows,
              openFindings: snapshot.openRows,
              progressFindings: snapshot.progressRows
            }
          };

          const fileName = `IAMS_Daily_Cutoff_00_00_${dateStr}.json`;
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

// Background Scheduler: checks every 30 seconds if today's 00:00 cutoff should run
export function initDailyCutoffScheduler(onNotify?: (msg: string, type: 'info' | 'success' | 'warning') => void) {
  const checkInterval = setInterval(async () => {
    const config = getDailyCutoffConfig();
    if (!config.enabled) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // If cutoff hasn't run for today, and local hour is 0 (or beyond 00:00)
    if (config.lastCutoffDate !== todayStr) {
      // If current hour is 0 (00:00 - 00:59) OR it's a new day and previous day was missed
      if (now.getHours() === (config.cutoffHour || 0)) {
        try {
          console.log(`[Daily Cutoff] Triggering automatic 00:00 cutoff for ${todayStr}...`);
          const res = await runDailyCutoffProcess(false);
          if (onNotify) {
            onNotify(res.message, 'success');
          }
        } catch (e: any) {
          console.error('[Daily Cutoff] Auto-execution error:', e);
        }
      }
    }
  }, 30000); // check every 30 seconds

  return () => clearInterval(checkInterval);
}
