import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
  FileSpreadsheet,
  ChevronRight,
  TrendingDown,
  Building2,
  ListFilter,
  Flame,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  UserCheck,
  Calendar,
  Zap,
  Grid
} from 'lucide-react';
import { RiskRegisterItem } from '../types';
import initialRiskData from '../data/riskRegisterData.json';

interface RiskRegisterProps {
  key?: React.Key;
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/edit?gid=1293981214#gid=1293981214';
const CSV_EXPORT_URL = 'https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/export?format=csv&gid=1293981214';

export default function RiskRegister({ onToast }: RiskRegisterProps) {
  const [data, setData] = useState<RiskRegisterItem[]>(initialRiskData as RiskRegisterItem[]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('11/05/2026 (Embedded)');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedInherentLevel, setSelectedInherentLevel] = useState('ALL');
  const [selectedResidualLevel, setSelectedResidualLevel] = useState('ALL');
  const [onlyTop10, setOnlyTop10] = useState(false);
  const [activeView, setActiveView] = useState<'table' | 'heatmap'>('table');

  // Selected Detail Modal
  const [selectedRisk, setSelectedRisk] = useState<RiskRegisterItem | null>(null);

  // Sync Live Data from Google Sheet
  const handleSyncData = async () => {
    setIsLoading(true);
    onToast('Menghubungkan ke Google Sheets Risk Register...', 'info');
    try {
      const res = await fetch(CSV_EXPORT_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const text = await res.text();

      // Simple CSV parser
      const parseCSV = (csvText: string) => {
        const result: string[][] = [];
        let row: string[] = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < csvText.length; i++) {
          const c = csvText[i];
          if (inQuotes) {
            if (c === '"') {
              if (i + 1 < csvText.length && csvText[i + 1] === '"') {
                field += '"';
                i++;
              } else {
                inQuotes = false;
              }
            } else {
              field += c;
            }
          } else {
            if (c === '"') {
              inQuotes = true;
            } else if (c === ',') {
              row.push(field.trim());
              field = '';
            } else if (c === '\n' || (c === '\r' && csvText[i + 1] === '\n')) {
              row.push(field.trim());
              result.push(row);
              row = [];
              field = '';
              if (c === '\r') i++;
            } else {
              field += c;
            }
          }
        }
        if (field || row.length) {
          row.push(field.trim());
          result.push(row);
        }
        return result;
      };

      const rawRows = parseCSV(text);
      const fetchedItems: RiskRegisterItem[] = [];

      for (let i = 3; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (!r || r.length < 5) continue;
        const no = (r[0] || '').trim();
        const riskNumber = (r[1] || '').trim();
        const site = (r[2] || '').trim();
        const dept = (r[3] || '').trim();
        const riskDesc = (r[8] || '').trim();

        if (!no && !riskNumber && !site && !dept && !riskDesc) continue;

        fetchedItems.push({
          no,
          riskNumber,
          site,
          department: dept,
          companyObjective: (r[4] || '').trim(),
          kpiObjective: (r[5] || '').trim(),
          businessProcess: (r[6] || '').trim(),
          activity: (r[7] || '').trim(),
          riskDescription: riskDesc,
          top10Risk: (r[9] || '').trim(),
          executiveCategory: (r[10] || '').trim(),
          lossEvent: (r[11] || '').trim(),

          inherentNotes: (r[12] || '').trim(),
          inherentWorstCase: (r[13] || '').trim(),
          inherentFinImpact: (r[18] || '').trim(),
          inherentImpact: (r[23] || '').trim(),
          inherentLikelihood: (r[24] || '').trim(),
          inherentRiskLevel: (r[25] || '').trim() || 'Medium',

          controlDescription: (r[26] || '').trim(),
          controlStatus: (r[27] || '').trim(),
          controlEffectiveness: (r[28] || '').trim(),

          residualNotes: (r[29] || '').trim(),
          residualWorstCase: (r[30] || '').trim(),
          residualFinImpact: (r[35] || '').trim(),
          residualImpact: (r[40] || '').trim(),
          residualLikelihood: (r[41] || '').trim(),
          residualRiskLevel: (r[42] || '').trim() || 'Low',

          treatmentPlan: (r[43] || '').trim(),
          pic: (r[44] || '').trim(),
          dueDate: (r[45] || '').trim(),
          expectedImpact: (r[46] || '').trim(),
          expectedLikelihood: (r[47] || '').trim(),
          expectedRiskLevel: (r[48] || '').trim(),
        });
      }

      if (fetchedItems.length > 0) {
        setData(fetchedItems);
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(`Hari ini (${nowStr})`);
        onToast(`Sinkronisasi sukses! ${fetchedItems.length} item Risk Register diperbarui.`, 'success');
      } else {
        onToast('Selesai sinkronisasi, tidak ada perubahan data.', 'info');
      }
    } catch (err) {
      console.error('Error syncing Risk Register sheet:', err);
      onToast('Gagal sinkronisasi data live. Menggunakan data cadangan.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter options
  const departments = useMemo(() => {
    const list = Array.from(new Set(data.map((item) => item.department).filter(Boolean)));
    return ['ALL', ...list.sort()];
  }, [data]);

  const categories = useMemo(() => {
    const list = Array.from(new Set(data.map((item) => item.executiveCategory).filter(Boolean)));
    return ['ALL', ...list.sort()];
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesDept = selectedDept === 'ALL' || item.department === selectedDept;
      const matchesCat = selectedCategory === 'ALL' || item.executiveCategory === selectedCategory;
      const matchesInherent = selectedInherentLevel === 'ALL' || item.inherentRiskLevel.toUpperCase() === selectedInherentLevel.toUpperCase();
      const matchesResidual = selectedResidualLevel === 'ALL' || item.residualRiskLevel.toUpperCase() === selectedResidualLevel.toUpperCase();
      const matchesTop10 = !onlyTop10 || (item.top10Risk && item.top10Risk !== '0');

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.riskNumber.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.businessProcess?.toLowerCase().includes(q) ||
        item.riskDescription.toLowerCase().includes(q) ||
        item.executiveCategory?.toLowerCase().includes(q) ||
        item.lossEvent?.toLowerCase().includes(q) ||
        item.treatmentPlan?.toLowerCase().includes(q) ||
        item.pic?.toLowerCase().includes(q);

      return matchesDept && matchesCat && matchesInherent && matchesResidual && matchesTop10 && matchesSearch;
    });
  }, [data, selectedDept, selectedCategory, selectedInherentLevel, selectedResidualLevel, onlyTop10, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredData.length;
    const extremeInherent = filteredData.filter((i) => i.inherentRiskLevel.toUpperCase() === 'EXTREME').length;
    const highInherent = filteredData.filter((i) => i.inherentRiskLevel.toUpperCase() === 'HIGH').length;
    const highResidual = filteredData.filter((i) => i.residualRiskLevel.toUpperCase() === 'HIGH').length;
    const top10Count = filteredData.filter((i) => i.top10Risk && i.top10Risk !== '0').length;
    const hasTreatment = filteredData.filter((i) => i.treatmentPlan && i.treatmentPlan.length > 5).length;

    return {
      total,
      extremeInherent,
      highInherent,
      highResidual,
      top10Count,
      hasTreatment,
    };
  }, [filteredData]);

  // Risk Level Badge Styling
  const getRiskBadge = (level?: string) => {
    const norm = (level || '').toUpperCase().trim();
    if (norm === 'EXTREME') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
          <Flame className="w-3 h-3 text-rose-600 animate-pulse" /> Extreme
        </span>
      );
    }
    if (norm === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-600" /> High
        </span>
      );
    }
    if (norm === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
          <Info className="w-3 h-3 text-sky-600" /> Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Low
      </span>
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      onToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }
    const headers = ['No', 'Risk Number', 'Site', 'Department', 'Business Process', 'Risk Description', 'Executive Category', 'Inherent Level', 'Control Description', 'Residual Level', 'Treatment Plan', 'PIC', 'Due Date'];
    const csvRows = [headers.join(',')];

    filteredData.forEach((item) => {
      const row = [
        `"${item.no}"`,
        `"${item.riskNumber}"`,
        `"${item.site}"`,
        `"${item.department}"`,
        `"${(item.businessProcess || '').replace(/"/g, '""')}"`,
        `"${(item.riskDescription || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        `"${(item.executiveCategory || '').replace(/"/g, '""')}"`,
        `"${item.inherentRiskLevel}"`,
        `"${(item.controlDescription || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        `"${item.residualRiskLevel}"`,
        `"${(item.treatmentPlan || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        `"${item.pic || ''}"`,
        `"${item.dueDate || ''}"`,
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Risk_Register_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Data Risk Register berhasil diunduh (CSV)', 'success');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-12"
    >
      {/* Top Banner / Title Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-400/30 backdrop-blur-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Risk Register Directory
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Sync & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleSyncData}
            disabled={isLoading}
            className="flex-1 md:flex-none px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            title="Singkronkan Data Terkini dari Google Sheets ERM"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyingkronkan...' : 'Sync Google Sheet'}</span>
          </button>

          <a
            href={DEFAULT_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition-all flex items-center gap-2"
            title="Buka Google Sheets Asli"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Buka Spreadsheet</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition-all flex items-center gap-2 cursor-pointer"
            title="Unduh Data Risiko Terfilter (.CSV)"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="flex items-center justify-between text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-slate-700">Sumber Data: Google Sheets BSS ERM Tools (Gid: 1293981214)</span>
        </div>
        <div className="text-slate-500 font-medium">
          Update Terakhir: <span className="font-semibold text-slate-700">{lastSyncTime}</span>
        </div>
      </div>



      {/* Filter & View Switcher Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Risk No, Deskripsi Risiko, Proses Bisnis, Treatment Plan, PIC..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start lg:self-auto">
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeView === 'table' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Tabel Detail ({filteredData.length})</span>
            </button>
            <button
              onClick={() => setActiveView('heatmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeView === 'heatmap' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Heatmap Inherent vs Residual</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Department */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Departemen
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-sky-500"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'Semua Departemen' : d}
                </option>
              ))}
            </select>
          </div>

          {/* Executive Category */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Kategori Eksekutif
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-sky-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'Semua Kategori' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Inherent Level */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Inherent Risk Level
            </label>
            <select
              value={selectedInherentLevel}
              onChange={(e) => setSelectedInherentLevel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua Level Inherent</option>
              <option value="EXTREME">Extreme</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Residual Level */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Residual Risk Level
            </label>
            <select
              value={selectedResidualLevel}
              onChange={(e) => setSelectedResidualLevel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua Level Residual</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Top 10 Toggle */}
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button
              onClick={() => setOnlyTop10(!onlyTop10)}
              className={`w-full py-1.5 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                onlyTop10
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${onlyTop10 ? 'text-amber-200 animate-bounce' : 'text-slate-400'}`} />
              <span>Top 10 Risk Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Table or Heatmap View */}
      {activeView === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-xs">
                <tr className="bg-slate-100 text-slate-700 font-bold">
                  <th className="py-3 px-3 w-12 text-center bg-slate-100">No</th>
                  <th className="py-3 px-3 w-28 bg-slate-100">Risk No</th>
                  <th className="py-3 px-3 w-28 bg-slate-100">Dept / Site</th>
                  <th className="py-3 px-4 min-w-[220px] bg-slate-100">Proses & Deskripsi Risiko</th>
                  <th className="py-3 px-3 w-32 bg-slate-100">Kategori Eksekutif</th>
                  <th className="py-3 px-3 text-center w-28 bg-slate-100">Inherent Risk</th>
                  <th className="py-3 px-4 min-w-[200px] bg-slate-100">Kontrol Eksisting</th>
                  <th className="py-3 px-3 text-center w-28 bg-slate-100">Residual Risk</th>
                  <th className="py-3 px-4 min-w-[220px] bg-slate-100">Treatment Plan & PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold">Tidak ada data risiko yang memenuhi kriteria filter.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedDept('ALL');
                          setSelectedCategory('ALL');
                          setSelectedInherentLevel('ALL');
                          setSelectedResidualLevel('ALL');
                          setOnlyTop10(false);
                        }}
                        className="mt-3 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg font-bold text-xs hover:bg-sky-100"
                      >
                        Reset Semua Filter
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr
                      key={`risk-row-${item.riskNumber}-${idx}`}
                      onClick={() => setSelectedRisk(item)}
                      className="hover:bg-sky-50/60 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3 text-center font-semibold text-slate-500">{item.no}</td>
                      <td className="py-3 px-3 font-bold text-sky-700">
                        <div className="flex items-center gap-1">
                          <span>{item.riskNumber}</span>
                          {item.top10Risk && item.top10Risk !== '0' && (
                            <span className="p-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-extrabold" title="Top 10 Risk">
                              T10
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 block">{item.department}</span>
                        <span className="text-[10px] text-slate-400">{item.site}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block mb-0.5">{item.businessProcess || 'General'}</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                          {item.riskDescription}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {item.executiveCategory || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">{getRiskBadge(item.inherentRiskLevel)}</td>
                      <td className="py-3 px-4">
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {item.controlDescription || '-'}
                        </p>
                        {item.controlEffectiveness && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Efektivitas: <strong className="text-slate-600">{item.controlEffectiveness}</strong>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">{getRiskBadge(item.residualRiskLevel)}</td>
                      <td className="py-3 px-4">
                        <p className="text-[11px] font-medium text-slate-800 leading-relaxed">
                          {item.treatmentPlan || '-'}
                        </p>
                        {item.pic && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-semibold">
                            <span>PIC: {item.pic}</span>
                            {item.dueDate && <span>• Due: {item.dueDate}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Menampilkan <strong>{filteredData.length}</strong> dari {data.length} item risiko</span>
            <span className="text-[11px]">Klik baris manapun untuk melihat detail lengkap & matriks evaluasi</span>
          </div>
        </div>
      ) : (
        /* Heatmap Matrix View */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Grid className="w-4 h-4 text-sky-600" /> Matriks Distribusi Level Risiko
              </h3>
              <p className="text-xs text-slate-500">Perbandingan Distribusi Profil Risiko (Inherent vs Residual)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inherent Heatmap Summary */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" /> Profil Inherent Risk (Sebelum Kontrol)
                </h4>
                <span className="text-xs font-semibold text-slate-500">Total: {filteredData.length}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-rose-100 border border-rose-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-rose-800 block">
                    {filteredData.filter((i) => i.inherentRiskLevel.toUpperCase() === 'EXTREME').length}
                  </span>
                  <span className="text-xs font-bold text-rose-700">EXTREME</span>
                </div>
                <div className="p-4 bg-amber-100 border border-amber-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-amber-800 block">
                    {filteredData.filter((i) => i.inherentRiskLevel.toUpperCase() === 'HIGH').length}
                  </span>
                  <span className="text-xs font-bold text-amber-700">HIGH</span>
                </div>
                <div className="p-4 bg-sky-100 border border-sky-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-sky-800 block">
                    {filteredData.filter((i) => i.inherentRiskLevel.toUpperCase() === 'MEDIUM').length}
                  </span>
                  <span className="text-xs font-bold text-sky-700">MEDIUM</span>
                </div>
              </div>
            </div>

            {/* Residual Heatmap Summary */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" /> Profil Residual Risk (Pasca Kontrol)
                </h4>
                <span className="text-xs font-semibold text-slate-500">Total: {filteredData.length}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-amber-100 border border-amber-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-amber-800 block">
                    {filteredData.filter((i) => i.residualRiskLevel.toUpperCase() === 'HIGH').length}
                  </span>
                  <span className="text-xs font-bold text-amber-700">HIGH</span>
                </div>
                <div className="p-4 bg-sky-100 border border-sky-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-sky-800 block">
                    {filteredData.filter((i) => i.residualRiskLevel.toUpperCase() === 'MEDIUM').length}
                  </span>
                  <span className="text-xs font-bold text-sky-700">MEDIUM</span>
                </div>
                <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl text-center">
                  <span className="text-2xl font-extrabold text-emerald-800 block">
                    {filteredData.filter((i) => i.residualRiskLevel.toUpperCase() === 'LOW').length}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">LOW</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Modal Popup */}
      <AnimatePresence>
        {selectedRisk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      {selectedRisk.riskNumber}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">{selectedRisk.department} • {selectedRisk.site}</span>
                  </div>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {selectedRisk.businessProcess || 'Risk Detail Evaluation'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRisk(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
                {/* Risk Description Card */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                    Deskripsi & Dampak Risiko (Loss Event)
                  </h4>
                  <p className="text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                    {selectedRisk.riskDescription}
                  </p>
                  {selectedRisk.lossEvent && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 font-bold">Event Kerugian: </span>
                      <span className="text-slate-800 font-semibold">{selectedRisk.lossEvent}</span>
                    </div>
                  )}
                </div>

                {/* Grid Evaluation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Inherent Assessment */}
                  <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                      <h4 className="font-bold text-rose-900">1. Inherent Risk (Awal)</h4>
                      {getRiskBadge(selectedRisk.inherentRiskLevel)}
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-500">Dampak (Impact): </span>
                        <strong className="text-slate-800">{selectedRisk.inherentImpact || selectedRisk.inherentFinImpact || '-'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Probabilitas (Likelihood): </span>
                        <strong className="text-slate-800">{selectedRisk.inherentLikelihood || '-'}</strong>
                      </div>
                      {selectedRisk.inherentNotes && (
                        <p className="text-slate-600 bg-white p-2 rounded border border-rose-100 italic mt-2 whitespace-pre-line">
                          "{selectedRisk.inherentNotes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Residual Assessment */}
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <h4 className="font-bold text-emerald-900">2. Residual Risk (Sisa)</h4>
                      {getRiskBadge(selectedRisk.residualRiskLevel)}
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-500">Dampak Residual: </span>
                        <strong className="text-slate-800">{selectedRisk.residualImpact || selectedRisk.residualFinImpact || '-'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Probabilitas Residual: </span>
                        <strong className="text-slate-800">{selectedRisk.residualLikelihood || '-'}</strong>
                      </div>
                      {selectedRisk.residualNotes && (
                        <p className="text-slate-600 bg-white p-2 rounded border border-emerald-100 italic mt-2 whitespace-pre-line">
                          "{selectedRisk.residualNotes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Existing Controls */}
                <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sky-900">Kontrol Internal Eksisting</h4>
                    <span className="text-[11px] font-bold text-sky-700">
                      Efektivitas: {selectedRisk.controlEffectiveness || 'Active'}
                    </span>
                  </div>
                  <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                    {selectedRisk.controlDescription || 'Belum ada rincian kontrol terdaftar.'}
                  </p>
                </div>

                {/* Treatment Plan & Action Items */}
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-amber-900">Rencana Penanganan (Treatment Plan)</h4>
                  <p className="text-slate-800 font-semibold whitespace-pre-line leading-relaxed">
                    {selectedRisk.treatmentPlan || 'Dalam proses formulasi oleh tim Risk Owner.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-amber-200/60 text-slate-700">
                    <div>
                      <span className="text-slate-500 font-medium">PIC Penanggung Jawab: </span>
                      <strong className="text-slate-900">{selectedRisk.pic || 'Belum Ditentukan'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Batas Waktu (Due Date): </span>
                      <strong className="text-slate-900">{selectedRisk.dueDate || 'TBA'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedRisk(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Tutup Evaluasi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
