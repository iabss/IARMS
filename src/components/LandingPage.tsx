import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  Mail, 
  Building2, 
  Briefcase, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Check, 
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  UserCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { 
  loginUserWithNikOrEmail, 
  registerUserWithNik, 
  completeFirstLoginPasswordChange,
  quickLoginDemo, 
  getInternalAuditInfo,
  DEMO_ACCOUNTS 
} from '../services/authService';
import { findEmployeeByNik } from '../data/employeeMasterData';

interface LandingPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  onExplorePublic?: () => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function LandingPage({
  onLoginSuccess,
  onExplorePublic,
  onToast
}: LandingPageProps) {
  const [viewMode, setViewMode] = useState<'login' | 'register' | 'register_success' | 'change_password_required'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States
  const [regNik, setRegNik] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regJobTitle, setRegJobTitle] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('auditee');

  // Master Employee Auto-Lookup States (Privacy-first: no dropdowns or suggestions)
  const [isNikMatched, setIsNikMatched] = useState(false);
  const [nikValidationMessage, setNikValidationMessage] = useState<string | null>(null);

  // Handle NIK input change with instant auto-lookup
  const handleNikChange = (value: string) => {
    setRegNik(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setIsNikMatched(false);
      setNikValidationMessage(null);
      setRegDisplayName('');
      setRegDepartment('');
      setRegJobTitle('');
      return;
    }

    // 1. Check Internal Audit personnel list
    const ia = getInternalAuditInfo(trimmed);
    if (ia) {
      setIsNikMatched(true);
      setNikValidationMessage(null);
      setRegDisplayName(ia.nama);
      setRegDepartment(ia.departemen || 'Internal Audit');
      setRegJobTitle(ia.jabatan || 'Internal Auditor');
      setRegRole('auditor');
      return;
    }

    // 2. Check Master Employee database
    const emp = findEmployeeByNik(trimmed);
    if (emp) {
      setIsNikMatched(true);
      setNikValidationMessage(null);
      setRegDisplayName(emp.name);
      setRegDepartment(emp.department || '');
      setRegJobTitle(emp.jobTitle || '');
      setRegRole('auditee');
      return;
    }

    // 3. Not found in master database
    setIsNikMatched(false);
    setNikValidationMessage('NIK tidak terdaftar dalam database karyawan.');
  };

  // Register Result State
  const [registeredTempInfo, setRegisteredTempInfo] = useState<{
    user: UserProfile;
    generatedPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // First-Login Password Change State
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Demo accounts drawer
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim()) {
      setErrorMessage('Masukkan NIK atau Username Anda.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Masukkan kata sandi akun Anda.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUserWithNikOrEmail(loginIdentifier, loginPassword);
      if (result.mustChangePassword) {
        setPendingUser(result.user);
        setViewMode('change_password_required');
        onToast('Anda baru pertama kali login. Silakan buat kata sandi baru untuk melanjutkan.', 'info');
      } else {
        onToast(`Selamat datang kembali, ${result.user.displayName}!`, 'success');
        onLoginSuccess(result.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regNik.trim()) {
      setErrorMessage('NIK (Nomor Induk Karyawan) wajib diisi.');
      return;
    }
    if (!isNikMatched) {
      setErrorMessage('NIK tidak terdaftar dalam database karyawan.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Alamat email kantor valid wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerUserWithNik({
        nik: regNik,
        email: regEmail,
        displayName: regDisplayName,
        department: regDepartment,
        jobTitle: regJobTitle,
        role: regRole
      });

      setRegisteredTempInfo(res);
      setViewMode('register_success');
      onToast('Registrasi berhasil! Silakan cek email Anda untuk mendapatkan password.', 'success');
    } catch (err: any) {
      const msg = err.message || 'Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle First-Time Password Change
  const handleFirstPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!pendingUser) return;
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await completeFirstLoginPasswordChange(pendingUser.uid, newPassword);
      onToast('Kata sandi baru berhasil disimpan! Selamat datang di sistem.', 'success');
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kata sandi baru.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Account Login
  const handleQuickDemo = (account: typeof DEMO_ACCOUNTS[0]) => {
    setErrorMessage(null);
    try {
      const user = quickLoginDemo(account);
      onToast(`Masuk sebagai ${user.displayName} (${user.isInternalAudit ? 'Internal Audit - Full 12 Menu' : 'Auditee - Akses Terbatas'})`, 'success');
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage('Gagal menggunakan akun demo.');
    }
  };

  const handleCopyTempPassword = () => {
    if (!registeredTempInfo) return;
    navigator.clipboard.writeText(registeredTempInfo.generatedPassword);
    setCopiedPassword(true);
    onToast('Kata sandi sementara disalin ke clipboard!', 'info');
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b1120] flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-900/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Container Card (matching exact user screenshot) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-[#162032] border border-[#23324c] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10"
      >
        {/* =================================================== */}
        {/* VIEW 1: LOGIN MODE (EXACT MATCH TO USER SCREENSHOT) */}
        {/* =================================================== */}
        {viewMode === 'login' && (
          <div>
            {/* Header: Shield Icon + AMS Web Audit Pro */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center gap-2 mb-1.5">
                {/* Shield icon with blue/cyan gradient */}
                <div className="relative flex items-center justify-center">
                  <Shield className="w-5 h-5 text-sky-400 fill-sky-400/30" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-sky-400 tracking-tight">
                  IARMS
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                Internal Audit Risk Management Systems
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Username / NIK Field */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Username / NIK
                </label>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Masukkan NIK atau admin..."
                  className="w-full px-4 py-2.5 sm:py-3 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-10 py-2.5 sm:py-3 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button (Bright Cyan / Sky Blue: 🚀 MASUK KE SISTEM) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-3.5 px-4 bg-[#00a3ff] hover:bg-[#0094e8] active:bg-[#0085d1] disabled:opacity-50 text-white font-bold text-sm tracking-wider uppercase rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>MEMVERIFIKASI...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>MASUK KE SISTEM</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Addition Requested by User: Register Option if no account yet */}
            <div className="mt-5 pt-4 border-t border-slate-700/50 text-center space-y-3">
              <p className="text-xs text-slate-400">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setViewMode('register');
                  }}
                  className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer ml-1"
                >
                  Daftar Akun Baru (NIK & Email)
                </button>
              </p>

              {/* Quick Demo Selector */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <span>Pilihan Akun Demo Pengujian</span>
                  {showDemoAccounts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDemoAccounts && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5 p-2 bg-[#0d1424] border border-[#202e47] rounded-xl space-y-1.5 text-left"
                  >
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 pt-1">
                      Klik salah satu untuk login instan:
                    </p>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleQuickDemo(DEMO_ACCOUNTS[0])}
                        className="w-full text-left p-1.5 px-2.5 hover:bg-slate-800/80 rounded-lg text-xs text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-sky-300">Demo Internal Auditor</p>
                          <p className="text-[10px] text-slate-400">Mode Uji Coba Auditor (Akses Penuh 12 Menu)</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          IA Full
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDemo(DEMO_ACCOUNTS[1])}
                        className="w-full text-left p-1.5 px-2.5 hover:bg-slate-800/80 rounded-lg text-xs text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-amber-300">Demo Auditee PIC</p>
                          <p className="text-[10px] text-slate-400">Mode Uji Coba Auditee (Akses Terbatas)</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                          Auditee
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDemo(DEMO_ACCOUNTS[2])}
                        className="w-full text-left p-1.5 px-2.5 hover:bg-slate-800/80 rounded-lg text-xs text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-indigo-300">Demo Management</p>
                          <p className="text-[10px] text-slate-400">Mode Uji Coba Eksekutif (Dashboard & Risk)</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">
                          Executive
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Direct Link to Public Portal */}
              {onExplorePublic && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onExplorePublic}
                    className="text-[11px] text-slate-400 hover:text-sky-300 transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>Jelajahi Portal Monitoring Publik</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================== */}
        {/* VIEW 2: REGISTER MODE (REQUESTED ADDITION)          */}
        {/* =================================================== */}
        {viewMode === 'register' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('login');
                }}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-400 fill-sky-400/30" />
                <span className="text-xs font-bold text-sky-400">IARMS</span>
              </div>
            </div>

            <div className="text-left mb-4">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Registrasi Akun Karyawan
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Masukkan NIK dan email resmi untuk aktivasi akun sistem.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </motion.div>
            )}

            {/* Register Form */}
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* NIK Input with Privacy-First Auto-Lookup */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  NIK (Nomor Induk Karyawan) *
                </label>
                <div className="relative">
                  <input
                    id="reg-nik"
                    type="text"
                    required
                    value={regNik}
                    onChange={(e) => handleNikChange(e.target.value)}
                    placeholder="Ketik NIK Anda (contoh: 1021048)..."
                    className={`w-full px-3.5 py-2.5 bg-[#0d1424] border rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 font-mono font-bold focus:outline-none transition-colors ${
                      isNikMatched 
                        ? 'border-emerald-500/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' 
                        : nikValidationMessage 
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' 
                          : 'border-[#22314d] focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                  />
                  {isNikMatched && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Validation message if NIK is not found in Master Database */}
                {nikValidationMessage && (
                  <motion.p
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-[11px] text-rose-400 font-medium flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span>{nikValidationMessage}</span>
                  </motion.p>
                )}

                {/* Verification success badge */}
                {isNikMatched && (
                  <motion.p
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-[11px] text-emerald-400 font-medium flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span>NIK terverifikasi di Master Data Karyawan</span>
                  </motion.p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="Nama Lengkap Karyawan"
                  className="w-full px-3.5 py-2 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Kantor (Untuk Terima Password) *
                </label>
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
                  className="w-full px-3.5 py-2 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Dept & Job Title Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Departemen
                    </label>
                    {isNikMatched && (
                      <span className="text-[10px] text-sky-400/90 font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Terkunci
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    readOnly={isNikMatched}
                    disabled={isNikMatched}
                    className={`w-full px-3 py-2 rounded-lg text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                      isNikMatched
                        ? 'bg-[#151f33] border border-[#253554] text-slate-300 cursor-not-allowed select-none'
                        : 'bg-[#0d1424] border border-[#22314d] text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Jabatan
                    </label>
                    {isNikMatched && (
                      <span className="text-[10px] text-sky-400/90 font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Terkunci
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={regJobTitle}
                    onChange={(e) => setRegJobTitle(e.target.value)}
                    readOnly={isNikMatched}
                    disabled={isNikMatched}
                    className={`w-full px-3 py-2 rounded-lg text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                      isNikMatched
                        ? 'bg-[#151f33] border border-[#253554] text-slate-300 cursor-not-allowed select-none'
                        : 'bg-[#0d1424] border border-[#22314d] text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="p-2.5 bg-sky-950/40 border border-sky-500/20 rounded-lg text-[11px] text-sky-200/80 leading-relaxed">
                Sistem akan membuat kata sandi acak yang aman dan mengirimkannya ke email Anda. Saat login pertama kali, Anda diwajibkan membuat kata sandi baru.
              </div>

              {/* Register Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#00a3ff] hover:bg-[#0094e8] active:bg-[#0085d1] disabled:opacity-50 text-white font-bold text-xs sm:text-sm tracking-wider uppercase rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>MEMPROSES PENDAFTARAN...</span>
                    </>
                  ) : (
                    <>
                      <span>📝</span>
                      <span>DAFTAR & DAPATKAN PASSWORD</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="text-xs text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  Sudah punya akun? <strong className="text-sky-400">Masuk ke Sistem</strong>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================== */}
        {/* VIEW 3: REGISTER SUCCESS (SHOW GENERATED PASSWORD) */}
        {/* =================================================== */}
        {viewMode === 'register_success' && registeredTempInfo && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">
                Pendaftaran Akun Berhasil!
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kredensial akun Anda telah aktif dan telah disinkronkan ke sistem.
              </p>
            </div>

            {/* Generated Credentials Card */}
            <div className="p-4 bg-[#0d1424] border border-[#22314d] rounded-xl text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Nama:</span>
                <span className="font-bold text-white">{registeredTempInfo.user.displayName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">NIK:</span>
                <span className="font-mono font-bold text-sky-400">{registeredTempInfo.user.nik}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{registeredTempInfo.user.email}</span>
              </div>

              {/* Notification: Sent to Email */}
              <div className="pt-3 border-t border-slate-700/60 space-y-2">
                <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-lg flex items-start gap-2.5 text-left">
                  <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-md shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-sky-200">
                      Kata Sandi Sementara Telah Dikirim ke Email
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Demi keamanan akun, kata sandi sementara tidak ditampilkan di layar dan telah dikirimkan langsung ke alamat email <strong className="text-white font-semibold">{registeredTempInfo.user.email}</strong>.
                    </p>
                    <p className="text-[10px] text-sky-300/80 italic">
                      * Silakan periksa folder Kotak Masuk (Inbox) atau Spam pada email Anda untuk melihat kata sandi sementara.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setLoginIdentifier(registeredTempInfo.user.nik);
                setLoginPassword('');
                setViewMode('login');
              }}
              className="w-full py-3 px-4 bg-[#00a3ff] hover:bg-[#0094e8] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🚀</span>
              <span>Lanjut Masuk ke Sistem</span>
            </button>
          </div>
        )}

        {/* =================================================== */}
        {/* VIEW 4: FORCE CHANGE PASSWORD (FIRST-TIME LOGIN)     */}
        {/* =================================================== */}
        {viewMode === 'change_password_required' && pendingUser && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400 mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Wajib Buat Kata Sandi Baru
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Halo <strong>{pendingUser.displayName}</strong>, demi keamanan Anda wajib membuat kata sandi baru saat pertama kali masuk.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleFirstPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Kata Sandi Baru (Min. 6 Karakter) *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Konfirmasi Kata Sandi Baru *
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru..."
                  className="w-full px-3.5 py-2.5 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Simpan Kata Sandi & Masuk</span>
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
