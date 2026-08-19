import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  HardDrive, 
  LogOut, 
  ShieldCheck,
  DownloadCloud,
  FileCode
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  DRIVE_FOLDER_ID, 
  getActiveFolderId,
  setActiveFolderId,
  initGoogleAuth, 
  googleSignIn, 
  googleSignOut, 
  getDriveAccessToken, 
  compileFullDatabase, 
  compileFindingsToCsv, 
  uploadToDrive, 
  listFolderFiles, 
  DriveUploadedFile 
} from '../services/googleDriveService';

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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>(DRIVE_FOLDER_ID);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<DriveUploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [lastUploadedLink, setLastUploadedLink] = useState<string | null>(null);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
        loadFolderFiles(authToken, folderId);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    return () => unsubscribe();
  }, [folderId]);

  const loadFolderFiles = async (authToken: string, targetFolder: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listFolderFiles(authToken, targetFolder);
      setRecentFiles(files);
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        onToast(`Berhasil terhubung dengan akun Google: ${result.user.email}`, 'success');
        loadFolderFiles(result.accessToken, folderId);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      onToast('Gagal menghubungkan akun Google. Pastikan popup tidak diblokir.', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setRecentFiles([]);
      onToast('Akun Google berhasil diputuskan.', 'info');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // 1. Backup Full Database JSON
  const handleBackupDatabaseJson = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getDriveAccessToken();
    }
    if (!currentToken) {
      onToast('Silakan login ke Google terlebih dahulu.', 'warning');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Menyiapkan file backup database JSON...');
    try {
      const dbData = compileFullDatabase();
      const jsonString = JSON.stringify(dbData, null, 2);
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `IAMS_Database_Backup_${dateStr}_${timeStr}.json`;

      setUploadProgress(`Mengunggah ${fileName} ke Google Drive...`);
      const uploaded = await uploadToDrive(currentToken, fileName, jsonString, 'application/json', folderId);
      const curFolder = getActiveFolderId();
      setFolderId(curFolder);

      onToast(`Database IAMS berhasil disimpan ke Google Drive! (${fileName})`, 'success');
      if (uploaded.webViewLink) {
        setLastUploadedLink(uploaded.webViewLink);
      }
      loadFolderFiles(currentToken, curFolder);
    } catch (err: any) {
      console.error('Backup JSON error:', err);
      onToast(err.message || 'Gagal mengunggah backup ke Google Drive', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // 2. Export Findings CSV / Spreadsheet
  const handleBackupCsv = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getDriveAccessToken();
    }
    if (!currentToken) {
      onToast('Silakan login ke Google terlebih dahulu.', 'warning');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Menyiapkan file tabel spreadsheet CSV...');
    try {
      const csvString = compileFindingsToCsv();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `IAMS_Finding_Statements_${dateStr}.csv`;

      setUploadProgress(`Mengunggah ${fileName} ke Google Drive...`);
      const uploaded = await uploadToDrive(currentToken, fileName, csvString, 'text/csv', folderId);
      const curFolder = getActiveFolderId();
      setFolderId(curFolder);

      onToast(`Tabel temuan audit berhasil disimpan ke Google Drive! (${fileName})`, 'success');
      if (uploaded.webViewLink) {
        setLastUploadedLink(uploaded.webViewLink);
      }
      loadFolderFiles(currentToken, curFolder);
    } catch (err: any) {
      console.error('Backup CSV error:', err);
      onToast(err.message || 'Gagal mengunggah CSV ke Google Drive', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  if (!isOpen) return null;

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=drive_link`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Cloud className="w-6 h-6 text-sky-200" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Simpan & Backup ke Google Drive</h2>
                <p className="text-xs text-sky-100/90 font-medium">
                  Integrasi cloud otomatis ke folder Google Drive Anda
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Target Folder Info Box */}
          <div className="bg-sky-50/70 border border-sky-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderCheck className="w-5 h-5 text-sky-600 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-sky-900">
                  Folder Tujuan di Google Drive
                </span>
              </div>
              <a
                href={folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <span>Buka Folder Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="bg-white p-3 rounded-xl border border-sky-100 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Folder ID:</span>
                <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                  {folderId}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                File database dan spreadsheet akan langsung dibuat dan tersimpan di dalam folder ini.
              </p>
            </div>
          </div>

          {/* Authentication State */}
          {!user ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-800">
                  Hubungkan Akun Google Anda
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Untuk menyimpan file database ke Google Drive, lakukan otorisasi akun Google satu kali dengan aman.
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-300 shadow-sm transition-all hover:shadow hover:border-slate-400 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Connected Bar */}
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      user.email?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-emerald-800">
                        {user.displayName || 'Akun Google Terhubung'}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      {user.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Putuskan</span>
                </button>
              </div>

              {/* Upload Actions Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Pilihan Simpan ke Drive
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Action 1: Database JSON */}
                  <button
                    onClick={handleBackupDatabaseJson}
                    disabled={isUploading}
                    className="p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 bg-gradient-to-br from-white to-indigo-50/40 text-left transition-all group disabled:opacity-50 shadow-xs hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Backup Database Lengkap
                        </h5>
                        <span className="text-[11px] font-bold text-indigo-600">Format .JSON</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                      Menyimpan seluruh data temuan, riwayat snapshot tren, dan konfigurasi sistem.
                    </p>
                  </button>

                  {/* Action 2: CSV / Spreadsheet */}
                  <button
                    onClick={handleBackupCsv}
                    disabled={isUploading}
                    className="p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 text-left transition-all group disabled:opacity-50 shadow-xs hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-black text-slate-900 group-hover:text-emerald-700">
                          Ekspor Spreadsheet Temuan
                        </h5>
                        <span className="text-[11px] font-bold text-emerald-600">Format .CSV / Sheets</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                      Menyimpan seluruh baris temuan audit yang siap dibuka di Google Sheets / Excel.
                    </p>
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              {isUploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs font-semibold text-blue-900 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span>{uploadProgress || 'Sedang mengunggah ke Google Drive...'}</span>
                </div>
              )}

              {/* Upload Success Alert */}
              {lastUploadedLink && !isUploading && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h6 className="text-xs font-black text-emerald-950">File Berhasil Tersimpan!</h6>
                      <p className="text-[11px] text-emerald-700">File telah diunggah ke Google Drive Anda.</p>
                    </div>
                  </div>
                  <a
                    href={lastUploadedLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <span>Buka File Sekarang</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Recent Files in Drive Folder */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                    File Terkini di Folder Google Drive
                  </span>
                  <button
                    onClick={() => token && loadFolderFiles(token, folderId)}
                    disabled={isLoadingFiles}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {isLoadingFiles ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Memuat daftar file di folder...</p>
                ) : recentFiles.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada file di folder ini. Klik tombol di atas untuk melakukan backup pertama Anda.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {recentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {file.mimeType.includes('json') ? (
                            <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Koneksi aman dengan Google Drive API v3</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
