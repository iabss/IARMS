import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Users, 
  Search, 
  Check, 
  Save, 
  RefreshCw, 
  Lock, 
  Unlock, 
  CheckSquare, 
  Square, 
  AlertCircle,
  Building2,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Database,
  Plus,
  ArrowRight,
  Upload,
  Link,
  Loader2,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { UserProfile, UserRole, InternalAuditMember, MenuItemConfig } from '../types';
import { 
  SYSTEM_MENUS, 
  getInternalAuditMembers, 
  saveInternalAuditMembers, 
  getAuditeeConfiguredMenus, 
  saveAuditeeConfiguredMenus, 
  getRegisteredUsers, 
  updateUserMenuPermissions,
  canUserAccessMenu
} from '../services/authService';
import { 
  getAllEmployees, 
  addCustomEmployee, 
  bulkSetEmployees,
  MasterEmployee 
} from '../data/employeeMasterData';

interface AccessSettingsProps {
  key?: string;
  currentUser: UserProfile | null;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AccessSettings({ currentUser, onToast }: AccessSettingsProps) {
  // State for Internal Audit members list
  const [iaMembers, setIaMembers] = useState<InternalAuditMember[]>(() => getInternalAuditMembers());
  
  // State for Auditee Allowed Menus (Apa saja yang bisa diakses dan tidak)
  const [auditeeMenus, setAuditeeMenus] = useState<string[]>(() => getAuditeeConfiguredMenus());

  // State for active tab
  const [activeTab, setActiveTab] = useState<'auditee-config' | 'ia-members' | 'user-override' | 'employee-master'>('auditee-config');

  // Registered users list
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(() => getRegisteredUsers());
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Master Employees state
  const [masterEmployees, setMasterEmployees] = useState<MasterEmployee[]>(() => getAllEmployees());
  const [empSearch, setEmpSearch] = useState('');
  const [empSiteFilter, setEmpSiteFilter] = useState('ALL');
  const [empDeptFilter, setEmpDeptFilter] = useState('ALL');
  const [empPage, setEmpPage] = useState(1);

  // Add new employee to master data form state
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [newEmpNik, setNewEmpNik] = useState('');
  const [newEmpNama, setNewEmpNama] = useState('');
  const [newEmpJabatan, setNewEmpJabatan] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newEmpSite, setNewEmpSite] = useState('BAYAN');

  // Bulk import master employees state
  const [isImportingMaster, setIsImportingMaster] = useState(false);
  const [importMethod, setImportMethod] = useState<'sheet' | 'file' | 'paste'>('file');
  const [importSheetUrl, setImportSheetUrl] = useState('');
  const [importPasteText, setImportPasteText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const handleParseAndSaveEmployees = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      onToast('Format data tidak valid atau baris data kosong.', 'error');
      return;
    }

    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const headers = firstLine.split(delimiter).map(h => h.trim().toUpperCase().replace(/^"(.*)"$/, '$1'));

    const findIdx = (keywords: string[]) => {
      return headers.findIndex(h => keywords.some(kw => h === kw || h.includes(kw)));
    };

    const nikIdx = findIdx(['NIK', 'NO INDUK', 'NOMOR INDUK', 'ID']);
    const namaIdx = findIdx(['NAMA', 'NAME', 'KARYAWAN', 'EMPLOYEE']);
    const jabatanIdx = findIdx(['JABATAN', 'TITLE', 'POSITION', 'POSISI', 'JOB']);
    const deptIdx = findIdx(['DEPARTEMEN', 'DEPT', 'DEPARTMENT', 'DIVISI']);
    const siteIdx = findIdx(['SITE', 'LOKASI', 'LOCATION', 'CABANG']);
    const masukIdx = findIdx(['MASUK', 'JOIN', 'TANGGAL', 'DATE']);

    const employees: MasterEmployee[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      const nik = nikIdx !== -1 ? row[nikIdx] : row[0];
      const name = namaIdx !== -1 ? row[namaIdx] : row[1];
      if (!nik || !name) continue;

      employees.push({
        nik: nik.trim(),
        name: name.trim(),
        jobTitle: jabatanIdx !== -1 && row[jabatanIdx] ? row[jabatanIdx].trim() : 'Staff',
        department: deptIdx !== -1 && row[deptIdx] ? row[deptIdx].trim() : 'Umum',
        site: siteIdx !== -1 && row[siteIdx] ? row[siteIdx].trim() : 'BAYAN',
        joinDate: masukIdx !== -1 && row[masukIdx] ? row[masukIdx].trim() : '',
        isCustom: true
      });
    }

    if (employees.length === 0) {
      onToast('Tidak ada data karyawan yang valid ditemukan dalam teks.', 'error');
      return;
    }

    bulkSetEmployees(employees);
    setMasterEmployees(getAllEmployees());
    setIsImportingMaster(false);
    setImportPasteText('');
    setImportSheetUrl('');
    onToast(`Berhasil mengimpor ${employees.length} data karyawan ke Master Database!`, 'success');
  };

  // New IA member modal / form state
  const [isAddingIa, setIsAddingIa] = useState(false);
  const [newIaNik, setNewIaNik] = useState('');
  const [newIaNama, setNewIaNama] = useState('');
  const [newIaJabatan, setNewIaJabatan] = useState('Internal Auditor');
  const [newIaDept, setNewIaDept] = useState('Internal Audit');

  // Sync state on mount
  useEffect(() => {
    setIaMembers(getInternalAuditMembers());
    setAuditeeMenus(getAuditeeConfiguredMenus());
    setRegisteredUsers(getRegisteredUsers());
    setMasterEmployees(getAllEmployees());
  }, []);

  // Toggle single menu access for Auditee
  const handleToggleAuditeeMenu = (menuId: string) => {
    if (menuId === 'access-settings') {
      onToast('Menu "Konfigurasi Akses Menu" dilindungi secara sistem dan hanya untuk Internal Audit.', 'warning');
      return;
    }

    const isCurrentlyAllowed = auditeeMenus.includes(menuId);
    let updated: string[];

    if (isCurrentlyAllowed) {
      // Cannot disable everything; at least public-portal must remain
      if (auditeeMenus.length <= 1 && auditeeMenus.includes(menuId)) {
        onToast('Minimal satu menu (Dashboard Achievement) harus tetap bisa diakses oleh Auditee.', 'warning');
        return;
      }
      updated = auditeeMenus.filter(id => id !== menuId);
    } else {
      updated = [...auditeeMenus, menuId];
    }

    setAuditeeMenus(updated);
  };

  // Apply quick presets for Auditee
  const handleApplyPreset = (presetType: 'standard' | 'with-input' | 'with-risk' | 'minimal' | 'all-non-admin') => {
    let presetMenus: string[] = [];

    switch (presetType) {
      case 'minimal':
        presetMenus = ['public-portal'];
        break;
      case 'standard':
        presetMenus = ['public-portal', 'trend-achievement', 'achievement-department', 'finding-statement'];
        break;
      case 'with-input':
        presetMenus = ['public-portal', 'trend-achievement', 'achievement-department', 'finding-statement', 'input-finding-statement'];
        break;
      case 'with-risk':
        presetMenus = ['public-portal', 'trend-achievement', 'achievement-department', 'finding-statement', 'risk-register', 'dashboard'];
        break;
      case 'all-non-admin':
        presetMenus = SYSTEM_MENUS.map(m => m.id).filter(id => id !== 'access-settings');
        break;
    }

    setAuditeeMenus(presetMenus);
    onToast(`Preset diterapkan! Klik "Simpan Konfigurasi" untuk mengaktifkan.`, 'info');
  };

  // Save Auditee configuration
  const handleSaveAuditeeConfig = () => {
    saveAuditeeConfiguredMenus(auditeeMenus);
    onToast('Konfigurasi akses menu Auditee berhasil disimpan! Sidebar Auditee langsung diperbarui.', 'success');
  };

  // Add new IA member
  const handleAddIaMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIaNik.trim() || !newIaNama.trim()) {
      onToast('NIK dan Nama Lengkap wajib diisi.', 'error');
      return;
    }

    const cleanNik = newIaNik.trim();
    if (iaMembers.some(m => m.nik === cleanNik)) {
      onToast(`NIK "${cleanNik}" sudah terdaftar dalam Tim Internal Audit.`, 'error');
      return;
    }

    const updated = [
      ...iaMembers,
      {
        nik: cleanNik,
        nama: newIaNama.trim(),
        jabatan: newIaJabatan.trim(),
        departemen: newIaDept.trim()
      }
    ];

    setIaMembers(updated);
    saveInternalAuditMembers(updated);
    setNewIaNik('');
    setNewIaNama('');
    setIsAddingIa(false);
    onToast(`Personel Internal Audit "${newIaNama}" (NIK: ${cleanNik}) berhasil ditambahkan!`, 'success');
  };

  // Remove IA member
  const handleRemoveIaMember = (nik: string, nama: string) => {
    if (iaMembers.length <= 1) {
      onToast('Minimal harus ada 1 personel Internal Audit dalam sistem.', 'error');
      return;
    }

    if (confirm(`Yakin ingin menghapus NIK ${nik} (${nama}) dari daftar Internal Audit? Pengguna ini selanjutnya akan berstatus sebagai Auditee dengan akses terbatas.`)) {
      const updated = iaMembers.filter(m => m.nik !== nik);
      setIaMembers(updated);
      saveInternalAuditMembers(updated);
      onToast(`NIK ${nik} (${nama}) dipindahkan menjadi Auditee akses terbatas.`, 'info');
    }
  };

  // Filter registered users for user overrides
  const filteredUsers = registeredUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      (u.nik && u.nik.toLowerCase().includes(q)) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl border border-sky-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <Sliders className="w-7 h-7 text-sky-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 flex-wrap">
                Konfigurasi Akses Menu IARMS
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  RBAC Policy
                </span>
              </h1>
              <p className="text-xs text-sky-200/80 mt-1 max-w-3xl">
                Pengaturan hak akses menu: <strong>Tim Internal Audit (7 Personel)</strong> memiliki akses penuh ke seluruh menu sistem. Selain daftar tersebut, seluruh pengguna adalah <strong>Auditee dengan akses terbatas</strong> yang dapat Anda konfigurasikan di bawah ini.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-3.5 py-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{iaMembers.length} Personel IA Terverifikasi</span>
            </div>
          </div>
        </div>

        {/* Policy Summary */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-300">1. Ketentuan NIK Internal Audit (Akses Penuh)</p>
              <p className="text-[11px] text-emerald-100/70 leading-relaxed mt-0.5">
                Daftar 7 NIK Internal Audit (Renny, Farhan, Habibie, Josua, Miftahul Majid, Rangga, Mahardian) secara otomatis dapat mengakses <strong>seluruh 12 menu</strong> tanpa terkecuali.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-950/50 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">2. Ketentuan NIK Auditee (Akses Terbatas)</p>
              <p className="text-[11px] text-amber-100/70 leading-relaxed mt-0.5">
                Selain 7 NIK di atas, pengguna berstatus <strong>Auditee</strong> dan hanya dapat mengakses menu yang Anda aktifkan (status hijau) pada tabel konfigurasi di bawah ini.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('auditee-config')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'auditee-config'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Konfigurasi Menu Auditee ({auditeeMenus.length} dari {SYSTEM_MENUS.length - 1} Aktif)
        </button>

        <button
          onClick={() => setActiveTab('ia-members')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'ia-members'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Daftar NIK Tim Internal Audit ({iaMembers.length})
        </button>

        <button
          onClick={() => setActiveTab('user-override')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'user-override'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Pengaturan Khusus per Akun Auditee
        </button>

        <button
          onClick={() => setActiveTab('employee-master')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'employee-master'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-sky-600" />
          Master Database Karyawan ({masterEmployees.length} Data)
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: KONFIGURASI MENU AUDITEE (APA SAJA BISA DIAKSES & TIDAK) */}
      {/* ========================================================= */}
      {activeTab === 'auditee-config' && (
        <div className="space-y-6">
          {/* Action Bar & Quick Presets */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pilih Menu yang Bisa Diakses & Tidak Bisa Diakses oleh Auditee
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik tombol toggle pada setiap menu untuk mengizinkan (Bisa Diakses) atau mengunci (Tidak Bisa Diakses).
              </p>
            </div>

            {/* Quick Presets & Save */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <span className="text-[11px] font-bold text-slate-500 px-2">Preset:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('standard')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer"
                  title="Dashboard + Trend + Ach Dept + Resume AFS"
                >
                  Standar (4 Menu)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('with-input')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer"
                  title="Standar + Input Finding Statement"
                >
                  + Input AFS
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('with-risk')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer"
                  title="Standar + Risk Register & Matriks"
                >
                  + Risk Management
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('minimal')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-rose-700 hover:bg-rose-50 border border-slate-200 shadow-2xs cursor-pointer"
                >
                  Minimal
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveAuditeeConfig}
                className="py-2 px-5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Konfigurasi Menu Auditee
              </button>
            </div>
          </div>

          {/* Menus Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {SYSTEM_MENUS.map((menu) => {
              const isStrictAdmin = menu.id === 'access-settings';
              const isAllowed = isStrictAdmin ? false : auditeeMenus.includes(menu.id);

              return (
                <div
                  key={menu.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isStrictAdmin
                      ? 'bg-slate-50/80 border-slate-200 opacity-70'
                      : isAllowed
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {menu.category}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          ID: {menu.id}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {menu.label}
                      </h4>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {menu.description}
                      </p>

                      {isStrictAdmin && (
                        <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Menu ini terkunci permanen khusus untuk 7 Personel Tim Internal Audit
                        </p>
                      )}
                    </div>

                    {/* Toggle Button */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {isStrictAdmin ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-600 flex items-center gap-1.5 cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5" /> Khusus IA
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleAuditeeMenu(menu.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isAllowed
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 ring-2 ring-emerald-500/20'
                              : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-300'
                          }`}
                        >
                          {isAllowed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Bisa Diakses</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              <span>Tidak Bisa Diakses</span>
                            </>
                          )}
                        </button>
                      )}

                      <span className="text-[10px] font-medium text-slate-400">
                        {isAllowed ? 'Status: Terbuka untuk Auditee' : 'Status: Dikunci untuk Auditee'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Preview of Auditee Sidebar Navigation */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  Pratampil Menu yang Muncul di Sidebar Auditee ({auditeeMenus.length} Menu):
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Menu yang tidak dicentang otomatis disembunyikan dan diblokir dari akun Auditee.
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {SYSTEM_MENUS.filter(m => auditeeMenus.includes(m.id) && m.id !== 'access-settings').map(m => (
                <span
                  key={m.id}
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs shadow-2xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  {m.label}
                </span>
              ))}

              {SYSTEM_MENUS.filter(m => !auditeeMenus.includes(m.id) || m.id === 'access-settings').map(m => (
                <span
                  key={m.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-200/70 border border-slate-300 text-slate-500 line-through text-xs flex items-center gap-1.5 opacity-60"
                  title="Menu ini terkunci untuk auditee"
                >
                  <Lock className="w-3 h-3" />
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DAFTAR NIK TIM INTERNAL AUDIT (7 PERSONEL RESMI) */}
      {/* ========================================================= */}
      {activeTab === 'ia-members' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Daftar NIK Tim Internal Audit Resmi
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {iaMembers.length} Personel
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengguna dengan NIK di bawah ini secara regulasi memiliki <strong>Akses Penuh (12 Menu Sistem)</strong> dan memiliki wewenang untuk mengatur menu auditee.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingIa(!isAddingIa)}
              className="py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              {isAddingIa ? 'Batal Tambah' : 'Tambah Personel IA'}
            </button>
          </div>

          {/* Form Tambah Personel IA Baru */}
          {isAddingIa && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleAddIaMember}
              className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-3"
            >
              <h4 className="text-xs font-bold text-sky-900">Tambah Personel Internal Audit Baru</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">NIK *</label>
                  <input
                    type="text"
                    required
                    value={newIaNik}
                    onChange={(e) => setNewIaNik(e.target.value)}
                    placeholder="Contoh: 1023999"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={newIaNama}
                    onChange={(e) => setNewIaNama(e.target.value)}
                    placeholder="Nama Auditor"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={newIaJabatan}
                    onChange={(e) => setNewIaJabatan(e.target.value)}
                    placeholder="Internal Auditor"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Departemen</label>
                  <input
                    type="text"
                    value={newIaDept}
                    onChange={(e) => setNewIaDept(e.target.value)}
                    placeholder="Internal Audit"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingIa(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Personel IA
                </button>
              </div>
            </motion.form>
          )}

          {/* Table of IA Members */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">NIK</th>
                  <th className="px-4 py-3">Nama Lengkap</th>
                  <th className="px-4 py-3">Jabatan</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Otorisasi Menu</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {iaMembers.map((member, index) => (
                  <tr key={member.nik} className="hover:bg-sky-50/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                    <td className="px-4 py-3 font-mono font-black text-slate-900 bg-slate-50/60">
                      {member.nik}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {member.nama}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {member.jabatan || 'Internal Auditor'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {member.departemen || 'Internal Audit'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Akses Penuh (12 Menu)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveIaMember(member.nik, member.nama)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Pindahkan ke Auditee (Akses Terbatas)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Personel Internal Audit yang terdaftar di atas dapat langsung mendaftar atau login menggunakan NIK masing-masing dan secara otomatis memiliki hak akses administrator.
          </p>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: PENGATURAN KHUSUS PER AKUN AUDITEE (USER OVERRIDES) */}
      {/* ========================================================= */}
      {activeTab === 'user-override' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User List Panel (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pilih Akun Auditee Spesifik</h3>
              <p className="text-[11px] text-slate-500">
                Atur pengecualian hak akses menu untuk auditee tertentu di luar konfigurasi global.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari NIK, Nama, atau Email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                const isIA = u.isInternalAudit;

                return (
                  <div
                    key={u.uid}
                    onClick={() => setSelectedUser(u)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-2 ring-sky-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            {u.nik || 'NO-NIK'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {u.displayName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.department || 'Unit Kerja'}</p>
                      </div>

                      <div>
                        {isIA ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            IA (Full)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            Auditee ({u.allowedMenus?.length || auditeeMenus.length} Menu)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Specific Menu Checklists (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            {selectedUser ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{selectedUser.displayName}</span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                        NIK: {selectedUser.nik}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{selectedUser.email} &bull; {selectedUser.department}</p>
                  </div>

                  {selectedUser.isInternalAudit ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Internal Audit (Full Access)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        // Reset to global auditee configured menus
                        setSelectedUser({
                          ...selectedUser,
                          allowedMenus: auditeeMenus
                        });
                        onToast('Hak akses user di-reset mengikuti konfigurasi global auditee.', 'info');
                      }}
                      className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                    >
                      Samakan dengan Konfigurasi Global
                    </button>
                  )}
                </div>

                {selectedUser.isInternalAudit ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    User ini adalah <strong>Tim Internal Audit</strong> dan secara otomatis memiliki hak akses ke seluruh 12 menu sistem.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Centang menu khusus yang diizinkan untuk <strong>{selectedUser.displayName}</strong>:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
                      {SYSTEM_MENUS.map((m) => {
                        if (m.id === 'access-settings') return null;
                        const userAllowed = (selectedUser.allowedMenus || auditeeMenus).includes(m.id);

                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              const currentAllowed = selectedUser.allowedMenus || auditeeMenus;
                              const updated = currentAllowed.includes(m.id)
                                ? currentAllowed.filter(id => id !== m.id)
                                : [...currentAllowed, m.id];
                              setSelectedUser({ ...selectedUser, allowedMenus: updated });
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              userAllowed
                                ? 'bg-sky-50 border-sky-300 font-bold text-sky-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {userAllowed ? (
                                <CheckSquare className="w-4 h-4 text-sky-600 flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              )}
                              <span className="text-xs leading-tight">{m.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            updateUserMenuPermissions(selectedUser.uid, selectedUser.allowedMenus || auditeeMenus);
                            setRegisteredUsers(getRegisteredUsers());
                            onToast(`Izin akses khusus untuk ${selectedUser.displayName} berhasil disimpan!`, 'success');
                          } catch (e: any) {
                            onToast(e.message || 'Gagal menyimpan', 'error');
                          }
                        }}
                        className="py-2 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Simpan Izin Khusus User
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Pilih pengguna di panel sebelah kiri untuk mengatur perizinan khusus.
              </div>
            )}
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* TAB 4: MASTER DATABASE KARYAWAN (899 DATA & TAMBAH NIK) */}
      {/* ========================================================= */}
      {activeTab === 'employee-master' && (() => {
        const q = empSearch.trim().toLowerCase();
        const filteredList = masterEmployees.filter((emp) => {
          const matchesQuery = !q || (
            emp.nik.toLowerCase().includes(q) ||
            emp.name.toLowerCase().includes(q) ||
            emp.department.toLowerCase().includes(q) ||
            emp.jobTitle.toLowerCase().includes(q)
          );
          const matchesSite = empSiteFilter === 'ALL' || emp.site?.toUpperCase() === empSiteFilter.toUpperCase();
          const matchesDept = empDeptFilter === 'ALL' || emp.department?.toUpperCase() === empDeptFilter.toUpperCase();
          return matchesQuery && matchesSite && matchesDept;
        });

        const PAGE_SIZE = 20;
        const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
        const currentPage = Math.min(empPage, totalPages);
        const paginated = filteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        const bayanCount = masterEmployees.filter(e => e.site?.toUpperCase() === 'BAYAN').length;
        const agmCount = masterEmployees.filter(e => e.site?.toUpperCase() === 'AGM').length;

        return (
          <div className="space-y-6">
            {/* Header & Quick Add */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Daftar Master Database Karyawan</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-100 text-sky-800 font-bold border border-sky-200">
                    {masterEmployees.length} Total Karyawan
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Database ini digunakan untuk verifikasi otomatis Nama, Departemen, & Jabatan saat karyawan mendaftarkan akun dengan NIK.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportingMaster(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Data Karyawan (5.806 Data)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingEmp(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah NIK Satuan</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <p className="text-slate-500 font-medium text-[11px]">Total Database</p>
                <p className="text-xl font-black text-slate-800 mt-1 font-mono">{masterEmployees.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Karyawan Terdata</p>
              </div>
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <p className="text-slate-500 font-medium text-[11px]">Site BAYAN</p>
                <p className="text-xl font-black text-sky-700 mt-1 font-mono">{bayanCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Personel Site Bayan</p>
              </div>
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <p className="text-slate-500 font-medium text-[11px]">Site AGM</p>
                <p className="text-xl font-black text-emerald-700 mt-1 font-mono">{agmCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Personel Site AGM</p>
              </div>
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <p className="text-slate-500 font-medium text-[11px]">Tim Internal Audit</p>
                <p className="text-xl font-black text-amber-700 mt-1 font-mono">{iaMembers.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Akses 12 Menu Penuh</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    setEmpPage(1);
                  }}
                  placeholder="Cari NIK, Nama Karyawan, Departemen, atau Jabatan..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Site:</span>
                  <select
                    value={empSiteFilter}
                    onChange={(e) => {
                      setEmpSiteFilter(e.target.value);
                      setEmpPage(1);
                    }}
                    className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
                  >
                    <option value="ALL">Semua Site</option>
                    <option value="BAYAN">BAYAN</option>
                    <option value="AGM">AGM</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Dept:</span>
                  <select
                    value={empDeptFilter}
                    onChange={(e) => {
                      setEmpDeptFilter(e.target.value);
                      setEmpPage(1);
                    }}
                    className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500 max-w-[140px]"
                  >
                    <option value="ALL">Semua Dept</option>
                    <option value="PLANT">PLANT</option>
                    <option value="PRODUKSI">PRODUKSI</option>
                    <option value="LOGISTIK">LOGISTIK</option>
                    <option value="ICGS">ICGS</option>
                    <option value="ENGINEERING">ENGINEERING</option>
                    <option value="DATA CENTER">DATA CENTER</option>
                    <option value="FAT">FAT</option>
                    <option value="IT">IT</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Tambah Karyawan Baru */}
            {isAddingEmp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>Tambah Karyawan ke Master Database</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingEmp(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newEmpNik.trim() || !newEmpNama.trim()) {
                        onToast('NIK dan Nama Lengkap wajib diisi.', 'error');
                        return;
                      }

                      const success = addCustomEmployee({
                        nik: newEmpNik.trim(),
                        name: newEmpNama.trim(),
                        jobTitle: newEmpJabatan.trim() || 'Staff',
                        department: newEmpDept.trim() || 'Umum',
                        site: newEmpSite.trim() || 'BAYAN',
                        joinDate: new Date().toLocaleDateString('id-ID')
                      });

                      if (success) {
                        setMasterEmployees(getAllEmployees());
                        setIsAddingEmp(false);
                        setNewEmpNik('');
                        setNewEmpNama('');
                        setNewEmpJabatan('');
                        setNewEmpDept('');
                        onToast(`Karyawan ${newEmpNama} (NIK: ${newEmpNik}) berhasil ditambahkan ke database master!`, 'success');
                      } else {
                        onToast(`NIK "${newEmpNik}" sudah ada di database master.`, 'error');
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        NIK (Nomor Induk Karyawan) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newEmpNik}
                        onChange={(e) => setNewEmpNik(e.target.value)}
                        placeholder="Contoh: 1004703"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold focus:bg-white focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={newEmpNama}
                        onChange={(e) => setNewEmpNama(e.target.value)}
                        placeholder="Nama lengkap karyawan..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Departemen
                        </label>
                        <input
                          type="text"
                          value={newEmpDept}
                          onChange={(e) => setNewEmpDept(e.target.value)}
                          placeholder="PLANT / PRODUKSI..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Jabatan
                        </label>
                        <input
                          type="text"
                          value={newEmpJabatan}
                          onChange={(e) => setNewEmpJabatan(e.target.value)}
                          placeholder="Operator / Staff..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Site Lokasi
                      </label>
                      <select
                        value={newEmpSite}
                        onChange={(e) => setNewEmpSite(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="BAYAN">BAYAN</option>
                        <option value="AGM">AGM</option>
                        <option value="HEAD OFFICE">HEAD OFFICE</option>
                      </select>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddingEmp(false)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan ke Database</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Import Bulk Karyawan (5.806 Data) */}
            {isImportingMaster && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-sky-600" />
                        <span>Import & Perbarui Master Database Karyawan (5.806 Data)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Muat seluruh data karyawan lengkap tanpa batasan agar seluruh NIK dapat terverifikasi otomatis saat registrasi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportingMaster(false);
                        setImportPasteText('');
                        setImportSheetUrl('');
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Method Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <button
                      type="button"
                      onClick={() => setImportMethod('file')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        importMethod === 'file'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Upload File CSV / Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMethod('sheet')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        importMethod === 'sheet'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Link className="w-3.5 h-3.5" />
                      <span>Link Google Spreadsheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMethod('paste')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        importMethod === 'paste'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Paste Teks / Tabel</span>
                    </button>
                  </div>

                  {/* Tab 1: File Upload */}
                  {importMethod === 'file' && (
                    <div className="space-y-3 py-2">
                      <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-6 text-center transition-colors bg-slate-50 hover:bg-sky-50/50">
                        <Upload className="w-8 h-8 text-sky-600 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">Pilih file CSV karyawan dari komputer Anda</p>
                        <p className="text-[11px] text-slate-500 mt-1">Mendukung file CSV dengan kolom: NIK, Nama, Jabatan, Departemen, Site, Masuk</p>
                        <input
                          type="file"
                          accept=".csv,.txt"
                          id="employee-csv-input"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const content = evt.target?.result as string;
                              if (content) {
                                handleParseAndSaveEmployees(content);
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                        <label
                          htmlFor="employee-csv-input"
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih File CSV</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Google Sheets URL */}
                  {importMethod === 'sheet' && (
                    <div className="space-y-3 py-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tautan Google Spreadsheet Master Karyawan (5.806 Data)
                        </label>
                        <input
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                          value={importSheetUrl}
                          onChange={(e) => setImportSheetUrl(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Pastikan akses Google Sheet disetel ke <strong>"Anyone with the link can view"</strong>.
                        </p>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={importLoading || !importSheetUrl.trim()}
                          onClick={async () => {
                            setImportLoading(true);
                            try {
                              const res = await fetch('/api/employees/sync-sheet', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sheetUrl: importSheetUrl.trim() })
                              });
                              const data = await res.json();
                              if (data.success) {
                                if (data.employees) {
                                  bulkSetEmployees(data.employees);
                                }
                                setMasterEmployees(getAllEmployees());
                                setIsImportingMaster(false);
                                setImportSheetUrl('');
                                onToast(data.message || `Berhasil mengimpor ${data.total} data karyawan!`, 'success');
                              } else {
                                onToast(data.error || 'Gagal sinkronisasi Google Sheets.', 'error');
                              }
                            } catch (err: any) {
                              onToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
                            } finally {
                              setImportLoading(false);
                            }
                          }}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {importLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Menghubungkan & Memuat 5.806 Data...</span>
                            </>
                          ) : (
                            <>
                              <Link className="w-3.5 h-3.5" />
                              <span>Tarik Data Otomatis</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Paste Text */}
                  {importMethod === 'paste' && (
                    <div className="space-y-3 py-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tempel (Paste) Baris Tabel dari Excel / Spreadsheet
                        </label>
                        <textarea
                          rows={6}
                          placeholder={`Nik\tNama\tJabatan\tDepartement\tSite\tMasuk\n1001526\tIka Soraya\tStaff Finance\tFAT\tAGM\t07/12/2011\n...`}
                          value={importPasteText}
                          onChange={(e) => setImportPasteText(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-sky-500"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Anda dapat langsung menyalin (Copy) kolom tabel dari Excel dan menempelkannya di sini.
                        </p>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={!importPasteText.trim()}
                          onClick={() => handleParseAndSaveEmployees(importPasteText)}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Proses & Simpan Karyawan</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Table of Employees */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">NIK</th>
                      <th className="p-3.5">Nama Karyawan</th>
                      <th className="p-3.5">Departemen</th>
                      <th className="p-3.5">Jabatan</th>
                      <th className="p-3.5">Site</th>
                      <th className="p-3.5">Tanggal Masuk</th>
                      <th className="p-3.5">Status Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Tidak ada data karyawan yang sesuai dengan kriteria pencarian.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((emp) => {
                        const isIa = iaMembers.some(ia => ia.nik === emp.nik);
                        return (
                          <tr key={emp.nik} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-sky-700">
                              <span className="flex items-center gap-1.5">
                                {emp.nik}
                                {emp.isCustom && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                    Manual
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-slate-800">
                              {emp.name}
                            </td>
                            <td className="p-3.5 text-slate-600">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-medium">
                                {emp.department}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-700">
                              {emp.jobTitle}
                            </td>
                            <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                              {emp.site || 'BAYAN'}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {emp.joinDate || '-'}
                            </td>
                            <td className="p-3.5">
                              {isIa ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  Internal Audit
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  Auditee
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div>
                  Menampilkan <strong>{paginated.length}</strong> dari <strong>{filteredList.length}</strong> karyawan (Total: {masterEmployees.length})
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setEmpPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <span className="px-2 font-mono text-[11px] text-slate-700 font-bold">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setEmpPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
