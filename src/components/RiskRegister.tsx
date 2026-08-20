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
  Grid,
  PlusCircle,
  Plus,
  Trash2,
  Edit,
  Save,
  Check,
  HelpCircle
} from 'lucide-react';
import { RiskRegisterItem } from '../types';
import initialRiskData from '../data/riskRegisterData.json';

interface RiskRegisterProps {
  key?: React.Key;
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const STORAGE_KEY_CUSTOM_RISKS = 'iarms_custom_risk_register_items';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/edit?gid=1293981214#gid=1293981214';
const CSV_EXPORT_URL = 'https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/export?format=csv&gid=1293981214';

// Helper to calculate risk level based on likelihood and impact
function calcRiskLevel(likelihoodStr?: string, impactStr?: string): 'Low' | 'Medium' | 'High' | 'Extreme' {
  const l = parseInt(likelihoodStr || '2', 10) || 2;
  const i = parseInt(impactStr || '2', 10) || 2;
  const score = l * i;
  if (score >= 16) return 'Extreme';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

const DEFAULT_FORM_STATE = {
  no: '',
  riskNumber: '',
  site: 'HO',
  department: 'OPERATIONAL',
  companyObjective: '',
  kpiObjective: '',
  businessProcess: '',
  activity: '',
  riskDescription: '',
  top10Risk: '0',
  executiveCategory: 'OPERATIONAL',
  lossEvent: '',

  inherentLikelihood: '3',
  inherentImpact: '3',
  inherentRiskLevel: 'Medium',
  inherentFinImpact: '',
  inherentNotes: '',

  controlDescription: '',
  controlStatus: 'Active',
  controlEffectiveness: 'Effective',

  residualLikelihood: '2',
  residualImpact: '2',
  residualRiskLevel: 'Low',
  residualFinImpact: '',
  residualNotes: '',

  treatmentPlan: '',
  pic: '',
  dueDate: '',
  expectedRiskLevel: 'Low'
};

export default function RiskRegister({ onToast }: RiskRegisterProps) {
  const [baseData, setBaseData] = useState<RiskRegisterItem[]>(initialRiskData as RiskRegisterItem[]);
  const [customRisks, setCustomRisks] = useState<RiskRegisterItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_RISKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('11/05/2026 (Embedded)');
  
  // Manual Input Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItemNumber, setEditingItemNumber] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);

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

  // Combined data: custom manual items at the top + base sheet data
  const data = useMemo(() => {
    return [...customRisks, ...baseData];
  }, [customRisks, baseData]);

  // Open add modal with fresh prefilled defaults
  const handleOpenAddModal = (itemToEdit?: RiskRegisterItem) => {
    if (itemToEdit) {
      setEditingItemNumber(itemToEdit.riskNumber);
      setFormData({
        no: itemToEdit.no || '',
        riskNumber: itemToEdit.riskNumber || '',
        site: itemToEdit.site || 'HO',
        department: itemToEdit.department || 'OPERATIONAL',
        companyObjective: itemToEdit.companyObjective || '',
        kpiObjective: itemToEdit.kpiObjective || '',
        businessProcess: itemToEdit.businessProcess || '',
        activity: itemToEdit.activity || '',
        riskDescription: itemToEdit.riskDescription || '',
        top10Risk: itemToEdit.top10Risk || '0',
        executiveCategory: itemToEdit.executiveCategory || 'OPERATIONAL',
        lossEvent: itemToEdit.lossEvent || '',

        inherentLikelihood: itemToEdit.inherentLikelihood || '3',
        inherentImpact: itemToEdit.inherentImpact || '3',
        inherentRiskLevel: itemToEdit.inherentRiskLevel || 'Medium',
        inherentFinImpact: itemToEdit.inherentFinImpact || '',
        inherentNotes: itemToEdit.inherentNotes || '',

        controlDescription: itemToEdit.controlDescription || '',
        controlStatus: itemToEdit.controlStatus || 'Active',
        controlEffectiveness: itemToEdit.controlEffectiveness || 'Effective',

        residualLikelihood: itemToEdit.residualLikelihood || '2',
        residualImpact: itemToEdit.residualImpact || '2',
        residualRiskLevel: itemToEdit.residualRiskLevel || 'Low',
        residualFinImpact: itemToEdit.residualFinImpact || '',
        residualNotes: itemToEdit.residualNotes || '',

        treatmentPlan: itemToEdit.treatmentPlan || '',
        pic: itemToEdit.pic || '',
        dueDate: itemToEdit.dueDate || '',
        expectedRiskLevel: itemToEdit.expectedRiskLevel || 'Low'
      });
    } else {
      setEditingItemNumber(null);
      const nextNum = customRisks.length + 1;
      setFormData({
        ...DEFAULT_FORM_STATE,
        no: String(nextNum),
        riskNumber: `RR-MNL-${String(nextNum).padStart(3, '0')}`,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
    setIsAddModalOpen(true);
  };

  // Handle Save Manual Risk
  const handleSaveManualRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.riskDescription.trim()) {
      onToast('Deskripsi risiko wajib diisi!', 'warning');
      return;
    }
    if (!formData.department.trim()) {
      onToast('Departemen wajib diisi!', 'warning');
      return;
    }

    const calculatedInherent = calcRiskLevel(formData.inherentLikelihood, formData.inherentImpact);
    const calculatedResidual = calcRiskLevel(formData.residualLikelihood, formData.residualImpact);

    const newItem: RiskRegisterItem = {
      no: formData.no || String(customRisks.length + 1),
      riskNumber: formData.riskNumber || `RR-MNL-${Date.now().toString().slice(-4)}`,
      site: formData.site.trim() || 'HO',
      department: formData.department.trim().toUpperCase(),
      companyObjective: formData.companyObjective.trim(),
      kpiObjective: formData.kpiObjective.trim(),
      businessProcess: formData.businessProcess.trim(),
      activity: formData.activity.trim(),
      riskDescription: formData.riskDescription.trim(),
      top10Risk: formData.top10Risk,
      executiveCategory: formData.executiveCategory,
      lossEvent: formData.lossEvent.trim(),

      inherentLikelihood: formData.inherentLikelihood,
      inherentImpact: formData.inherentImpact,
      inherentRiskLevel: formData.inherentRiskLevel || calculatedInherent,
      inherentFinImpact: formData.inherentFinImpact.trim(),
      inherentNotes: formData.inherentNotes.trim(),

      controlDescription: formData.controlDescription.trim(),
      controlStatus: formData.controlStatus,
      controlEffectiveness: formData.controlEffectiveness,

      residualLikelihood: formData.residualLikelihood,
      residualImpact: formData.residualImpact,
      residualRiskLevel: formData.residualRiskLevel || calculatedResidual,
      residualFinImpact: formData.residualFinImpact.trim(),
      residualNotes: formData.residualNotes.trim(),

      treatmentPlan: formData.treatmentPlan.trim(),
      pic: formData.pic.trim(),
      dueDate: formData.dueDate,
      expectedRiskLevel: formData.expectedRiskLevel
    };

    let updatedCustom: RiskRegisterItem[];
    if (editingItemNumber) {
      updatedCustom = customRisks.map(r => r.riskNumber === editingItemNumber ? newItem : r);
      onToast(`Risiko ${newItem.riskNumber} berhasil diperbarui!`, 'success');
    } else {
      updatedCustom = [newItem, ...customRisks];
      onToast(`Risiko baru ${newItem.riskNumber} berhasil ditambahkan secara manual!`, 'success');
    }

    setCustomRisks(updatedCustom);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_RISKS, JSON.stringify(updatedCustom));
    } catch (err) {
      console.error('Failed to save custom risk to storage', err);
    }

    setIsAddModalOpen(false);
    if (selectedRisk && selectedRisk.riskNumber === editingItemNumber) {
      setSelectedRisk(newItem);
    }
  };

  // Delete manual item
  const handleDeleteManualRisk = (riskNumber: string) => {
    if (!window.confirm(`Yakin ingin menghapus item risiko manual ${riskNumber}?`)) return;
    const updated = customRisks.filter(r => r.riskNumber !== riskNumber);
    setCustomRisks(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_RISKS, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update storage', err);
    }
    if (selectedRisk?.riskNumber === riskNumber) {
      setSelectedRisk(null);
    }
    onToast(`Item risiko manual ${riskNumber} telah dihapus.`, 'info');
  };

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
        setBaseData(fetchedItems);
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
            onClick={() => handleOpenAddModal()}
            className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30 active:scale-95"
            title="Input Item Risk Register Baru Secara Manual"
          >
            <PlusCircle className="w-4 h-4 text-emerald-100" />
            <span>+ Input Risk Register Manual</span>
          </button>

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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span>{item.riskNumber}</span>
                            {item.top10Risk && item.top10Risk !== '0' && (
                              <span className="p-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-extrabold" title="Top 10 Risk">
                                T10
                              </span>
                            )}
                          </div>
                          {customRisks.some(c => c.riskNumber === item.riskNumber) && (
                            <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                              Manual
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
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {customRisks.some(c => c.riskNumber === selectedRisk.riskNumber) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const itemToEdit = selectedRisk;
                          setSelectedRisk(null);
                          handleOpenAddModal(itemToEdit);
                        }}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Data Manual</span>
                      </button>
                      <button
                        onClick={() => handleDeleteManualRisk(selectedRisk.riskNumber)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRisk(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Tutup Evaluasi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Input / Edit Risk Register Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-sky-950 text-white flex items-center justify-between border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-400/30">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {editingItemNumber ? `Edit Item Risk Register (${editingItemNumber})` : 'Input Item Risk Register Manual'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Tambahkan rincian profil risiko, penilaian inherent, kontrol eksisting, residual, dan mitigasi.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveManualRisk} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-slate-700">
                {/* 1. INFORMASI UMUM & IDENTITAS RISIKO */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold border-b border-emerald-100 pb-1.5">
                    <ShieldAlert className="w-4 h-4 text-emerald-600" />
                    <span className="uppercase tracking-wider text-[11px]">1. Identitas & Konteks Risiko</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nomor / Kode Risiko <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.riskNumber}
                        onChange={(e) => setFormData({ ...formData, riskNumber: e.target.value })}
                        placeholder="Contoh: RR-2026-001"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Site / Lokasi <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.site}
                        onChange={(e) => setFormData({ ...formData, site: e.target.value.toUpperCase() })}
                        placeholder="HO, JKT, MME, AGM, MAS, CDI..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Departemen / Divisi <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                        placeholder="OPERATIONAL, PLANT, HSE, FINANCE..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Kategori Eksekutif
                      </label>
                      <select
                        value={formData.executiveCategory}
                        onChange={(e) => setFormData({ ...formData, executiveCategory: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="OPERATIONAL">OPERATIONAL</option>
                        <option value="FINANCIAL">FINANCIAL</option>
                        <option value="STRATEGIC">STRATEGIC</option>
                        <option value="COMPLIANCE">COMPLIANCE</option>
                        <option value="REPUTATION">REPUTATION</option>
                        <option value="SAFETY & HEALTH">SAFETY & HEALTH</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Proses Bisnis
                      </label>
                      <input
                        type="text"
                        value={formData.businessProcess}
                        onChange={(e) => setFormData({ ...formData, businessProcess: e.target.value })}
                        placeholder="Contoh: Pengelolaan Kontrak Vendor / Pemeliharaan Unit"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Status Top 10 Risk Perusahaan?
                      </label>
                      <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="top10"
                            checked={formData.top10Risk === '1' || formData.top10Risk === 'Ya'}
                            onChange={() => setFormData({ ...formData, top10Risk: '1' })}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-bold text-amber-700">Ya (Top 10 Risk)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="top10"
                            checked={formData.top10Risk !== '1' && formData.top10Risk !== 'Ya'}
                            onChange={() => setFormData({ ...formData, top10Risk: '0' })}
                            className="text-slate-600 focus:ring-slate-500"
                          />
                          <span className="text-slate-600">Bukan Top 10</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Deskripsi Risiko (Risk Description) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={formData.riskDescription}
                      onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                      placeholder="Jelaskan secara detail potensi peristiwa risiko dan penyebab utamanya..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Loss Event / Potensi Dampak Kerugian
                    </label>
                    <input
                      type="text"
                      value={formData.lossEvent}
                      onChange={(e) => setFormData({ ...formData, lossEvent: e.target.value })}
                      placeholder="Contoh: Downtime operasional 48 jam, potensi kerugian finansial..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* 2. INHERENT RISK EVALUATION */}
                <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <div className="flex items-center gap-2 text-rose-900 font-bold">
                      <Flame className="w-4 h-4 text-rose-600" />
                      <span className="uppercase tracking-wider text-[11px]">2. Penilaian Inherent Risk (Sebelum Kontrol)</span>
                    </div>
                    <div>
                      {getRiskBadge(formData.inherentRiskLevel || calcRiskLevel(formData.inherentLikelihood, formData.inherentImpact))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Inherent Likelihood (1 - 5)
                      </label>
                      <select
                        value={formData.inherentLikelihood}
                        onChange={(e) => {
                          const newL = e.target.value;
                          const autoLevel = calcRiskLevel(newL, formData.inherentImpact);
                          setFormData({ ...formData, inherentLikelihood: newL, inherentRiskLevel: autoLevel });
                        }}
                        className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-rose-400"
                      >
                        <option value="1">1 - Rare (Sangat Jarang)</option>
                        <option value="2">2 - Unlikely (Jarang)</option>
                        <option value="3">3 - Possible (Mungkin)</option>
                        <option value="4">4 - Likely (Sering)</option>
                        <option value="5">5 - Almost Certain (Hampir Pasti)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Inherent Impact (1 - 5)
                      </label>
                      <select
                        value={formData.inherentImpact}
                        onChange={(e) => {
                          const newI = e.target.value;
                          const autoLevel = calcRiskLevel(formData.inherentLikelihood, newI);
                          setFormData({ ...formData, inherentImpact: newI, inherentRiskLevel: autoLevel });
                        }}
                        className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-rose-400"
                      >
                        <option value="1">1 - Insignificant (Tidak Signifikan)</option>
                        <option value="2">2 - Minor (Kecil)</option>
                        <option value="3">3 - Moderate (Sedang)</option>
                        <option value="4">4 - Major (Besar / Signifikan)</option>
                        <option value="5">5 - Catastrophic (Bencana / Kritis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Inherent Risk Level
                      </label>
                      <select
                        value={formData.inherentRiskLevel}
                        onChange={(e) => setFormData({ ...formData, inherentRiskLevel: e.target.value })}
                        className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-rose-400"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Extreme">Extreme</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Catatan / Skenario Terburuk Inherent
                    </label>
                    <input
                      type="text"
                      value={formData.inherentNotes}
                      onChange={(e) => setFormData({ ...formData, inherentNotes: e.target.value })}
                      placeholder="Contoh: Operasional terhenti total apabila suplai material tidak tiba tepat waktu..."
                      className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>

                {/* 3. EXISTING CONTROLS */}
                <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200 space-y-3">
                  <div className="flex items-center gap-2 text-sky-900 font-bold border-b border-sky-200 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    <span className="uppercase tracking-wider text-[11px]">3. Pengendalian Internal Saat Ini (Existing Controls)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Uraian Kontrol / SOP yang Berjalan
                      </label>
                      <textarea
                        rows={2}
                        value={formData.controlDescription}
                        onChange={(e) => setFormData({ ...formData, controlDescription: e.target.value })}
                        placeholder="Contoh: Inspeksi harian tim QA, verifikasi ganda persetujuan PO, checklist safety..."
                        className="w-full bg-white border border-sky-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-400 resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Efektivitas Kontrol
                      </label>
                      <select
                        value={formData.controlEffectiveness}
                        onChange={(e) => setFormData({ ...formData, controlEffectiveness: e.target.value })}
                        className="w-full bg-white border border-sky-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-400"
                      >
                        <option value="Effective">Effective (Efektif)</option>
                        <option value="Partially Effective">Partially Effective (Sebagian Efektif)</option>
                        <option value="Ineffective">Ineffective (Tidak Efektif)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. RESIDUAL RISK EVALUATION */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span className="uppercase tracking-wider text-[11px]">4. Penilaian Residual Risk (Setelah Kontrol)</span>
                    </div>
                    <div>
                      {getRiskBadge(formData.residualRiskLevel || calcRiskLevel(formData.residualLikelihood, formData.residualImpact))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Residual Likelihood (1 - 5)
                      </label>
                      <select
                        value={formData.residualLikelihood}
                        onChange={(e) => {
                          const newL = e.target.value;
                          const autoLevel = calcRiskLevel(newL, formData.residualImpact);
                          setFormData({ ...formData, residualLikelihood: newL, residualRiskLevel: autoLevel });
                        }}
                        className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-400"
                      >
                        <option value="1">1 - Rare (Sangat Jarang)</option>
                        <option value="2">2 - Unlikely (Jarang)</option>
                        <option value="3">3 - Possible (Mungkin)</option>
                        <option value="4">4 - Likely (Sering)</option>
                        <option value="5">5 - Almost Certain (Hampir Pasti)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Residual Impact (1 - 5)
                      </label>
                      <select
                        value={formData.residualImpact}
                        onChange={(e) => {
                          const newI = e.target.value;
                          const autoLevel = calcRiskLevel(formData.residualLikelihood, newI);
                          setFormData({ ...formData, residualImpact: newI, residualRiskLevel: autoLevel });
                        }}
                        className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-400"
                      >
                        <option value="1">1 - Insignificant (Tidak Signifikan)</option>
                        <option value="2">2 - Minor (Kecil)</option>
                        <option value="3">3 - Moderate (Sedang)</option>
                        <option value="4">4 - Major (Besar)</option>
                        <option value="5">5 - Catastrophic (Kritis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Residual Risk Level
                      </label>
                      <select
                        value={formData.residualRiskLevel}
                        onChange={(e) => setFormData({ ...formData, residualRiskLevel: e.target.value })}
                        className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-emerald-400"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Extreme">Extreme</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Catatan Residual Risk
                    </label>
                    <input
                      type="text"
                      value={formData.residualNotes}
                      onChange={(e) => setFormData({ ...formData, residualNotes: e.target.value })}
                      placeholder="Catatan status ketercapaian penurunan risiko setelah adanya kontrol..."
                      className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* 5. TREATMENT PLAN & ACTION ITEMS */}
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold border-b border-amber-200 pb-2">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span className="uppercase tracking-wider text-[11px]">5. Rencana Tindakan Penanganan (Treatment Plan)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Rencana Tindak Lanjut / Rencana Mitigasi
                    </label>
                    <textarea
                      rows={2}
                      value={formData.treatmentPlan}
                      onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
                      placeholder="Contoh: Implementasi otomatisasi sensor cadangan, pelatihan berkala personil, pembuatan buffer stock..."
                      className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-amber-400 resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        PIC / Penanggung Jawab
                      </label>
                      <input
                        type="text"
                        value={formData.pic}
                        onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                        placeholder="Contoh: Section Head Plant, Logistic Spv..."
                        className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Target Batas Waktu (Due Date)
                      </label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer border border-emerald-400/30"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingItemNumber ? 'Simpan Perubahan' : 'Simpan ke Risk Register'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
