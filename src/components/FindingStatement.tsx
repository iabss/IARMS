import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  RotateCcw, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown,
  Download,
  Trash2,
  Edit2,
  X,
  FileCheck2,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  FileText,
  RefreshCw,
  FolderOpen,
  Lock
} from 'lucide-react';
import { AFSFindingRecord } from '../types';
import rawSheetData from '../data/sheetData.json';
import { getMergedSheetRows, getProjectLinkConfigs } from '../data/dataSyncManager';
import { parseDepartments, getRecordDepartments, matchesDepartmentRecord } from '../utils/deptHelper';

interface FindingStatementProps {
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToInputAFS?: () => void;
  initialFilter?: {
    dept?: string;
    search?: string;
    status?: string;
    project?: string;
    remarks?: string;
  } | null;
  key?: string;
}

const GOOGLE_SHEET_URL = rawSheetData.sourceUrl || "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit";

// Function to automatically resolve merged cell hierarchy from Google Sheets / Excel exports
const processMergedRows = (rows: AFSFindingRecord[]): AFSFindingRecord[] => {
  let currentNo = '';
  let currentProject = '';
  let currentSite = '';
  let currentProblem = '';
  let currentDetail = '';
  let currentKriteria = '';
  let currentKategori = '';

  return rows.map((row) => {
    const hasNo = row.NO !== undefined && row.NO !== null && String(row.NO).trim() !== '';
    const hasProject = !!row["PROJECT AUDIT"] && String(row["PROJECT AUDIT"]).trim() !== '';
    const hasSite = !!row.SITE && String(row.SITE).trim() !== '';
    const hasProblem = !!row["PROBLEM/FINDING"] && String(row["PROBLEM/FINDING"]).trim() !== '';
    const hasDetail = !!row["DETAIL TEMUAN"] && String(row["DETAIL TEMUAN"]).trim() !== '';
    const hasKriteria = !!row.KRITERIA && String(row.KRITERIA).trim() !== '';
    const hasKategori = !!row.KATEGORI && String(row.KATEGORI).trim() !== '';

    if (hasNo) currentNo = String(row.NO);
    if (hasProject) currentProject = row["PROJECT AUDIT"];
    if (hasSite) currentSite = row.SITE;
    if (hasProblem) currentProblem = row["PROBLEM/FINDING"];
    if (hasDetail) currentDetail = row["DETAIL TEMUAN"];
    if (hasKriteria) currentKriteria = row.KRITERIA;
    if (hasKategori) currentKategori = row.KATEGORI;

    return {
      ...row,
      NO: hasNo ? row.NO : currentNo,
      "PROJECT AUDIT": hasProject ? row["PROJECT AUDIT"] : currentProject,
      SITE: hasSite ? row.SITE : currentSite,
      "PROBLEM/FINDING": hasProblem ? row["PROBLEM/FINDING"] : currentProblem,
      "DETAIL TEMUAN": hasDetail ? row["DETAIL TEMUAN"] : (currentDetail || currentProblem),
      KRITERIA: hasKriteria ? row.KRITERIA : currentKriteria,
      KATEGORI: hasKategori ? row.KATEGORI : currentKategori,
    };
  });
};

export default function FindingStatement({ onToast, onNavigateToInputAFS, initialFilter }: FindingStatementProps) {
  // Data loaded from the parsed Google Sheet with Merged Cell Auto-Fill & Sync
  const [data, setData] = useState<AFSFindingRecord[]>(() => processMergedRows(getMergedSheetRows()));

  React.useEffect(() => {
    const handleDataSynced = () => {
      setData(processMergedRows(getMergedSheetRows()));
    };
    window.addEventListener('afs_data_synced', handleDataSynced);
    return () => window.removeEventListener('afs_data_synced', handleDataSynced);
  }, []);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Column-Specific Header Filter States
  const [colFilterNo, setColFilterNo] = useState('');
  const [colFilterDetail, setColFilterDetail] = useState('');
  const [colFilterRekomendasi, setColFilterRekomendasi] = useState('');
  const [colFilterPicSite, setColFilterPicSite] = useState('');
  const [colFilterPicHO, setColFilterPicHO] = useState('');
  const [colFilterDueDate, setColFilterDueDate] = useState('');
  const [colFilterRemarks, setColFilterRemarks] = useState('ALL');
  const [colFilterIaReview, setColFilterIaReview] = useState('ALL');

  // React to initialFilter navigation triggers from other components
  React.useEffect(() => {
    if (initialFilter) {
      if (initialFilter.dept) {
        setSelectedDept(initialFilter.dept.toUpperCase());
        setSearchQuery(''); // Critical: Clear search query so "IT" doesn't falsely substring-match 'Audit', 'Site', 'Terkait', etc.
      } else {
        setSelectedDept('ALL');
      }

      if (initialFilter.search) {
        setSearchQuery(initialFilter.search);
      } else if (!initialFilter.dept) {
        setSearchQuery('');
      }

      if (initialFilter.status) {
        setSelectedStatus(initialFilter.status.toUpperCase());
      } else {
        setSelectedStatus('ALL');
      }

      if (initialFilter.project) {
        setSelectedProject(initialFilter.project);
      } else {
        setSelectedProject('ALL');
      }

      if (initialFilter.remarks) {
        setColFilterRemarks(initialFilter.remarks.toUpperCase());
      } else {
        setColFilterRemarks('ALL');
      }

      setCurrentPage(1);
    }
  }, [initialFilter]);

  // Sorting & Pagination States
  const [sortField, setSortField] = useState<keyof AFSFindingRecord>('_rowId');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Interaction States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<AFSFindingRecord | null>(null);
  const [editingItem, setEditingItem] = useState<AFSFindingRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for Add / Edit
  const [formNo, setFormNo] = useState('');
  const [formProject, setFormProject] = useState('PR-PAYMENT');
  const [formSite, setFormSite] = useState('JKT');
  const [formProblem, setFormProblem] = useState('');
  const [formDetail, setFormDetail] = useState('');
  const [formKriteria, setFormKriteria] = useState('DO');
  const [formKategori, setFormKategori] = useState('MAJOR');
  const [formRekomendasi, setFormRekomendasi] = useState('');
  const [formStatus, setFormStatus] = useState('OPEN');
  const [formPicSite, setFormPicSite] = useState('');
  const [formPicHO, setFormPicHO] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formRemarks, setFormRemarks] = useState('OVERDUE');
  const [formDokumenClosing, setFormDokumenClosing] = useState('');
  const [formIaReview, setFormIaReview] = useState('');
  const [formNote, setFormNote] = useState('');

  // Helper to format unique text (merge duplicates case-insensitively)
  const formatUniqueText = (val?: string): string => {
    if (!val || !val.trim()) return '-';
    const parts = parseDepartments(val);
    const map = new Map<string, string>();
    parts.forEach(p => {
      const key = p.toUpperCase();
      if (!map.has(key)) map.set(key, p);
    });
    const unique = Array.from(map.values());
    return unique.length > 0 ? unique.join(', ') : '-';
  };

  // Extract Dropdown Options
  const configuredProjectConfigs = useMemo(() => {
    const configs = getProjectLinkConfigs();
    return configs.filter(c => c.sheetUrl && c.sheetUrl.trim() !== '');
  }, [data]);

  const configuredProjectSet = useMemo(() => {
    const set = new Set<string>();
    configuredProjectConfigs.forEach(c => {
      if (c.projectName) {
        set.add(c.projectName.trim().toUpperCase());
      }
    });
    return set;
  }, [configuredProjectConfigs]);

  const configuredProjectNames = useMemo(() => {
    const map = new Map<string, string>();
    configuredProjectConfigs.forEach(c => {
      if (c.projectName) {
        const name = c.projectName.trim();
        const key = name.toUpperCase();
        if (!map.has(key)) map.set(key, name);
      }
    });
    return Array.from(map.values()).sort();
  }, [configuredProjectConfigs]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (d["PROJECT AUDIT"]) {
        const trimmed = d["PROJECT AUDIT"].trim();
        if (trimmed) {
          const key = trimmed.toUpperCase();
          if (!map.has(key)) map.set(key, trimmed);
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [data]);

  const sites = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (d.SITE) {
        const trimmed = d.SITE.trim();
        if (trimmed) {
          const key = trimmed.toUpperCase();
          if (!map.has(key)) map.set(key, trimmed);
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [data]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (d.KATEGORI) {
        const trimmed = d.KATEGORI.trim();
        if (trimmed) {
          const key = trimmed.toUpperCase();
          if (!map.has(key)) map.set(key, trimmed);
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [data]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      const depts = getRecordDepartments(d);
      depts.forEach(dept => {
        const key = dept.toUpperCase();
        if (!map.has(key)) map.set(key, dept);
      });
    });
    return Array.from(map.values()).sort();
  }, [data]);

  // Statistics Calculation
  const stats = useMemo(() => {
    let total = data.length;
    let close = 0;
    let open = 0;
    let progress = 0;
    let overdue = 0;

    data.forEach(item => {
      const st = (item.STATUS || '').toUpperCase().trim();
      const rm = (item.REMARKS || '').toUpperCase().trim();
      if (st === 'CLOSE') close++;
      else if (st === 'OPEN') open++;
      else progress++;

      if (rm === 'OVERDUE') overdue++;
    });

    return {
      total,
      close,
      closePct: total > 0 ? ((close / total) * 100).toFixed(2) : '0.00',
      open,
      openPct: total > 0 ? ((open / total) * 100).toFixed(2) : '0.00',
      progress,
      progressPct: total > 0 ? ((progress / total) * 100).toFixed(2) : '0.00',
      overdue,
      overduePct: total > 0 ? ((overdue / total) * 100).toFixed(2) : '0.00',
    };
  }, [data]);

  // Filter Logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (
        (item["PROJECT AUDIT"] || '').toLowerCase().includes(q) ||
        (item.SITE || '').toLowerCase().includes(q) ||
        (item["PROBLEM/FINDING"] || '').toLowerCase().includes(q) ||
        (item["DETAIL TEMUAN"] || '').toLowerCase().includes(q) ||
        (item.REKOMENDASI || '').toLowerCase().includes(q) ||
        (item["PIC SITE"] || '').toLowerCase().includes(q) ||
        (item["PIC HO"] || '').toLowerCase().includes(q) ||
        (item.NOTE || '').toLowerCase().includes(q)
      );

      const matchesDept = selectedDept === 'ALL' || matchesDepartmentRecord(item, selectedDept);

      const matchesProject = selectedProject === 'ALL'
        ? true
        : selectedProject === 'LINKED_ONLY'
          ? configuredProjectSet.has((item["PROJECT AUDIT"] || '').trim().toUpperCase())
          : item["PROJECT AUDIT"] === selectedProject;
      const matchesSite = selectedSite === 'ALL' || item.SITE === selectedSite;
      const matchesStatus = selectedStatus === 'ALL' || (item.STATUS || '').toUpperCase() === selectedStatus;
      const matchesCategory = selectedCategory === 'ALL' || (item.KATEGORI || '').toUpperCase() === selectedCategory;

      const matchesNo = !colFilterNo || String(item.NO || '').toLowerCase().includes(colFilterNo.toLowerCase());
      const matchesDetail = !colFilterDetail || (
        (item["PROBLEM/FINDING"] || '').toLowerCase().includes(colFilterDetail.toLowerCase()) ||
        (item["DETAIL TEMUAN"] || '').toLowerCase().includes(colFilterDetail.toLowerCase())
      );
      const matchesRekomendasi = !colFilterRekomendasi || (item.REKOMENDASI || '').toLowerCase().includes(colFilterRekomendasi.toLowerCase());
      const matchesPicSite = !colFilterPicSite || (item["PIC SITE"] || '').toLowerCase().includes(colFilterPicSite.toLowerCase());
      const matchesPicHO = !colFilterPicHO || (item["PIC HO"] || '').toLowerCase().includes(colFilterPicHO.toLowerCase());
      const matchesDueDate = !colFilterDueDate || (item["DUE DATE"] || '').toLowerCase().includes(colFilterDueDate.toLowerCase());
      const matchesRemarks = colFilterRemarks === 'ALL' || (item.REMARKS || '').toUpperCase().includes(colFilterRemarks.toUpperCase());
      const matchesIaReview = colFilterIaReview === 'ALL' || (
        colFilterIaReview === 'EMPTY' ? !item["REVIEWED CLOSING FROM IA"] :
        (item["REVIEWED CLOSING FROM IA"] || '').toLowerCase().includes(colFilterIaReview.toLowerCase())
      );

      return matchesSearch && matchesDept && matchesProject && matchesSite && matchesStatus && matchesCategory && matchesNo && matchesDetail && matchesRekomendasi && matchesPicSite && matchesPicHO && matchesDueDate && matchesRemarks && matchesIaReview;
    });
  }, [data, searchQuery, selectedDept, selectedProject, selectedSite, selectedStatus, selectedCategory, colFilterNo, colFilterDetail, colFilterRekomendasi, colFilterPicSite, colFilterPicHO, colFilterDueDate, colFilterRemarks, colFilterIaReview, configuredProjectSet]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc 
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortField, sortAsc]);

  // Pagination Logic
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: keyof AFSFindingRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onToast('Teks berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedDept('ALL');
    setSelectedProject('ALL');
    setSelectedSite('ALL');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setColFilterNo('');
    setColFilterDetail('');
    setColFilterRekomendasi('');
    setColFilterPicSite('');
    setColFilterPicHO('');
    setColFilterDueDate('');
    setColFilterRemarks('ALL');
    setColFilterIaReview('ALL');
    setCurrentPage(1);
    onToast('Filter tampilan telah direset', 'info');
  };

  const handleIaReviewChange = (rowId: number, value: string) => {
    setData(prev => prev.map(item => {
      if (item._rowId === rowId) {
        const isApprove = value.toLowerCase() === 'approve';
        const newStatus = isApprove ? 'CLOSE' : 'OPEN';
        const newRemarks = isApprove ? 'DONE' : (item.REMARKS === 'DONE' ? 'OVERDUE' : item.REMARKS);
        return { 
          ...item, 
          "REVIEWED CLOSING FROM IA": value,
          STATUS: newStatus,
          REMARKS: newRemarks
        };
      }
      return item;
    }));
    if (value) {
      if (value === 'Approve') {
        onToast(`Review IA: 'Approve' — Status temuan otomatis berubah menjadi CLOSE`, 'success');
      } else {
        onToast(`Review IA: '${value}' — Status temuan dikembalikan ke OPEN`, 'warning');
      }
    } else {
      onToast('Status Review IA dikosongkan — Status temuan dikembalikan ke OPEN', 'info');
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormNo(String(data.length + 1));
    setFormProject('PR-PAYMENT');
    setFormSite('JKT');
    setFormProblem('');
    setFormDetail('');
    setFormKriteria('DO');
    setFormKategori('MAJOR');
    setFormRekomendasi('');
    setFormStatus('OPEN');
    setFormPicSite('PLANT');
    setFormPicHO('LOG');
    setFormDueDate('');
    setFormRemarks('OVERDUE');
    setFormDokumenClosing('');
    setFormIaReview('');
    setFormNote('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: AFSFindingRecord) => {
    setEditingItem(item);
    setFormNo(item.NO || '');
    setFormProject(item["PROJECT AUDIT"] || '');
    setFormSite(item.SITE || '');
    setFormProblem(item["PROBLEM/FINDING"] || '');
    setFormDetail(item["DETAIL TEMUAN"] || '');
    setFormKriteria(item.KRITERIA || '');
    setFormKategori(item.KATEGORI || 'MAJOR');
    setFormRekomendasi(item.REKOMENDASI || '');
    setFormStatus((item.STATUS || 'OPEN').toUpperCase());
    setFormPicSite(item["PIC SITE"] || '');
    setFormPicHO(item["PIC HO"] || '');
    setFormDueDate(item["DUE DATE"] || '');
    setFormRemarks(item.REMARKS || '');
    setFormDokumenClosing(item["DOKUMENTASI CLOSING"] || '');
    setFormIaReview(item["REVIEWED CLOSING FROM IA"] || '');
    setFormNote(item.NOTE || '');
    setIsModalOpen(true);
  };

  const handleDelete = (rowId: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus data temuan ini?')) {
      setData(prev => prev.filter(item => item._rowId !== rowId));
      onToast('Data temuan audit berhasil dihapus', 'warning');
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      // Edit existing
      setData(prev => prev.map(item => {
        if (item._rowId === editingItem._rowId) {
          return {
            ...item,
            NO: formNo,
            "PROJECT AUDIT": formProject,
            SITE: formSite,
            "PROBLEM/FINDING": formProblem,
            "DETAIL TEMUAN": formDetail,
            KRITERIA: formKriteria,
            KATEGORI: formKategori,
            REKOMENDASI: formRekomendasi,
            STATUS: formStatus,
            "PIC SITE": formPicSite,
            "PIC HO": formPicHO,
            "DUE DATE": formDueDate,
            REMARKS: formRemarks,
            "DOKUMENTASI CLOSING": formDokumenClosing,
            "REVIEWED CLOSING FROM IA": formIaReview,
            NOTE: formNote
          };
        }
        return item;
      }));
      onToast('Data temuan audit berhasil diperbarui', 'success');
    } else {
      // Create new
      const maxRowId = data.length > 0 ? Math.max(...data.map(d => d._rowId)) : 1;
      const newItem: AFSFindingRecord = {
        _rowId: maxRowId + 1,
        NO: formNo || String(maxRowId + 1),
        "PROJECT AUDIT": formProject,
        SITE: formSite,
        "PROBLEM/FINDING": formProblem,
        "DETAIL TEMUAN": formDetail,
        KRITERIA: formKriteria,
        KATEGORI: formKategori,
        REKOMENDASI: formRekomendasi,
        STATUS: formStatus,
        "PIC SITE": formPicSite,
        "PIC HO": formPicHO,
        "DUE DATE": formDueDate,
        REMARKS: formRemarks,
        "DOKUMENTASI CLOSING": formDokumenClosing,
        "REVIEWED CLOSING FROM IA": formIaReview,
        NOTE: formNote
      };
      setData(prev => [newItem, ...prev]);
      onToast('Temuan audit baru berhasil ditambahkan', 'success');
    }

    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'NO', 'PROJECT AUDIT', 'SITE', 'PROBLEM/FINDING', 'DETAIL TEMUAN', 
      'KRITERIA', 'KATEGORI', 'REKOMENDASI', 'STATUS', 'PIC SITE', 'PIC HO', 
      'DUE DATE', 'REMARKS', 'DOKUMENTASI CLOSING', 'REVIEW IA', 'NOTE'
    ];

    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      // Normalize line breaks inside cells to spaces or soft breaks so CSV rows remain intact
      const strVal = String(val).replace(/\r\n|\n|\r/g, ' ').replace(/"/g, '""');
      return `"${strVal}"`;
    };

    const rows = filteredData.map(item => [
      escapeCell(item.NO),
      escapeCell(item["PROJECT AUDIT"]),
      escapeCell(item.SITE),
      escapeCell(item["PROBLEM/FINDING"]),
      escapeCell(item["DETAIL TEMUAN"]),
      escapeCell(item.KRITERIA),
      escapeCell(item.KATEGORI),
      escapeCell(item.REKOMENDASI),
      escapeCell(item.STATUS),
      escapeCell(item["PIC SITE"]),
      escapeCell(item["PIC HO"]),
      escapeCell(item["DUE DATE"]),
      escapeCell(item.REMARKS),
      escapeCell(item["DOKUMENTASI CLOSING"]),
      escapeCell(item["REVIEWED CLOSING FROM IA"]),
      escapeCell(item.NOTE)
    ]);

    // Use semicolon delimiter and sep=; directive for automatic Excel/Spreadsheet column separation
    const delimiter = ';';
    const csvContent = [
      `sep=${delimiter}`,
      headers.map(h => escapeCell(h)).join(delimiter),
      ...rows.map(r => r.join(delimiter))
    ].join('\r\n');

    // Add UTF-8 BOM (\uFEFF) for proper character encoding in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audit_Finding_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onToast('Data Audit Finding Statement berhasil di-export ke CSV (Otomatis terpisah kolom di Excel)!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700 flex items-center gap-1.5 border border-violet-200">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Resume Audit Finding Statement (AFS)
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              • Total {data.length.toLocaleString('id-ID')} Records
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Resume Temuan dan Rekomendasi Hasil Audit
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-sm border border-slate-200"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar & Active Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search & Dept Filter */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Cari temuan, rekomendasi, site, catatan..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Departemen:</span>
              <select
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
                className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${
                  selectedDept !== 'ALL'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">Semua Departemen</option>
                {departments.map((d) => (
                  <option key={`opt-dept-${d}`} value={d.toUpperCase()}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Quick Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'OPEN', 'PROGRESS', 'CLOSE'] as const).map((st) => (
                <button
                  key={`st-pill-${st}`}
                  onClick={() => { setSelectedStatus(st); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedStatus === st
                      ? st === 'OPEN'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : st === 'PROGRESS'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : st === 'CLOSE'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Results Count & Reset */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Menampilkan <strong className="text-slate-900">{filteredData.length}</strong> dari {data.length} temuan
            </span>
            {(searchQuery || selectedDept !== 'ALL' || selectedProject !== 'ALL' || selectedSite !== 'ALL' || selectedStatus !== 'ALL' || selectedCategory !== 'ALL' || colFilterNo || colFilterDetail || colFilterRekomendasi || colFilterPicSite || colFilterPicHO || colFilterDueDate || colFilterRemarks !== 'ALL' || colFilterIaReview !== 'ALL') && (
              <button
                onClick={handleResetFilter}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Badges */}
        {(selectedDept !== 'ALL' || selectedStatus !== 'ALL' || colFilterRemarks !== 'ALL' || selectedProject !== 'ALL' || selectedSite !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold">Filter Aktif:</span>
            {selectedDept !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-bold">
                Departemen: {selectedDept}
                <button 
                  onClick={() => { setSelectedDept('ALL'); setCurrentPage(1); }}
                  className="hover:text-indigo-950 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatus !== 'ALL' && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg font-bold ${
                selectedStatus === 'OPEN' 
                  ? 'bg-rose-50 border-rose-200 text-rose-800' 
                  : selectedStatus === 'PROGRESS'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                Status: {selectedStatus}
                <button 
                  onClick={() => { setSelectedStatus('ALL'); setCurrentPage(1); }}
                  className="hover:opacity-75 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {colFilterRemarks !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg font-bold">
                Remarks: {colFilterRemarks}
                <button 
                  onClick={() => { setColFilterRemarks('ALL'); setCurrentPage(1); }}
                  className="hover:text-purple-950 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedProject !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg font-bold">
                Project: {selectedProject}
                <button 
                  onClick={() => { setSelectedProject('ALL'); setCurrentPage(1); }}
                  className="hover:text-slate-950 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSite !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg font-bold">
                Site: {selectedSite}
                <button 
                  onClick={() => { setSelectedSite('ALL'); setCurrentPage(1); }}
                  className="hover:text-slate-950 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[680px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <table className="w-full table-fixed min-w-[1100px] text-[11px] text-left border-collapse relative">
            
            {/* Dark Header */}
            <thead className="sticky top-0 z-20 bg-[#1e293b]">
              <tr className="bg-[#1e293b] text-white uppercase tracking-wider font-bold text-[10px] border-b border-slate-700">
                <th 
                  onClick={() => handleSort('NO')} 
                  className="py-3 px-1 text-center w-[3.5%] min-w-[38px] cursor-pointer hover:bg-slate-700 transition-all sticky top-0 bg-[#1e293b]"
                >
                  <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    NO <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('PROJECT AUDIT')} 
                  className="py-3 px-2 w-[7.5%] min-w-[80px] cursor-pointer hover:bg-slate-700 transition-all sticky top-0 bg-[#1e293b]"
                >
                  <div className="flex items-center gap-0.5 whitespace-nowrap">
                    PROJECT <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('SITE')} 
                  className="py-3 px-1 text-center w-[4.5%] min-w-[50px] cursor-pointer hover:bg-slate-700 transition-all sticky top-0 bg-[#1e293b]"
                >
                  <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    SITE <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-2 w-[22%] min-w-[200px] sticky top-0 bg-[#1e293b]">
                  DETAIL TEMUAN / PROBLEM
                </th>
                <th className="py-3 px-1 text-center w-[7%] min-w-[75px] sticky top-0 bg-[#1e293b]">
                  KATEGORI
                </th>
                <th className="py-3 px-2 w-[18%] min-w-[170px] sticky top-0 bg-[#1e293b]">
                  REKOMENDASI AUDIT
                </th>
                <th 
                  onClick={() => handleSort('STATUS')} 
                  className="py-3 px-1 text-center w-[6.5%] min-w-[70px] cursor-pointer hover:bg-slate-700 transition-all sticky top-0 bg-[#1e293b]"
                >
                  <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    STATUS <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-1.5 w-[6%] min-w-[65px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  PIC SITE
                </th>
                <th className="py-3 px-1.5 w-[6%] min-w-[65px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  PIC HO
                </th>
                <th className="py-3 px-1 text-center w-[6%] min-w-[70px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  DUE DATE
                </th>
                <th className="py-3 px-1 text-center w-[5.5%] min-w-[65px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  DOK. CLOSING
                </th>
                <th className="py-3 px-1 text-center w-[7.5%] min-w-[80px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  REVIEW IA
                </th>
                <th className="py-3 px-1 text-center w-[4%] min-w-[45px] sticky top-0 bg-[#1e293b] whitespace-nowrap">
                  AKSI
                </th>
              </tr>

              {/* Interactive Header Filter Controls Row */}
              <tr className="bg-[#0f172a] border-b border-slate-700">
                <td className="p-1.5 text-center">
                  <input
                    type="text"
                    placeholder="No..."
                    value={colFilterNo}
                    onChange={(e) => { setColFilterNo(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400 text-center"
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={selectedProject}
                    onChange={(e) => { setSelectedProject(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-1.5 py-1.5 text-[11px] h-8 focus:outline-none truncate cursor-pointer"
                  >
                    <option value="ALL">All Project</option>
                    {projects.map((p, idx) => (
                      <option key={`fs-fp-${p}-${idx}`} value={p} className="bg-slate-800 text-white">{p}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1.5">
                  <select
                    value={selectedSite}
                    onChange={(e) => { setSelectedSite(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-1.5 py-1.5 text-[11px] h-8 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Site</option>
                    {sites.map((s, idx) => (
                      <option key={`fs-fs-${s}-${idx}`} value={s} className="bg-slate-800 text-white">{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    placeholder="Cari detail problem..."
                    value={colFilterDetail}
                    onChange={(e) => { setColFilterDetail(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400"
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-1.5 py-1.5 text-[11px] h-8 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Kategori</option>
                    {categories.map((c, idx) => (
                      <option key={`fs-fc-${c}-${idx}`} value={c} className="bg-slate-800 text-white">{c}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    placeholder="Cari rekomendasi..."
                    value={colFilterRekomendasi}
                    onChange={(e) => { setColFilterRekomendasi(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400"
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={selectedStatus}
                    onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-1.5 py-1.5 text-[11px] h-8 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="ALL">All Status</option>
                    <option value="CLOSE" className="bg-slate-800 text-emerald-400 font-bold">CLOSE</option>
                    <option value="OPEN" className="bg-slate-800 text-rose-400 font-bold">OPEN</option>
                    <option value="PROGRESS" className="bg-slate-800 text-amber-400 font-bold">PROGRESS</option>
                  </select>
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    placeholder="PIC Site..."
                    value={colFilterPicSite}
                    onChange={(e) => { setColFilterPicSite(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    placeholder="PIC HO..."
                    value={colFilterPicHO}
                    onChange={(e) => { setColFilterPicHO(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    placeholder="Due Date..."
                    value={colFilterDueDate}
                    onChange={(e) => { setColFilterDueDate(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-2 py-1.5 text-[11px] h-8 focus:outline-none placeholder:text-slate-400 text-center"
                  />
                </td>
                <td className="p-1.5"></td>
                <td className="p-1.5">
                  <select
                    value={colFilterIaReview}
                    onChange={(e) => { setColFilterIaReview(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-cyan-400 text-white rounded-lg px-1.5 py-1.5 text-[11px] h-8 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="ALL">All Review</option>
                    <option value="Approve" className="bg-slate-800 text-emerald-400 font-bold">Approve</option>
                    <option value="Reject" className="bg-slate-800 text-rose-400 font-bold">Reject</option>
                  </select>
                </td>
                <td className="p-1.5 text-center">
                  {(searchQuery || selectedDept !== 'ALL' || selectedProject !== 'ALL' || selectedSite !== 'ALL' || selectedStatus !== 'ALL' || selectedCategory !== 'ALL' || colFilterNo || colFilterDetail || colFilterRekomendasi || colFilterPicSite || colFilterPicHO || colFilterDueDate || colFilterRemarks !== 'ALL' || colFilterIaReview !== 'ALL') && (
                    <button
                      onClick={handleResetFilter}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 mx-auto shadow-sm"
                      title="Reset Semua Filter"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  )}
                </td>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Tidak ada temuan audit ditemukan</p>
                    <p className="text-xs text-slate-400 mt-1">Sesuaikan kata kunci pencarian atau reset filter</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const statusUpper = (item.STATUS || '').toUpperCase().trim();
                  const isClose = statusUpper === 'CLOSE';
                  const isOpen = statusUpper === 'OPEN';
                  const katUpper = (item.KATEGORI || '').toUpperCase();
                  const iaReviewUpper = (item["REVIEWED CLOSING FROM IA"] || '').toUpperCase().trim();

                  return (
                    <tr key={`fs-row-${item._rowId ?? 'item'}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* NO */}
                      <td className="py-2 px-1 text-center font-mono text-slate-500 font-semibold border-r border-slate-200 text-[10px]">
                        {item.NO}
                      </td>

                      {/* PROJECT AUDIT */}
                      <td className="py-2 px-1 font-bold text-slate-800 border-r border-slate-200 break-words">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-800 border border-slate-200 inline-block">
                          {item["PROJECT AUDIT"]}
                        </span>
                      </td>

                      {/* SITE */}
                      <td className="py-2 px-1 text-center font-extrabold text-slate-900 border-r border-slate-200 text-[10px]">
                        {item.SITE}
                      </td>

                      {/* DETAIL TEMUAN / PROBLEM */}
                      <td className="py-2 px-2 border-r border-slate-200 break-words">
                        {item["PROBLEM/FINDING"] && item["DETAIL TEMUAN"] && item["PROBLEM/FINDING"].trim() === item["DETAIL TEMUAN"].trim() ? (
                          <p className="font-semibold text-slate-800 text-[10px] line-clamp-3 leading-tight" title={item["DETAIL TEMUAN"]}>
                            {item["DETAIL TEMUAN"]}
                          </p>
                        ) : (
                          <>
                            {item["PROBLEM/FINDING"] && (
                              <p className="font-bold text-slate-900 mb-0.5 text-[10px] line-clamp-2 leading-tight" title={item["PROBLEM/FINDING"]}>
                                {item["PROBLEM/FINDING"]}
                              </p>
                            )}
                            {item["DETAIL TEMUAN"] && (
                              <p className="text-slate-600 text-[10px] line-clamp-2 leading-tight" title={item["DETAIL TEMUAN"]}>
                                {item["DETAIL TEMUAN"]}
                              </p>
                            )}
                            {!item["PROBLEM/FINDING"] && !item["DETAIL TEMUAN"] && (
                              <span className="text-slate-400 text-[10px] italic block truncate" title={item.NOTE || `Sub-rekomendasi temuan No. ${item.NO}`}>
                                {item.NOTE ? `Note: ${item.NOTE}` : `(Sub-rekomendasi No. ${item.NO})`}
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* KATEGORI */}
                      <td className="py-2 px-1 text-center border-r border-slate-200">
                        {katUpper.includes('MAJOR') ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-block">
                            MAJOR
                          </span>
                        ) : katUpper.includes('MINOR') ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                            MINOR
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200 inline-block">
                            IMPROV.
                          </span>
                        )}
                      </td>

                      {/* REKOMENDASI AUDIT */}
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-700 leading-tight font-medium break-words">
                        <p className="line-clamp-3 text-[10px]" title={item.REKOMENDASI}>
                          {item.REKOMENDASI || '-'}
                        </p>
                      </td>

                      {/* STATUS */}
                      <td className="py-2 px-1 text-center border-r border-slate-200">
                        {isClose ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500 text-white shadow-sm inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> CLOSE
                          </span>
                        ) : isOpen ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white shadow-sm inline-flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> OPEN
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white shadow-sm inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> PROG.
                          </span>
                        )}
                      </td>

                      {/* PIC SITE */}
                      <td className="py-2 px-1 border-r border-slate-200 text-[10px] font-semibold text-slate-800 break-words">
                        {formatUniqueText(item["PIC SITE"])}
                      </td>

                      {/* PIC HO */}
                      <td className="py-2 px-1 border-r border-slate-200 text-[10px] font-medium text-slate-700 break-words">
                        {formatUniqueText(item["PIC HO"])}
                      </td>

                      {/* DUE DATE / REMARKS */}
                      <td className="py-2 px-1 text-center border-r border-slate-200">
                        <span className="font-mono text-slate-700 block font-semibold text-[10px]">
                          {item["DUE DATE"] || '-'}
                        </span>
                        {item.REMARKS && (
                          <span className={`text-[9px] font-bold block ${
                            item.REMARKS === 'DONE' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {item.REMARKS}
                          </span>
                        )}
                      </td>

                      {/* CLOSING DOKUMEN */}
                      <td className="py-2 px-1 text-center border-r border-slate-200">
                        {item["DOKUMENTASI CLOSING"] ? (
                          <button
                            onClick={() => setDetailItem(item)}
                            className="px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-all inline-flex items-center gap-0.5"
                            title="Lihat Bukti Closing"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Bukti
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>

                      {/* REVIEW FROM IA */}
                      <td className="py-2 px-1 text-center border-r border-slate-200">
                        <select
                          value={item["REVIEWED CLOSING FROM IA"] || ''}
                          onChange={(e) => handleIaReviewChange(item._rowId, e.target.value)}
                          className={`w-full px-1 py-0.5 text-[9px] font-bold rounded border focus:outline-none focus:ring-1 cursor-pointer transition-all ${
                            iaReviewUpper === 'APPROVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-extrabold'
                              : iaReviewUpper === 'REJECT'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 font-extrabold'
                              : 'bg-slate-50 text-slate-500 border-slate-300'
                          }`}
                        >
                          <option value="" className="bg-white text-slate-500">- Select -</option>
                          <option value="Approve" className="bg-white text-emerald-700 font-bold">Approve</option>
                          <option value="Reject" className="bg-white text-rose-700 font-bold">Reject</option>
                        </select>
                      </td>

                      {/* AKSI */}
                      <td className="py-2 px-1 text-center">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 hover:border-violet-300 rounded-lg shadow-sm transition-all inline-flex items-center justify-center cursor-pointer active:scale-95 mx-auto"
                          title="Lihat Detail Temuan & Edit / Lampirkan Bukti Closing"
                        >
                          <FileEdit className="w-4 h-4 text-violet-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500">Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold focus:outline-none focus:border-violet-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono font-medium text-slate-600">
              {totalItems === 0 ? '0 / 0' : `${startIndex + 1} - ${Math.min(startIndex + pageSize, totalItems)} dari ${totalItems.toLocaleString('id-ID')} items`}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Row Detail View Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-sm">
                  Detail Audit Finding Statement - No. {detailItem.NO} ({detailItem["PROJECT AUDIT"]} / {detailItem.SITE})
                </h3>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">Project Audit</span>
                  <span className="font-bold text-slate-900 text-sm">{detailItem["PROJECT AUDIT"]}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">Jobsite</span>
                  <span className="font-bold text-slate-900 text-sm">{detailItem.SITE}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">Status</span>
                  <span className="font-bold text-sm">{detailItem.STATUS}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">Kategori</span>
                  <span className="font-bold text-sm">{detailItem.KATEGORI || '-'}</span>
                </div>
              </div>

              {detailItem["PROBLEM/FINDING"] && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Problem / Finding Utama:</h4>
                  <p className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-slate-800 leading-relaxed font-medium">
                    {detailItem["PROBLEM/FINDING"]}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Detail Temuan:</h4>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {detailItem["DETAIL TEMUAN"] || '-'}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Rekomendasi Audit:</h4>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {detailItem.REKOMENDASI || '-'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">PIC Site:</h4>
                  <p className="font-semibold text-slate-800">{detailItem["PIC SITE"] || '-'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">PIC HO:</h4>
                  <p className="font-semibold text-slate-800">{detailItem["PIC HO"] || '-'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Due Date:</h4>
                  <p className="font-mono font-semibold text-slate-800">{detailItem["DUE DATE"] || '-'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Remarks:</h4>
                  <p className="font-semibold text-slate-800">{detailItem.REMARKS || '-'}</p>
                </div>
              </div>

              {detailItem["DOKUMENTASI CLOSING"] && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Dokumentasi Closing / Link Bukti:</h4>
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                    <p className="text-sky-900 whitespace-pre-wrap font-mono text-[11px]">
                      {detailItem["DOKUMENTASI CLOSING"]}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Review From IA:</h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {detailItem["REVIEWED CLOSING FROM IA"] ? (
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${
                      detailItem["REVIEWED CLOSING FROM IA"].toUpperCase() === 'APPROVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : detailItem["REVIEWED CLOSING FROM IA"].toUpperCase() === 'REJECT'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {detailItem["REVIEWED CLOSING FROM IA"]}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Belum ada review dari Internal Audit</span>
                  )}
                </div>
              </div>

              {detailItem.NOTE && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Catatan / Note Tambahan:</h4>
                  <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 italic">
                    {detailItem.NOTE}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const target = detailItem;
                  setDetailItem(null);
                  handleOpenEditModal(target);
                }}
                className="px-4 py-2 text-xs font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 border border-violet-300 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit & Lampirkan Bukti</span>
              </button>
              <button
                onClick={() => setDetailItem(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-sm">
                  {editingItem ? `Detail & Edit Temuan Audit #${editingItem.NO} (${editingItem["PROJECT AUDIT"]} / ${editingItem.SITE})` : 'Tambah Temuan Audit Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 overflow-y-auto space-y-4">
              {/* Notice Banner */}
              {editingItem ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 px-3 flex items-center gap-2 text-xs text-amber-800">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Rincian temuan audit terkunci (read-only). Anda dapat melampirkan atau memperbarui <strong>Link CCP / Bukti Closing Audit</strong> pada kolom aktif di bawah.</span>
                </div>
              ) : (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5 px-3 flex items-center gap-2 text-xs text-violet-800">
                  <Plus className="w-4 h-4 text-violet-600 shrink-0" />
                  <span>Silakan masukkan rincian temuan audit baru secara lengkap pada formulir di bawah ini.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">NO {!editingItem && '*'}</label>
                  <input
                    type="text"
                    required={!editingItem}
                    readOnly={!!editingItem}
                    value={formNo}
                    onChange={(e) => setFormNo(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-bold ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Project Audit {!editingItem && '*'}</label>
                  <input
                    type="text"
                    required={!editingItem}
                    readOnly={!!editingItem}
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-semibold ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Jobsite {!editingItem && '*'}</label>
                  <input
                    type="text"
                    required={!editingItem}
                    readOnly={!!editingItem}
                    value={formSite}
                    onChange={(e) => setFormSite(e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-bold ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Problem / Finding Utama</label>
                <textarea
                  rows={2}
                  readOnly={!!editingItem}
                  placeholder="Ringkasan temuan utama..."
                  value={formProblem}
                  onChange={(e) => setFormProblem(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl ${
                    editingItem 
                      ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none resize-none' 
                      : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Detail Temuan {!editingItem && '*'}</label>
                <textarea
                  rows={3}
                  required={!editingItem}
                  readOnly={!!editingItem}
                  placeholder="Uraian detail temuan audit..."
                  value={formDetail}
                  onChange={(e) => setFormDetail(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl ${
                    editingItem 
                      ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none resize-none' 
                      : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                  {editingItem ? (
                    <input
                      type="text"
                      readOnly
                      value={formKategori}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-not-allowed focus:outline-none"
                    />
                  ) : (
                    <select
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="MAJOR">MAJOR</option>
                      <option value="MINOR">MINOR</option>
                      <option value="AREA OF IMPROVEMENT">AREA OF IMPROVEMENT</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  {editingItem ? (
                    <input
                      type="text"
                      readOnly
                      value={formStatus}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-not-allowed focus:outline-none"
                    />
                  ) : (
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="CLOSE">CLOSE</option>
                      <option value="PROGRESS">PROGRESS</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rekomendasi Audit</label>
                <textarea
                  rows={3}
                  readOnly={!!editingItem}
                  placeholder="Rekomendasi perbaikan..."
                  value={formRekomendasi}
                  onChange={(e) => setFormRekomendasi(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl ${
                    editingItem 
                      ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none resize-none' 
                      : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">PIC Site</label>
                  <input
                    type="text"
                    readOnly={!!editingItem}
                    placeholder="PIC Site"
                    value={formPicSite}
                    onChange={(e) => setFormPicSite(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">PIC HO</label>
                  <input
                    type="text"
                    readOnly={!!editingItem}
                    placeholder="PIC HO"
                    value={formPicHO}
                    onChange={(e) => setFormPicHO(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                  <input
                    type="text"
                    readOnly={!!editingItem}
                    placeholder="e.g. 8/4/2026"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-mono ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                  <input
                    type="text"
                    readOnly={!!editingItem}
                    placeholder="e.g. DONE / OVERDUE"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border rounded-xl font-bold ${
                      editingItem 
                        ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed focus:outline-none' 
                        : 'border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-violet-500'
                    }`}
                  />
                </div>
              </div>

              {/* EDITABLE SECTION: LINK BUKTI CCP / DOKUMENTASI CLOSING */}
              <div className="bg-gradient-to-r from-sky-50 via-indigo-50/50 to-sky-50 p-4 rounded-2xl border-2 border-sky-400 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-sky-900 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Tempel Link CCP / Lampirkan Bukti Closing Audit</span>
                  </label>
                  {formDokumenClosing && (
                    <a
                      href={formDokumenClosing.startsWith('http') ? formDokumenClosing : `https://${formDokumenClosing}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-white px-2.5 py-1 rounded-lg border border-sky-300 inline-flex items-center gap-1 shadow-sm transition-all hover:bg-sky-50"
                    >
                      <span>Uji Link Bukti</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <textarea
                  rows={3}
                  placeholder="Tempelkan URL Google Drive / Docs / Note bukti closing CCP rekomendasi audit di sini..."
                  value={formDokumenClosing}
                  onChange={(e) => setFormDokumenClosing(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border-2 border-sky-400 focus:border-sky-600 rounded-xl font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-inner"
                />
                <p className="text-[10px] text-sky-800 font-medium italic">
                  * Tempatkan link dokumen, Google Drive, atau catatan bukti tindakan perbaikan audit CCP.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                    editingItem 
                      ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20' 
                      : 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/20'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>{editingItem ? 'Simpan Link CCP' : 'Simpan Temuan Baru'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
