import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  AlertTriangle, 
  AlertCircle,
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
import { isStatusClosed, isStatusOpen, isStatusProgress, extractFindingYear } from '../utils/statusHelper';
import { getRecordDepartments } from '../utils/deptHelper';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

interface PriorityRecommendationsProps {
  key?: string;
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: (filter?: { dept?: string; search?: string; status?: string; project?: string; remarks?: string }) => void;
}

// Helper to format date badge like "01 Sep '26"
const formatDateBadge = (d: Date = new Date()): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const mon = monthNames[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day} ${mon} '${yr}`;
};

// Helper to format financial exposure / potential loss text
const getFormattedExposure = (item: PriorityRecommendationItem): string => {
  if (item.financialImpact?.estimatedValue && item.financialImpact.estimatedValue.trim() !== '') {
    return item.financialImpact.estimatedValue;
  }
  if (item.financialImpact?.estimatedRupiah && item.financialImpact.estimatedRupiah > 0) {
    const val = item.financialImpact.estimatedRupiah;
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(2).replace('.', ',')} Miliar`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1).replace('.', ',')} Juta`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  }
  return 'Rp 0';
};

export interface WarningReportHeaderProps {
  selectedSite: string;
  selectedDept: string;
  selectedYear: string;
  lastAnalyzedTime: string;
}

export function WarningReportHeader({
  selectedSite,
  selectedDept,
  selectedYear,
  lastAnalyzedTime
}: WarningReportHeaderProps) {
  return (
    <div className="w-full border-b-2 border-slate-900 pb-3 pt-0.5 bg-white print-avoid-break">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-[10px] tracking-wider">
              IARMS
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Internal Audit &amp; Risk Management Systems
            </span>
          </div>

          {/* Judul Utama Besar */}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-tight pt-1">
            WARNING REPORT TINDAK LANJUT TEMUAN AUDIT
          </h1>

          {/* Sub-header Merah */}
          <p className="text-xs sm:text-sm font-bold text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Fokus: Temuan Kritis (Major Open Findings) &amp; Eskalasi Temuan Open</span>
          </p>

          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium pt-0.5">
            <span>Lingkup Audit:</span>
            <span className="font-semibold text-slate-700">
              {selectedSite === 'ALL' ? 'Semua Site' : `Site ${selectedSite}`}
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-700">
              {selectedDept === 'ALL' ? 'Semua Departemen' : `Dept ${selectedDept}`}
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-700">
              {selectedYear === 'ALL' ? 'Semua Tahun' : `Tahun ${selectedYear}`}
            </span>
          </div>
        </div>

        {/* Badge Tanggal Cetak / Cut-Off Berwarna Merah Gelap di Pojok Kanan Atas */}
        <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
          <div className="px-3.5 py-1.5 rounded-xl bg-red-950 text-red-100 border border-red-800/90 shadow-xs flex items-center gap-2 font-mono font-bold text-xs sm:text-[13px] tracking-wide">
            <Calendar className="w-3.5 h-3.5 text-rose-400" />
            <span>{formatDateBadge()}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 text-left sm:text-right">
            <p>Cut-Off: {lastAnalyzedTime} WIB</p>
            <p className="text-rose-800 font-bold uppercase tracking-wider">CONFIDENTIAL / ESCALATION</p>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string>(() => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Manage body class for printing lifecycle
  useEffect(() => {
    if (!isPrintModalOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add('is-printing-report');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('is-printing-report');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('is-printing-report');
    };
  }, [isPrintModalOpen]);

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

  // Helper to render Risk Level Badges
  const renderRiskBadge = (level: PriorityRecommendationItem['riskLevel']) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200">
            <ShieldAlert className="w-3 h-3" />
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            LOW
          </span>
        );
    }
  };

  const renderTableRiskBadge = (level: PriorityRecommendationItem['riskLevel']) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-200">
            <ShieldAlert className="w-2.5 h-2.5" />
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />
            LOW
          </span>
        );
    }
  };

  // Handle status update directly from Priority Recommendation UI (for OPEN / IN PROGRESS / CLOSE)
  // Updates all records tied to this audit finding to maintain finding-level consistency
  const handleUpdateStatus = (item: PriorityRecommendationItem, newStatus: 'OPEN' | 'IN PROGRESS' | 'CLOSE') => {
    const allRows = getMergedSheetRows();
    const rowIds = new Set(item.allRecords?.map(r => r._rowId).filter(Boolean) || [item.record._rowId]);
    const targetNo = item.findingNo || item.record.NO;
    const targetProj = item.record['PROJECT AUDIT'];
    const targetSite = item.record.SITE || '';
    const targetProb = (item.findingTitle || item.record['PROBLEM/FINDING'] || '').trim().toLowerCase();

    let found = false;
    const updatedRows = allRows.map(r => {
      const isMatch = (r._rowId && rowIds.has(r._rowId)) ||
        (r['PROJECT AUDIT'] === targetProj && (r.SITE || '') === targetSite && (
          (targetNo && r.NO === targetNo) ||
          ((r['PROBLEM/FINDING'] || r['DETAIL TEMUAN'] || '').trim().toLowerCase() === targetProb)
        ));

      if (isMatch) {
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
      saveEntireDataset(updatedRows, `Update Status Temuan Prioritas #${targetNo || 'ID'} -> ${newStatus}`);
      setRawRows(updatedRows);
      
      if (newStatus === 'CLOSE') {
        onToast(
          `Temuan #${targetNo || ''} (${targetProj}) berhasil di-CLOSE! Seluruh poin rekomendasi telah ditutup dan dikeluarkan dari Top 10.`, 
          'success'
        );
      } else {
        onToast(`Status temuan #${targetNo || ''} (${targetProj}) diperbarui ke ${newStatus}. Resume AFS tersinkronisasi.`, 'success');
      }
    } else {
      onToast('Gagal memperbarui status temuan.', 'error');
    }
  };

  // Filter items by status and search query (Finding-Centric)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const hasProgress = item.recommendations?.some(r => r.isProgress) ?? isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
      const hasOpen = item.recommendations?.some(r => r.isOpen) ?? isStatusOpen(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);

      if (filterStatus === 'open' && !hasOpen) return false;
      if (filterStatus === 'progress' && !hasProgress) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = [
          item.findingNo,
          item.record.NO,
          item.record['PROJECT AUDIT'],
          item.record.SITE,
          item.findingTitle,
          item.record['PROBLEM/FINDING'],
          item.record['DETAIL TEMUAN'],
          item.allRecommendationsText,
          item.combinedPic,
          item.financialImpact.description,
          item.financialImpact.estimatedValue,
          item.operationalImpact.description
        ].join(' ').toLowerCase();

        return text.includes(q);
      }

      return true;
    });
  }, [items, filterStatus, searchQuery]);

  // Export to Excel / CSV format (Finding-Centric with consolidated recommendations)
  const handleExportExcel = () => {
    if (items.length === 0) {
      onToast('Tidak ada data temuan prioritas aktif untuk diekspor.', 'warning');
      return;
    }

    const headers = [
      'Rank',
      'Risk Severity',
      'Nilai Exposure Kerugian',
      'AI Score',
      'Project Audit',
      'Site / Lokasi',
      'No Temuan',
      'Temuan Audit (Problem Statement)',
      'Detail Temuan',
      'Dampak Finansial',
      'Gangguan Operasional',
      'Rasional Eksekutif AI',
      'Rekomendasi Penanganan (Seluruh Poin)',
      'PIC (Seluruh Rekomendasi)',
      'Target Due Date',
      'Status Tindak Lanjut'
    ];

    const rows = items.map(item => {
      const isProg = item.recommendations.some(r => r.isProgress);
      return [
        `#${item.rank}`,
        item.riskLevel,
        `"${(item.financialImpact.estimatedValue || 'Rp 0').replace(/"/g, '""')}"`,
        `${item.score}/100`,
        `"${(item.record['PROJECT AUDIT'] || '').replace(/"/g, '""')}"`,
        `"${(item.record.SITE || '').replace(/"/g, '""')}"`,
        `"${(item.findingNo || item.record.NO || '').replace(/"/g, '""')}"`,
        `"${(item.findingTitle || item.record['PROBLEM/FINDING'] || '').replace(/"/g, '""')}"`,
        `"${(item.record['DETAIL TEMUAN'] || '').replace(/"/g, '""')}"`,
        `"${(item.financialImpact.description || '').replace(/"/g, '""')}"`,
        `"${(item.operationalImpact.description || '').replace(/"/g, '""')}"`,
        `"${(item.aiRationale || '').replace(/"/g, '""')}"`,
        `"${(item.allRecommendationsText || item.keyMitigationAction || '').replace(/"/g, '""')}"`,
        `"${(item.combinedPic || item.record['PIC SITE'] || item.record['PIC HO'] || '').replace(/"/g, '""')}"`,
        `"${(item.nearestDueDateInfo.formattedDate || '').replace(/"/g, '""')}"`,
        `"${(isProg ? 'IN PROGRESS' : 'OPEN')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Top_10_Temuan_Prioritas_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportDropdownOpen(false);
    onToast('File Excel Top 10 Temuan Prioritas berhasil diunduh.', 'success');
  };

  // Handler for printing via browser dialog (Window.print)
  const handlePrint = () => {
    document.body.classList.add('is-printing-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing-report');
    }, 1200);
  };

  // Handler for direct PDF generation and download via jsPDF & html-to-image
  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-priority-report');
    if (!element) {
      onToast('Elemen dokumen cetak tidak ditemukan.', 'error');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      onToast('Sedang menyiapkan dokumen PDF resmi...', 'info');

      // Capture element to high resolution image without scrollbars
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          overflow: 'visible',
          overflowY: 'visible',
          overflowX: 'visible',
          maxHeight: 'none',
          height: 'auto',
        },
        filter: (node: HTMLElement) => {
          if (node.classList && (node.classList.contains('no-print') || node.classList.contains('print:hidden'))) {
            return false;
          }
          return true;
        }
      });

      // Create portrait A4 PDF (210mm x 297mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2); // 194mm

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });

      const imgWidth = contentWidth;
      const imgHeight = (img.height * imgWidth) / img.width;

      let heightLeft = imgHeight;
      let position = margin;
      const maxPageContentHeight = pageHeight - (margin * 2); // 281mm

      // Add first page
      pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= maxPageContentHeight;

      // Add subsequent pages if cards overflow a single page
      while (heightLeft > 0) {
        position = position - maxPageContentHeight;
        pdf.addPage('a4', 'portrait');
        pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= maxPageContentHeight;
      }

      pdf.save(`Warning_Report_Tindak_Lanjut_Temuan_${new Date().toISOString().slice(0, 10)}.pdf`);
      onToast('Dokumen Warning Report PDF berhasil diunduh.', 'success');
    } catch (err) {
      console.error('Failed to generate PDF directly:', err);
      onToast('Gagal memproses file PDF langsung. Mengalihkan ke jendela Cetak / Simpan PDF...', 'warning');
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
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
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Temuan yang Sesuai</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery 
              ? `Tidak ditemukan temuan audit prioritas dengan kata kunci "${searchQuery}".`
              : 'Seluruh temuan aktif telah tertangani atau tidak ada temuan dengan filter ini.'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW: Rank 1 - 10 (Finding-Centric) */
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const hasProgress = item.recommendations.some(r => r.isProgress);
            const totalRecs = item.recommendations.length;
            const progressCount = item.recommendations.filter(r => r.isProgress).length;

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
                        {/* Risk Severity Badge (Critical / High / Medium / Low) */}
                        {renderRiskBadge(item.riskLevel)}

                        {/* AI Score Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Skor AI: {item.score}/100
                        </span>

                        {/* Status Badge (OPEN / IN PROGRESS) */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide flex items-center gap-1.5 border ${
                          hasProgress
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${hasProgress ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                          {hasProgress ? 'IN PROGRESS' : 'OPEN'}
                          {totalRecs > 1 && (
                            <span className="text-[10px] font-bold text-amber-800 ml-1">
                              ({progressCount}/{totalRecs})
                            </span>
                          )}
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

                        {(item.findingNo || item.record.NO) && (
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            No. {item.findingNo || item.record.NO}
                          </span>
                        )}
                      </div>

                      {/* Finding Problem Statement (Finding-Centric) */}
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.findingTitle || item.record['PROBLEM/FINDING'] || item.record['DETAIL TEMUAN'] || 'Temuan Audit'}
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
                              <span className="px-2 py-0.5 rounded-md bg-rose-200 text-rose-900 font-mono font-bold text-[10px]">
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

                      {/* Rekomendasi Prioritas Penanganan (Multiple Recommendations in One Finding) */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                            Rekomendasi Penanganan Audit ({item.recommendations.length} Poin)
                          </span>
                          {item.recommendations.length > 1 && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              Multi-Rekomendasi
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {item.recommendations.map((rec, rIdx) => (
                            <div key={rec.id || rIdx} className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs space-y-1.5 shadow-2xs">
                              <div className="flex items-start gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex-shrink-0 mt-0.5">
                                  {rIdx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 leading-relaxed">
                                    {rec.recommendationText}
                                  </p>
                                  <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] text-slate-500 font-medium">
                                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                                      <User className="w-3 h-3 text-slate-400" />
                                      PIC: {rec.picCombined}
                                    </span>
                                    <span className="flex items-center gap-1 font-mono">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      Target: {rec.dueDateInfo.formattedDate}
                                    </span>
                                    {rec.dueDateInfo.formattedDate !== '-' && (
                                      <span className={`px-1.5 py-0.2 rounded font-bold ${
                                        rec.dueDateInfo.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {rec.dueDateInfo.isOverdue ? `Overdue ${Math.abs(rec.dueDateInfo.daysRemaining)}d` : `${rec.dueDateInfo.daysRemaining}d left`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: PIC, Due Date, Status Action Buttons */}
                  <div className="lg:w-64 flex-shrink-0 flex flex-col justify-between space-y-3.5 pt-3 lg:pt-0 lg:border-l lg:border-slate-200/80 lg:pl-5">
                    {/* PIC Info Summary */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          PIC Penanggung Jawab
                        </span>
                        <div className="font-bold text-slate-800 flex items-start gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-tight">{item.combinedPic}</span>
                        </div>
                      </div>

                      {/* Due Date Summary */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Target Deadline Terdekat
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-bold text-slate-800">
                            {item.nearestDueDateInfo.formattedDate}
                          </span>
                        </div>
                        {item.nearestDueDateInfo.formattedDate !== '-' && (
                          <div className="mt-1">
                            {item.nearestDueDateInfo.isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-3 h-3" /> Overdue {Math.abs(item.nearestDueDateInfo.daysRemaining)} Hari
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" /> {item.nearestDueDateInfo.daysRemaining} Hari Tersisa
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
                          disabled={!hasProgress}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                            !hasProgress 
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-black' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Ubah status seluruh poin rekomendasi menjadi OPEN"
                        >
                          🔴 OPEN
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item, 'IN PROGRESS')}
                          disabled={hasProgress}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                            hasProgress 
                              ? 'bg-amber-50 text-amber-800 border-amber-300 font-black' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Ubah status seluruh poin rekomendasi menjadi IN PROGRESS"
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
                        <span>Detail Temuan ({item.recommendations.length} Rekomendasi)</span>
                      </button>

                      {onNavigateToAFS && (
                        <button
                          onClick={() => {
                            onNavigateToAFS({
                              project: item.record['PROJECT AUDIT'],
                              search: item.findingTitle || item.findingNo || item.record.NO
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
        /* TABLE VIEW: Rank 1 - 10 (Finding-Centric with Multi-Recommendation in One Row) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 text-center w-14">Rank</th>
                  <th className="p-3.5 w-28">Level Risiko</th>
                  <th className="p-3.5 w-44">Site &amp; Project</th>
                  <th className="p-3.5 min-w-[280px]">Temuan Audit &amp; Potensi Dampak</th>
                  <th className="p-3.5 min-w-[280px]">Rekomendasi (Seluruh Poin)</th>
                  <th className="p-3.5 min-w-[200px]">PIC &amp; Target Due Date</th>
                  <th className="p-3.5 w-32 text-center">Status</th>
                  <th className="p-3.5 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item) => {
                  const hasProgress = item.recommendations.some(r => r.isProgress);
                  const totalRecs = item.recommendations.length;
                  const progressCount = item.recommendations.filter(r => r.isProgress).length;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Rank & AI Score */}
                      <td className="p-3.5 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-semibold text-xs ${
                          item.rank === 1 
                            ? 'bg-amber-500 text-slate-950 font-semibold' 
                            : item.rank === 2 
                            ? 'bg-slate-300 text-slate-900 font-semibold' 
                            : item.rank === 3 
                            ? 'bg-amber-800 text-amber-100 font-semibold' 
                            : 'bg-slate-100 text-slate-700 font-medium'
                        }`}>
                          #{item.rank}
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400 mt-1">
                          {item.score} pt
                        </span>
                      </td>

                      {/* Level Risiko (CRITICAL / HIGH / MEDIUM / LOW) */}
                      <td className="p-3.5 align-top">
                        {renderTableRiskBadge(item.riskLevel)}
                      </td>

                      {/* Site & Project */}
                      <td className="p-3.5 align-top space-y-1">
                        <strong className="block text-slate-900 font-semibold">
                          {item.record['PROJECT AUDIT'] || 'Audit'}
                        </strong>
                        <span className="text-[11px] text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.record.SITE || 'Head Office'}
                        </span>
                        {(item.findingNo || item.record.NO) && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            No #{item.findingNo || item.record.NO}
                          </span>
                        )}
                      </td>

                      {/* Temuan Audit & Potensi Dampak (Finding-Centric) */}
                      <td className="p-3.5 align-top space-y-1.5">
                        <p className="font-semibold text-slate-900 leading-snug">
                          {item.findingTitle || item.record['PROBLEM/FINDING']}
                        </p>
                        
                        {/* Nilai Exposure Kerugian */}
                        {item.financialImpact.estimatedValue && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 font-semibold font-mono text-[10px]">
                            <DollarSign className="w-3 h-3 text-rose-600" />
                            Eksposur: {item.financialImpact.estimatedValue}
                          </div>
                        )}

                        <div className="text-[11px] text-rose-700 font-medium">
                          • {item.financialImpact.description}
                        </div>
                        <div className="text-[11px] text-amber-800 font-medium">
                          • {item.operationalImpact.description}
                        </div>
                      </td>

                      {/* Rekomendasi Prioritas (Multi-recommendation in One Row) */}
                      <td className="p-3.5 align-top">
                        {item.recommendations.length > 1 ? (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.recommendations.length} Poin Rekomendasi Terkait:
                            </div>
                            <ol className="space-y-2 list-none">
                              {item.recommendations.map((rec, rIdx) => (
                                <li key={rec.id || rIdx} className="text-slate-800 font-medium leading-snug flex items-start gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-200/60">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[9px] flex-shrink-0 mt-0.5">
                                    {rIdx + 1}
                                  </span>
                                  <span className="flex-1 text-[11px]">{rec.recommendationText}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : (
                          <p className="text-slate-700 font-medium leading-relaxed">
                            {item.recommendations[0]?.recommendationText || item.keyMitigationAction}
                          </p>
                        )}
                      </td>

                      {/* PIC & Due Date (Aggregated Multi-Recommendation) */}
                      <td className="p-3.5 align-top">
                        {item.recommendations.length > 1 ? (
                          <div className="space-y-2">
                            {item.recommendations.map((rec, rIdx) => (
                              <div key={rec.id || rIdx} className="text-[11px] border-b border-slate-100 last:border-0 pb-1.5 last:pb-0 space-y-0.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-[10px] text-indigo-700">Poin #{rIdx + 1}</span>
                                  {rec.dueDateInfo.formattedDate !== '-' && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      rec.dueDateInfo.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {rec.dueDateInfo.isOverdue ? `Overdue ${Math.abs(rec.dueDateInfo.daysRemaining)}d` : `${rec.dueDateInfo.daysRemaining}d left`}
                                    </span>
                                  )}
                                </div>
                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span className="truncate" title={rec.picCombined}>{rec.picCombined}</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  {rec.dueDateInfo.formattedDate}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{item.combinedPic}</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-600">
                              {item.nearestDueDateInfo.formattedDate}
                            </div>
                            {item.nearestDueDateInfo.formattedDate !== '-' && (
                              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.nearestDueDateInfo.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.nearestDueDateInfo.isOverdue ? `Overdue ${Math.abs(item.nearestDueDateInfo.daysRemaining)}d` : `${item.nearestDueDateInfo.daysRemaining}d left`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status Badge (OPEN / IN PROGRESS) */}
                      <td className="p-3.5 align-top text-center space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                          hasProgress
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hasProgress ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                          {hasProgress ? 'IN PROGRESS' : 'OPEN'}
                        </span>
                        {totalRecs > 1 && (
                          <span className="block text-[9px] font-bold text-slate-500">
                            {progressCount}/{totalRecs} In Progress
                          </span>
                        )}
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
                                search: item.findingTitle || item.findingNo || item.record.NO
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
                    Temuan Audit (Problem / Finding)
                  </span>
                  <p className="text-sm font-bold text-slate-900 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {selectedItemForModal.findingTitle || selectedItemForModal.record['PROBLEM/FINDING']}
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

                {/* Rekomendasi Penanganan (Consolidated Points) */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Rekomendasi Penanganan Audit ({selectedItemForModal.recommendations.length} Poin)
                  </span>
                  <div className="space-y-2">
                    {selectedItemForModal.recommendations.map((rec, rIdx) => (
                      <div key={rec.id || rIdx} className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex-shrink-0 mt-0.5">
                            {rIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-indigo-950 font-semibold leading-relaxed">
                              {rec.recommendationText}
                            </p>
                            <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-indigo-800 font-medium pt-1 border-t border-indigo-200/60">
                              <span><strong>PIC:</strong> {rec.picCombined}</span>
                              <span><strong>Target:</strong> {rec.dueDateInfo.formattedDate}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                rec.isProgress ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {rec.isProgress ? 'IN PROGRESS' : 'OPEN'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact Analysis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <span className="font-bold text-rose-800 text-[11px] block mb-1">
                      Dampak Finansial: {selectedItemForModal.financialImpact.level}
                    </span>
                    {selectedItemForModal.financialImpact.estimatedValue && (
                      <span className="inline-block px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-mono font-bold text-[10px] mb-1">
                        Eksposur: {selectedItemForModal.financialImpact.estimatedValue}
                      </span>
                    )}
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
                          search: selectedItemForModal.findingTitle || selectedItemForModal.findingNo || selectedItemForModal.record.NO
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
          <div 
            id="printable-modal-backdrop" 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none print:z-auto print:block"
          >
            <motion.div
              id="printable-modal-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 sm:p-7 space-y-5 print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:overflow-y-visible print:overflow-x-visible print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none no-scrollbar"
            >
              {/* Modal Top Bar (Controls - Hidden during Print) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3 no-print print:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                      Warning Report: Tindak Lanjut Temuan Audit
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Format Warning Report Card Layout • Siap Cetak &amp; Export PDF Resmi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Unduh File PDF Langsung */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-60"
                    title="Unduh file PDF resmi Warning Report Card"
                  >
                    {isGeneratingPdf ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh PDF'}</span>
                  </button>

                  {/* Cetak Dokumen via Browser Window.print */}
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    title="Buka dialog cetak browser (Cetak ke printer atau Simpan sebagai PDF)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Dokumen</span>
                  </button>

                  {/* Close Modal */}
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                    title="Tutup jendela pratinjau"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Document Preview Area */}
              <div 
                id="printable-priority-report" 
                className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 font-sans text-slate-900 text-xs print:p-0 print:m-0 print:border-none print:shadow-none print:overflow-visible print:overflow-y-visible print:overflow-x-visible print:h-auto print:max-h-none no-scrollbar"
              >
                <table className="w-full border-collapse border-none m-0 p-0 print-report-table text-left">
                  {/* Table Header: repeats automatically on every page in print / PDF */}
                  <thead className="print-table-header">
                    <tr>
                      <th className="p-0 pb-3 border-none bg-transparent font-normal text-left align-top">
                        <WarningReportHeader
                          selectedSite={selectedSite}
                          selectedDept={selectedDept}
                          selectedYear={selectedYear}
                          lastAnalyzedTime={lastAnalyzedTime}
                        />
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body: Executive Summary, Cards, and Sign-off */}
                  <tbody className="print-table-body">
                    {/* Executive Summary Box Row */}
                    <tr className="print-avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <td className="p-0 pb-3.5 border-none bg-transparent align-top">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 print:bg-slate-100 print:border-slate-300 print-avoid-break">
                          <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide block">
                            Ringkasan Eksekutif:
                          </span>
                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            Dokumen ini merangkum <strong>10 temuan audit prioritas tertinggi</strong> yang masih berstatus aktif (<strong className="text-rose-700">OPEN</strong> atau <strong className="text-amber-700">IN PROGRESS</strong>) berdasarkan kalkulasi AI Risk Scoring Engine. Temuan-temuan ini dinilai memiliki potensi kerugian finansial, risiko gangguan operasional, serta urgensi tindak lanjut tertinggi dengan total estimasi eksposur teridentifikasi: <strong className="text-rose-700 font-mono font-bold text-xs">{summary?.totalEstimatedExposure || 'Rp 0'}</strong>.
                          </p>
                        </div>
                      </td>
                    </tr>

                    {/* Warning Report Cards: each in its own row for strict break-inside avoid */}
                    {items.map(item => {
                      const isProg = item.recommendations.some(r => r.isProgress);
                      const isOverdue = item.nearestDueDateInfo.isOverdue || (item.record.REMARKS || '').toUpperCase().includes('OVERDUE');
                      const overdueDays = Math.abs(item.nearestDueDateInfo.daysRemaining);
                      const exposureText = getFormattedExposure(item);
                      const findingDescription = item.record['DETAIL TEMUAN'] || item.record['PROBLEM/FINDING'] || item.findingTitle;

                      return (
                        <tr 
                          key={item.id}
                          className="print-avoid-break"
                          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                        >
                          <td className="p-0 pb-3.5 border-none bg-transparent align-top">
                            <div 
                              className="print-warning-card print-avoid-break bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden flex flex-col sm:flex-row transition-all hover:border-slate-400 print:border-slate-400 print:shadow-none"
                              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                            >
                              {/* Sisi Kiri (Rank Number): Blok abu-abu berisikan nomor urut besar (misal: 1, 2, ..., 10) */}
                              <div className="w-full sm:w-16 md:w-20 bg-slate-100 border-b sm:border-b-0 sm:border-r border-slate-300 flex flex-row sm:flex-col items-center justify-between sm:justify-center p-3 sm:p-2 shrink-0 select-none print:bg-slate-100 print:border-slate-300">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">
                                  RANK
                                </span>
                                <span className="font-black text-2xl sm:text-4xl text-slate-800 font-mono tracking-tight">
                                  {item.rank}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 sm:mt-1 hidden sm:block uppercase">
                                  TOP 10
                                </span>
                              </div>

                              {/* Sisi Kanan / Konten Utama Kartu */}
                              <div className="flex-1 p-4 sm:p-5 space-y-3">
                                {/* Area Judul & Nilai Risiko (Header Kartu) */}
                                <div 
                                  className="print-avoid-break print-card-subblock flex flex-col md:flex-row md:items-start justify-between gap-2.5 border-b border-slate-200 pb-3"
                                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                >
                                  {/* Kiri: Judul Temuan Utama (Font Bold/Tebal) */}
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[10px] tracking-wide">
                                        {item.record['PROJECT AUDIT'] || 'Audit Project'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px] border border-slate-200">
                                        Site: {item.record.SITE || 'Head Office'}
                                      </span>
                                      {item.findingNo && (
                                        <span className="text-[10.5px] font-mono text-slate-500 font-semibold">
                                          Temuan #{item.findingNo}
                                        </span>
                                      )}
                                    </div>

                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                      {item.findingTitle || item.record['PROBLEM/FINDING']}
                                    </h3>
                                  </div>

                                  {/* Kanan: Potential Loss / Eksposur Risiko, Kategori Risiko, dan Badge Overdue */}
                                  <div className="flex flex-wrap items-center md:flex-col md:items-end gap-1.5 shrink-0">
                                    {/* Potential Loss / Eksposur Risiko (Teks Merah Tebal, misal: Potential Loss: Rp 1,70 Miliar) */}
                                    <div className="text-xs sm:text-[13px] font-bold text-rose-700 font-mono tracking-tight flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      <span>Potential Loss: {exposureText}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Kategori Risiko (Teks Orange) */}
                                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        {item.record.KATEGORI ? `Kategori: ${item.record.KATEGORI}` : `Level: ${item.riskLevel}`}
                                      </span>

                                      {/* Badge Overdue (Misal: Overdue: 146 Hari) */}
                                      {isOverdue ? (
                                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10.5px] tracking-wide inline-flex items-center gap-1 shadow-2xs">
                                          <Clock className="w-3 h-3" />
                                          Overdue: {overdueDays < 999 && overdueDays > 0 ? `${overdueDays} Hari` : (item.nearestDueDateInfo.formattedDate || 'Terlewat')}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-bold text-[10.5px] tracking-wide inline-flex items-center gap-1 shadow-2xs">
                                          <Clock className="w-3 h-3" />
                                          Due: {item.nearestDueDateInfo.formattedDate}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Area Narasi Temuan: Teks deskripsi ringkas temuan audit dengan prefiks **Temuan:** */}
                                <div 
                                  className="print-avoid-break print-card-subblock print-card-finding text-slate-800 text-xs sm:text-[12.5px] leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-200"
                                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                >
                                  <p>
                                    <strong className="text-slate-900 font-bold">Temuan: </strong>
                                    {findingDescription}
                                  </p>
                                  {item.financialImpact.description && (
                                    <p className="text-[11px] text-rose-800 font-medium mt-1.5 flex items-start gap-1">
                                      <span className="font-bold text-rose-900 shrink-0">• Dampak Risiko:</span>
                                      <span>{item.financialImpact.description}</span>
                                    </p>
                                  )}
                                </div>

                                {/* Area Rekomendasi (Callout Hijau) */}
                                <div 
                                  className="print-avoid-break print-card-subblock print-card-recommendation bg-emerald-50/90 border-l-4 border-l-emerald-600 border border-emerald-200 rounded-r-xl p-3 sm:p-3.5 space-y-2"
                                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                >
                                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs uppercase tracking-wide">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Rekomendasi Wajib:</span>
                                  </div>

                                  <div className="text-slate-900 text-xs sm:text-[12px] leading-relaxed pl-1">
                                    {item.recommendations && item.recommendations.length > 1 ? (
                                      <ol className="space-y-1.5 list-decimal list-inside font-normal text-slate-800">
                                        {item.recommendations.map((rec, rIdx) => (
                                          <li key={rIdx} className="leading-snug">
                                            <span className="font-medium text-slate-900">{rec.recommendationText}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    ) : (
                                      <p className="font-medium text-slate-800 leading-snug">
                                        {item.recommendations?.[0]?.recommendationText || item.keyMitigationAction || item.allRecommendationsText || 'Tindak lanjut rekomendasi perbaikan sesuai rencana aksi manajemen.'}
                                      </p>
                                    )}
                                  </div>

                                  {/* Sisi kanan bawah kotak hijau menampilkan badge PIC */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200/80 text-[10.5px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-emerald-800 font-medium">Status Temuan:</span>
                                      <span className={`px-2 py-0.5 rounded font-bold text-[9.5px] uppercase border ${
                                        isProg
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : 'bg-rose-100 text-rose-900 border-rose-300'
                                      }`}>
                                        {isProg ? 'IN PROGRESS' : 'OPEN'}
                                      </span>
                                    </div>

                                    <div className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-950 font-bold text-[11px] shadow-2xs tracking-wide">
                                      PIC: {item.combinedPic || item.record.PIC || item.record.DEPARTMENT || 'PIC Terkait'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Signoff Blocks Row */}
                    <tr className="print-avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <td className="p-0 pt-4 border-none bg-transparent align-top">
                        <div className="grid grid-cols-2 gap-12 pt-6 text-center text-xs print:pt-6 print-avoid-break">
                          <div>
                            <p className="text-slate-600 font-medium">Dipersiapkan Oleh:</p>
                            <div className="h-12" />
                            <p className="font-bold text-slate-900 border-t border-slate-400 inline-block px-8 pt-1">
                              Tim Internal Audit IARMS
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600 font-medium">Mengetahui:</p>
                            <div className="h-12" />
                            <p className="font-bold text-slate-900 border-t border-slate-400 inline-block px-8 pt-1">
                              Chief Audit Executive (CAE) / Komite Audit
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
