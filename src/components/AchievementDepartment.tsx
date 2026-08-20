import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Filter, 
  RotateCcw, 
  Search, 
  FileText, 
  Award, 
  TrendingUp, 
  ChevronRight, 
  X,
  Sparkles,
  Layers,
  ArrowUpRight,
  FolderKanban,
  ExternalLink,
  Info
} from 'lucide-react';
import { AFSFindingRecord } from '../types';
import { getMergedSheetRows } from '../data/dataSyncManager';
import { parseDepartments, getRecordDepartments } from '../utils/deptHelper';
import { isStatusClosed, isStatusOpen, isStatusProgress } from '../utils/statusHelper';

interface AchievementDepartmentProps {
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: (filter?: { dept?: string; search?: string; status?: string; project?: string; remarks?: string }) => void;
  key?: string;
}

export default function AchievementDepartment({ onToast, onNavigateToAFS }: AchievementDepartmentProps) {
  // Filters state
  const [deptTypeFilter, setDeptTypeFilter] = useState<'ho' | 'site' | 'all'>('ho');
  const [deptSortBy, setDeptSortBy] = useState<'rate' | 'total' | 'open' | 'overdue'>('rate');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('ALL');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [selectedKategoriFilter, setSelectedKategoriFilter] = useState<string>('ALL');

  // Selected Department for Detail Modal
  const [selectedDeptDetail, setSelectedDeptDetail] = useState<string | null>(null);

  // Sync reactivity version
  const [syncedVersion, setSyncedVersion] = useState(0);

  useEffect(() => {
    const handleDataSynced = () => {
      setSyncedVersion(v => v + 1);
    };
    window.addEventListener('afs_data_synced', handleDataSynced);
    return () => window.removeEventListener('afs_data_synced', handleDataSynced);
  }, []);

  // Load raw findings dataset
  const allRows: AFSFindingRecord[] = useMemo(() => {
    return getMergedSheetRows();
  }, [syncedVersion]);

  // Filtered Rows based on global dropdowns
  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      // Site filter
      if (selectedSiteFilter !== 'ALL' && (r.SITE || '').trim() !== selectedSiteFilter) return false;
      
      // Project filter
      if (selectedProjectFilter !== 'ALL' && (r['PROJECT AUDIT'] || '').trim() !== selectedProjectFilter) return false;

      // Category filter
      if (selectedKategoriFilter !== 'ALL') {
        const kat = (r.KATEGORI || '').toUpperCase();
        if (selectedKategoriFilter === 'MAJOR' && !kat.includes('MAJOR')) return false;
        if (selectedKategoriFilter === 'MINOR' && !kat.includes('MINOR')) return false;
        if (selectedKategoriFilter === 'IMPROVEMENT' && !kat.includes('IMPROV')) return false;
      }

      return true;
    });
  }, [allRows, selectedSiteFilter, selectedProjectFilter, selectedKategoriFilter]);

  // List of Sites for filter
  const sitesList = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => {
      if (r.SITE && r.SITE.trim()) set.add(r.SITE.trim());
    });
    return Array.from(set).sort();
  }, [allRows]);

  // List of Projects for filter
  const projectsList = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => {
      if (r['PROJECT AUDIT'] && r['PROJECT AUDIT'].trim()) set.add(r['PROJECT AUDIT'].trim());
    });
    return Array.from(set).sort();
  }, [allRows]);

  // Compute Department Performance Matrix
  const departmentPerformance = useMemo(() => {
    const map = new Map<string, { 
      dept: string; 
      total: number; 
      closed: number; 
      open: number; 
      progress: number;
      overdue: number;
      majorTotal: number;
      majorClosed: number;
      minorTotal: number;
      minorClosed: number;
      improvTotal: number;
      improvClosed: number;
      records: AFSFindingRecord[];
    }>();

    filteredRows.forEach(r => {
      const uniqueDepts = getRecordDepartments(r, deptTypeFilter);

      const isClose = isStatusClosed(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"]);
      const isOpen = isStatusOpen(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"]);
      const isOverdue = (r.REMARKS || '').toUpperCase().includes('OVERDUE');

      const kat = (r.KATEGORI || '').toUpperCase().trim();
      const isMajor = kat.includes('MAJOR');
      const isMinor = kat.includes('MINOR');

      uniqueDepts.forEach(dept => {
        const normKey = dept.toUpperCase();
        if (!map.has(normKey)) {
          map.set(normKey, { 
            dept, 
            total: 0, 
            closed: 0, 
            open: 0, 
            progress: 0, 
            overdue: 0,
            majorTotal: 0,
            majorClosed: 0,
            minorTotal: 0,
            minorClosed: 0,
            improvTotal: 0,
            improvClosed: 0,
            records: []
          });
        }
        const item = map.get(normKey)!;
        item.total += 1;
        item.records.push(r);

        if (isClose) item.closed += 1;
        else if (isOpen) item.open += 1;
        else item.progress += 1;

        if (isOverdue) item.overdue += 1;

        if (isMajor) {
          item.majorTotal += 1;
          if (isClose) item.majorClosed += 1;
        } else if (isMinor) {
          item.minorTotal += 1;
          if (isClose) item.minorClosed += 1;
        } else {
          item.improvTotal += 1;
          if (isClose) item.improvClosed += 1;
        }
      });
    });

    let list = Array.from(map.values()).map(item => {
      const rate = item.total > 0 ? parseFloat(((item.closed / item.total) * 100).toFixed(2)) : 0;
      const majorRate = item.majorTotal > 0 ? parseFloat(((item.majorClosed / item.majorTotal) * 100).toFixed(2)) : 0;
      return {
        ...item,
        rate,
        majorRate
      };
    });

    // Apply Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.dept.toLowerCase().includes(q));
    }

    // Apply Sorting
    list.sort((a, b) => {
      if (deptSortBy === 'rate') {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.total - a.total;
      }
      if (deptSortBy === 'total') return b.total - a.total;
      if (deptSortBy === 'open') return b.open - a.open;
      if (deptSortBy === 'overdue') return b.overdue - a.overdue;
      return 0;
    });

    return list;
  }, [filteredRows, deptTypeFilter, searchQuery, deptSortBy]);

  // Overall KPI Summary for Departments
  const deptSummaryKPI = useMemo(() => {
    const totalDepts = departmentPerformance.length;
    if (totalDepts === 0) {
      return {
        totalDepts: 0,
        avgRate: '0.00',
        topPerformer: null,
        needsAttention: null,
        totalRecommendations: 0,
        totalClosed: 0
      };
    }

    let sumRate = 0;
    let totalRecommendations = 0;
    let totalClosed = 0;

    departmentPerformance.forEach(d => {
      sumRate += d.rate;
      totalRecommendations += d.total;
      totalClosed += d.closed;
    });

    const avgRate = (sumRate / totalDepts).toFixed(2);
    
    // Top performer with highest closing rate (min 2 items)
    const candidates = [...departmentPerformance].filter(d => d.total >= 1);
    candidates.sort((a, b) => b.rate - a.rate || b.total - a.total);
    const topPerformer = candidates.length > 0 ? candidates[0] : null;

    // Highest open/overdue
    const openCandidates = [...departmentPerformance];
    openCandidates.sort((a, b) => (b.open + b.overdue) - (a.open + a.overdue));
    const needsAttention = openCandidates.length > 0 && (openCandidates[0].open > 0 || openCandidates[0].overdue > 0) ? openCandidates[0] : null;

    return {
      totalDepts,
      avgRate,
      topPerformer,
      needsAttention,
      totalRecommendations,
      totalClosed
    };
  }, [departmentPerformance]);

  // Reset Filters
  const handleResetFilters = () => {
    setDeptTypeFilter('ho');
    setDeptSortBy('rate');
    setSearchQuery('');
    setSelectedSiteFilter('ALL');
    setSelectedProjectFilter('ALL');
    setSelectedKategoriFilter('ALL');
    onToast('Filter Achievement Department direset', 'info');
  };

  // Find records for selected dept detail modal
  const selectedDeptObj = useMemo(() => {
    if (!selectedDeptDetail) return null;
    return departmentPerformance.find(d => d.dept.toUpperCase() === selectedDeptDetail.toUpperCase()) || null;
  }, [selectedDeptDetail, departmentPerformance]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      {/* Page Title & Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-extrabold text-[10px] uppercase tracking-wider border border-indigo-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Matrix Performance Analytics
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                Data AFS Terintegrasi
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-400" />
              Achievement Department
            </h1>
            <p className="text-xs md:text-sm text-indigo-200/80 max-w-2xl font-normal leading-relaxed">
              Matriks evaluasi & pemantauan tingkat penyelesaian (closing rate) rekomendasi audit berdasarkan departemen dan fungsi penanggung jawab (PIC HO & Site).
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {onNavigateToAFS && (
              <button
                onClick={onNavigateToAFS}
                className="px-4 py-2.5 bg-white text-indigo-950 hover:bg-indigo-50 text-xs font-black rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <FolderKanban className="w-4 h-4 text-indigo-700" />
                <span>Resume AFS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Department KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Department */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Total Department / PIC
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-100">
              {deptTypeFilter === 'ho' ? 'PIC HO' : deptTypeFilter === 'site' ? 'PIC Site' : 'Semua'}
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-slate-900">{deptSummaryKPI.totalDepts}</span>
            <span className="text-xs text-slate-500 block mt-0.5 font-medium">
              Fungsi Penanggung Jawab Aktif
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>Total Rekomendasi:</span>
            <strong className="text-slate-700 font-bold">{deptSummaryKPI.totalRecommendations} Items</strong>
          </div>
        </div>

        {/* Average Closing Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Rata-Rata ACH Closing %
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100">
              Overall Rate
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-emerald-700">{deptSummaryKPI.avgRate}%</span>
            <span className="text-xs text-slate-500 block mt-0.5 font-medium">
              {deptSummaryKPI.totalClosed} / {deptSummaryKPI.totalRecommendations} Recommendations Closed
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, parseFloat(deptSummaryKPI.avgRate))}%` }}
            />
          </div>
        </div>

        {/* Top Performer Department */}
        <div className="bg-gradient-to-br from-indigo-50 to-sky-50/80 p-4 rounded-2xl border border-indigo-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              Top Department Performer
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold shadow-2xs">
              Highest Rate
            </span>
          </div>
          <div className="my-2">
            <h4 className="text-xl font-black text-indigo-950 truncate">
              {deptSummaryKPI.topPerformer ? deptSummaryKPI.topPerformer.dept : '-'}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-black text-emerald-700">
                {deptSummaryKPI.topPerformer ? `${deptSummaryKPI.topPerformer.rate}%` : '0%'}
              </span>
              <span className="text-xs text-indigo-700 font-semibold">
                ({deptSummaryKPI.topPerformer ? `${deptSummaryKPI.topPerformer.closed}/${deptSummaryKPI.topPerformer.total} Close` : ''})
              </span>
            </div>
          </div>
          <p className="text-[10px] text-indigo-600 font-medium pt-1 border-t border-indigo-100">
            Kinerja penyelesaian terbaik berdasarkan data audit
          </p>
        </div>

        {/* Department Needing Attention */}
        <div className="bg-gradient-to-br from-rose-50 to-amber-50/80 p-4 rounded-2xl border border-rose-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Perlu Perhatian Khusus
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-200">
              Open / Overdue
            </span>
          </div>
          <div className="my-2">
            <h4 className="text-xl font-black text-rose-950 truncate">
              {deptSummaryKPI.needsAttention ? deptSummaryKPI.needsAttention.dept : 'Semua On-Track'}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-rose-700">
                Open: {deptSummaryKPI.needsAttention ? deptSummaryKPI.needsAttention.open : 0} Items
              </span>
              <span className="text-xs font-bold text-purple-700">
                Overdue: {deptSummaryKPI.needsAttention ? deptSummaryKPI.needsAttention.overdue : 0} Items
              </span>
            </div>
          </div>
          <p className="text-[10px] text-rose-600 font-medium pt-1 border-t border-rose-100">
            Fungsi dengan beban temuan open & overdue tertinggi
          </p>
        </div>
      </div>

      {/* Filter & Toolbar Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Filter & Search Matriks Achievement Department
            </h2>
          </div>

          <button
            onClick={handleResetFilters}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Tipe PIC Filter Toggle */}
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Kategori PIC:
            </label>
            <div className="inline-flex w-full bg-slate-100 p-1 rounded-xl text-xs font-extrabold border border-slate-200">
              <button
                onClick={() => setDeptTypeFilter('ho')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  deptTypeFilter === 'ho' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PIC HO
              </button>
              <button
                onClick={() => setDeptTypeFilter('site')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  deptTypeFilter === 'site' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PIC Site
              </button>
              <button
                onClick={() => setDeptTypeFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  deptTypeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          {/* Search Query Input */}
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Cari Nama Department / PIC:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari e.g. ENGINEERING, LOGISTIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Site Filter */}
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Jobsite:
            </label>
            <select
              value={selectedSiteFilter}
              onChange={(e) => setSelectedSiteFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Semua Site ({sitesList.length})</option>
              {sitesList.map((s, idx) => (
                <option key={`dept-s-${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Kategori Filter */}
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Kategori:
            </label>
            <select
              value={selectedKategoriFilter}
              onChange={(e) => setSelectedKategoriFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="MAJOR">MAJOR</option>
              <option value="MINOR">MINOR</option>
              <option value="IMPROVEMENT">IMPROVEMENT</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Urutkan Berdasarkan:
            </label>
            <select
              value={deptSortBy}
              onChange={(e) => setDeptSortBy(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs bg-indigo-50/80 border border-indigo-200 rounded-xl font-extrabold text-indigo-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="rate">Highest ACH %</option>
              <option value="total">Total Rekomendasi</option>
              <option value="open">Temuan Open</option>
              <option value="overdue">Overdue Remarks</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Department Achievement Matrix Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Tabel Performance Closing Rate per Department
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {departmentPerformance.length} entitas departemen penanggung jawab
            </p>
          </div>

          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-xl">
            Klik pada nama department untuk melihat rincian temuan
          </span>
        </div>

        {departmentPerformance.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
            <Info className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">Tidak Ada Department Sesuai Filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Coba reset filter atau ubah kata kunci pencarian untuk melihat data pencapaian departemen.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-3 text-center w-12 border-r border-slate-800">NO</th>
                  <th className="py-3.5 px-4 min-w-[200px] border-r border-slate-800">NAMA DEPARTMENT / PIC</th>
                  <th className="py-3.5 px-3 text-center min-w-[100px] border-r border-slate-800">TOTAL AUDIT</th>
                  <th className="py-3.5 px-3 text-center text-emerald-400 min-w-[80px] border-r border-slate-800">CLOSED</th>
                  <th className="py-3.5 px-3 text-center text-rose-300 min-w-[80px] border-r border-slate-800">OPEN</th>
                  <th className="py-3.5 px-3 text-center text-amber-300 min-w-[85px] border-r border-slate-800">PROGRESS</th>
                  <th className="py-3.5 px-3 text-center text-purple-300 min-w-[85px] border-r border-slate-800">OVERDUE</th>
                  <th className="py-3.5 px-3 text-center text-rose-300 min-w-[120px] border-r border-slate-800">MAJOR CLOSED %</th>
                  <th className="py-3.5 px-4 text-center text-amber-300 min-w-[170px] border-r border-slate-800">ACH CLOSING %</th>
                  <th className="py-3.5 px-3 text-center min-w-[90px]">DETAIL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium">
                {departmentPerformance.map((item, idx) => {
                  const isHigh = item.rate >= 80;
                  const isLow = item.rate < 50;

                  return (
                    <tr 
                      key={`dept-row-${item.dept}-${idx}`} 
                      className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedDeptDetail(item.dept)}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 border-r border-slate-200">
                        {idx + 1}.
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-200 uppercase tracking-wide group-hover:text-indigo-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <span>{item.dept}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </td>

                      {/* TOTAL AUDIT */}
                      <td 
                        className="py-3 px-3 text-center font-extrabold text-slate-900 bg-slate-50/50 hover:bg-slate-100 border-r border-slate-200 text-sm cursor-pointer transition-colors group/total"
                        title={`Klik untuk membuka semua temuan ${item.dept} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToAFS?.({ dept: item.dept, status: 'ALL' });
                          onToast(`Mengarahkan ke Resume AFS untuk ${item.dept} (Semua Status)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-slate-300 group-hover/total:decoration-slate-900 group-hover/total:font-black transition-all">
                          {item.total}
                        </span>
                      </td>

                      {/* CLOSED */}
                      <td 
                        className="py-3 px-3 text-center font-extrabold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/80 border-r border-slate-200 text-sm cursor-pointer transition-colors group/closed"
                        title={`Klik untuk membuka temuan CLOSED untuk ${item.dept} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToAFS?.({ dept: item.dept, status: 'CLOSE' });
                          onToast(`Mengarahkan ke Resume AFS untuk ${item.dept} (Status: CLOSED)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-emerald-300 group-hover/closed:decoration-emerald-700 group-hover/closed:font-black transition-all">
                          {item.closed}
                        </span>
                      </td>

                      {/* OPEN */}
                      <td 
                        className="py-3 px-3 text-center font-extrabold text-rose-700 bg-rose-50/70 hover:bg-rose-100 border-r border-slate-200 text-sm cursor-pointer transition-colors group/open"
                        title={`Klik untuk membuka rekomendasi OPEN untuk ${item.dept} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToAFS?.({ dept: item.dept, status: 'OPEN' });
                          onToast(`Mengarahkan ke Resume AFS untuk ${item.dept} (Status: OPEN)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-rose-300 group-hover/open:decoration-rose-700 group-hover/open:font-black transition-all">
                          {item.open}
                        </span>
                      </td>

                      {/* PROGRESS */}
                      <td 
                        className="py-3 px-3 text-center font-extrabold text-amber-700 bg-amber-50/50 hover:bg-amber-100/80 border-r border-slate-200 text-sm cursor-pointer transition-colors group/progress"
                        title={`Klik untuk membuka temuan PROGRESS untuk ${item.dept} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToAFS?.({ dept: item.dept, status: 'PROGRESS' });
                          onToast(`Mengarahkan ke Resume AFS untuk ${item.dept} (Status: PROGRESS)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-amber-300 group-hover/progress:decoration-amber-700 group-hover/progress:font-black transition-all">
                          {item.progress}
                        </span>
                      </td>

                      {/* OVERDUE */}
                      <td 
                        className="py-3 px-3 text-center font-extrabold text-purple-700 bg-purple-50/50 hover:bg-purple-100/80 border-r border-slate-200 text-sm cursor-pointer transition-colors group/overdue"
                        title={`Klik untuk membuka temuan OVERDUE untuk ${item.dept} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToAFS?.({ dept: item.dept, remarks: 'OVERDUE' });
                          onToast(`Mengarahkan ke Resume AFS untuk ${item.dept} (Remarks: OVERDUE)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-purple-300 group-hover/overdue:decoration-purple-700 group-hover/overdue:font-black transition-all">
                          {item.overdue}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-rose-700 border-r border-slate-200 text-xs">
                        {item.majorTotal > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 font-extrabold">
                            {item.majorRate}%
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                              }`} 
                              style={{ width: `${item.rate}%` }} 
                            />
                          </div>
                          <span className={`font-black text-xs min-w-[50px] text-right ${
                            isHigh ? 'text-emerald-700' : isLow ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            {item.rate.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDeptDetail(item.dept);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-200 cursor-pointer"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Department Findings */}
      <AnimatePresence>
        {selectedDeptObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                      Rincian Temuan Audit Department
                    </span>
                    <h3 className="text-xl font-black text-white mt-1">
                      {selectedDeptObj.dept}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDeptDetail(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Stats Header Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Audit</span>
                    <span className="text-xl font-black text-slate-900">{selectedDeptObj.total}</span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Closed</span>
                    <span className="text-xl font-black text-emerald-800">{selectedDeptObj.closed}</span>
                  </div>
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                    <span className="text-[10px] text-rose-700 font-bold uppercase block">Open</span>
                    <span className="text-xl font-black text-rose-800">{selectedDeptObj.open}</span>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] text-indigo-700 font-bold uppercase block">Closing Rate</span>
                    <span className="text-xl font-black text-indigo-900">{selectedDeptObj.rate}%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                    Daftar Temuan Audit ({selectedDeptObj.records.length} Item):
                  </h4>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {selectedDeptObj.records.map((r, idx) => {
                      const st = (r.STATUS || '').toUpperCase().trim();
                      const isClose = st === 'CLOSE';
                      const isOpen = st === 'OPEN';

                      return (
                        <div 
                          key={`dept-rec-${idx}`} 
                          className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-extrabold text-[10px]">
                                {r.SITE || 'SITE'}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {r['PROJECT AUDIT'] || 'Scope Audit'}
                              </span>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isClose 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : isOpen 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {st || 'OPEN'}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 leading-snug">
                            {r['PROBLEM/FINDING'] || r['DETAIL TEMUAN'] || 'Uraian Temuan'}
                          </p>

                          {r.REKOMENDASI && (
                            <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 italic">
                              Rekomendasi: {r.REKOMENDASI}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span>Kategori: <strong className="text-slate-800 font-bold">{r.KATEGORI || '-'}</strong></span>
                            <span>Due Date: <strong className="text-slate-800 font-bold">{r['DUE DATE'] || '-'}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex items-center justify-between">
                {onNavigateToAFS && (
                  <button
                    onClick={() => {
                      const deptName = selectedDeptObj.dept;
                      setSelectedDeptDetail(null);
                      onNavigateToAFS({ dept: deptName, status: 'OPEN' });
                      onToast(`Mengarahkan ke Resume AFS untuk ${deptName} (Status: OPEN)...`, 'info');
                    }}
                    className="px-4 py-2 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-200 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Buka Temuan OPEN {selectedDeptObj.dept} di Resume AFS</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setSelectedDeptDetail(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all cursor-pointer"
                >
                  Tutup Window
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
