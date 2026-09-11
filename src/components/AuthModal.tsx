import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Building2, 
  Briefcase, 
  ShieldCheck, 
  LogIn, 
  UserPlus, 
  Sparkles, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Hash
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { 
  loginUserWithNikOrEmail, 
  registerUserWithNik, 
  completeFirstLoginPasswordChange,
  quickLoginDemo, 
  checkIsInternalAudit,
  getInternalAuditInfo,
  DEMO_ACCOUNTS 
} from '../services/authService';
import { findEmployeeByNik } from '../data/employeeMasterData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onSuccess?: (user: UserProfile) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onToast,
  onSuccess
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'change_password_required' | 'register_success'>(initialMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login Form Fields
  const [loginIdentifier, setLoginIdentifier] = useState(''); // NIK or Email
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form Fields
  const [regNik, setRegNik] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regJobTitle, setRegJobTitle] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('auditee');

  // Register Success State
  const [registeredTempInfo, setRegisteredTempInfo] = useState<{
    user: UserProfile;
    generatedPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Force Change Password State (on first login)
  const [pendingChangeUser, setPendingChangeUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  if (!isOpen) return null;

  const isNikInternalAudit = checkIsInternalAudit(regNik, regRole, regDepartment);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Mohon masukkan NIK / Email dan Kata Sandi.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUserWithNikOrEmail(loginIdentifier, loginPassword);

      if (result.mustChangePassword) {
        // "untuk login harus buat pasword baru"
        setPendingChangeUser(result.user);
        setMode('change_password_required');
        onToast('Login pertama kali terdeteksi! Silakan buat kata sandi baru Anda.', 'info');
      } else {
        onToast(`Selamat datang kembali, ${result.user.displayName}!`, 'success');
        if (onSuccess) onSuccess(result.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk. Periksa kembali NIK/Email dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regNik.trim()) {
      setErrorMessage('Nomor Induk Karyawan (NIK) wajib diisi.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Masukkan alamat email yang valid.');
      return;
    }

    setLoading(true);
    try {
      const result = await registerUserWithNik({
        nik: regNik.trim(),
        email: regEmail.trim(),
        displayName: regDisplayName.trim() || `Karyawan (${regNik.trim()})`,
        department: regDepartment.trim(),
        jobTitle: regJobTitle.trim(),
        role: isNikInternalAudit ? 'auditor' : regRole
      });

      setRegisteredTempInfo(result);
      setMode('register_success');
      onToast(`Akun berhasil dibuat! Kata sandi acak telah dikirimkan ke email ${result.user.email}`, 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal melakukan registrasi akun.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Submit New Password (Force change password)
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!pendingChangeUser) return;
    if (newPassword.length < 6) {
      setErrorMessage('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await completeFirstLoginPasswordChange(pendingChangeUser.uid, newPassword);
      onToast(`Kata sandi baru berhasil disimpan! Selamat bekerja, ${updatedUser.displayName}.`, 'success');
      if (onSuccess) onSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kata sandi baru.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Login
  const handleQuickDemoLogin = (account: typeof DEMO_ACCOUNTS[0]) => {
    setErrorMessage(null);
    try {
      const user = quickLoginDemo(account);
      onToast(`Masuk sebagai ${user.displayName} (NIK: ${user.nik}) - ${user.isInternalAudit ? 'Internal Audit' : 'Non-IA'}`, 'success');
      if (onSuccess) onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage('Gagal menggunakan akun demo.');
    }
  };

  // Copy Temporary Password
  const handleCopyTempPassword = () => {
    if (!registeredTempInfo) return;
    navigator.clipboard.writeText(registeredTempInfo.generatedPassword);
    setCopiedPassword(true);
    onToast('Kata sandi sementara disalin ke clipboard!', 'info');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
      >
        {/* Header with gradient branding */}
        <div className="relative bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">IARMS Portal</h2>
              <p className="text-xs text-sky-200/80">Sistem Autentikasi NIK & Otorisasi Menu Terpadu</p>
            </div>
          </div>

          {/* Mode Switch Tabs (only visible during standard login or register) */}
          {(mode === 'login' || mode === 'register') && (
            <div className="mt-5 flex bg-black/25 p-1 rounded-xl backdrop-blur-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <LogIn className="w-4 h-4" /> Masuk (Login NIK)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Daftar Akun (NIK & Email)
              </button>
            </div>
          )}
        </div>

        {/* Modal Form Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* Error Message Alert */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
            </motion.div>
          )}

          {/* ===== 1. LOGIN FORM ===== */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Induk Karyawan (NIK) atau Email Kerja
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Contoh: IA-1001 atau nama@iarms.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Kata Sandi
                  </label>
                  <span className="text-[11px] text-slate-400">Kata sandi akun / email</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memverifikasi akun...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Masuk ke Sistem IARMS
                  </>
                )}
              </button>

              {/* Demo Accounts Quick Selection */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Akses Cepat Akun Demo (Uji Coba Hak Akses):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.uid}
                      type="button"
                      onClick={() => handleQuickDemoLogin(acc)}
                      className="p-2.5 text-left border border-slate-200 hover:border-sky-400 hover:bg-sky-50/60 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black px-1 rounded bg-slate-100 text-slate-700">
                          {acc.nik}
                        </span>
                        {acc.isInternalAudit ? (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">All Menus</span>
                        ) : (
                          <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Restricted</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-sky-700 truncate mt-1">
                        {acc.displayName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{acc.department}</p>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* ===== 2. REGISTER FORM ===== */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Cukup daftarkan <strong>NIK dan Email</strong> Anda. Sistem akan <strong>secara otomatis membuatkan kata sandi acak</strong> dan mengirimkannya ke email Anda. Saat login pertama kali, Anda akan diarahkan untuk membuat kata sandi baru.
                </p>
              </div>

              {/* NIK Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Karyawan (NIK) *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regNik}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setRegNik(val);
                      const ia = getInternalAuditInfo(val);
                      if (ia) {
                        setRegDisplayName(ia.nama);
                        setRegDepartment(ia.departemen || 'Internal Audit');
                        setRegJobTitle(ia.jabatan || 'Internal Auditor');
                        return;
                      }
                      const emp = findEmployeeByNik(val);
                      if (emp) {
                        setRegDisplayName(emp.name);
                        setRegDepartment(emp.department || '');
                        setRegJobTitle(emp.jobTitle || '');
                        return;
                      }
                      // Jika NIK tidak ditemukan di database, kosongkan agar data lama tidak tertinggal
                      setRegDisplayName('');
                      setRegDepartment('');
                      setRegJobTitle('');
                    }}
                    placeholder="Contoh NIK: 1021048 atau 1006059 atau NIK Auditee"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-mono font-bold"
                  />
                </div>
                {regNik && (
                  <div className="mt-1.5 text-[11px] font-medium">
                    {isNikInternalAudit ? (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          Terverifikasi: <strong>Tim Internal Audit</strong> — Akses Penuh ke Seluruh Menu & Konfigurasi.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          Status: <strong>Auditee (Akses Terbatas)</strong> — Hanya dapat mengakses menu yang diaktifkan oleh Tim Internal Audit.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Email Perusahaan (Untuk Menerima Password) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="karyawan@perusahaan.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap & Gelar
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="Nama Lengkap Karyawan"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {/* Department & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Departemen / Unit Kerja
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      placeholder="Departemen / Unit Kerja"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jabatan / Posisi
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regJobTitle}
                      onChange={(e) => setRegJobTitle(e.target.value)}
                      placeholder="Jabatan / Posisi"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mendaftarkan & Mengirimkan Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Daftar & Kirim Password Acak ke Email
                  </>
                )}
              </button>
            </form>
          )}

          {/* ===== 3. REGISTER SUCCESS STATE (SHOW GENERATED PASSWORD) ===== */}
          {mode === 'register_success' && registeredTempInfo && (
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">Registrasi Berhasil!</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Kata sandi acak telah berhasil digenerate dan dikirimkan ke alamat email:{' '}
                  <span className="font-bold text-slate-900">{registeredTempInfo.user.email}</span>
                </p>
              </div>

              {/* Password Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Kata Sandi Sementara Anda:</span>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Wajib Ganti saat Login
                  </span>
                </div>

                <div className="flex items-center justify-between bg-white border border-slate-300 rounded-xl px-3 py-2">
                  <span className="font-mono text-sm font-black text-sky-800 tracking-wider">
                    {registeredTempInfo.generatedPassword}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTempPassword}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Salin Kata Sandi"
                  >
                    {copiedPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                  <p>&bull; NIK: <strong className="text-slate-800">{registeredTempInfo.user.nik}</strong></p>
                  <p>&bull; Status Akses: <strong className="text-slate-800">{registeredTempInfo.user.isInternalAudit ? 'Internal Audit (Akses Semua Menu)' : 'Non-Internal Audit (Akses Dibatasi)'}</strong></p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier(registeredTempInfo.user.nik);
                    setLoginPassword(registeredTempInfo.generatedPassword);
                    setMode('login');
                  }}
                  className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Gunakan Password Ini untuk Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===== 4. FORCE CHANGE PASSWORD FORM (FIRST LOGIN) ===== */}
          {mode === 'change_password_required' && pendingChangeUser && (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Buat Kata Sandi Baru Anda</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Halo <strong>{pendingChangeUser.displayName}</strong> (NIK: {pendingChangeUser.nik}). Ini adalah login pertama Anda dengan kata sandi acak. Demi keamanan, Anda diwajibkan untuk membuat kata sandi baru Anda sendiri.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi Baru * (Minimal 6 Karakter)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ulangi Kata Sandi Baru *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan Kata Sandi Baru...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan Kata Sandi & Masuk ke IARMS
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Otorisasi Hak Akses Menu Berbasis NIK</span>
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            IARMS Security Active
          </span>
        </div>
      </motion.div>
    </div>
  );
}
