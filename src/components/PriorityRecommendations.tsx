import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Download, 
  Printer, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Activity, 
  User, 
  Calendar, 
  FileSpreadsheet, 
  ExternalLink, 
  ChevronDown, 
  Flame, 
  X, 
  FileText, 
  Check, 
  ShieldCheck,
  Building2,
  TrendingUp,
  LayoutGrid,
  List,
  ArrowRight,
  Filter,
  RotateCcw
} from 'lucide-react';
import { AFSFindingRecord } from '../types';
import { getMergedSheetRows, saveEntireDataset } from '../data/dataSyncManager';
import { 
  PriorityRecommendationItem, 
  PrioritySummary, 
  computeTop10RecommendationsSync, 
  parseDueDateInfo 
} from '../services/aiPriorityService';
import { isStatusClosed, isStatusProgress, extractFindingYear } from '../utils/statusHelper';
import { getRecordDepartments } from '../utils/deptHelper';

interface PriorityRecommendationsProps {
  key?: string;
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: (filter?: { dept?: string; search?: string; status?: string; project?: string; remarks?: string }) => void;
}

export default function PriorityRecommendations({ onToast, onNavigateToAFS }: PriorityRecommendationsProps) {
  // 1. Live dataset state (automatically re-evaluates on mount, edit, sync)
  const [rawRows, setRawRows] = useState<AFSFindingRecord[]>(() => getMergedSheetRows());

  // 2. Filter states for reactive Top 10 AI auto-run
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'progress'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedItemForModal, setSelectedItemForModal] = useState<PriorityRecommendationItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string>(() => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time synchronization: listen to AFS dataset changes (when items are closed, edited, or synced in Resume AFS / sheets)
  useEffect(() => {
    const handleAfsDataSynced = () => {
      // Re-read live dataset - useMemo will instantly recalculate Top 10
      setRawRows(getMergedSheetRows());
      setLastAnalyzedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };

    window.addEventListener('afs_data_synced', handleAfsDataSynced);
    window.addEventListener('storage', handleAfsDataSynced);
    return () => {
      window.removeEventListener('afs_data_synced', handleAfsDataSynced);
      window.removeEventListener('storage', handleAfsDataSynced);
    };
  }, []);

  // Filter options derived from rawRows (only active findings that are not closed)
  const availableSites = useMemo(() => {
    const map = new Map<string, string>();
    rawRows.forEach(r => {
      if (isStatusClosed(r.STATUS, r.REMARKS, r['REVIEWED CLOSING FROM IA'])) return;
      const site = (r.SITE || '').trim();
      if (site && site !== '-') {
        const key = site.toUpperCase();
        if (!map.has(key)) map.set(key, site);
      }
    });
    return Array.from(map.values()).sort();
  }, [rawRows]);

  const availableDepts = useMemo(() => {
    const map = new Map<string, string>();
    rawRows.forEach(r => {
      if (isStatusClosed(r.STATUS, r.REMARKS, r['REVIEWED CLOSING FROM IA'])) return;
      const depts = getRecordDepartments(r);
      depts.forEach(d => {
        const key = d.toUpperCase();
        if (!map.has(key)) map.set(key, d);
      });
    });
    return Array.from(map.values()).sort();
  }, [rawRows]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach(r => {
      if (isStatusClosed(r.STATUS, r.REMARKS, r['REVIEWED CLOSING FROM IA'])) return;
      const year = extractFindingYear(r);
      if (year && year.length === 4) set.add(year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rawRows]);

  // AUTOMATIC CALCULATION (Auto-Run) with Memoization & Caching:
  // Runs automatically on mount, on data change (afs_data_synced), and whenever filters (Site, Dept, Year) change
  const { items, summary, totalMatchingActive } = useMemo(() => {
    return computeTop10RecommendationsSync(rawRows, {
      site: selectedSite,
      dept: selectedDept,
      year: selectedYear
    });
  }, [rawRows, selectedSite, selectedDept, selectedYear]);

  // Helper to reset all filter parameters to default
  const handleResetFilters = () => {
    setSelectedSite('ALL');
    setSelectedDept('ALL');
    setSelectedYear('ALL');
    setFilterStatus('all');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedSite !== 'ALL' || selectedDept !== 'ALL' || selectedYear !== 'ALL' || filterStatus !== 'all' || searchQuery.trim() !== '';

  // Handle status update directly from Priority Recommendation UI (for OPEN / IN PROGRESS)
  const handleUpdateStatus = (item: PriorityRecommendationItem, newStatus: 'OPEN' | 'IN PROGRESS' | 'CLOSE') => {
    const allRows = getMergedSheetRows();
    const rowId = item.record._rowId;
    const targetNo = item.record.NO;
    const targetProj = item.record['PROJECT AUDIT'];

    let found = false;
    const updatedRows = allRows.map(r => {
      if (r._rowId === rowId || (r.NO === targetNo && r['PROJECT AUDIT'] === targetProj)) {
        found = true;
        const isNowClose = newStatus === 'CLOSE';
        return {
          ...r,
          STATUS: newStatus,
          REMARKS: isNowClose ? 'DONE' : (newStatus === 'IN PROGRESS' ? 'PROGRESS' : 'OPEN'),
          'REVIEWED CLOSING FROM USER': isNowClose ? (r['REVIEWED CLOSING FROM USER'] || 'Closed via Priority AI') : r['REVIEWED CLOSING FROM USER']
        };
      }
      return r;
    });

    if (found) {
      saveEntireDataset(updatedRows, `Update Status Rekomendasi Prioritas No #${targetNo} -> ${newStatus}`);
      setRawRows(updatedRows);
      
      if (newStatus === 'CLOSE') {
        onToast(
          `Temuan #${targetNo} (${targetProj}) berhasil di-CLOSE! Temuan otomatis dikeluarkan dari Top 10 dan digantikan oleh temuan kritis berikutnya.`, 
          'success'
        );
      } else {
        onToast(`Status temuan #${targetNo} (${targetProj}) diubah ke ${newStatus}. Resume AFS tersinkronisasi.`, 'success');
      }
    } else {
      onToast('Gagal memperbarui status temuan.', 'error');
    }
  };

  // Filter items by status and search query (Top 10 is strictly Active only)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const isProg = isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
      if (filterStatus === 'open' && isProg) return false;
      if (filterStatus === 'progress' && !isProg) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = [
          item.record.NO,
          item.record['PROJECT AUDIT'],
          item.record.SITE,
          item.record['PROBLEM/FINDING'],
          item.record['DETAIL TEMUAN'],
          item.record['REKOMENDASI'],
          item.record['PIC SITE'],
          item.record['PIC HO'],
          item.financialImpact.description,
          item.operationalImpact.description
        ].join(' ').toLowerCase();

        return text.includes(q);
      }

      return true;
    });
  }, [items, filterStatus, searchQuery]);

  // Export to Excel / CSV format
  const handleExportExcel = () => {
    if (items.length === 0) {
      onToast('Tidak ada data prioritas aktif untuk diekspor.', 'warning');
      return;
    }

    const headers = [
      'Rank',
      'Risk Level',
      'AI Score',
      'Project Audit',
      'Site / Lokasi',
      'No Temuan',
      'Ringkasan Masalah / Temuan',
      'Dampak Finansial',
      'Gangguan Operasional',
      'Rasional Eksekutif AI',
      'Rekomendasi Penanganan Prioritas',
      'PIC Site',
      'PIC HO',
      'Due Date',
      'Status Tindak Lanjut'
    ];

    const rows = items.map(item => [
      `#${item.rank}`,
      item.riskLevel,
      `${item.score}/100`,
      `"${(item.record['PROJECT AUDIT'] || '').replace(/"/g, '""')}"`,
      `"${(item.record.SITE || '').replace(/"/g, '""')}"`,
      `"${(item.record.NO || '').replace(/"/g, '""')}"`,
      `"${(item.record['PROBLEM/FINDING'] || '').replace(/"/g, '""')}"`,
      `"${(item.financialImpact.description || '').replace(/"/g, '""')}"`,
      `"${(item.operationalImpact.description || '').replace(/"/g, '""')}"`,
      `"${(item.aiRationale || '').replace(/"/g, '""')}"`,
      `"${(item.record['REKOMENDASI'] || item.keyMitigationAction || '').replace(/"/g, '""')}"`,
      `"${(item.record['PIC SITE'] || '').replace(/"/g, '""')}"`,
      `"${(item.record['PIC HO'] || '').replace(/"/g, '""')}"`,
      `"${(item.record['DUE DATE'] || '').replace(/"/g, '""')}"`,
      `"${(item.record.STATUS || 'OPEN').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Top_10_Rekomendasi_Prioritas_Aktif_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportDropdownOpen(false);
    onToast('File Excel Top 10 Rekomendasi Prioritas berhasil diunduh.', 'success');
  };

  return (
    <div id="priority-recommendations-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                AI Risk Scoring Engine
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Hanya Temuan Aktif (OPEN / IN PROGRESS)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Pembaruan: {lastAnalyzedTime} WIB
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Rekomendasi Prioritas</span>
              <span className="text-amber-400 font-mono text-xl sm:text-2xl font-bold">(Top 10 Kritis)</span>
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Analisis cerdas terotomasi yang menyeleksi <strong>Top 10 Rekomendasi Paling Kritis</strong> yang belum selesai (OPEN/IN PROGRESS) berdasarkan tingkat kerugian finansial, risiko gangguan operasional, dan kepatuhan.
            </p>
          </div>

          {/* Action Buttons: Export Top 10 PDF/Excel Button Group */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-xs text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-Run Realtime</span>
            </div>

            {/* Export Top 10 PDF/Excel Button Group */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                id="btn-export-top10-menu"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                title="Ekspor daftar Top 10 ke format PDF atau Excel"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Top 10 PDF/Excel</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-30 text-xs backdrop-blur-md">
                  <button
                    onClick={() => {
                      setIsPrintModalOpen(true);
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <Printer className="w-4 h-4 text-sky-400" />
                    <div>
                      <p className="font-bold">Export PDF / Cetak</p>
                      <p className="text-[10px] text-slate-400">Laporan eksekutif resmi</p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    onClick={handleExportExcel}
                    className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="font-bold">Export Excel (CSV)</p>
                      <p className="text-[10px] text-slate-400">Format spreadsheet UTF-8</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Ringkasan Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Prioritas Critical Active */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Prioritas Critical Active
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 font-mono">
              {summary ? summary.totalCriticalActive : 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">dari {items.length} temuan aktif</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span>Skor risiko keparahan &gt; 75 poin (Hanya temuan belum CLOSE)</span>
          </p>
        </div>

        {/* Card 2: Average Target Due Date */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Average Target Due Date
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {summary?.averageDueDays.label || '-'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate" title={summary?.nearestDeadline?.projectName || ''}>
            Target Terdekat: <strong className="text-slate-700">{summary?.nearestDeadline?.date || '-'}</strong>
            {summary?.nearestDeadline && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                summary.nearestDeadline.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {summary.nearestDeadline.isOverdue ? 'Overdue' : 'Aktif'}
              </span>
            )}
          </p>
        </div>

        {/* Card 3: Progress Closing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Progress Closing
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-mono">
              {summary ? summary.progressClosing.overallClosingRate : 0}%
            </span>
            <span className="text-xs font-semibold text-slate-500">Closing Rate AFS</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${summary ? summary.progressClosing.overallClosingRate : 0}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-600 flex items-center justify-between">
            <span>{summary?.progressClosing.inProgressCount || 0} In Progress</span>
            <span className="text-slate-400">•</span>
            <span>{summary?.progressClosing.openCount || 0} Open</span>
          </p>
        </div>

        {/* Card 4: Financial & Operational Exposure */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Eksposur Kerugian Terdeteksi
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-700 font-mono tracking-tight truncate">
              {summary ? summary.totalEstimatedExposure : 'Rp 0'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span>Akumulasi potensi kerugian material Top 10</span>
          </p>
        </div>
      </div>

      {/* Filter and View Mode Switcher */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Row 1: Dropdown Filters (Site, Departemen, Tahun) and Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-500" />
              <span>Filter Otomatis:</span>
            </span>

            {/* Site Filter */}
            <div className="relative">
              <select
                id="select-filter-site"
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className={`text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 border transition-all cursor-pointer appearance-none ${
                  selectedSite !== 'ALL' 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter berdasarkan Site/Lokasi kerja"
              >
                <option value="ALL">Semua Site ({availableSites.length})</option>
                {availableSites.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Department Filter */}
            <div className="relative">
              <select
                id="select-filter-dept"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className={`text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 border transition-all cursor-pointer appearance-none ${
                  selectedDept !== 'ALL' 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter berdasarkan Departemen"
              >
                <option value="ALL">Semua Departemen ({availableDepts.length})</option>
                {availableDepts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Year Filter */}
            <div className="relative">
              <select
                id="select-filter-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={`text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 border transition-all cursor-pointer appearance-none ${
                  selectedYear !== 'ALL' 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter berdasarkan Tahun Periode Audit"
              >
                <option value="ALL">Semua Tahun</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>Tahun {y}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                id="btn-reset-filters"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer border border-rose-200"
                title="Kembalikan semua filter ke kondisi awal"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Ditemukan: <span className="font-bold text-slate-700 font-mono">{totalMatchingActive}</span> temuan aktif
          </div>
        </div>

        {/* Row 2: Status Tabs, View Mode, and Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Status Filter Tabs (Strictly Active Only) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Top 10 ({items.length})
            </button>
            <button
              onClick={() => setFilterStatus('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'open'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OPEN Saja ({summary?.progressClosing.openCount || 0})
            </button>
            <button
              onClick={() => setFilterStatus('progress')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'progress'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IN PROGRESS Saja ({summary?.progressClosing.inProgressCount || 0})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle: Card vs Table */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setViewMode('card')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan Kartu Komprehensif"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan Tabel Ringkas"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari temuan, project, site, PIC..."
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Rendering: Cards or Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Rekomendasi yang Sesuai</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery 
              ? `Tidak ditemukan rekomendasi prioritas dengan kata kunci "${searchQuery}".`
              : 'Seluruh temuan aktif telah tertangani atau tidak ada temuan dengan filter ini.'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW: Rank 1 - 10 */
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isProgress = isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
            const dueDateInfo = parseDueDateInfo(item.record['DUE DATE']);

            // Rank podium styles
            let rankBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
            let rankBorderClass = 'border-slate-200';
            if (item.rank === 1) {
              rankBadgeClass = 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black border-amber-300 shadow-md shadow-amber-500/20';
              rankBorderClass = 'border-amber-300/80 ring-1 ring-amber-400/20';
            } else if (item.rank === 2) {
              rankBadgeClass = 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 font-black border-slate-300';
              rankBorderClass = 'border-slate-300';
            } else if (item.rank === 3) {
              rankBadgeClass = 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100 font-black border-amber-800';
              rankBorderClass = 'border-amber-200';
            }

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm hover:shadow-md transition-all ${rankBorderClass}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Left Column: Rank + Core Content */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Rank Indicator */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black border ${rankBadgeClass}`}>
                        {item.rank === 1 ? <Flame className="w-5 h-5 text-slate-950" /> : `#${item.rank}`}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">
                        Rank #{item.rank}
                      </span>
                    </div>

                    {/* Information Body */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Meta Tags Header: Rank, Level, Site, Project, Status */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Level Risiko Badge (Critical / High) */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          item.riskLevel === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {item.riskLevel}
                        </span>

                        {/* AI Score Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Skor AI: {item.score}/100
                        </span>

                        {/* Status Badge (OPEN / IN PROGRESS) */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide flex items-center gap-1.5 border ${
                          isProgress
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isProgress ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                          {isProgress ? 'IN PROGRESS' : 'OPEN'}
                        </span>

                        {/* Site / Lokasi & Nama Project */}
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1 border border-slate-200">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {item.record.SITE || 'Head Office'}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1 border border-slate-200">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          {item.record['PROJECT AUDIT'] || 'Audit'}
                        </span>

                        {item.record.NO && (
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            No. {item.record.NO}
                          </span>
                        )}
                      </div>

                      {/* Finding Problem Statement */}
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.record['PROBLEM/FINDING'] || item.record['DETAIL TEMUAN'] || 'Temuan Audit'}
                        </h3>
                        {item.record['DETAIL TEMUAN'] && item.record['PROBLEM/FINDING'] !== item.record['DETAIL TEMUAN'] && (
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                            {item.record['DETAIL TEMUAN']}
                          </p>
                        )}
                      </div>

                      {/* Ringkasan Temuan & Potensi Dampak/Kerugian Utama (AI Generated) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {/* Financial Impact */}
                        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-rose-800">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                              Potensi Dampak Finansial ({item.financialImpact.level})
                            </span>
                            {item.financialImpact.estimatedValue && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 font-mono text-[10px]">
                                {item.financialImpact.estimatedValue}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-rose-900/90 leading-relaxed font-medium">
                            {item.financialImpact.description}
                          </p>
                        </div>

                        {/* Operational Impact */}
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-amber-600" />
                              Risiko Gangguan Operasional ({item.operationalImpact.level})
                            </span>
                          </div>
                          <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                            {item.operationalImpact.description}
                          </p>
                        </div>
                      </div>

                      {/* AI Executive Rationale */}
                      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50/80 to-sky-50/80 border border-indigo-200/80 text-xs text-indigo-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-indigo-800 text-[11px]">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Rasional Penilaian Eksekutif (AI CAE Risk Insight)</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {item.aiRationale}
                        </p>
                      </div>

                      {/* Rekomendasi Prioritas Penanganan */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Rekomendasi Prioritas Penanganan
                        </span>
                        <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                          {item.keyMitigationAction}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: PIC, Due Date, Status Action Buttons */}
                  <div className="lg:w-64 flex-shrink-0 flex flex-col justify-between space-y-3.5 pt-3 lg:pt-0 lg:border-l lg:border-slate-200/80 lg:pl-5">
                    {/* PIC Info */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          PIC Penanggung Jawab
                        </span>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Site: {item.record['PIC SITE'] || '-'}
                          </span>
                          {item.record['PIC HO'] && (
                            <span className="text-slate-600 flex items-center gap-1.5 text-[11px]">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              HO: {item.record['PIC HO']}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Due Date */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Target Due Date
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-bold text-slate-800">
                            {dueDateInfo.formattedDate}
                          </span>
                        </div>
                        {dueDateInfo.formattedDate !== '-' && (
                          <div className="mt-1">
                            {dueDateInfo.isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-3 h-3" /> Overdue {Math.abs(dueDateInfo.daysRemaining)} Hari
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" /> {dueDateInfo.daysRemaining} Hari Tersisa
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Management: Status Switcher & Closing in Resume AFS */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Status Temuan
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Closing di Resume AFS
                        </span>
                      </div>

                      {/* Toggle between OPEN & IN PROGRESS */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleUpdateStatus(item, 'OPEN')}
                          disabled={!isProgress}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                            !isProgress 
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-black' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Ubah status menjadi OPEN"
                        >
                          🔴 OPEN
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item, 'IN PROGRESS')}
                          disabled={isProgress}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                            isProgress 
                              ? 'bg-amber-50 text-amber-800 border-amber-300 font-black' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Ubah status menjadi IN PROGRESS"
                        >
                          🟡 IN PROGRESS
                        </button>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => setSelectedItemForModal(item)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Detail Temuan</span>
                      </button>

                      {onNavigateToAFS && (
                        <button
                          onClick={() => {
                            onNavigateToAFS({
                              project: item.record['PROJECT AUDIT'],
                              search: item.record['PROBLEM/FINDING'] || item.record.NO
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Buka Resume AFS untuk verifikasi data dan proses closing resmi"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-violet-600" />
                          <span>Proses Closing di Resume AFS</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW: Rank 1 - 10 */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 text-center w-14">Rank</th>
                  <th className="p-3.5 w-28">Level Risiko</th>
                  <th className="p-3.5 w-44">Site &amp; Project</th>
                  <th className="p-3.5 min-w-[280px]">Ringkasan Temuan &amp; Potensi Dampak</th>
                  <th className="p-3.5 min-w-[240px]">Rekomendasi Prioritas</th>
                  <th className="p-3.5 w-36">PIC &amp; Due Date</th>
                  <th className="p-3.5 w-32 text-center">Status</th>
                  <th className="p-3.5 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item) => {
                  const isProgress = isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
                  const dueDateInfo = parseDueDateInfo(item.record['DUE DATE']);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Rank & AI Score */}
                      <td className="p-3.5 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                          item.rank === 1 
                            ? 'bg-amber-500 text-slate-950 font-black' 
                            : item.rank === 2 
                            ? 'bg-slate-300 text-slate-900 font-black' 
                            : item.rank === 3 
                            ? 'bg-amber-800 text-amber-100 font-black' 
                            : 'bg-slate-100 text-slate-700 font-bold'
                        }`}>
                          #{item.rank}
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400 mt-1">
                          {item.score} pt
                        </span>
                      </td>

                      {/* Level Risiko */}
                      <td className="p-3.5 align-top">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                          item.riskLevel === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {item.riskLevel}
                        </span>
                      </td>

                      {/* Site & Project */}
                      <td className="p-3.5 align-top space-y-1">
                        <strong className="block text-slate-900 font-bold">
                          {item.record['PROJECT AUDIT'] || 'Audit'}
                        </strong>
                        <span className="text-[11px] text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.record.SITE || 'Head Office'}
                        </span>
                        {item.record.NO && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            No #{item.record.NO}
                          </span>
                        )}
                      </td>

                      {/* Problem & Impact */}
                      <td className="p-3.5 align-top space-y-1.5">
                        <p className="font-bold text-slate-800 leading-snug">
                          {item.record['PROBLEM/FINDING']}
                        </p>
                        <div className="text-[11px] text-rose-700 font-medium">
                          • {item.financialImpact.description}
                        </div>
                        <div className="text-[11px] text-amber-800 font-medium">
                          • {item.operationalImpact.description}
                        </div>
                      </td>

                      {/* Rekomendasi Prioritas */}
                      <td className="p-3.5 align-top space-y-1">
                        <p className="text-slate-700 font-medium leading-relaxed">
                          {item.keyMitigationAction}
                        </p>
                      </td>

                      {/* PIC & Due Date */}
                      <td className="p-3.5 align-top space-y-1">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.record['PIC SITE'] || item.record['PIC HO'] || '-'}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600">
                          {dueDateInfo.formattedDate}
                        </div>
                        {dueDateInfo.formattedDate !== '-' && (
                          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            dueDateInfo.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {dueDateInfo.isOverdue ? `Overdue ${Math.abs(dueDateInfo.daysRemaining)}d` : `${dueDateInfo.daysRemaining}d left`}
                          </span>
                        )}
                      </td>

                      {/* Status Badge (OPEN / IN PROGRESS) */}
                      <td className="p-3.5 align-top text-center space-y-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                          isProgress
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isProgress ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                          {isProgress ? 'IN PROGRESS' : 'OPEN'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-top text-center space-y-1">
                        <button
                          onClick={() => setSelectedItemForModal(item)}
                          className="w-full text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          Detail
                        </button>
                        {onNavigateToAFS && (
                          <button
                            onClick={() => {
                              onNavigateToAFS({
                                project: item.record['PROJECT AUDIT'],
                                search: item.record['PROBLEM/FINDING'] || item.record.NO
                              });
                            }}
                            className="w-full text-[10px] font-bold px-1.5 py-1 rounded-lg text-violet-700 hover:bg-violet-50 cursor-pointer"
                          >
                            Buka AFS
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Temuan Modal */}
      <AnimatePresence>
        {selectedItemForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                    #{selectedItemForModal.rank}
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Detail Temuan Rekomendasi Prioritas
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedItemForModal.record['PROJECT AUDIT']} • {selectedItemForModal.record.SITE || 'Head Office'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItemForModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4 text-xs">
                {/* Problem Statement */}
                <div className="space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Problem / Finding
                  </span>
                  <p className="text-sm font-bold text-slate-900 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {selectedItemForModal.record['PROBLEM/FINDING']}
                  </p>
                </div>

                {/* Detail Temuan */}
                {selectedItemForModal.record['DETAIL TEMUAN'] && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      Detail Masalah
                    </span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed font-medium">
                      {selectedItemForModal.record['DETAIL TEMUAN']}
                    </p>
                  </div>
                )}

                {/* Rekomendasi Penanganan */}
                <div className="space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Rekomendasi Penanganan Audit
                  </span>
                  <p className="text-indigo-900 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 leading-relaxed font-semibold">
                    {selectedItemForModal.record['REKOMENDASI'] || selectedItemForModal.keyMitigationAction}
                  </p>
                </div>

                {/* Impact Analysis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <span className="font-bold text-rose-800 text-[11px] block mb-1">
                      Dampak Finansial: {selectedItemForModal.financialImpact.level}
                    </span>
                    <p className="text-rose-900 font-medium">
                      {selectedItemForModal.financialImpact.description}
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="font-bold text-amber-800 text-[11px] block mb-1">
                      Gangguan Operasional: {selectedItemForModal.operationalImpact.level}
                    </span>
                    <p className="text-amber-900 font-medium">
                      {selectedItemForModal.operationalImpact.description}
                    </p>
                  </div>
                </div>

                {/* Criteria & Category */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Kategori</span>
                    <span className="font-bold text-slate-800">{selectedItemForModal.record.KATEGORI || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Kriteria</span>
                    <span className="font-bold text-slate-800">{selectedItemForModal.record.KRITERIA || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Dokumentasi</span>
                    <span className="font-bold text-slate-800 truncate block" title={selectedItemForModal.record['DOKUMENTASI TEMUAN'] || '-'}>
                      {selectedItemForModal.record['DOKUMENTASI TEMUAN'] || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Proses closing temuan dilakukan melalui Resume AFS</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedItemForModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Tutup
                  </button>
                  {onNavigateToAFS && (
                    <button
                      onClick={() => {
                        onNavigateToAFS({
                          project: selectedItemForModal.record['PROJECT AUDIT'],
                          search: selectedItemForModal.record['PROBLEM/FINDING'] || selectedItemForModal.record.NO
                        });
                        setSelectedItemForModal(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Buka di Resume AFS</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Top 10 Executive Report Modal */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[95vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6"
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    Executive Report: Top 10 Rekomendasi Prioritas Audit (Active Only)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Dokumen</span>
                  </button>
                  <button
                    onClick={() => setIsPrintModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Document Preview */}
              <div id="printable-priority-report" className="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 font-sans text-slate-900 text-xs">
                {/* Official Letterhead */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      INTERNAL AUDIT &amp; RISK MANAGEMENT SYSTEMS (IARMS)
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      Laporan Eksekutif Rekomendasi Prioritas Paling Kritis (Top 10 Active Only)
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-500">
                    <p>Tanggal: {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                    <p>Status: Confidential / Internal Only</p>
                  </div>
                </div>

                {/* Executive Summary Paragraph */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 text-[11px] block">
                    Ringkasan Eksekutif:
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Dokumen ini merangkum 10 rekomendasi prioritas utama yang berstatus aktif (OPEN / IN PROGRESS) 
                    yang dinilai memiliki eksposur kerugian finansial serta potensi gangguan operasional tertinggi.
                    Total estimasi eksposur material yang teridentifikasi: <strong>{summary?.totalEstimatedExposure}</strong>.
                  </p>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs bg-white rounded-xl overflow-hidden border border-slate-300">
                    <thead className="bg-slate-900 text-white font-bold text-[11px]">
                      <tr>
                        <th className="p-2.5 border border-slate-700 text-center w-12">Rank</th>
                        <th className="p-2.5 border border-slate-700 w-24">Level Risiko</th>
                        <th className="p-2.5 border border-slate-700">Project &amp; Site</th>
                        <th className="p-2.5 border border-slate-700">Ringkasan Masalah &amp; Dampak</th>
                        <th className="p-2.5 border border-slate-700">Rekomendasi Penanganan</th>
                        <th className="p-2.5 border border-slate-700 w-28">PIC &amp; Due Date</th>
                        <th className="p-2.5 border border-slate-700 w-24 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const isProg = isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
                        return (
                          <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-2.5 border border-slate-300 font-bold text-center font-mono">
                              #{item.rank}
                            </td>
                            <td className="p-2.5 border border-slate-300 font-bold">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                item.riskLevel === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.riskLevel}
                              </span>
                            </td>
                            <td className="p-2.5 border border-slate-300">
                              <strong className="block text-slate-800">{item.record['PROJECT AUDIT']}</strong>
                              <span className="text-slate-500 text-[11px]">{item.record.SITE || 'Head Office'}</span>
                            </td>
                            <td className="p-2.5 border border-slate-300 max-w-xs">
                              <p className="font-semibold text-slate-800 line-clamp-2">
                                {item.record['PROBLEM/FINDING']}
                              </p>
                              <p className="text-[11px] text-rose-700 font-medium mt-1">
                                • {item.financialImpact.description}
                              </p>
                            </td>
                            <td className="p-2.5 border border-slate-300 max-w-xs">
                              <p className="text-slate-700 line-clamp-2">
                                {item.keyMitigationAction}
                              </p>
                            </td>
                            <td className="p-2.5 border border-slate-300">
                              <span className="block font-bold text-slate-800">{item.record['PIC SITE'] || item.record['PIC HO'] || '-'}</span>
                              <span className="text-[11px] text-slate-500">{item.record['DUE DATE'] || '-'}</span>
                            </td>
                            <td className="p-2.5 border border-slate-300 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                isProg ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isProg ? 'IN PROGRESS' : 'OPEN'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signoff Blocks */}
                <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                  <div>
                    <p className="text-slate-500">Dipersiapkan Oleh:</p>
                    <div className="h-14" />
                    <p className="font-bold text-slate-900 border-t border-slate-400 inline-block px-6 pt-1">
                      Tim Internal Audit IARMS
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mengetahui:</p>
                    <div className="h-14" />
                    <p className="font-bold text-slate-900 border-t border-slate-400 inline-block px-6 pt-1">
                      Chief Audit Executive (CAE)
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
