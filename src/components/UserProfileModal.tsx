import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  User, 
  Mail, 
  Building2, 
  Briefcase, 
  ShieldCheck, 
  LogOut, 
  Calendar, 
  Users, 
  Save, 
  CheckCircle2, 
  ShieldAlert,
  Hash,
  KeyRound,
  Lock
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { 
  getCurrentUser, 
  updateUserProfile, 
  logoutUser, 
  getRegisteredUsers,
  quickLoginDemo,
  DEMO_ACCOUNTS
} from '../services/authService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onToast,
  onLogout,
  onOpenLogin
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser?.role || 'auditor');

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      updateUserProfile({
        displayName: displayName.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        role: selectedRole
      });
      setIsEditing(false);
      onToast('Profil pengguna berhasil diperbarui!', 'success');
    } catch (err: any) {
      onToast(err.message || 'Gagal memperbarui profil', 'error');
    }
  };

  const registeredUsers = getRegisteredUsers();

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'auditor':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">Lead Auditor</span>;
      case 'auditee':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Auditee / PIC</span>;
      case 'management':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Manajemen</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Publik</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
      >
        {/* Header banner */}
        <div className="relative bg-gradient-to-r from-slate-800 via-slate-900 to-sky-950 p-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-black text-xl flex items-center justify-center shadow-lg border-2 border-white/20 flex-shrink-0">
              {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold truncate text-white">
                {currentUser?.displayName || 'Pengguna Sistem'}
              </h3>
              <p className="text-xs text-slate-300 truncate">{currentUser?.email || 'Tamu / Publik'}</p>
              <div className="mt-1.5 flex items-center gap-2">
                {getRoleBadge(currentUser?.role || 'public')}
              </div>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
            <button
              onClick={() => setActiveTab('profile')}
              className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'profile' ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Info Akun
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'users' ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Daftar Pengguna ({registeredUsers.length})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {activeTab === 'profile' ? (
            <div>
              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Peran (Role)</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="auditor">Lead Auditor (Full Access)</option>
                      <option value="auditee">Auditee / PIC Departemen</option>
                      <option value="management">Manajemen / Eksekutif</option>
                      <option value="public">Akses Publik / Tamu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Departemen / Unit</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jabatan / Posisi</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Simpan Perubahan
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-slate-400" /> NIK Karyawan
                      </span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded text-xs">
                        {currentUser?.nik || 'NO-NIK'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Status Hak Akses
                      </span>
                      <span className="font-semibold text-xs">
                        {currentUser?.isInternalAudit ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Internal Audit (Semua Menu)
                          </span>
                        ) : (
                          <span className="text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-sky-600" /> Non-IA (Akses Dibatasi)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                      </span>
                      <span className="font-semibold text-slate-800">{currentUser?.email || '-'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> Departemen
                      </span>
                      <span className="font-semibold text-slate-800">{currentUser?.department || 'Internal Audit'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Jabatan
                      </span>
                      <span className="font-semibold text-slate-800">{currentUser?.jobTitle || 'Auditor'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Terdaftar Sejak
                      </span>
                      <span className="font-medium text-slate-600">
                        {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Aktif'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Ubah Data Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logoutUser();
                        onLogout();
                        onToast('Anda telah keluar dari sistem.', 'info');
                        onClose();
                      }}
                      className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 mb-2">
                Daftar seluruh akun internal yang terdaftar dalam sistem IARMS:
              </p>
              {registeredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="p-3 bg-slate-50 hover:bg-sky-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold px-1 rounded bg-slate-200 text-slate-800">
                        {user.nik || 'NO-NIK'}
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">{user.displayName}</p>
                      {user.isInternalAudit ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          IA (All Menus)
                        </span>
                      ) : (
                        getRoleBadge(user.role)
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.department} • {user.jobTitle}</p>
                  </div>
                  {user.email !== currentUser?.email && (
                    <button
                      type="button"
                      onClick={() => {
                        quickLoginDemo(user);
                        onToast(`Beralih akun ke: ${user.displayName}`, 'success');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-sky-600 hover:text-white border border-slate-300 hover:border-sky-600 text-slate-700 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      Alihkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
