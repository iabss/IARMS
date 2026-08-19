import React from 'react';
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
  LayoutGrid, 
  PanelLeftOpen, 
  PanelLeftClose,
  Cloud
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  userRole: 'public' | 'auditor';
  setUserRole: (role: 'public' | 'auditor') => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenDriveBackup?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  userRole,
  setUserRole,
  onToast,
  onOpenDriveBackup
}: SidebarProps) {

  const navItems = [
    { id: 'public-portal', label: 'Dashboard Achievement', icon: Globe, color: 'text-sky-600' },
    { id: 'input-finding-statement', label: 'Input Finding Statement', icon: FolderKanban, color: 'text-amber-600' },
    { id: 'trend-achievement', label: 'Trend Achievement Closing Audit', icon: TrendingUp, color: 'text-emerald-600' },
    { id: 'achievement-department', label: 'Achievement Department', icon: Building2, color: 'text-indigo-600' },
    { id: 'finding-statement', label: 'Resume AFS', icon: FileSpreadsheet, color: 'text-violet-600' },
    { id: 'risk-register', label: 'Risk Register', icon: ShieldAlert, color: 'text-rose-600' },
    { id: 'dashboard', label: 'Company Risk Matrix', icon: LayoutDashboard, color: 'text-indigo-600' },
    { id: 'field-mobile', label: 'Mobile Field App', icon: Smartphone, color: 'text-emerald-600' },
    { id: 'timeframe', label: 'Rencana Timeframe', icon: Clock, color: 'text-rose-600' }
  ];

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (nextState) {
      onToast('Menu samping diciptakan (Icon View)', 'info');
    } else {
      onToast('Menu samping ditampilkan penuh', 'info');
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as 'public' | 'auditor';
    setUserRole(nextRole);
    if (nextRole === 'public') {
      setActiveTab('public-portal');
      onToast('Mode Akses Publik: Fitur KKA Internal Dibatasi', 'warning');
    } else {
      onToast('Mode Lead Auditor: Akses Penuh Sistem Terbuka', 'success');
    }
  };

  return (
    <motion.aside
      id="sidebar"
      className="w-full md:h-screen md:overflow-y-auto bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 sticky top-0 z-50 shadow-sm flex flex-col justify-between flex-shrink-0 transition-all duration-300"
      animate={{ width: isCollapsed ? '5rem' : '16rem' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="space-y-6">
        {/* Brand Logo & Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-gradient-to-tr from-sky-600 to-blue-700 rounded-xl shadow-md shadow-sky-500/20 flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="sidebar-text whitespace-nowrap"
              >
                <h1 className="font-bold text-base leading-tight text-slate-900">
                  IAMS
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">Internal Audit Management System</p>
              </motion.div>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-all hidden md:block"
            title="Sembunyikan / Tampilkan Menu"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 animate-pulse" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Vertical Navigation Menu */}
        <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
          {navItems.map((item, idx) => {
            const IconComponent = item.icon;
            const isTabActive = activeTab === item.id;
            const isRestricted = (item as any).isPrivate && userRole === 'public';

            return (
              <button
                key={`side-nav-${item.id || idx}-${idx}`}
                onClick={() => {
                  if (isRestricted) {
                    onToast('Akses ditolak: KKA Auditor hanya untuk Lead Auditor!', 'error');
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`tab-btn w-full px-3 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2.5 whitespace-nowrap ${
                  isTabActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                } ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={item.label}
              >
                <IconComponent className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-white' : item.color}`} />
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="sidebar-text"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Google Drive Quick Sync & Cut-Off Action Section */}
        <div className="pt-2 space-y-1.5 border-t border-slate-100">
          {onOpenDriveBackup && (
            <button
              id="btn-backup-gdrive"
              onClick={onOpenDriveBackup}
              className="w-full px-3 py-2.5 bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 shadow-2xs group cursor-pointer"
              title="Backup & Simpan Database ke Google Drive"
            >
              <div className="p-1 bg-sky-600 text-white rounded-lg group-hover:scale-105 transition-transform flex-shrink-0">
                <Cloud className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sidebar-text truncate"
                >
                  Backup Google Drive
                </motion.span>
              )}
            </button>
          )}

          {/* Cut-Off Harian (00:00) Menu - Located directly below Backup Google Drive */}
          <button
            id="btn-daily-cutoff"
            onClick={() => setActiveTab('daily-cutoff')}
            className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
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
                <span className="truncate">Cut-Off Harian (00:00)</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ml-1 ${
                  activeTab === 'daily-cutoff' ? 'bg-teal-800 text-teal-100' : 'bg-teal-200/80 text-teal-900'
                }`}>
                  AUTO
                </span>
              </motion.div>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Footer / User Profile & Role Switcher */}
      <div className="hidden md:flex flex-col gap-3 pt-4 border-t border-slate-200 overflow-hidden">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sidebar-text"
          >
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
              Akses Pengguna
            </label>
            <select
              id="user-role-select"
              value={userRole}
              onChange={handleRoleChange}
              className="w-full bg-slate-100 text-xs text-sky-700 font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="public">Mode: Akses Publik</option>
              <option value="auditor">Mode: Lead Auditor</option>
            </select>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-100 to-blue-200 border border-sky-300 flex items-center justify-center font-bold text-xs text-sky-800 shadow-sm flex-shrink-0">
              MM
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col sidebar-text min-w-0"
              >
                <span className="text-xs font-semibold text-slate-800 leading-tight truncate">M. Majid</span>
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Systems Online
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
