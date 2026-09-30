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
  RotateCcw,
  FileCheck,
  Paperclip,
  Calendar
} from 'lucide-react';
import { UserProfile } from '../types';
import { checkIsInternalAudit } from '../services/authService';
import { getMergedSheetRows } from '../data/dataSyncManager';
import { 
  getTodayStartTimestamp, 
  getEvidenceSubmissionsToday, 
  EvidenceSubmissionRecord 
} from '../services/evidenceNotificationService';

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
  buktiClosing: string;
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending-review' | 'approved'>('all');
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
  const isInternalAudit = Boolean(
    currentUser?.isInternalAudit ||
    currentUser?.role === 'auditor' ||
    (currentUser?.nik && checkIsInternalAudit(currentUser.nik, currentUser.role, currentUser.department))
  );

  // Format tanggal hari ini dalam bahasa Indonesia
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }, []);

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

  // Real-time listener for incoming evidence and finding submissions
  useEffect(() => {
    if (!isInternalAudit) return;

    const handleDataUpdate = () => {
      setVersion(v => v + 1);
    };

    window.addEventListener('iarms_new_evidence_submitted', handleDataUpdate);
    window.addEventListener('afs_data_synced', handleDataUpdate);
    window.addEventListener('afs_project_links_updated', handleDataUpdate);
    window.addEventListener('iarms_new_finding_added', handleDataUpdate);
    window.addEventListener('iarms_permissions_changed', handleDataUpdate);

    // Periodic check every 10s for newly submitted evidence today
    const timer = setInterval(() => {
      setVersion(v => v + 1);
    }, 10000);

    return () => {
      window.removeEventListener('iarms_new_evidence_submitted', handleDataUpdate);
      window.removeEventListener('afs_data_synced', handleDataUpdate);
      window.removeEventListener('afs_project_links_updated', handleDataUpdate);
      window.removeEventListener('iarms_new_finding_added', handleDataUpdate);
      window.removeEventListener('iarms_permissions_changed', handleDataUpdate);
      clearInterval(timer);
    };
  }, [isInternalAudit]);

  // 2. FILTER KETAT: HANYA MUNCULKAN NOTIFIKASI BUKTI TEMUAN YANG DIINPUT SETELAH TANGGAL HARI INI
  // Abaikan seluruh notifikasi & temuan lama dari hari-hari sebelumnya
  const notifications = useMemo<FindingNotificationItem[]>(() => {
    if (!isInternalAudit) return [];

    const now = Date.now();
    const todayStartTs = getTodayStartTimestamp();

    // Ambil bukti temuan yang tercatat diinput hari ini
    const todaySubmissions = getEvidenceSubmissionsToday();
    const allRows = getMergedSheetRows() || [];

    const matchedItems: FindingNotificationItem[] = [];
    const processedRowIds = new Set<number>();

    // 1. Prioritaskan data bukti yang diinput hari ini melalui sistem
    todaySubmissions.forEach((sub: EvidenceSubmissionRecord) => {
      if (sub.timestamp < todayStartTs) return; // ABAIKAN JIKA SEBELUM HARI INI
      if (!sub.dokumentasiClosing || !sub.dokumentasiClosing.trim()) return; // HANYA BUKTI TEMUAN

      processedRowIds.add(sub.rowId);

      const diffMin = Math.max(1, Math.round((now - sub.timestamp) / 60000));
      let timeAgo = `${diffMin}m lalu`;
      if (diffMin >= 60 && diffMin < 1440) {
        timeAgo = `${Math.floor(diffMin / 60)}j lalu`;
      } else if (diffMin >= 1440) {
        timeAgo = `${Math.floor(diffMin / 1440)}h lalu`;
      }

      const isPending = !sub.reviewedIA || sub.reviewedIA === 'EMPTY' || sub.reviewedIA === 'WAITING' || sub.reviewedIA === '-';

      matchedItems.push({
        id: sub.id,
        rowId: sub.rowId,
        no: sub.no,
        project: sub.project,
        site: sub.site,
        title: sub.title,
        kategori: sub.kategori,
        status: sub.status,
        iaReview: sub.reviewedIA,
        dueDate: '-',
        picSite: sub.picSite || '',
        picHO: sub.picHO || '',
        buktiClosing: sub.dokumentasiClosing,
        timestamp: sub.timestamp,
        timeAgo,
        isPendingIaReview: isPending,
        isNewArrival: sub.timestamp > lastReadTime
      });
    });

    // 2. Periksa dataset baris sheet aktif untuk bukti temuan dengan timestamp hari ini
    allRows.forEach((row: any, idx: number) => {
      const rowId = row._rowId ?? (idx + 1);
      if (processedRowIds.has(rowId)) return; // Sudah diproses

      const buktiClosing = (row['DOKUMENTASI CLOSING'] || '').trim();
      if (!buktiClosing) return; // Abaikan jika tidak ada bukti temuan / closing

      // Ekstrak timestamp riil dari baris (HANYA tanggal hari ini ke atas)
      let rowTs: number | null = null;
      if (row._evidenceTimestamp) {
        const parsed = new Date(row._evidenceTimestamp).getTime();
        if (!isNaN(parsed) && parsed >= todayStartTs) rowTs = parsed;
      } else if (row._inputTimestamp) {
        const parsed = new Date(row._inputTimestamp).getTime();
        if (!isNaN(parsed) && parsed >= todayStartTs) rowTs = parsed;
      } else if (row.timestamp) {
        const parsed = new Date(row.timestamp).getTime();
        if (!isNaN(parsed) && parsed >= todayStartTs) rowTs = parsed;
      } else if (row._syncedAt) {
        const parsed = new Date(row._syncedAt).getTime();
        if (!isNaN(parsed) && parsed >= todayStartTs) rowTs = parsed;
      }

      // STRICT GUARD: Jika tidak ada bukti diinput hari ini, ABAIKAN TOTAL
      if (!rowTs || rowTs < todayStartTs) {
        return;
      }

      processedRowIds.add(rowId);

      const no = String(row.NO || '').trim();
      const project = (row['PROJECT AUDIT'] || 'LAINNYA').trim();
      const site = (row.SITE || 'HEAD OFFICE').trim();
      const title = (row['PROBLEM/FINDING'] || row['DETAIL TEMUAN'] || 'Temuan Audit').trim();
      const kategori = (row.KATEGORI || 'MAJOR').trim().toUpperCase();
      const status = (row.STATUS || 'OPEN').trim().toUpperCase();
      const iaReview = (row['REVIEWED CLOSING FROM IA'] || '').trim().toUpperCase();
      const dueDate = row['DUE DATE'] || '-';
      const picSite = row['PIC SITE'] || '';
      const picHO = row['PIC HO'] || '';

      const isPending = !iaReview || iaReview === 'EMPTY' || iaReview === 'WAITING' || iaReview === '-';
      const isNewArrival = rowTs > lastReadTime;

      const diffMin = Math.max(1, Math.round((now - rowTs) / 60000));
      let timeAgo = `${diffMin}m lalu`;
      if (diffMin >= 60 && diffMin < 1440) {
        timeAgo = `${Math.floor(diffMin / 60)}j lalu`;
      } else if (diffMin >= 1440) {
        timeAgo = `${Math.floor(diffMin / 1440)}h lalu`;
      }

      matchedItems.push({
        id: `notif-${rowId}-${no}-${rowTs}`,
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
        buktiClosing,
        timestamp: rowTs,
        timeAgo,
        isPendingIaReview: isPending,
        isNewArrival
      });
    });

    // Filter out cleared notifications if user clicked "Bersihkan Notifikasi"
    const activeItems = (clearedTime > 0 && !showHistory)
      ? matchedItems.filter(i => i.timestamp > clearedTime)
      : matchedItems;

    // Urutkan dari yang paling baru diinput hari ini
    return activeItems.sort((a, b) => b.timestamp - a.timestamp);
  }, [isInternalAudit, version, lastReadTime, clearedTime, showHistory]);

  // Hitung jumlah notifikasi bukti temuan baru yang belum dibaca hari ini
  const unreadCount = useMemo(() => {
    return notifications.filter(n => n.isNewArrival || n.isPendingIaReview).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeFilter === 'pending-review' && !item.isPendingIaReview) return false;
      if (activeFilter === 'approved' && item.isPendingIaReview) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          item.no.toLowerCase().includes(q) ||
          item.site.toLowerCase().includes(q) ||
          item.project.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.buktiClosing.toLowerCase().includes(q) ||
          item.kategori.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    onToast?.('Seluruh notifikasi bukti temuan hari ini telah ditandai sudah dibaca.', 'info');
  };

  // Bersihkan notifikasi
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
    onToast?.('Daftar notifikasi bukti temuan hari ini berhasil dibersihkan!', 'success');
  };

  // Pulihkan / tampilkan kembali riwayat notifikasi hari ini
  const handleRestoreNotifications = () => {
    setClearedTime(0);
    setShowHistory(true);
    try {
      localStorage.removeItem(STORAGE_KEY_CLEARED_TIME);
    } catch {
      // ignore
    }
    onToast?.('Riwayat notifikasi bukti temuan hari ini ditampilkan kembali.', 'info');
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

    // Dispatch global event for instant navigation & row highlight
    window.dispatchEvent(new CustomEvent('iarms_navigate_finding', {
      detail: {
        no: item.no,
        project: item.project,
        site: item.site,
        rowId: item.rowId,
        openDetail: true
      }
    }));

    onToast?.(`Membuka bukti temuan No. ${item.no} (${item.site}) untuk verifikasi IA...`, 'success');
  };

  // JIKA BUKAN INTERNAL AUDIT, JANGAN RENDER APAPUN
  if (!isInternalAudit) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        id="btn-ia-notifications"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
            : unreadCount > 0
            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/90 shadow-2xs'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title={`Notifikasi Bukti Temuan (${unreadCount} bukti baru hari ini)`}
      >
        {unreadCount > 0 ? (
          <BellRing className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-amber-600 animate-bounce'}`} />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {/* Counter Badge: HANYA MUNCUL JIKA ADA BUKTI TEMUAN HARI INI */}
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
            className="absolute right-0 mt-2 w-80 sm:w-96 md:w-[430px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh]"
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
                      Monitoring Bukti Temuan (Hari Ini)
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-extrabold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Hari Ini
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>Sejak {todayFormatted}</span>
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
                  onClick={() => setActiveFilter('approved')}
                  className={`flex-1 py-1 px-2 rounded-lg transition-all text-center text-[11px] cursor-pointer ${
                    activeFilter === 'approved'
                      ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Disetujui ({notifications.filter(n => !n.isPendingIaReview).length})
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari bukti temuan, No, Jobsite, atau uraian..."
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
                    <FileCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {clearedTime > 0 && !showHistory 
                      ? 'Notifikasi Telah Dibersihkan' 
                      : 'Belum Ada Bukti Temuan Baru Hari Ini'}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                    {clearedTime > 0 && !showHistory
                      ? 'Daftar notifikasi bukti temuan hari ini telah dikosongkan. Bukti baru yang masuk akan otomatis muncul di sini.'
                      : `Hanya memantau bukti temuan yang diinput setelah tanggal hari ini (${todayFormatted}). Notifikasi lama lainnya diabaikan.`}
                  </p>
                  {clearedTime > 0 && !showHistory && (
                    <button
                      type="button"
                      onClick={handleRestoreNotifications}
                      className="mt-2.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-sky-700 text-xs font-bold rounded-xl shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:border-sky-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                      <span>Tampilkan Kembali Riwayat Hari Ini</span>
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
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
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
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1 mt-1 leading-snug group-hover:text-sky-700 transition-colors">
                      {item.title}
                    </p>

                    {/* Bukti Temuan / Closing Proof Display */}
                    {item.buktiClosing && (
                      <div className="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg flex items-start gap-1.5 text-[10.5px]">
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9.5px] font-bold text-emerald-800 uppercase block">
                            Bukti Temuan / Closing Diinput Hari Ini:
                          </span>
                          <p className="text-emerald-950 font-mono text-[10.5px] truncate">
                            {item.buktiClosing}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Info & Quick Jump Button */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10.5px]">
                      <div className="flex items-center gap-2 text-slate-500">
                        {item.isPendingIaReview ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px]">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            Menunggu Verifikasi IA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {item.iaReview}
                          </span>
                        )}
                        <span>•</span>
                        <span className="truncate max-w-[100px] text-slate-400">
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
                        <span>Verifikasi Bukti</span>
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
                Bukti Masuk Hari Ini: <strong>{notifications.length}</strong>
              </span>

              <div className="flex items-center gap-2">
                {clearedTime > 0 && !showHistory ? (
                  <button
                    type="button"
                    onClick={handleRestoreNotifications}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 font-bold hover:underline cursor-pointer"
                    title="Tampilkan kembali riwayat notifikasi hari ini"
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
                      title="Bersihkan seluruh notifikasi temuan hari ini"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500 group-hover:scale-110 transition-transform" />
                      <span>Bersihkan</span>
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
