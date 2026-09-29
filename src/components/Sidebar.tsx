import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2,
  ShieldCheck, 
  ShieldAlert, 
  Globe, 
  TrendingUp,
  FolderKanban,
  LayoutDashboard, 
  Smartphone, 
  FileSpreadsheet,
  Clock,
  PanelLeftOpen, 
  PanelLeftClose,
  Cloud,
  LogIn,
  KeyRound,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileCheck,
  FileText,
  Layers,
  Award,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { canUserAccessMenu } from '../services/authService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currentUser: UserProfile | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: () => void;
  onOpenChangePassword?: () => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenDriveBackup?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

interface NavCategory {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  badgeText?: string;
  items: NavItem[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  userRole,
  setUserRole,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onOpenChangePassword,
  onToast,
  onOpenDriveBackup
}: SidebarProps) {
  const [, setTick] = useState(0);

  // Listen to live permission changes
  useEffect(() => {
    const handlePermissionChange = () => {
      setTick(t => t + 1);
    };
    window.addEventListener('iarms_permissions_changed', handlePermissionChange);
    return () => {
      window.removeEventListener('iarms_permissions_changed', handlePermissionChange);
    };
  }, []);

  const isInternalAudit = currentUser?.isInternalAudit || currentUser?.role === 'auditor';

  // 1. STRUKTUR 3 KATEGORI UTAMA (TREE VIEW)
  const navCategories: NavCategory[] = [
    {
      id: 'audit-operasional',
      title: 'Audit Operasional',
      shortTitle: 'Operasional',
      icon: Layers,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50 text-sky-700 border-sky-200',
      badgeText: '6 Menu',
      items: [
        { id: 'public-portal', label: 'Dashboard Achievement', icon: Globe, color: 'text-sky-600' },
        { id: 'input-finding-statement', label: 'Input Finding Statement', icon: FolderKanban, color: 'text-amber-600' },
        { id: 'trend-achievement', label: 'Trend Achievement Closing', icon: TrendingUp, color: 'text-emerald-600' },
        { id: 'achievement-department', label: 'Achievement Department', icon: Building2, color: 'text-indigo-600' },
        { id: 'finding-statement', label: 'Resume AFS', icon: FileSpreadsheet, color: 'text-violet-600' },
        { id: 'priority-recommendations', label: 'Rekomendasi Prioritas', icon: Sparkles, color: 'text-amber-500' }
      ]
    },
    {
      id: 'audit-management-system',
      title: 'Audit Management System',
      shortTitle: 'ISO System',
      icon: Award,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 text-teal-700 border-teal-200',
      badgeText: 'ISO',
      items: [
        { id: 'working-paper', label: 'Kertas Kerja Audit (KKA)', icon: FileText, color: 'text-teal-600' },
        { id: 'iso-system', label: 'Checklist Sistem Manajemen ISO', icon: FileCheck, color: 'text-emerald-600' }
      ]
    },
    {
      id: 'risk-management-category',
      title: 'Risk Management',
      shortTitle: 'Risk (ERM)',
      icon: ShieldAlert,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: 'ERM',
      items: [
        { id: 'risk-management', label: 'Risk Management (Utama)', icon: ShieldCheck, color: 'text-emerald-600' },
        { id: 'risk-register', label: 'Risk Register', icon: ShieldAlert, color: 'text-rose-600' },
        { id: 'dashboard', label: 'Company Risk Matrix', icon: LayoutDashboard, color: 'text-indigo-600' }
      ]
    }
  ];

  // 2. MENU PENDUKUNG DI LUAR KATEGORI UTAMA
  const supportingNavItems: NavItem[] = [
    { id: 'field-mobile', label: 'Mobile Field App', icon: Smartphone, color: 'text-emerald-600' },
    { id: 'timeframe', label: 'Rencana Timeframe', icon: Clock, color: 'text-rose-600' },
    { id: 'access-settings', label: 'Konfigurasi Akses Menu', icon: KeyRound, color: 'text-amber-500', badge: 'ADMIN' }
  ];

  // State Expand / Collapse untuk masing-masing Kategori Tree View
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('iarms_sidebar_expanded_sections');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // fallback
    }
    // Default: Semua 3 kategori terbuka
    return {
      'audit-operasional': true,
      'audit-management-system': true,
      'risk-management-category': true
    };
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const updated = {
        ...prev,
        [categoryId]: !prev[categoryId]
      };
      try {
        localStorage.setItem('iarms_sidebar_expanded_sections', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  };

  // Auto-expand kategori jika sub-menunya sedang aktif
  useEffect(() => {
    const parentCategory = navCategories.find(cat => 
      cat.items.some(item => item.id === activeTab)
    );
    if (parentCategory && !expandedCategories[parentCategory.id]) {
      setExpandedCategories(prev => {
        const next = { ...prev, [parentCategory.id]: true };
        try {
          localStorage.setItem('iarms_sidebar_expanded_sections', JSON.stringify(next));
        } catch (e) {
          // ignore
        }
        return next;
      });
    }
  }, [activeTab]);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (nextState) {
      onToast('Menu samping disederhanakan', 'info');
    } else {
      onToast('Menu samping ditampilkan penuh', 'info');
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as UserRole;
    setUserRole(nextRole);
    if (nextRole === 'public') {
      setActiveTab('public-portal');
      onToast('Mode Akses Publik: Akses menu internal dibatasi', 'warning');
    } else if (nextRole === 'auditee') {
      onToast('Mode Auditee: Fokus tindak lanjut temuan', 'info');
    } else if (nextRole === 'management') {
      onToast('Mode Manajemen: Ringkasan eksekutif & risk matrix', 'info');
    } else {
      onToast('Mode Lead Auditor: Akses penuh seluruh sistem', 'success');
    }
  };

  // Helper untuk memeriksa visibilitas menu berdasarkan izin
  const isItemVisible = (item: NavItem) => {
    if (item.id === 'access-settings') {
      return isInternalAudit;
    }
    return canUserAccessMenu(currentUser, item.id);
  };

  const visibleSupportingItems = supportingNavItems.filter(isItemVisible);
  const canAccessCutoff = canUserAccessMenu(currentUser, 'daily-cutoff');

  return (
    <motion.aside
      id="sidebar"
      className="w-full md:h-screen md:overflow-y-auto bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3.5 sticky top-0 z-50 shadow-sm flex flex-col justify-between flex-shrink-0 transition-all duration-300"
      animate={{ width: isCollapsed ? '5rem' : '17.5rem' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="space-y-4">
        {/* Brand Logo & Header */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 bg-gradient-to-tr from-sky-600 to-blue-700 rounded-xl shadow-md shadow-sky-500/20 flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="sidebar-text whitespace-nowrap overflow-hidden"
              >
                <div className="flex items-center gap-1.5">
                  <h1 id="sidebar-brand-title" className="font-bold text-sm leading-tight text-slate-900 tracking-tight">
                    IARMS
                  </h1>
                  <span className="px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-700 text-[9px] font-black border border-sky-200">
                    PORTAL
                  </span>
                </div>
                <p id="sidebar-brand-subtitle" className="text-[10px] text-slate-500 font-medium truncate">
                  Audit & Risk Management
                </p>
              </motion.div>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-all hidden md:block cursor-pointer"
            title={isCollapsed ? 'Perluas Menu Samping' : 'Lipat Menu Samping'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-sky-600" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* 3 KATEGORI UTAMA (TREE VIEW / EXPAND-COLLAPSE) */}
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
          {navCategories.map((category) => {
            const CategoryIcon = category.icon;
            const visibleItems = category.items.filter(isItemVisible);
            const isExpanded = !!expandedCategories[category.id];
            const hasActiveChild = category.items.some(item => item.id === activeTab);

            // Jika tidak ada item yang dapat diakses oleh user dalam kategori ini, sembunyikan
            if (visibleItems.length === 0) return null;

            return (
              <div key={category.id} className="space-y-1">
                {/* Header Kategori Tree View (Dengan Tombol Panah Expand/Collapse) */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer select-none group ${
                      hasActiveChild
                        ? 'bg-slate-100/90 text-slate-900 border border-slate-200/80 shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    title={`Klik untuk ${isExpanded ? 'melipat' : 'membuka'} kategori ${category.title}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-lg border flex-shrink-0 transition-transform group-hover:scale-105 ${category.bgColor}`}>
                        <CategoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate text-[11.5px] font-bold tracking-tight text-slate-800 text-left">
                        {category.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                      {category.badgeText && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shadow-2xs">
                          {visibleItems.length}
                        </span>
                      )}
                      <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.2 }}
                        className="text-slate-400 group-hover:text-slate-600"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.div>
                    </div>
                  </button>
                ) : (
                  // Mode Collapsed Sidebar: Tampilkan Divider Ikon Kategori
                  <div 
                    className="w-full py-1 flex items-center justify-center border-t border-slate-100 first:border-t-0"
                    title={category.title}
                  >
                    <div className={`p-1.5 rounded-lg border ${category.bgColor}`}>
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                {/* Sub-Menu List (Konten Tree View dengan Animasi) */}
                <AnimatePresence initial={false}>
                  {(isExpanded || isCollapsed) && (
                    <motion.div
                      key={`cat-items-${category.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className={`overflow-hidden flex flex-col gap-0.5 ${
                        !isCollapsed ? 'pl-2.5 ml-3.5 border-l-2 border-slate-200/90 py-0.5' : ''
                      }`}
                    >
                      {visibleItems.map((item, idx) => {
                        const IconComponent = item.icon;
                        const isTabActive = activeTab === item.id;

                        return (
                          <button
                            key={`side-nav-${item.id || idx}`}
                            onClick={() => setActiveTab(item.id)}
                            className={`tab-btn w-full px-2.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer group text-left ${
                              isTabActive
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                            title={item.label}
                          >
                            <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:scale-105 ${isTabActive ? 'text-white' : item.color}`} />
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="sidebar-text truncate flex-1 text-[11px] leading-tight"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* 3. MENU PENDUKUNG DI LUAR KATEGORI UTAMA */}
          {visibleSupportingItems.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex flex-col gap-0.5">
                {visibleSupportingItems.map((item, idx) => {
                  const IconComponent = item.icon;
                  const isTabActive = activeTab === item.id;

                  return (
                    <button
                      key={`supporting-${item.id || idx}`}
                      onClick={() => setActiveTab(item.id)}
                      className={`tab-btn w-full px-2.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer group text-left ${
                        isTabActive
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 font-bold'
                          : item.id === 'access-settings'
                          ? 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                      title={item.label}
                    >
                      <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:scale-105 ${isTabActive ? 'text-white' : item.color}`} />
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="sidebar-text truncate flex-1 text-[11px] leading-tight"
                        >
                          {item.label}
                        </motion.span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-200 text-amber-900 font-black">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Google Drive Quick Sync & Cut-Off Action Section */}
        <div className="pt-2 space-y-1.5 border-t border-slate-100">
          {onOpenDriveBackup && isInternalAudit && (
            <button
              id="btn-backup-gdrive"
              onClick={onOpenDriveBackup}
              className="w-full px-2.5 py-2 bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-2xs group cursor-pointer"
              title="Backup & Simpan Database ke Google Drive"
            >
              <div className="p-1 bg-sky-600 text-white rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                <Cloud className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sidebar-text truncate text-[11px]"
                >
                  Backup Google Drive
                </motion.span>
              )}
            </button>
          )}

          {/* Cut-Off Harian (00:00) Menu - Only if allowed */}
          {canAccessCutoff && (
            <button
              id="btn-daily-cutoff"
              onClick={() => setActiveTab('daily-cutoff')}
              className={`w-full px-2.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'daily-cutoff'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200/70 text-teal-800'
              }`}
              title="Cut-Off Harian (00:00 WIB) & Auto Drive Sync"
            >
              <div className={`p-1 rounded-lg flex-shrink-0 ${activeTab === 'daily-cutoff' ? 'bg-teal-700 text-white' : 'bg-teal-600 text-white'}`}>
                <Clock className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sidebar-text flex items-center justify-between flex-1 min-w-0"
                >
                  <span className="truncate text-[11px]">Cut-Off Harian</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ml-1 ${
                    activeTab === 'daily-cutoff' ? 'bg-teal-800 text-teal-100' : 'bg-teal-200/80 text-teal-900'
                  }`}>
                    00:00
                  </span>
                </motion.div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Footer / User Profile & Role Switcher */}
      <div className="hidden md:flex flex-col gap-2.5 pt-3 border-t border-slate-200 overflow-hidden">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sidebar-text"
          >
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Simulasi Peran
              </label>
              {currentUser && (
                <div className="flex items-center gap-1.5">
                  {onOpenChangePassword && (
                    <button
                      type="button"
                      onClick={onOpenChangePassword}
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold hover:underline cursor-pointer"
                      title="Ganti Password"
                    >
                      Ganti Password
                    </button>
                  )}
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold hover:underline cursor-pointer"
                  >
                    Kelola Akun
                  </button>
                </div>
              )}
            </div>
            <select
              id="user-role-select"
              value={userRole}
              onChange={handleRoleChange}
              className="w-full bg-slate-100 text-xs text-sky-700 font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="auditor">Mode: Lead Auditor (Full Access)</option>
              <option value="auditee">Mode: Auditee / PIC Departemen</option>
              <option value="management">Mode: Manajemen / Eksekutif</option>
              <option value="public">Mode: Akses Publik</option>
            </select>
          </motion.div>
        )}

        {currentUser ? (
          <div 
            onClick={onOpenProfile}
            className="flex items-center justify-between pt-1 p-1.5 -mx-1 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
            title="Klik untuk melihat profil & detail akun"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 border border-sky-300 flex items-center justify-center font-bold text-[11px] text-white shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'US'}
              </div>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col sidebar-text min-w-0"
                >
                  <span className="text-xs font-semibold text-slate-800 leading-tight truncate group-hover:text-sky-700">
                    {currentUser.displayName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                    {currentUser.jobTitle || currentUser.department || (isInternalAudit ? 'Internal Audit' : 'Operasional')}
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-0.5">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="w-full py-2 px-3 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk / Daftar Akun
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="w-8 h-8 mx-auto rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                title="Masuk / Daftar Akun"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
