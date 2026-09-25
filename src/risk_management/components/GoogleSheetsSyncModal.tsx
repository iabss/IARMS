import { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  LogOut,
  Sparkles,
  Link,
  Save,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  googleSignOut,
} from '../services/googleAuth';
import {
  getSavedSpreadsheetId,
  getSavedSpreadsheetUrl,
  saveSpreadsheetInfo,
  syncAllRisksToSpreadsheet,
  createRiskSpreadsheet,
  getSyncedRiskIds,
  SheetSyncResult,
} from '../services/googleSheetsService';
import { RiskItem } from '../types/risk';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthLogout: () => void;
  risks: RiskItem[];
  onSyncComplete?: (result: SheetSyncResult) => void;
}

export const GoogleSheetsSyncModal = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onAuthSuccess,
  onAuthLogout,
  risks,
  onSyncComplete,
}: GoogleSheetsSyncModalProps) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [syncResult, setSyncResult] = useState<SheetSyncResult | null>(null);
  const [manualSheetId, setManualSheetId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSheetId = getSavedSpreadsheetId();
  const currentSheetUrl = getSavedSpreadsheetUrl();
  const syncedIds = getSyncedRiskIds();
  const pendingCount = risks.filter((r) => !syncedIds.has(r.id)).length;
  const syncedCount = risks.length - pendingCount;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk dengan akun Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      onAuthLogout();
      setSyncResult(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal keluar akun.');
    }
  };

  const handleCreateNewSheet = async () => {
    if (!accessToken) return;
    setIsCreatingSheet(true);
    setErrorMessage(null);
    try {
      const created = await createRiskSpreadsheet(accessToken);
      // Immediately sync all data to new sheet
      const result = await syncAllRisksToSpreadsheet(risks, accessToken, created.id);
      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat Google Sheet baru.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSyncAll = async () => {
    if (!accessToken) {
      setErrorMessage('Silakan hubungkan akun Google terlebih dahulu.');
      return;
    }
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const result = await syncAllRisksToSpreadsheet(risks, accessToken);
      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal sinkronisasi ke Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveManualSheetId = () => {
    if (!manualSheetId.trim()) return;
    const cleanId = manualSheetId.trim();
    saveSpreadsheetInfo(cleanId, `https://docs.google.com/spreadsheets/d/${cleanId}/edit`);
    setShowManualInput(false);
    setManualSheetId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
                  AUTO BACKUP & SINKRONISASI
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  Google Sheets Realtime
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Integrasi Backup Google Spreadsheet
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 text-xs text-slate-700 overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Account Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Status Akun Google:
                </span>
                {currentUser ? (
                  <div className="flex items-center space-x-2.5">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'User'}
                        className="w-9 h-9 rounded-full border border-emerald-500 shadow-2xs"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold">
                        {currentUser.displayName?.charAt(0) || 'G'}
                      </div>
                    )}
                    <div>
                      <p className="text-slate-900 font-semibold text-xs">
                        {currentUser.displayName || 'Akun Google Terhubung'}
                      </p>
                      <p className="text-slate-500 text-xs">{currentUser.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-slate-600">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Belum terhubung ke Akun Google. Masuk untuk mengaktifkan backup otomatis.</span>
                  </div>
                )}
              </div>

              {/* Login / Logout Button */}
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition flex items-center space-x-1.5 self-start sm:self-auto font-medium shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Akun</span>
                </button>
              ) : (
                /* Google Material Button */
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 font-semibold text-xs transition shadow-xs disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sync Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Data Risiko
              </span>
              <p className="text-xl font-bold text-slate-900 mt-1">{risks.length} Data</p>
              <span className="text-xs text-slate-500">Di database dashboard</span>
            </div>

            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Tersinkron ke Sheets
              </span>
              <p className="text-xl font-bold text-emerald-700 mt-1">{syncedCount} Data</p>
              <span className="text-xs text-emerald-600">Telah aman ter-backup</span>
            </div>

            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                Belum Masuk / Pending
              </span>
              <p className="text-xl font-bold text-amber-700 mt-1">{pendingCount} Data</p>
              <span className="text-xs text-amber-600">Perlu refresh / sync</span>
            </div>
          </div>

          {/* Auto Backup Info Callout */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sky-900 font-semibold text-xs">
                Otomatis Backup Saat Input Risiko Baru
              </p>
              <p className="text-xs text-sky-800 leading-relaxed">
                Ketika akun Google terhubung, setiap pengguna yang menginput risiko baru di form akan{' '}
                <strong>langsung ditambahkan otomatis ke baris spreadsheet backup</strong>. Jika koneksi sempat tertunda atau terdapat perubahan offline, cukup tekan tombol <strong>Refresh &amp; Sinkronisasi</strong> di bawah.
              </p>
            </div>
          </div>

          {/* Connected Spreadsheet Details */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Target Google Spreadsheet:
              </span>
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline flex items-center space-x-1"
              >
                <Link className="w-3.5 h-3.5" />
                <span>{showManualInput ? 'Batal Ganti ID' : 'Ganti / Hubungkan ID Lain'}</span>
              </button>
            </div>

            {showManualInput ? (
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="Masukkan Spreadsheet ID (misal: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
                  value={manualSheetId}
                  onChange={(e) => setManualSheetId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-sky-500 font-mono shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleSaveManualSheetId}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
            ) : currentSheetId ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 font-mono text-xs shadow-2xs">
                <div className="truncate">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ID SPREADSHEET:</span>
                  <span className="text-emerald-700 font-bold truncate block">{currentSheetId}</span>
                </div>
                {currentSheetUrl && (
                  <a
                    href={currentSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center space-x-1 shrink-0 self-start sm:self-auto font-sans font-semibold text-xs"
                  >
                    <span>Buka Spreadsheet</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                )}
              </div>
            ) : (
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                <p className="text-slate-600 text-xs">
                  Belum ada spreadsheet terhubung. Klik tombol di bawah untuk membuat spreadsheet backup baru secara otomatis di Google Drive Anda.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewSheet}
                  disabled={!accessToken || isCreatingSheet}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 inline-flex items-center space-x-1.5 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isCreatingSheet ? 'Membuat Spreadsheet...' : 'Buat Spreadsheet Backup Baru'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sync Result Toast */}
          {syncResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start space-x-2 text-xs ${
                syncResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{syncResult.message}</p>
                {syncResult.spreadsheetUrl && (
                  <a
                    href={syncResult.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center text-sky-600 hover:underline text-xs font-semibold"
                  >
                    <span>Lihat di Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-xs flex items-center space-x-1.5 self-start sm:self-auto font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Koneksi aman dengan Google Workspace OAuth 2.0</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition font-semibold"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={!accessToken || isSyncing}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center space-x-2 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Menyinkronkan...'
                  : pendingCount > 0
                  ? `Refresh & Sinkronisasi (${pendingCount} Pending)`
                  : 'Refresh & Sinkronisasi Semua'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
