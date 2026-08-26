import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Clock, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Calendar, 
  Database, 
  FileCode, 
  Check, 
  Sliders, 
  HardDrive,
  Sparkles
} from 'lucide-react';
import { 
  getDailyCutoffConfig, 
  saveDailyCutoffConfig, 
  getDailyCutoffLogs, 
  DailyCutoffConfig, 
  DailyCutoffLog 
} from '../data/dataSyncManager';
import { runDailyCutoffProcess } from '../services/cutoffService';
import { getDriveAccessToken, getActiveFolderId, googleSignIn } from '../services/googleDriveService';

interface DailyCutoffPanelProps {
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenDriveBackup?: () => void;
}

export default function DailyCutoffPanel({ onToast, onOpenDriveBackup }: DailyCutoffPanelProps) {
  const [config, setConfig] = useState<DailyCutoffConfig>(getDailyCutoffConfig());
  const [logs, setLogs] = useState<DailyCutoffLog[]>(getDailyCutoffLogs());
  const [isRunning, setIsRunning] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [folderId, setFolderId] = useState<string>(getActiveFolderId());
  const [selectedCutoffDate, setSelectedCutoffDate] = useState<string>('2026-08-18');

  // Check drive token status & listen for cutoff events
  useEffect(() => {
    const checkToken = async () => {
      const token = await getDriveAccessToken();
      setIsDriveConnected(!!token);
    };
    checkToken();

    const handleLogUpdate = (e: any) => {
      if (e.detail?.history) {
        setLogs(e.detail.history);
      } else {
        setLogs(getDailyCutoffLogs());
      }
      setConfig(getDailyCutoffConfig());
    };

    window.addEventListener('iams_cutoff_log_updated', handleLogUpdate);
    window.addEventListener('iams_cutoff_config_updated', handleLogUpdate);
    return () => {
      window.removeEventListener('iams_cutoff_log_updated', handleLogUpdate);
      window.removeEventListener('iams_cutoff_config_updated', handleLogUpdate);
    };
  }, []);

  const handleToggleEnable = () => {
    const next = !config.enabled;
    const updated = saveDailyCutoffConfig({ enabled: next });
    setConfig(updated);
    onToast(
      next ? 'Otomatisasi Cut-Off Harian 00:00 diaktifkan.' : 'Otomatisasi Cut-Off dinonaktifkan.',
      next ? 'success' : 'info'
    );
  };

  const handleToggleAutoDrive = () => {
    const next = !config.autoDriveBackup;
    const updated = saveDailyCutoffConfig({ autoDriveBackup: next });
    setConfig(updated);
    onToast(
      next ? 'Auto-Backup ke Google Drive saat Cut-Off diaktifkan.' : 'Auto-Backup ke Google Drive dinonaktifkan.',
      next ? 'success' : 'info'
    );
  };

  const handleManualRunCutoff = async (customDate?: string) => {
    setIsRunning(true);
    const targetDate = customDate || selectedCutoffDate || undefined;
    onToast(`Sedang memproses Cut-Off (${targetDate || 'Hari Ini'}) & sinkronisasi data ke Google Drive...`, 'info');
    try {
      const res = await runDailyCutoffProcess(true, undefined, targetDate);
      setLogs(getDailyCutoffLogs());
      setConfig(getDailyCutoffConfig());
      onToast(res.message, 'success');
    } catch (err: any) {
      console.error('Manual Cutoff error:', err);
      onToast(err.message || 'Gagal menjalankan Cut-Off.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setIsDriveConnected(true);
        onToast(`Google Drive terhubung: ${res.user.email}`, 'success');
      }
    } catch (err: any) {
      onToast('Gagal menghubungkan akun Google Drive.', 'error');
    }
  };

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Banner Card */}
      <div className="bg-gradient-to-br from-[#0c2340] via-[#103258] to-[#0a192f] text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-sky-900/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-400/30 rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Otomatisasi Cut-Off Harian 09:00 WIB</span>
              </span>
              {config.enabled ? (
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Sistem Aktif</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-lg text-[11px] font-bold">
                  Nonaktif
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Cut-Off Database Otomatis & Sinkronisasi Google Drive
            </h2>
            <p className="text-xs sm:text-sm text-sky-100/80 leading-relaxed font-medium">
              Sistem secara otomatis mengunci (*snapshot*) data capaian closing audit setiap hari pukul <strong>09:00 WIB</strong>, dan langsung mengunggah file cadangan database JSON ke folder Google Drive Anda.
            </p>
          </div>

          {/* Action Trigger Button & Custom Date Control */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 self-start lg:self-auto shrink-0">
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/20">
              <span className="text-[11px] font-bold text-sky-200 pl-2">Tanggal:</span>
              <input
                type="date"
                value={selectedCutoffDate}
                onChange={(e) => setSelectedCutoffDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white text-slate-900 font-extrabold text-xs rounded-xl focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setSelectedCutoffDate('2026-08-18')}
                className="px-2.5 py-1.5 bg-sky-500/30 hover:bg-sky-500/50 text-white font-bold text-xs rounded-xl border border-sky-300/30 cursor-pointer"
                title="Pilih 18 Agustus 2026 sebagai Cut-Off"
              >
                18 Ags
              </button>
            </div>

            <button
              onClick={() => handleManualRunCutoff(selectedCutoffDate)}
              disabled={isRunning}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-wait hover:scale-105 active:scale-95"
              title="Eksekusi backup manual untuk tanggal yang dipilih"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>{isRunning ? 'Sedang Memproses...' : 'Backup Manual'}</span>
            </button>

            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
              title="Buka folder tujuan Google Drive di tab baru"
            >
              <Cloud className="w-4 h-4 text-sky-300" />
              <span>Buka Drive</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-200" />
            </a>
          </div>
        </div>
      </div>

      {/* Grid: Status & Konfigurasi Parameter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Waktu & Jadwal Cutoff */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-800">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-wider">Jadwal Cut-Off</span>
            </div>
            <button
              onClick={handleToggleEnable}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                config.enabled ? 'bg-sky-600' : 'bg-slate-300'
              }`}
              title={config.enabled ? 'Nonaktifkan cut-off otomatis' : 'Aktifkan cut-off otomatis'}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  config.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">09:00 WIB</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {config.enabled 
                ? 'Aktif otomatis setiap hari pukul 09:00 WIB' 
                : 'Otomatisasi saat ini dinonaktifkan'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cut-Off Terakhir:</span>
            <span className="font-bold text-slate-800">
              {config.lastCutoffDate || 'Belum pernah dieksekusi'}
            </span>
          </div>
        </div>

        {/* Card 2: Status Google Drive Cloud Sync */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-800">
              <Cloud className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-wider">Auto-Sync Google Drive</span>
            </div>
            <button
              onClick={handleToggleAutoDrive}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                config.autoDriveBackup ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
              title={config.autoDriveBackup ? 'Nonaktifkan auto-sync drive' : 'Aktifkan auto-sync drive'}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  config.autoDriveBackup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-900">
                {isDriveConnected ? 'Akun Google Terhubung' : 'Google Drive Belum Login'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Format: <span className="font-semibold text-indigo-600">.JSON Database & Snapshot</span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            {!isDriveConnected ? (
              <button
                onClick={handleConnectDrive}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
              >
                <span>Login Google Sekarang</span>
              </button>
            ) : (
              <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Otomatis Unggah Siap</span>
              </span>
            )}
            {onOpenDriveBackup && (
              <button
                onClick={onOpenDriveBackup}
                className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold"
              >
                Kelola Akun
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Target Folder ID */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <Database className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Folder Penyimpanan</span>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-500">Google Drive Folder ID:</div>
            <div className="font-mono text-xs font-extrabold text-slate-800 bg-slate-100 p-2 rounded-xl mt-1 truncate">
              {folderId}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Akses:</span>
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 text-[11px]"
            >
              <span>Buka di Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Riwayat Log Cut-Off Harian */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" />
              <span>Riwayat Log Cut-Off & Status Google Drive</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Catatan riwayat cut-off harian beserta persentase closing temuan dan tautan file backup.
            </p>
          </div>

          <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl self-start sm:self-auto">
            {logs.length} Catatan Cut-Off
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Belum Ada Riwayat Cut-Off</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Sistem akan mencatat log pertama saat jam 09:00 WIB atau ketika Anda mengklik tombol Cut-Off.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Tanggal Cut-Off</th>
                  <th className="py-3 px-4">Waktu Eksekusi</th>
                  <th className="py-3 px-4">Tipe Trigger</th>
                  <th className="py-3 px-4 text-center">Closing Rate (%)</th>
                  <th className="py-3 px-4 text-center">Total Temuan</th>
                  <th className="py-3 px-4">Status Google Drive</th>
                  <th className="py-3 px-4 text-right">Aksi File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => {
                  const execDate = new Date(item.timestamp);
                  const timeFormatted = `${String(execDate.getHours()).padStart(2, '0')}:${String(execDate.getMinutes()).padStart(2, '0')}:${String(execDate.getSeconds()).padStart(2, '0')} WIB`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        {item.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {timeFormatted}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isManualTrigger ? (
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold">
                            Manual Trigger
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-bold">
                            Auto 09:00 WIB
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-sm font-black text-slate-900">
                          {item.closeRate.toFixed(2).replace('.', ',')}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {item.totalRows}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          ({item.closedRows} Close, {item.openRows} Open)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.driveSyncStatus === 'success' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tersimpan di Drive</span>
                          </span>
                        ) : item.driveSyncStatus === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px]" title={item.errorMessage}>
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Gagal Upload</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium text-[11px]">
                            <span>Dilewati / Offline</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.driveFileLink ? (
                          <a
                            href={item.driveFileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all"
                          >
                            <span>Buka File</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
