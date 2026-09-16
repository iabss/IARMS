import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  X
} from 'lucide-react';
import { UserProfile } from '../types';
import { changeUserPassword } from '../services/authService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose?: () => void;
  currentUser: UserProfile;
  isForced?: boolean; // If true: user CANNOT close the modal or click backdrop
  onSuccess: (updatedUser: UserProfile) => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  currentUser,
  isForced = false,
  onSuccess,
  onToast
}: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validation rules helper
  const hasMinLength = newPassword.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate old password
    if (!oldPassword) {
      setErrorMessage('Kata sandi lama atau sementara wajib diisi.');
      return;
    }

    // Validate new password rules (min 6-8 chars, combo letters/numbers)
    if (!hasMinLength) {
      setErrorMessage('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    if (!hasLetter || !hasNumber) {
      setErrorMessage('Kata sandi baru harus kombinasi huruf dan angka.');
      return;
    }

    if (newPassword === oldPassword) {
      setErrorMessage('Kata sandi baru tidak boleh sama dengan kata sandi lama.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const updated = await changeUserPassword({
        nik: currentUser.nik,
        oldPassword,
        newPassword
      });

      onToast('Kata sandi berhasil diperbarui dan disinkronkan ke server!', 'success');
      onSuccess(updated);
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || 'Gagal memperbarui kata sandi. Silakan periksa kata sandi lama Anda.';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={() => {
        // If not forced and user clicks backdrop, close
        if (!isForced && onClose) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto relative"
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 p-6 text-white">
          {/* Close button (ONLY IF NOT FORCED) */}
          {!isForced && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 rounded-xl border border-sky-400/30 text-sky-300">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                {isForced ? 'Wajib Buat Kata Sandi Baru' : 'Ganti Kata Sandi Akun'}
              </h2>
              <p className="text-xs text-sky-200/80 mt-0.5">
                NIK: <strong className="text-white font-mono">{currentUser.nik || '-'}</strong> &bull; {currentUser.displayName}
              </p>
            </div>
          </div>

          {isForced && (
            <div className="mt-3.5 p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Ini adalah login pertama Anda dengan kata sandi acak/sementara. <strong>Anda wajib mengganti kata sandi</strong> sebelum dapat mengakses sistem IARMS.
              </span>
            </div>
          )}
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMessage}</span>
            </div>
          )}

          {/* 1. Old Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isForced ? 'Password Sementara / Saat Ini *' : 'Password Lama / Saat Ini *'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showOldPassword ? 'text' : 'password'}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password saat ini..."
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showOldPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isForced && (
              <p className="text-[10px] text-slate-500 mt-1">
                * Masukkan password acak yang telah dikirimkan ke email Anda saat registrasi/reset.
              </p>
            )}
          </div>

          {/* 2. New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password Baru *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6-8 karakter..."
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showNewPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength hints */}
            <div className="mt-2 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className={hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  Minimal 6 karakter
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${hasLetter && hasNumber ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className={hasLetter && hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  Kombinasi huruf & angka
                </span>
              </div>
            </div>
          </div>

          {/* 3. Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Konfirmasi Password Baru *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru..."
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`text-[11px] mt-1 font-semibold ${isMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            {!isForced && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !hasMinLength || !hasLetter || !hasNumber || !isMatch}
              className={`py-2.5 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                isForced ? 'w-full py-3' : 'flex-1'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan ke Server...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Password Baru
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer note */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Sinkronisasi Otomatis Google Apps Script</span>
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Keamanan Terenkripsi
          </span>
        </div>
      </motion.div>
    </div>
  );
}
