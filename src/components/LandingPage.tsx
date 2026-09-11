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
  ChevronUp,
  Search,
  Database,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { 
  loginUserWithNikOrEmail, 
  registerUserWithNik, 
  completeFirstLoginPasswordChange,
  quickLoginDemo, 
  checkIsInternalAudit,
  getInternalAuditInfo,
  DEMO_ACCOUNTS 
} from '../services/authService';
import { 
  findEmployeeByNik, 
  searchEmployees, 
  getAllEmployees,
  MasterEmployee 
} from '../data/employeeMasterData';

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

  // Employee Master Data Auto-Fill States
  const [matchedEmployee, setMatchedEmployee] = useState<MasterEmployee | null>(null);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<MasterEmployee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  // Master Database Modal State
  const [showMasterDbModal, setShowMasterDbModal] = useState(false);
  const [masterDbSearch, setMasterDbSearch] = useState('');
  const [masterDbSite, setMasterDbSite] = useState('ALL');
  const [masterDbPage, setMasterDbPage] = useState(1);

  // Dynamic IA detection for registration
  const isNikInternalAudit = checkIsInternalAudit(regNik, regRole, regDepartment);

  // Apply Employee Master Data to Form
  const applyEmployeeData = (emp: MasterEmployee | { nik: string; nama: string; jabatan?: string; departemen?: string; email?: string; site?: string }) => {
    const nik = emp.nik;
    const name = 'nama' in emp ? emp.nama : (emp as MasterEmployee).name;
    const dept = 'departemen' in emp ? (emp.departemen || '') : (emp as MasterEmployee).department;
    const title = 'jabatan' in emp ? (emp.jabatan || '') : (emp as MasterEmployee).jobTitle;
    const site = emp.site || 'Head Office';

    setRegNik(nik);
    setRegDisplayName(name);
    setRegDepartment(dept);
    setRegJobTitle(title);
    setIsAutoFilled(true);
    setShowSuggestions(false);
    // Email sengaja dikosongkan agar diinput manual oleh user tanpa suggestion

    setMatchedEmployee({
      nik,
      name,
      department: dept,
      jobTitle: title,
      site
    });
  };

  // Handle NIK input with instant lookup and suggestions
  const handleNikInputChange = (val: string) => {
    setRegNik(val);
    const trimmed = val.trim();

    if (!trimmed) {
      setMatchedEmployee(null);
      setEmployeeSuggestions([]);
      setShowSuggestions(false);
      setIsAutoFilled(false);
      return;
    }

    // 1. Check exact Internal Audit personnel whitelist
    const ia = getInternalAuditInfo(trimmed);
    if (ia) {
      applyEmployeeData(ia);
      return;
    }

    // 2. Check exact Master Employee Database (5.806+ records)
    const foundEmp = findEmployeeByNik(trimmed);
    if (foundEmp) {
      applyEmployeeData(foundEmp);
      return;
    }

    // If not exact match yet, clear auto-filled flags and reset stale auto-filled data
    setMatchedEmployee(null);
    if (isAutoFilled) {
      setRegDisplayName('');
      setRegDepartment('');
      setRegJobTitle('');
      setIsAutoFilled(false);
    }

    // Search for matching NIKs or names for dropdown suggestion
    if (trimmed.length >= 2) {
      const matches = searchEmployees(trimmed, 5);
      setEmployeeSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setEmployeeSuggestions([]);
      setShowSuggestions(false);
    }
  };

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
                          <p className="font-bold text-sky-300">1021048 - Miftahul Majid</p>
                          <p className="text-[10px] text-slate-400">Lead Auditor (Akses 12 Menu Penuh)</p>
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
                          <p className="font-bold text-sky-300">1006059 - Renny Antikawati</p>
                          <p className="text-[10px] text-slate-400">Internal Auditor (Akses 12 Menu Penuh)</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          IA Full
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDemo(DEMO_ACCOUNTS[3])}
                        className="w-full text-left p-1.5 px-2.5 hover:bg-slate-800/80 rounded-lg text-xs text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-amber-300">1088921 - Ahmad Yani</p>
                          <p className="text-[10px] text-slate-400">Auditee PIC Operasional (Akses Terbatas)</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                          Auditee
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
              {/* NIK Input */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    NIK (Nomor Induk Karyawan) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMasterDbModal(true);
                      setMasterDbSearch('');
                      setMasterDbSite('ALL');
                      setMasterDbPage(1);
                    }}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                  >
                    <Search className="w-3 h-3" />
                    <span>Cek Master Database ({getAllEmployees().length.toLocaleString('id-ID')} Data)</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regNik}
                    onChange={(e) => handleNikInputChange(e.target.value)}
                    onFocus={() => {
                      if (employeeSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    placeholder="Ketik NIK atau cari nama karyawan..."
                    className="w-full px-3.5 py-2.5 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 font-mono font-bold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  {isAutoFilled && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown if user is typing partial NIK or Name */}
                {showSuggestions && employeeSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-[#10192b] border border-[#273859] rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <div className="p-2 border-b border-slate-700/60 bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400 font-bold flex justify-between items-center">
                      <span>Pilih Karyawan Terdaftar:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowSuggestions(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800/80">
                      {employeeSuggestions.map((emp) => (
                        <button
                          key={emp.nik}
                          type="button"
                          onClick={() => applyEmployeeData(emp)}
                          className="w-full text-left p-2.5 hover:bg-sky-900/30 transition-colors cursor-pointer flex items-center justify-between group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sky-400 text-xs">{emp.nik}</span>
                              <span className="font-medium text-white text-xs">{emp.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {emp.jobTitle} &bull; <strong className="text-slate-300">{emp.department}</strong>
                            </p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {emp.site || 'Site'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                  Email *
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
                  className="w-full px-3.5 py-2 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Dept & Job Title Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Departemen
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Jabatan
                  </label>
                  <input
                    type="text"
                    value={regJobTitle}
                    onChange={(e) => setRegJobTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1424] border border-[#22314d] rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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

      {/* Master Database Modal Viewer */}
      {showMasterDbModal && (() => {
        const allMasterEmployees = getAllEmployees();
        const availableSites = Array.from(new Set(allMasterEmployees.map(e => e.site?.trim().toUpperCase()).filter(Boolean) as string[])).sort();
        const q = masterDbSearch.trim().toLowerCase();
        const filteredList = allMasterEmployees.filter((emp) => {
          const matchesQuery = !q || (
            emp.nik.toLowerCase().includes(q) ||
            emp.name.toLowerCase().includes(q) ||
            emp.department.toLowerCase().includes(q) ||
            emp.jobTitle.toLowerCase().includes(q)
          );
          const matchesSite = masterDbSite === 'ALL' || emp.site?.toUpperCase() === masterDbSite.toUpperCase();
          return matchesQuery && matchesSite;
        });

        const PAGE_SIZE = 15;
        const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
        const currentPage = Math.min(masterDbPage, totalPages);
        const paginated = filteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-[#223354] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#223354] flex items-center justify-between bg-[#131d35]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        Database Master Karyawan IARMS
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {allMasterEmployees.length.toLocaleString('id-ID')} Total Data
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cek ketersediaan NIK, Nama, Departemen, dan Site Anda di database internal.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMasterDbModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search and Site Filters */}
              <div className="p-4 border-b border-[#223354] bg-[#0b1120] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={masterDbSearch}
                    onChange={(e) => {
                      setMasterDbSearch(e.target.value);
                      setMasterDbPage(1);
                    }}
                    placeholder="Cari NIK, Nama Karyawan, Departemen, atau Jabatan..."
                    className="w-full pl-9 pr-3.5 py-2 bg-[#131d35] border border-[#223354] rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">Site:</span>
                  <select
                    value={masterDbSite}
                    onChange={(e) => {
                      setMasterDbSite(e.target.value);
                      setMasterDbPage(1);
                    }}
                    className="bg-[#131d35] border border-[#223354] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
                  >
                    <option value="ALL">Semua Site ({availableSites.length} Site)</option>
                    {availableSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table / List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredList.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-200">
                      NIK atau Nama "{masterDbSearch}" Tidak Ditemukan di Master Database
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Jangan khawatir! Anda tetap dapat mendaftar dengan mengetikkan NIK serta Nama Lengkap, Departemen, dan Jabatan secara manual pada formulir pendaftaran.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRegNik(masterDbSearch);
                        setShowMasterDbModal(false);
                      }}
                      className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Lanjut Daftar dengan NIK Ini ({masterDbSearch})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#223354] rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#131d35] text-slate-300 font-semibold border-b border-[#223354]">
                        <tr>
                          <th className="p-3">NIK</th>
                          <th className="p-3">Nama Karyawan</th>
                          <th className="p-3">Jabatan</th>
                          <th className="p-3">Departemen</th>
                          <th className="p-3">Site</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2c47]">
                        {paginated.map((emp) => (
                          <tr key={emp.nik} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-sky-400">
                              {emp.nik}
                            </td>
                            <td className="p-3 font-medium text-white">
                              {emp.name}
                            </td>
                            <td className="p-3 text-slate-300">
                              {emp.jobTitle}
                            </td>
                            <td className="p-3 text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                                {emp.department}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[11px]">
                              {emp.site || 'BAYAN'}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  applyEmployeeData(emp);
                                  setShowMasterDbModal(false);
                                  onToast(`NIK ${emp.nik} (${emp.name}) berhasil dipilih.`, 'success');
                                }}
                                className="px-2.5 py-1 bg-sky-600/80 hover:bg-sky-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>Pilih</span>
                                <Check className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination and Footer Note */}
              <div className="p-4 border-t border-[#223354] bg-[#0b1120] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div>
                  Menampilkan <strong>{paginated.length}</strong> dari <strong>{filteredList.length}</strong> karyawan
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setMasterDbPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg bg-[#131d35] border border-[#223354] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
                    >
                      Sebelumnya
                    </button>
                    <span className="px-2 font-mono text-[11px] text-slate-300">
                      Hal {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setMasterDbPage(p => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg bg-[#131d35] border border-[#223354] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowMasterDbModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
