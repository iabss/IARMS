import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Cloud, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  FolderCheck, 
  Database, 
  FileSpreadsheet, 
  RefreshCw, 
  ShieldCheck,
  FileCode,
  Trash2,
  Server
} from 'lucide-react';
import { 
  DRIVE_FOLDER_ID, 
  getActiveFolderId,
  compileFullDatabase, 
  compileFindingsToCsv, 
  sendBackupToGasBackend,
  getRecentBackups,
  clearBackupHistory,
  BackupHistoryItem
} from '../services/googleDriveService';
import { GOOGLE_SCRIPT_URL } from '../services/api';
import { getMergedSheetRows } from '../data/dataSyncManager';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function GoogleDriveSyncModal({
  isOpen,
  onClose,
  onToast
}: GoogleDriveSyncModalProps) {
  const [folderId] = useState<string>(DRIVE_FOLDER_ID);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [recentBackups, setRecentBackups] = useState<BackupHistoryItem[]>([]);
  const [lastUploaded, setLastUploaded] = useState<{
    fileName: string;
    type: 'json' | 'csv';
    link: string;
    recordCount?: number;
    timestamp: string;
  } | null>(null);

  // Load backup history when opened
  useEffect(() => {
    if (isOpen) {
      setRecentBackups(getRecentBackups());
      setUploadStep(0);
      setUploadProgress(null);
    }

    const handleBackupUpdate = (e: any) => {
      if (e.detail?.history) {
        setRecentBackups(e.detail.history);
      } else {
        setRecentBackups(getRecentBackups());
      }
    };

    window.addEventListener('iams_backup_saved', handleBackupUpdate);
    return () => {
      window.removeEventListener('iams_backup_saved', handleBackupUpdate);
    };
  }, [isOpen]);

  // 1. Backup Full Database JSON directly to GAS Backend
  const handleBackupDatabaseJson = async () => {
    if (isUploading) return;

    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress('1/3 Menyiapkan payload database JSON & snapshot...');

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `IAMS_Database_Backup_${dateStr}_${timeStr}.json`;

      const dbData = compileFullDatabase();

      setUploadStep(2);
      setUploadProgress(`2/3 Mengirim payload ke Google Apps Script backend (${dbData.metrics.totalFindings} temuan)...`);

      const result = await sendBackupToGasBackend(fileName, dbData, 'json', folderId);

      setUploadStep(3);
      setUploadProgress('3/3 Backup berhasil tersimpan di Google Drive!');

      const finalLink = result.webViewLink || `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;
      setLastUploaded({
        fileName,
        type: 'json',
        link: finalLink,
        recordCount: dbData.metrics.totalFindings,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      setRecentBackups(getRecentBackups());
      onToast(`Database IAMS berhasil dibackup ke Google Drive! (${fileName})`, 'success');
    } catch (err: any) {
      console.error('Backup JSON error:', err);
      onToast(err.message || 'Gagal mengirim backup ke Google Apps Script', 'error');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3500);
    }
  };

  // 2. Export Findings CSV directly to GAS Backend
  const handleBackupCsv = async () => {
    if (isUploading) return;

    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress('1/3 Menyiapkan tabel CSV dari seluruh temuan audit...');

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `IAMS_Finding_Statements_${dateStr}_${timeStr}.csv`;

      const csvString = compileFindingsToCsv();
      const rowCount = getMergedSheetRows().length;

      setUploadStep(2);
      setUploadProgress(`2/3 Mengirim ${rowCount} baris spreadsheet ke Google Apps Script backend...`);

      const result = await sendBackupToGasBackend(fileName, csvString, 'csv', folderId);

      setUploadStep(3);
      setUploadProgress('3/3 File spreadsheet CSV berhasil tersimpan di Google Drive!');

      const finalLink = result.webViewLink || `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;
      setLastUploaded({
        fileName,
        type: 'csv',
        link: finalLink,
        recordCount: rowCount,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });

      setRecentBackups(getRecentBackups());
      onToast(`Spreadsheet temuan berhasil disimpan ke Google Drive! (${fileName})`, 'success');
    } catch (err: any) {
      console.error('Backup CSV error:', err);
      onToast(err.message || 'Gagal mengirim CSV ke Google Apps Script', 'error');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3500);
    }
  };

  const handleClearHistory = () => {
    clearBackupHistory();
    setRecentBackups([]);
    onToast('Riwayat catatan backup lokal telah dibersihkan', 'info');
  };

  if (!isOpen) return null;

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Cloud className="w-6 h-6 text-sky-200" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Simpan & Backup Google Drive</h2>
                <p className="text-xs text-sky-100/90 font-medium">
                  Direct Cloud Backup via Google Apps Script Backend (Tanpa Perlu Login Akun)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Target Folder & Backend Service Status */}
          <div className="bg-gradient-to-br from-sky-50/80 to-blue-50/60 border border-sky-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderCheck className="w-5 h-5 text-sky-600 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-sky-950">
                  Folder Tujuan Google Drive
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Langsung Terhubung
                </span>
              </div>
              <a
                href={folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all"
              >
                <span>Buka Folder Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="bg-white p-3 rounded-xl border border-sky-100 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span>Folder ID:</span>
                <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {folderId}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Backend Gateway:</span>
                <span className="text-[11px] font-medium text-slate-600 truncate max-w-xs font-mono" title={GOOGLE_SCRIPT_URL}>
                  Google Apps Script Web App (Ready)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                Data dikirimkan langsung ke backend dan disimpan ke Google Drive tanpa memerlukan izin login Google OAuth browser.
              </p>
            </div>

            {/* Direct Backup Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={handleBackupDatabaseJson}
                disabled={isUploading}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                <span>{isUploading && uploadStep === 1 ? 'Memproses...' : 'Backup Database Manual'}</span>
              </button>
              <button
                onClick={handleBackupCsv}
                disabled={isUploading}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Ekspor temuan audit ke spreadsheet format CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isUploading && uploadStep === 2 ? 'Memproses...' : 'Ekspor Spreadsheet (.CSV)'}</span>
              </button>
            </div>
          </div>

          {/* Live Upload Progress Box */}
          {isUploading && (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-sky-950">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Sedang Mengirim ke Google Drive...</span>
                </div>
                <span className="text-[11px] font-extrabold text-sky-700 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                  Langkah {uploadStep} / 3
                </span>
              </div>
              <p className="text-xs text-sky-800 font-medium">{uploadProgress}</p>
              <div className="w-full bg-sky-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(uploadStep / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Live Success Banner */}
          {lastUploaded && !isUploading && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h6 className="text-xs font-black text-emerald-950">Backup Berhasil Terkirim & Tersimpan!</h6>
                  <p className="text-[11px] text-emerald-700 font-medium truncate max-w-sm">
                    {lastUploaded.fileName} ({lastUploaded.recordCount} temuan • {lastUploaded.timestamp})
                  </p>
                </div>
              </div>
              <a
                href={lastUploaded.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>Buka di Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Recent Backups History */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                Riwayat Backup Terkini
              </span>
              <div className="flex items-center gap-2">
                {recentBackups.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1"
                    title="Bersihkan riwayat backup lokal"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Bersihkan</span>
                  </button>
                )}
                <button
                  onClick={() => setRecentBackups(getRecentBackups())}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {recentBackups.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Belum ada catatan backup terbaru. Klik tombol di atas untuk membuat backup pertama Anda.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {recentBackups.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {item.type === 'json' ? (
                        <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 block truncate" title={item.fileName}>
                          {item.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString('id-ID')}
                          {item.sizeFormatted ? ` • ${item.sizeFormatted}` : ''}
                          {item.recordCount !== undefined ? ` • ${item.recordCount} baris` : ''}
                        </span>
                      </div>
                    </div>
                    {item.webViewLink && (
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 flex items-center gap-1 text-[11px] font-bold shrink-0 ml-2"
                      >
                        <span>Lihat</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Server className="w-4 h-4 text-sky-600" />
            <span>Google Apps Script Direct Web App Cloud Gateway</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
