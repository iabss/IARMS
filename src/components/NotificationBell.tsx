import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  BellRing, 
  CheckCheck, 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  X,
  Building2,
  FileSpreadsheet,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { UserProfile } from '../types';
import { checkIsInternalAudit } from '../services/authService';
import { getMergedSheetRows } from '../data/dataSyncManager';

interface NotificationBellProps {
  currentUser: UserProfile | null;
  onNavigateToFinding?: (finding: { no: string; project?: string; site?: string; rowId?: number }) => void;
  onToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface FindingNotificationItem {
  id: string;
  rowId: number;
  no: string;
  project: string;
  site: string;
  title: string;
  kategori: string;
  status: string;
  iaReview: string;
  dueDate: string;
  picSite: string;
  picHO: string;
  timestamp: number;
  timeAgo: string;
  isPendingIaReview: boolean;
  isNewArrival: boolean;
}

const STORAGE_KEY_LAST_READ = 'iarms_ia_notifications_last_read';
const STORAGE_KEY_CLEARED_TIME = 'iarms_ia_notifications_cleared_until';

export default function NotificationBell({
  currentUser,
  onNavigateToFinding,
  onToast
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending-review' | 'new-entries'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastReadTime, setLastReadTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_READ);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [clearedTime, setClearedTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLEARED_TIME);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [version, setVersion] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. PEMBATASAN HAK AKSES KHUSUS INTERNAL AUDIT / ADMINISTRATOR
  // Hanya dirender jika user adalah Internal Audit (atau Auditor)
  const isInternalAudit = Boolean(
    currentUser?.isInternalAudit ||
    currentUser?.role === 'auditor' ||
    (currentUser?.nik && checkIsInternalAudit(currentUser.nik, currentUser.role, currentUser.department))
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Real-time listener for incoming finding statements and background sync
  useEffect(() => {
    if (!isInternalAudit) return;

    const handleDataUpdate = () => {
      setVersion(v => v + 1);
    };

    window.addEventListener('afs_data_synced', handleDataUpdate);
    window.addEventListener('afs_project_links_updated', handleDataUpdate);
    window.addEventListener('iarms_new_finding_added', handleDataUpdate);
    window.addEventListener('iarms_permissions_changed', handleDataUpdate);

    // Periodic check every 12s for newly synchronized data
    const timer = setInterval(() => {
      setVersion(v => v + 1);
    }, 12000);

    return () => {
      window.removeEventListener('afs_data_synced', handleDataUpdate);
      window.removeEventListener('afs_project_links_updated', handleDataUpdate);
      window.removeEventListener('iarms_new_finding_added', handleDataUpdate);
      window.removeEventListener('iarms_permissions_changed', handleDataUpdate);
      clearInterval(timer);
    };
  }, [isInternalAudit]);

  // Calculate Finding Notifications List
  const notifications = useMemo<FindingNotificationItem[]>(() => {
    if (!isInternalAudit) return [];

    const allRows = getMergedSheetRows();
    if (!Array.isArray(allRows) || allRows.length === 0) return [];

    const now = Date.now();

    // Map each row into notification item
    const items: FindingNotificationItem[] = allRows.map((row: any, idx: number) => {
      const rowId = row._rowId ?? (idx + 1);
      const no = String(row.NO || '').trim();
      const project = (row['PROJECT AUDIT'] || 'LAINNYA').trim();
      const site = (row.SITE || 'HEAD OFFICE').trim();
      const title = (row['PROBLEM/FINDING'] || row['DETAIL TEMUAN'] || 'Temuan Audit Baru').trim();
      const kategori = (row.KATEGORI || 'MAJOR').trim().toUpperCase();
      const status = (row.STATUS || 'OPEN').trim().toUpperCase();
      const iaReview = (row['REVIEWED CLOSING FROM IA'] || '').trim().toUpperCase();
      const dueDate = row['DUE DATE'] || '-';
      const picSite = row['PIC SITE'] || '';
      const picHO = row['PIC HO'] || '';

      // Timestamp fallback: use explicit row timestamp or reverse index spread
      const rowTs = row._syncedAt ? new Date(row._syncedAt).getTime() : 
                    row.timestamp ? new Date(row.timestamp).getTime() : 
                    (now - (allRows.length - idx) * 45000);

      const isPendingIaReview = !iaReview || iaReview === 'EMPTY' || iaReview === 'WAITING' || iaReview === '-';
      const isNewArrival = rowTs > lastReadTime;

      // Friendly time display
      const diffMin = Math.max(1, Math.round((now - rowTs) / 60000));
      let timeAgo = `${diffMin}m lalu`;
      if (diffMin >= 60 && diffMin < 1440) {
        timeAgo = `${Math.floor(diffMin / 60)}j lalu`;
      } else if (diffMin >= 1440) {
        timeAgo = `${Math.floor(diffMin / 1440)}h lalu`;
      }

      return {
        id: `notif-${rowId}-${no}`,
        rowId,
        no,
        project,
        site,
        title,
        kategori,
        status,
        iaReview,
        dueDate,
        picSite,
        picHO,
        timestamp: rowTs,
        timeAgo,
        isPendingIaReview,
        isNewArrival
      };
    });

    // Filter out cleared notifications unless user explicitly clicks "Tampilkan Riwayat"
    const activeItems = (clearedTime > 0 && !showHistory)
      ? items.filter(i => i.timestamp > clearedTime)
      : items;

    // Sort by: newest first (or pending IA review)
    return activeItems.reverse();
  }, [isInternalAudit, version, lastReadTime, clearedTime, showHistory]);

  // Count unread / action-required notifications
  const unreadCount = useMemo(() => {
    return notifications.filter(n => n.isNewArrival || n.isPendingIaReview).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeFilter === 'pending-review' && !item.isPendingIaReview) return false;
      if (activeFilter === 'new-entries' && !item.isNewArrival) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          item.no.toLowerCase().includes(q) ||
          item.site.toLowerCase().includes(q) ||
          item.project.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.kategori.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).slice(0, 30); // show top 30 items for smooth scrolling
  }, [notifications, activeFilter, searchQuery]);

  // Mark all as read
  const handleMarkAllAsRead = () => {
    const now = Date.now();
    setLastReadTime(now);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_READ, String(now));
    } catch {
      // ignore
    }
    onToast?.('Seluruh notifikasi temuan telah ditandai sudah dibaca.', 'info');
  };

  // Bersihkan notifikasi (clear all notifications until current timestamp)
  const handleClearNotifications = () => {
    const now = Date.now();
    setClearedTime(now);
    setLastReadTime(now);
    setShowHistory(false);
    try {
      localStorage.setItem(STORAGE_KEY_CLEARED_TIME, String(now));
      localStorage.setItem(STORAGE_KEY_LAST_READ, String(now));
    } catch {
      // ignore
    }
    onToast?.('Daftar notifikasi temuan berhasil dibersihkan!', 'success');
  };

  // Pulihkan / tampilkan kembali riwayat notifikasi
  const handleRestoreNotifications = () => {
    setClearedTime(0);
    setShowHistory(true);
    try {
      localStorage.removeItem(STORAGE_KEY_CLEARED_TIME);
    } catch {
      // ignore
    }
    onToast?.('Riwayat notifikasi temuan ditampilkan kembali.', 'info');
  };

  // Quick Action: Navigate and highlight finding in Finding Statement table
  const handleQuickJump = (item: FindingNotificationItem) => {
    setIsOpen(false);
    
    // Auto-update last read time for this item
    const now = Date.now();
    setLastReadTime(now);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_READ, String(now));
    } catch {
      // ignore
    }

    if (onNavigateToFinding) {
      onNavigateToFinding({
        no: item.no,
        project: item.project,
        site: item.site,
        rowId: item.rowId
      });
    }

    // Also dispatch global event so any active view can capture and highlight
    window.dispatchEvent(new CustomEvent('iarms_navigate_finding', {
      detail: {
        no: item.no,
        project: item.project,
        site: item.site,
        rowId: item.rowId,
        openDetail: true
      }
    }));

    onToast?.(`Membuka temuan No. ${item.no} (${item.site} - ${item.project}) untuk verifikasi IA...`, 'success');
  };

  // JIKA BUKAN INTERNAL AUDIT, JANGAN RENDER APAPUN (ROLE RESTRICTION)
  if (!isInternalAudit) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        id="btn-ia-notifications"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            // Optional: don't auto-clear right away, let user review or click "Tandai Sudah Dibaca"
          }
        }}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
            : unreadCount > 0
            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/90 shadow-2xs'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title={`Notifikasi Temuan AFS (${unreadCount} temuan baru / menunggu verifikasi IA)`}
      >
        {unreadCount > 0 ? (
          <BellRing className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-amber-600 animate-bounce'}`} />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-md ring-2 ring-white">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
            <span className="relative z-10">{unreadCount > 99 ? '99+' : unreadCount}</span>
          </span>
        )}
      </button>

      {/* Flyout / Dropdown Popover Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-96 md:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-3.5 px-4 flex items-center justify-between border-b border-slate-700/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-400/30 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-xs text-white truncate">
                      Monitoring Input Temuan AFS
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-extrabold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Real-Time
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Khusus Internal Audit • Jobsite Finding Stream
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Tandai semua sudah dibaca"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearNotifications}
                    className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                    title="Bersihkan seluruh notifikasi"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`flex-1 py-1 px-2 rounded-lg transition-all text-center text-[11px] cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('pending-review')}
                  className={`flex-1 py-1 px-2 rounded-lg transition-all text-center text-[11px] cursor-pointer ${
                    activeFilter === 'pending-review'
                      ? 'bg-white text-amber-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Belum Review ({notifications.filter(n => n.isPendingIaReview).length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('new-entries')}
                  className={`flex-1 py-1 px-2 rounded-lg transition-all text-center text-[11px] cursor-pointer ${
                    activeFilter === 'new-entries'
                      ? 'bg-white text-sky-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Terbaru ({notifications.filter(n => n.isNewArrival).length})
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari No, Jobsite, Project, atau uraian temuan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Notification List Container */}
            <div className="overflow-y-auto p-2 space-y-1.5 flex-1 max-h-[380px] divide-y divide-slate-100 scrollbar-thin">
              {filteredNotifications.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {clearedTime > 0 && !showHistory ? 'Notifikasi Telah Dibersihkan' : 'Tidak ada notifikasi temuan baru'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">
                    {clearedTime > 0 && !showHistory
                      ? 'Daftar notifikasi temuan telah dikosongkan. Temuan baru yang masuk dari jobsite akan otomatis muncul di sini.'
                      : 'Seluruh temuan dari jobsite sudah ditinjau atau telah diperiksa oleh tim Internal Audit.'}
                  </p>
                  {clearedTime > 0 && !showHistory && (
                    <button
                      type="button"
                      onClick={handleRestoreNotifications}
                      className="mt-2.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-sky-700 text-xs font-bold rounded-xl shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:border-sky-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                      <span>Tampilkan Kembali Riwayat</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleQuickJump(item)}
                    className="p-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-200 relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Site Badge */}
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-extrabold text-[10px] border border-sky-200">
                          {item.site}
                        </span>

                        {/* Finding No */}
                        <span className="font-mono font-bold text-slate-700 text-[10.5px]">
                          No. {item.no}
                        </span>

                        {/* Project Name */}
                        <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                          {item.project}
                        </span>

                        {/* Kategori Badge */}
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                          item.kategori.includes('MAJOR') 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {item.kategori}
                        </span>
                      </div>

                      {/* Time ago */}
                      <span className="text-[9.5px] text-slate-400 whitespace-nowrap flex-shrink-0 font-medium">
                        {item.timeAgo}
                      </span>
                    </div>

                    {/* Problem Description */}
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2 mt-1 leading-snug group-hover:text-sky-700 transition-colors">
                      {item.title}
                    </p>

                    {/* Footer Info & Quick Jump Button */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10.5px]">
                      <div className="flex items-center gap-2 text-slate-500">
                        {item.isPendingIaReview ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px]">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            Belum Direview IA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {item.iaReview}
                          </span>
                        )}
                        <span>•</span>
                        <span className="truncate max-w-[110px] text-slate-400">
                          PIC: {item.picSite || item.picHO || '-'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickJump(item);
                        }}
                        className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-bold text-[10.5px] hover:underline cursor-pointer flex-shrink-0"
                      >
                        <span>Verifikasi</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary & Actions */}
            <div className="p-2.5 px-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px] font-medium text-slate-600">
                Total: <strong>{notifications.length}</strong> temuan {clearedTime > 0 && !showHistory ? '(Dibersihkan)' : 'termonitor'}
              </span>

              <div className="flex items-center gap-2">
                {clearedTime > 0 && !showHistory ? (
                  <button
                    type="button"
                    onClick={handleRestoreNotifications}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 font-bold hover:underline cursor-pointer"
                    title="Tampilkan kembali riwayat notifikasi sebelumnya"
                  >
                    <RotateCcw className="w-3 h-3 text-sky-600" />
                    <span>Lihat Riwayat</span>
                  </button>
                ) : (
                  notifications.length > 0 && (
                    <button
                      type="button"
                      id="btn-clear-notifications"
                      onClick={handleClearNotifications}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer group"
                      title="Bersihkan seluruh notifikasi temuan saat ini"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500 group-hover:scale-110 transition-transform" />
                      <span>Bersihkan Notifikasi</span>
                    </button>
                  )
                )}

                <span className="text-slate-300">•</span>

                <button
                  type="button"
                  onClick={() => setVersion(v => v + 1)}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 font-bold hover:underline cursor-pointer"
                  title="Segarkan data input temuan terbaru"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
