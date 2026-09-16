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
  Hash,
  RotateCcw
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { 
  loginUserWithNikOrEmail, 
  registerUserWithNik, 
  completeFirstLoginPasswordChange,
  quickLoginDemo, 
  checkIsInternalAudit,
  getInternalAuditInfo,
  updateStuckAccountEmail,
  resendPasswordForUser,
  requestPasswordReset,
  completePasswordReset,
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
  const [mode, setMode] = useState<
    'login' | 'register' | 'change_password_required' | 'register_success' | 'resend_verification' | 'forgot_password_request' | 'forgot_password_verify'
  >(initialMode);
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

  // Master Employee Auto-Lookup State
  const [isNikMatched, setIsNikMatched] = useState(false);
  const [nikValidationMessage, setNikValidationMessage] = useState<string | null>(null);

  // Resend / Update Email State (Fitur Akun Tersangkut)
  const [resendNik, setResendNik] = useState('');
  const [resendEmail, setResendEmail] = useState('');

  // Forgot Password / Reset OTP States
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Handle NIK change with instant auto-lookup
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

    // 1. Check Internal Audit personnel whitelist
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

    // 3. NIK not found
    setIsNikMatched(false);
    setNikValidationMessage('NIK tidak terdaftar dalam database karyawan.');
  };

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
    if (!isNikMatched) {
      setErrorMessage('NIK tidak terdaftar dalam database karyawan.');
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
      onToast('Registrasi berhasil! Silakan cek email Anda untuk mendapatkan password.', 'success');
    } catch (err: any) {
      const msg = err.message || 'Gagal mengirim password ke email. Silakan coba lagi.';
      setErrorMessage(msg);
      onToast(msg, 'error');
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

  // Handle Resend Verification / Kirim Ulang Password (Fitur Akun Tersangkut / Belum Terima Email)
  const handleResendVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!resendNik.trim()) {
      setErrorMessage('Nomor Induk Karyawan (NIK) wajib diisi.');
      return;
    }
    if (!resendEmail.trim() || !resendEmail.includes('@')) {
      setErrorMessage('Masukkan alamat email yang valid.');
      return;
    }

    setLoading(true);
    try {
      const result = await resendPasswordForUser({
        nik: resendNik.trim(),
        email: resendEmail.trim()
      });

      onToast(result.message, 'success');
      setErrorMessage(null);
      setMode('login');
      setLoginIdentifier(resendNik.trim());
      setLoginPassword('');
    } catch (err: any) {
      const msg = err.message || 'Gagal mengirim password ke email. Silakan coba lagi.';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Lupa Password Step 1: Request OTP
  const handleForgotPasswordRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const targetId = forgotIdentifier.trim() || loginIdentifier.trim();
    if (!targetId) {
      setErrorMessage('Mohon masukkan NIK atau Email terdaftar Anda.');
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(targetId);
      setForgotIdentifier(targetId);
      setResetTargetEmail(result.email);
      setResetOtp('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setMode('forgot_password_verify');
      onToast(`Kode OTP 6-digit berhasil dikirimkan ke email: ${result.email}`, 'success');
    } catch (err: any) {
      const msg = err.message || 'Gagal mengirim email verifikasi reset password. Pastikan akun terdaftar.';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Lupa Password Step 2: Verify OTP & Set New Password
  const handleForgotPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = resetOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMessage('Masukkan 6-digit kode OTP yang dikirimkan ke email Anda.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setErrorMessage('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await completePasswordReset({
        identifier: forgotIdentifier.trim(),
        otp: cleanOtp,
        newPassword: resetNewPassword
      });

      onToast(`Kata sandi berhasil direset! Selamat datang kembali, ${updatedUser.displayName}.`, 'success');
      if (onSuccess) onSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Gagal mereset kata sandi. Periksa kode OTP Anda.';
      setErrorMessage(msg);
      onToast(msg, 'error');
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

          {/* Sub-mode header banners */}
          {mode === 'resend_verification' && (
            <div className="mt-4 flex items-center justify-between bg-black/25 px-3 py-2 rounded-xl text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-sky-300" /> Pembaruan Email & Kirim Ulang
              </span>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMessage(null); }}
                className="text-sky-200 hover:text-white underline cursor-pointer text-[11px]"
              >
                Kembali ke Daftar
              </button>
            </div>
          )}
          {(mode === 'forgot_password_request' || mode === 'forgot_password_verify') && (
            <div className="mt-4 flex items-center justify-between bg-black/25 px-3 py-2 rounded-xl text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-300" /> Reset Kata Sandi
              </span>
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMessage(null); }}
                className="text-sky-200 hover:text-white underline cursor-pointer text-[11px]"
              >
                Kembali ke Masuk
              </button>
            </div>
          )}
        </div>

        {/* Modal Form Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* Error Message Alert with contextual action */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <span className="font-medium leading-relaxed block">{errorMessage}</span>
                
                {/* Fitur Kirim Ulang Password Action Link */}
                {(errorMessage.toLowerCase().includes('sudah terdaftar') || errorMessage.toLowerCase().includes('terdaftar') || errorMessage.toLowerCase().includes('gagal mengirim password')) && mode !== 'resend_verification' && (
                  <div className="pt-2 border-t border-rose-200/80 flex items-center justify-between flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResendNik(regNik.trim() || loginIdentifier.trim());
                        setResendEmail(regEmail.trim());
                        setErrorMessage(null);
                        setMode('resend_verification');
                      }}
                      className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-white px-3 py-1.5 rounded-lg border border-sky-300 shadow-xs hover:shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                      <span>Belum terima email? Kirim Ulang Password</span>
                    </button>
                  </div>
                )}
              </div>
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
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(loginIdentifier || '');
                      setErrorMessage(null);
                      setMode('forgot_password_request');
                    }}
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline cursor-pointer"
                  >
                    Lupa Password?
                  </button>
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

              {/* NIK Input with Auto-Lookup */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Karyawan (NIK) *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="modal-reg-nik"
                    type="text"
                    required
                    value={regNik}
                    onChange={(e) => handleNikChange(e.target.value)}
                    className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:outline-none transition-all font-mono font-bold ${
                      isNikMatched
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                        : nikValidationMessage
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-300 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500'
                    }`}
                  />
                  {isNikMatched && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Validation message if NIK is not found in Master Database */}
                {nikValidationMessage && (
                  <p className="mt-1.5 text-[11px] text-rose-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                    <span>{nikValidationMessage}</span>
                  </p>
                )}

                {/* Success verification message */}
                {isNikMatched && (
                  <div className="mt-1.5 text-[11px] font-medium">
                    {isNikInternalAudit ? (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          Terverifikasi: <strong>Tim Internal Audit</strong> — Akses Penuh ke Seluruh Menu & Konfigurasi.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          NIK terverifikasi: <strong>{regDisplayName}</strong> ({regDepartment || 'Operasional'})
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Departemen / Unit Kerja
                    </label>
                    {isNikMatched && (
                      <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Terkunci
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      readOnly={isNikMatched}
                      disabled={isNikMatched}
                      placeholder="Departemen / Unit Kerja"
                      className={`w-full pl-10 pr-3.5 py-2 text-xs border rounded-xl focus:outline-none transition-all ${
                        isNikMatched
                          ? 'bg-slate-100/90 border-slate-300 text-slate-600 cursor-not-allowed select-none'
                          : 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Jabatan / Posisi
                    </label>
                    {isNikMatched && (
                      <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Terkunci
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regJobTitle}
                      onChange={(e) => setRegJobTitle(e.target.value)}
                      readOnly={isNikMatched}
                      disabled={isNikMatched}
                      placeholder="Jabatan / Posisi"
                      className={`w-full pl-10 pr-3.5 py-2 text-xs border rounded-xl focus:outline-none transition-all ${
                        isNikMatched
                          ? 'bg-slate-100/90 border-slate-300 text-slate-600 cursor-not-allowed select-none'
                          : 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-wider uppercase"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Password ke Email...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>DAFTAR & DAPATKAN PASSWORD</span>
                  </>
                )}
              </button>

              {/* Link Kirim Ulang Password / Belum Terima Email */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResendNik(regNik.trim());
                    setResendEmail(regEmail.trim());
                    setErrorMessage(null);
                    setMode('resend_verification');
                  }}
                  className="text-xs text-amber-600 hover:text-amber-800 font-semibold hover:underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Belum terima email? <strong>Kirim Ulang Password</strong></span>
                </button>
              </div>
            </form>
          )}

          {/* ===== 2B. FITUR KIRIM ULANG PASSWORD (OPSI RESET / RESEND) ===== */}
          {mode === 'resend_verification' && (
            <form onSubmit={handleResendVerificationSubmit} className="space-y-4">
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Kirim Ulang Password ke Email</p>
                  <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                    Jika NIK Anda sudah terdaftar namun Anda belum menerima email password atau perlu reset, masukkan NIK dan alamat email aktif Anda di bawah ini. Sistem akan membuat ulang password acak baru dan mengirimkannya via MailApp.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Induk Karyawan (NIK) *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={resendNik}
                    onChange={(e) => {
                      setResendNik(e.target.value);
                      const ia = getInternalAuditInfo(e.target.value.trim());
                      if (ia?.email && !resendEmail) {
                        setResendEmail(ia.email);
                      }
                    }}
                    placeholder="Contoh: 1021048"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Email Penerima Password *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="nama.karyawan@perusahaan.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim Password ke Email...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    KIRIM ULANG PASSWORD
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('register');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  &larr; Kembali ke Form Registrasi
                </button>
              </div>
            </form>
          )}

          {/* ===== 2C. LUPA PASSWORD STEP 1: INPUT NIK / EMAIL ===== */}
          {mode === 'forgot_password_request' && (
            <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Lupa Kata Sandi Akun</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Masukkan NIK atau alamat email terdaftar Anda. Kami akan mengirimkan kode verifikasi OTP 6-digit ke email tersebut untuk mengatur ulang kata sandi Anda.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Induk Karyawan (NIK) atau Email Terdaftar *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="Contoh: 1021048 atau nama@iarms.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirimkan Kode OTP ke Email...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Kirim Kode OTP Verifikasi
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('login');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  &larr; Batal & Kembali ke Halaman Masuk
                </button>
              </div>
            </form>
          )}

          {/* ===== 2D. LUPA PASSWORD STEP 2: INPUT OTP 6-DIGIT & PASSWORD BARU ===== */}
          {mode === 'forgot_password_verify' && (
            <form onSubmit={handleForgotPasswordVerify} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Kode OTP Berhasil Dikirim!</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Kode verifikasi OTP 6-digit telah dikirim ke: <strong className="text-emerald-950">{resetTargetEmail}</strong>. Masukkan kode tersebut dan buat kata sandi baru Anda.
                  </p>
                </div>
              </div>

              {/* OTP 6-Digit Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode OTP 6-Digit *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full py-2.5 px-4 text-center tracking-[0.4em] font-mono text-xl font-black bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-800"
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[11px] text-slate-400">Cek Kotak Masuk atau Spam</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleForgotPasswordRequest()}
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-bold cursor-pointer disabled:opacity-50"
                  >
                    Kirim Ulang OTP
                  </button>
                </div>
              </div>

              {/* Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi Baru * (Minimal 6 Karakter)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru"
                    className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ulangi Kata Sandi Baru *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
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
                    Simpan Kata Sandi Baru & Masuk
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('login');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  &larr; Batal & Kembali ke Halaman Masuk
                </button>
              </div>
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
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 max-w-sm mx-auto">
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-sky-900">
                      Kata Sandi Sementara Dikirim ke Email
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Demi keamanan akun, kata sandi sementara tidak ditampilkan di layar dan telah dikirimkan langsung ke alamat email:{' '}
                      <strong className="text-slate-900 font-semibold">{registeredTempInfo.user.email}</strong>
                    </p>
                    <p className="text-[10px] text-slate-500 italic">
                      * Silakan periksa folder Kotak Masuk (Inbox) atau Spam pada email Anda untuk melihat kata sandi.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200">
                  <p>&bull; NIK: <strong className="text-slate-800">{registeredTempInfo.user.nik}</strong></p>
                  <p>&bull; Status Akses: <strong className="text-slate-800">{registeredTempInfo.user.isInternalAudit ? 'Internal Audit (Akses Semua Menu)' : 'Non-Internal Audit (Akses Dibatasi)'}</strong></p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier(registeredTempInfo.user.nik);
                    setLoginPassword('');
                    setMode('login');
                  }}
                  className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Lanjut Masuk ke Sistem</span>
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
