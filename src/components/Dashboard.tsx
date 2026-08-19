import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Plus, 
  Upload, 
  Link, 
  FileSpreadsheet, 
  ExternalLink, 
  Edit3, 
  X, 
  Check, 
  Globe, 
  Paperclip,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Maximize2,
  AlertTriangle,
  TrendingDown,
  ChevronRight,
  Sparkles,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Building2,
  Clock,
  Briefcase,
  Loader2,
  MapPin
} from 'lucide-react';
import { AuditEngagement } from '../types';
import { fetchGoogleSheetRiskRegister, RiskRegisterItem as FetchedRiskItem } from '../data/riskRegisterFetcher';

export interface RiskProfileLink {
  fileName: string;
  url: string;
  uploadedAt: string;
  fileSize?: string;
  notes?: string;
}

export interface RiskRegisterItem {
  id: string;
  code: string; // E.g., ICGS-01
  site?: string;
  department?: string;
  category: string; // E.g., Leaking/Inefisiensi, Operasional
  businessProcess: string;
  riskEvent: string;
  causes: string;
  impactDescription?: string;
  inherentLikelihood: number; // 1 - 5
  inherentImpact: number; // 1 - 5
  existingControl: string;
  controlEffectiveness: string;
  residualLikelihood: number; // 1 - 5
  residualImpact: number; // 1 - 5
  riskOwner: string;
  actionPlan: string;
  targetDate: string;
  status: 'Open' | 'In Progress' | 'Closed' | 'Overdue';
}

interface DashboardProps {
  auditData?: AuditEngagement[];
  onOpenNewModal?: () => void;
  onOpenKKA?: (title: string) => void;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  key?: string;
}

const mapScoreToLevelNum = (str: string): number => {
  if (!str) return 2;
  const s = str.toLowerCase().trim();
  if (s.includes('insignificant') || s.includes('rare') || s.includes('low') || s === '1') return 1;
  if (s.includes('minor') || s.includes('unlikely') || s === '2') return 2;
  if (s.includes('moderate') || s.includes('possible') || s.includes('medium') || s === '3') return 3;
  if (s.includes('major') || s.includes('likely') || s.includes('high') || s === '4') return 4;
  if (s.includes('catastrophic') || s.includes('almost') || s.includes('extreme') || s === '5') return 5;
  return 2;
};

// Initial Sample Risk Register Data populated from standard corporate Risk Register Google Sheets
const INITIAL_RISK_REGISTER: RiskRegisterItem[] = [
  {
    id: '1',
    code: 'RSK-OPS-001',
    category: 'Operasional & Produksi',
    businessProcess: 'Pengolahan Kelapa Sawit / PKS',
    riskEvent: 'Kerusakan Komponen Mesin Utama (Press Machine & Screw) Penyebab Breakdown PKS',
    causes: 'Suhu kerja ekstrim, kelelahan material, jadwal Preventive Maintenance (PM) terlambat',
    impactDescription: 'Penurunan throughput pengolahan PKS hingga 25% dan potensi kerugian produksi minyak kelapa sawit',
    inherentLikelihood: 4,
    inherentImpact: 4,
    existingControl: 'Pelaksanaan checklist pemeliharaan mingguan dan penyediaan sparepart kritis di gudang',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 2,
    residualImpact: 3,
    riskOwner: 'Dept. Teknik & Maintenance PKS',
    actionPlan: 'Penerapan Vibration Monitoring & Sistem Maintenance Terjadwal Terintegrasi IoT',
    targetDate: '2026-10-31',
    status: 'In Progress'
  },
  {
    id: '2',
    code: 'RSK-FIN-002',
    category: 'Keuangan & Likuiditas',
    businessProcess: 'Manajemen Kas & Piutang Dagang',
    riskEvent: 'Keterlambatan Pelunasan Piutang Dagang (AR Overdue) melebihi Term of Payment (TOP)',
    causes: 'Kondisi arus kas buyer mengalami fluktuasi dan proses penagihan belum terintegrasi secara otomatis',
    impactDescription: 'Penurunan cash flow operasional dan peningkatan biaya cadangan kerugian penurunan nilai (CKPN)',
    inherentLikelihood: 4,
    inherentImpact: 4,
    existingControl: 'Pemberlakuan limit kredit per buyer dan konfirmasi piutang berkala',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 3,
    residualImpact: 2,
    riskOwner: 'Dept. Keuangan & Treasury',
    actionPlan: 'Eskalasi proses legal, peringatan sistemik otomatis TOP -7 hari, dan syarat L/C untuk buyer baru',
    targetDate: '2026-09-15',
    status: 'In Progress'
  },
  {
    id: '3',
    code: 'RSK-CMP-003',
    category: 'Kepatuhan & Lingkungan',
    businessProcess: 'Sertifikasi ISPO/RSPO & Pengolahan Limbah',
    riskEvent: 'Keterlambatan Perpanjangan Izin Lingkungan & Audit Sertifikasi ISPO Berkelanjutan',
    causes: 'Perubahan regulasi baku mutu lingkungan daerah dan pembaruan dokumen AMDAL yang tertunda',
    impactDescription: 'Sanksi administratif dari regulator dan risiko diskualifikasi pasokan pasar ekspor',
    inherentLikelihood: 3,
    inherentImpact: 5,
    existingControl: 'Pengujian laboratorium independen bulanan atas baku mutu air limbah cair (POME)',
    controlEffectiveness: 'Effective',
    residualLikelihood: 1,
    residualImpact: 3,
    riskOwner: 'Dept. Sustainability & K3L',
    actionPlan: 'Penyelesaian perizinan AMDAL terpadu via OSS RBA dan pendampingan konsultan sertifikasi',
    targetDate: '2026-11-30',
    status: 'Open'
  },
  {
    id: '4',
    code: 'RSK-SFT-004',
    category: 'Keselamatan Kerja (K3)',
    businessProcess: 'Panen & Pengangkutan Hasil Kebun (TBS)',
    riskEvent: 'Kecelakaan Kerja Kategori Sedang-Berat pada Kegiatan Panen & Transportasi Kebun',
    causes: 'Penggunaan APD belum konsisten, medan jalan kebun licin saat musim hujan ekstrim',
    impactDescription: 'Cidera pekerja, biaya perawatan medis, dan penghentian sementara operasional blok kebun',
    inherentLikelihood: 3,
    inherentImpact: 4,
    existingControl: 'Sertifikasi K3 Panen, pembagian APD standar, dan safety briefing harian (Toolbox Meeting)',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 2,
    riskOwner: 'Dept. Kebun & Operasional Field',
    actionPlan: 'Perbaikan perkerasan jalan produksi batu pecah & inspeksi ketaatan APD acak mingguan',
    targetDate: '2026-08-31',
    status: 'In Progress'
  },
  {
    id: '5',
    code: 'RSK-IT-005',
    category: 'Teknologi & Keamanan Siber',
    businessProcess: 'Sistem Informasi ERP & Jaringan Kebun',
    riskEvent: 'Gangguan Akses Server ERP Perkebunan & Gangguan Keamanan Data Siber',
    causes: 'Koneksi jaringan remote kebun tidak stabil, serangan malware/phishing pada perangkat karyawan',
    impactDescription: 'Keterlambatan input data timbangan TBS harian dan penundaan laporan keuangan bulanan',
    inherentLikelihood: 3,
    inherentImpact: 4,
    existingControl: 'Penerapan Dual Firewall, Backup Server Otomatis Harian, dan Sentinel Endpoint Protection',
    controlEffectiveness: 'Effective',
    residualLikelihood: 1,
    residualImpact: 2,
    riskOwner: 'Dept. Information Technology (IT)',
    actionPlan: 'Implementasi koneksi VSAT Backup & Pelatihan Awareness Cybersecurity bagi seluruh staff',
    targetDate: '2026-12-15',
    status: 'In Progress'
  },
  {
    id: '6',
    code: 'RSK-STR-006',
    category: 'Strategis & Kemitraan',
    businessProcess: 'Pengadaan TBS Pihak Ketiga',
    riskEvent: 'Fluktuasi Pasokan TBS Pihak Ketiga akibat Persaingan Harga Antar PKS Kompetitor',
    causes: 'Kapasitas olah PKS sekitar meningkat dan insentif harga potongan fraksi yang lebih agresif',
    impactDescription: 'Utilisasi PKS berkurang di bawah target efisiensi minimum (Di bawah 80% utilisasi)',
    inherentLikelihood: 4,
    inherentImpact: 3,
    existingControl: 'Kemitraan jangka panjang dengan kelompok tani & insentif mutu kematangan TBS',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 2,
    residualImpact: 2,
    riskOwner: 'Dept. Commercial & Procurement',
    actionPlan: 'Program kemitraan pupuk subsidi mitra tani dan pembayaran ekspress via transfer sistemik',
    targetDate: '2026-10-15',
    status: 'Open'
  }
];

export default function Dashboard({
  onToast
}: DashboardProps) {
  // Google Sheets Document Integration State
  const defaultGoogleSheetUrl = 'https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/edit?gid=1293981214#gid=1293981214';

  const [riskProfileLink, setRiskProfileLink] = useState<RiskProfileLink>(() => {
    try {
      const saved = localStorage.getItem('company_risk_profile_link');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      fileName: 'Risk_Register_PT_AGM_2026.xlsx',
      url: defaultGoogleSheetUrl,
      uploadedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      fileSize: 'Live Spreadsheet',
      notes: 'Spreadsheet Resmi Risk Register Perusahaan (ISO 31000)'
    };
  });

  // Display Mode: 'table' (Interactive Dashboard) vs 'iframe' (Google Sheets Embed View)
  const [viewMode, setViewMode] = useState<'table' | 'iframe'>('table');

  // Risk Register Items State
  const [riskItems, setRiskItems] = useState<RiskRegisterItem[]>(() => {
    try {
      const saved = localStorage.getItem('company_risk_register_items');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_RISK_REGISTER;
  });

  // Modal Link Edit State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [inputFileName, setInputFileName] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'url' | 'file'>('url');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);

  // New / Edit Risk Modal State
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [editingRiskItem, setEditingRiskItem] = useState<RiskRegisterItem | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRiskLevelFilter, setSelectedRiskLevelFilter] = useState<string>('All');

  // Additional Filters & Sync State
  const [selectedSite, setSelectedSite] = useState<string>('All');
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  // Function to sync data from Google Sheet
  const syncGoogleSheetData = useCallback(async (silent = false) => {
    if (!riskProfileLink?.url) return;
    setIsLoadingSheet(true);
    try {
      const fetched = await fetchGoogleSheetRiskRegister(riskProfileLink.url);
      if (fetched && fetched.length > 0) {
        const converted: RiskRegisterItem[] = fetched.map((item, idx) => {
          const inhL = mapScoreToLevelNum(item.inherentLikelihoodStr);
          const inhI = mapScoreToLevelNum(item.inherentImpactStr);
          const resL = mapScoreToLevelNum(item.residualLikelihoodStr);
          const resI = mapScoreToLevelNum(item.residualImpactStr);

          return {
            id: item.id || `rsk-${idx}`,
            code: item.code || `RSK-${idx + 1}`,
            site: item.site,
            department: item.department,
            category: item.category || 'Operasional',
            businessProcess: item.businessProcess || 'Operasional',
            riskEvent: item.riskEvent,
            causes: item.causes,
            inherentLikelihood: inhL,
            inherentImpact: inhI,
            existingControl: item.existingControl,
            controlEffectiveness: item.controlEffectiveness,
            residualLikelihood: resL,
            residualImpact: resI,
            riskOwner: item.riskOwner || 'Risk Owner',
            actionPlan: item.actionPlan,
            targetDate: item.targetDate,
            status: item.status
          };
        });

        setRiskItems(converted);
        try {
          localStorage.setItem('company_risk_register_items', JSON.stringify(converted));
        } catch (e) {
          console.error(e);
        }
        const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        setLastSyncedAt(now);
        if (!silent) {
          onToast(`Berhasil menyinkronkan ${converted.length} item risiko dari Google Sheets!`, 'success');
        }
      }
    } catch (err: any) {
      console.error('Failed to sync sheet:', err);
      if (!silent) {
        onToast(`Gagal menyinkronkan data Google Sheet: ${err.message || 'Error'}`, 'warning');
      }
    } finally {
      setIsLoadingSheet(false);
    }
  }, [riskProfileLink?.url, onToast]);

  // Initial Sync on Mount
  useEffect(() => {
    syncGoogleSheetData(true);
  }, []);

  // Save Spreadsheet Link Handler
  const handleSaveRiskLink = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = inputUrl.trim();
    let finalFileName = inputFileName.trim() || 'Risk_Register_Dokumen.xlsx';
    let finalSize = riskProfileLink?.fileSize || 'Live Cloud';

    if (activeModalTab === 'file' && selectedFileObj) {
      finalFileName = selectedFileObj.name;
      finalSize = `${(selectedFileObj.size / (1024 * 1024)).toFixed(2)} MB`;
      finalUrl = URL.createObjectURL(selectedFileObj);
    }

    if (!finalUrl && activeModalTab === 'url') {
      onToast('Mohon masukkan URL link file profil risiko yang valid', 'warning');
      return;
    }

    const updated: RiskProfileLink = {
      fileName: finalFileName,
      url: finalUrl,
      uploadedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      fileSize: finalSize,
      notes: inputNotes.trim()
    };

    setRiskProfileLink(updated);
    try {
      localStorage.setItem('company_risk_profile_link', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    setIsLinkModalOpen(false);
    onToast('Link Google Sheet / File Risk Register berhasil disimpan!', 'success');
  };

  // Convert Google Sheets edit URL into embeddable HTML URL
  const embeddableUrl = useMemo(() => {
    if (!riskProfileLink.url) return '';
    try {
      const urlObj = new URL(riskProfileLink.url);
      if (urlObj.hostname.includes('docs.google.com')) {
        // Extract spreadsheet ID and gid
        const matches = urlObj.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          const sheetId = matches[1];
          let gidParam = '';
          if (urlObj.hash.includes('gid=')) {
            const gidMatch = urlObj.hash.match(/gid=(\d+)/);
            if (gidMatch) gidParam = `&gid=${gidMatch[1]}`;
          } else if (urlObj.searchParams.has('gid')) {
            gidParam = `&gid=${urlObj.searchParams.get('gid')}`;
          }
          return `https://docs.google.com/spreadsheets/d/${sheetId}/htmlembed?widget=true&headers=false${gidParam}`;
        }
      }
    } catch (e) {
      console.error('Invalid URL for embed', e);
    }
    return riskProfileLink.url;
  }, [riskProfileLink.url]);

  // Score Calculator (Likelihood x Impact)
  const calculateRiskLevel = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 15) return { level: 'Sangat Tinggi (Extreme)', color: 'bg-rose-500 text-white', border: 'border-rose-600', badgeBg: 'bg-rose-100 text-rose-800' };
    if (score >= 10) return { level: 'Tinggi (High)', color: 'bg-amber-500 text-white', border: 'border-amber-600', badgeBg: 'bg-amber-100 text-amber-800' };
    if (score >= 5) return { level: 'Sedang (Medium)', color: 'bg-yellow-400 text-slate-900', border: 'border-yellow-500', badgeBg: 'bg-yellow-100 text-yellow-800' };
    return { level: 'Rendah (Low)', color: 'bg-emerald-500 text-white', border: 'border-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-800' };
  };

  // Unique Categories
  const categories = useMemo(() => {
    const set = new Set(riskItems.map(i => i.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [riskItems]);

  // Unique Sites
  const sites = useMemo(() => {
    const set = new Set(riskItems.map(i => i.site).filter(Boolean) as string[]);
    return ['All', ...Array.from(set)];
  }, [riskItems]);

  // Filtered Risk Items
  const filteredRiskItems = useMemo(() => {
    return riskItems.filter(item => {
      const matchesSearch = 
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.riskEvent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.riskOwner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.site && item.site.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.department && item.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.causes.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSite = selectedSite === 'All' || item.site === selectedSite;

      const resLevel = calculateRiskLevel(item.residualLikelihood, item.residualImpact).level;
      const matchesLevel = selectedRiskLevelFilter === 'All' || resLevel.includes(selectedRiskLevelFilter);

      return matchesSearch && matchesCategory && matchesSite && matchesLevel;
    });
  }, [riskItems, searchQuery, selectedCategory, selectedSite, selectedRiskLevelFilter]);

  // Risk Level Metrics
  const metrics = useMemo(() => {
    let extreme = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    riskItems.forEach(item => {
      const score = item.residualLikelihood * item.residualImpact;
      if (score >= 15) extreme++;
      else if (score >= 10) high++;
      else if (score >= 5) medium++;
      else low++;
    });

    return { total: riskItems.length, extreme, high, medium, low };
  }, [riskItems]);

  // Save / Update Risk Item
  const handleSaveRiskItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newItem: RiskRegisterItem = {
      id: editingRiskItem ? editingRiskItem.id : Date.now().toString(),
      code: (formData.get('code') as string) || `RSK-${Math.floor(100 + Math.random() * 900)}`,
      category: (formData.get('category') as string) || 'Operasional',
      businessProcess: (formData.get('businessProcess') as string) || '',
      riskEvent: (formData.get('riskEvent') as string) || '',
      causes: (formData.get('causes') as string) || '',
      impactDescription: (formData.get('impactDescription') as string) || '',
      inherentLikelihood: Number(formData.get('inherentLikelihood')) || 3,
      inherentImpact: Number(formData.get('inherentImpact')) || 3,
      existingControl: (formData.get('existingControl') as string) || '',
      controlEffectiveness: (formData.get('controlEffectiveness') as 'Effective' | 'Partially Effective' | 'Ineffective') || 'Partially Effective',
      residualLikelihood: Number(formData.get('residualLikelihood')) || 2,
      residualImpact: Number(formData.get('residualImpact')) || 2,
      riskOwner: (formData.get('riskOwner') as string) || '',
      actionPlan: (formData.get('actionPlan') as string) || '',
      targetDate: (formData.get('targetDate') as string) || '',
      status: (formData.get('status') as 'Open' | 'In Progress' | 'Closed' | 'Overdue') || 'In Progress'
    };

    let updatedList: RiskRegisterItem[];
    if (editingRiskItem) {
      updatedList = riskItems.map(item => item.id === editingRiskItem.id ? newItem : item);
      onToast(`Item risiko ${newItem.code} berhasil diperbarui`, 'success');
    } else {
      updatedList = [newItem, ...riskItems];
      onToast(`Item risiko baru ${newItem.code} berhasil ditambahkan`, 'success');
    }

    setRiskItems(updatedList);
    try {
      localStorage.setItem('company_risk_register_items', JSON.stringify(updatedList));
    } catch (err) {
      console.error(err);
    }

    setIsRiskModalOpen(false);
    setEditingRiskItem(null);
  };

  // Delete Risk Item
  const handleDeleteRisk = (id: string, code: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus item risiko ${code}?`)) {
      const updated = riskItems.filter(i => i.id !== id);
      setRiskItems(updated);
      try {
        localStorage.setItem('company_risk_register_items', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      onToast(`Item risiko ${code} berhasil dihapus`, 'info');
    }
  };

  // Reset to initial
  const handleResetData = () => {
    if (confirm('Kembalikan data Risk Register ke daftar bawaan Google Sheets?')) {
      setRiskItems(INITIAL_RISK_REGISTER);
      localStorage.setItem('company_risk_register_items', JSON.stringify(INITIAL_RISK_REGISTER));
      onToast('Data Risk Register berhasil direstart ke versi awal Google Sheets', 'success');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-sky-400/30">
              Enterprise Risk Management (ISO 31000)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-sky-400" />
            Company Risk Register & Matrix
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Sistem Matriks Profil Risiko Perusahaan yang terhubung langsung dengan Spreadsheet Google Sheets resmi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          {/* View Mode Toggle */}
          <div className="bg-slate-800/90 border border-slate-700 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard & Matriks
            </button>
            <button
              onClick={() => setViewMode('iframe')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'iframe'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Live Google Sheets
            </button>
          </div>

          <button
            onClick={() => {
              setInputFileName(riskProfileLink.fileName);
              setInputUrl(riskProfileLink.url);
              setInputNotes(riskProfileLink.notes || '');
              setSelectedFileObj(null);
              setIsLinkModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-indigo-900/30 cursor-pointer whitespace-nowrap"
          >
            <Link className="w-4 h-4 text-sky-300" /> Tautkan Sheet
          </button>
        </div>
      </div>

      {/* Connected Google Sheets Link Banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl border border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30 mt-0.5 sm:mt-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase tracking-wider">
                Google Sheets Terhubung
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Terakhir Diperbarui: {riskProfileLink.uploadedAt}
              </span>
            </div>
            <h3 className="font-bold text-sm text-white mt-1 flex items-center gap-2">
              {riskProfileLink.fileName}
            </h3>
            <p className="text-xs text-slate-300 font-normal italic mt-0.5 truncate max-w-xl">
              {riskProfileLink.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <a
            href={riskProfileLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" /> Buka Google Sheets
          </a>
          <button
            onClick={() => {
              setInputFileName(riskProfileLink.fileName);
              setInputUrl(riskProfileLink.url);
              setInputNotes(riskProfileLink.notes || '');
              setSelectedFileObj(null);
              setIsLinkModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-600 cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-300" /> Ubah Link
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: Google Sheets Live Iframe Embed */}
      {viewMode === 'iframe' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">Pratinjau Live Google Sheets Risk Register</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={riskProfileLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600" /> Buka Layar Penuh
              </a>
              <button
                onClick={() => {
                  onToast('Memuat ulang tampilan pratinjau Google Sheets...', 'info');
                  // Trigger re-render iframe
                  const iframe = document.getElementById('gsheet-iframe') as HTMLIFrameElement;
                  if (iframe) iframe.src = iframe.src;
                }}
                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Iframe
              </button>
            </div>
          </div>

          <div className="w-full h-[650px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
            <iframe
              id="gsheet-iframe"
              src={embeddableUrl}
              className="w-full h-full border-0"
              title="Google Sheets Risk Register"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Dashboard & Interactive Risk Table */}
      {viewMode === 'table' && (
        <>
          {/* Risk Level Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Item Risiko</p>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">ISO 31000</span>
              </div>
              <p className="text-[10px] text-slate-500">Terdaftar dalam Risk Register</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Risiko Sangat Tinggi</p>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-rose-600">{metrics.extreme}</span>
                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">Score ≥ 15</span>
              </div>
              <p className="text-[10px] text-rose-600 font-medium">Perlu mitigasi segera (Priority 1)</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Risiko Tinggi</p>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-amber-600">{metrics.high}</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Score 10 - 14</span>
              </div>
              <p className="text-[10px] text-amber-600 font-medium">Pengawasan manajemen ketat</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-yellow-200 bg-yellow-50/20 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider">Risiko Sedang</p>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-yellow-600">{metrics.medium}</span>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Score 5 - 9</span>
              </div>
              <p className="text-[10px] text-yellow-700 font-medium">Monitoring periodik</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Risiko Rendah</p>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-emerald-600">{metrics.low}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Score 1 - 4</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium">Prosedur operasional rutin</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode, deskripsi risiko, penyebab, risk owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 text-slate-900"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> Kategori:
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'All' ? 'Semua Kategori' : cat}</option>
                ))}
              </select>

              {/* Site Filter */}
              {sites.length > 2 && (
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {sites.map(st => (
                    <option key={st} value={st}>{st === 'All' ? 'Semua Site' : `Site: ${st}`}</option>
                  ))}
                </select>
              )}

              {/* Level Filter */}
              <select
                value={selectedRiskLevelFilter}
                onChange={(e) => setSelectedRiskLevelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="All">Semua Level Risiko</option>
                <option value="Sangat Tinggi">Sangat Tinggi (Extreme)</option>
                <option value="Tinggi">Tinggi (High)</option>
                <option value="Sedang">Sedang (Medium)</option>
                <option value="Rendah">Rendah (Low)</option>
              </select>

              {/* Sync Button */}
              <button
                onClick={() => syncGoogleSheetData(false)}
                disabled={isLoadingSheet}
                className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Sinkronkan Data Langsung dari Google Sheet"
              >
                {isLoadingSheet ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {isLoadingSheet ? 'Menyinkronkan...' : 'Sync Sheet'}
              </button>

              <button
                onClick={() => {
                  setEditingRiskItem(null);
                  setIsRiskModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Tambah Risiko Baru
              </button>

              <button
                onClick={handleResetData}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                title="Reset Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Risk Register Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Matriks Profil & Risk Register Terstruktur ({filteredRiskItems.length} Item)
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Skor Residual = Kemungkinan (Likelihood) × Dampak (Impact)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Kode</th>
                    <th className="p-3">Kategori & Proses</th>
                    <th className="p-3 min-w-[220px]">Event Risiko & Penyebab</th>
                    <th className="p-3 text-center">Inherent Score</th>
                    <th className="p-3 min-w-[180px]">Kontrol Eksisting</th>
                    <th className="p-3 text-center">Residual Level</th>
                    <th className="p-3 min-w-[180px]">Rencana Aksi Mitigasi</th>
                    <th className="p-3">Risk Owner & Target</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredRiskItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Tidak ada item risiko yang cocok dengan pencarian atau filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRiskItems.map((item) => {
                      const inherent = calculateRiskLevel(item.inherentLikelihood, item.inherentImpact);
                      const residual = calculateRiskLevel(item.residualLikelihood, item.residualImpact);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{item.category}</span>
                            <span className="text-[11px] text-slate-500 block">{item.businessProcess}</span>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-slate-900 leading-snug">{item.riskEvent}</p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">Penyebab: {item.causes}</p>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${inherent.badgeBg}`}>
                              {item.inherentLikelihood}x{item.inherentImpact} ({item.inherentLikelihood * item.inherentImpact})
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="text-slate-800 font-medium leading-snug">{item.existingControl}</p>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">
                              Eff: {item.controlEffectiveness}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-2xs whitespace-nowrap ${residual.color}`}>
                              {residual.level.split(' ')[0]} ({item.residualLikelihood * item.residualImpact})
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="text-slate-900 font-semibold leading-snug">{item.actionPlan}</p>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block text-[11px]">{item.riskOwner}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" /> {item.targetDate}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingRiskItem(item);
                                  setIsRiskModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="Edit Item Risiko"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRisk(item.id, item.code)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="Hapus Item Risiko"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Tautkan File / Google Sheet Link */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-start pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Link className="w-5 h-5 text-indigo-600" />
                  Tautkan Google Sheets / File Risk Register
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sematkan URL Google Sheets resmi atau upload file Excel / PDF Risk Register.
                </p>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Mode */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveModalTab('url')}
                className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'url'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Sematkan Link Google Sheets
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('file')}
                className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'file'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File Komputer
              </button>
            </div>

            <form onSubmit={handleSaveRiskLink} className="space-y-4 text-xs">
              {activeModalTab === 'url' ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      URL Link Google Sheets / Document Cloud *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/edit..."
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama / Judul Dokumen (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Risk_Register_PT_AGM_2026.xlsx"
                      value={inputFileName}
                      onChange={(e) => setInputFileName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pilih File Risk Register (Excel, PDF, CSV) *
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-400 bg-slate-50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.docx,.doc,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFileObj(e.target.files[0]);
                          setInputFileName(e.target.files[0].name);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Paperclip className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    {selectedFileObj ? (
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{selectedFileObj.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ukuran: {(selectedFileObj.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-slate-800 text-xs">Klik atau seret file ke area ini</p>
                        <p className="text-[10px] text-slate-500 mt-1">Mendukung PDF, Excel, Word, CSV (Maks 25MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan / Versi Dokumen (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Disetujui Komite Manajemen Risiko & Direksi 2026"
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan & Tautkan Link
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Tambah / Edit Item Risiko */}
      {isRiskModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-600" />
                  {editingRiskItem ? `Edit Item Risiko: ${editingRiskItem.code}` : 'Tambah Item Risiko Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi informasi penilaian risiko sesuai kerangka kerja ISO 31000 Enterprise Risk Management.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRiskModalOpen(false);
                  setEditingRiskItem(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRiskItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Risiko *</label>
                  <input
                    type="text"
                    name="code"
                    required
                    defaultValue={editingRiskItem?.code || `RSK-${Math.floor(100 + Math.random() * 900)}`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Risiko *</label>
                  <input
                    type="text"
                    name="category"
                    required
                    placeholder="Contoh: Operasional & Produksi, Keuangan, K3..."
                    defaultValue={editingRiskItem?.category || 'Operasional & Produksi'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proses Bisnis / Sub-Bidang *</label>
                <input
                  type="text"
                  name="businessProcess"
                  required
                  placeholder="Contoh: Pengolahan Kelapa Sawit PKS / Transportasi Kebun"
                  defaultValue={editingRiskItem?.businessProcess || ''}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Event Risiko *</label>
                <textarea
                  name="riskEvent"
                  required
                  rows={2}
                  placeholder="Jelaskan peristiwa risiko yang berpotensi terjadi..."
                  defaultValue={editingRiskItem?.riskEvent || ''}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Penyebab Utama (Root Cause) *</label>
                <textarea
                  name="causes"
                  required
                  rows={2}
                  placeholder="Penyebab internal/eksternal timbulnya risiko..."
                  defaultValue={editingRiskItem?.causes || ''}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Inherent Risk Score */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-xs block">Penilaian Inherent Risk (Awal)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Likelihood (1 - 5)</label>
                    <select
                      name="inherentLikelihood"
                      defaultValue={editingRiskItem?.inherentLikelihood || 3}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value={1}>1 - Sangat Jarang</option>
                      <option value={2}>2 - Jarang</option>
                      <option value={3}>3 - Kadang-kadang</option>
                      <option value={4}>4 - Sering</option>
                      <option value={5}>5 - Sangat Sering</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Impact (1 - 5)</label>
                    <select
                      name="inherentImpact"
                      defaultValue={editingRiskItem?.inherentImpact || 3}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value={1}>1 - Sangat Rendah</option>
                      <option value={2}>2 - Rendah</option>
                      <option value={3}>3 - Sedang</option>
                      <option value={4}>4 - Tinggi</option>
                      <option value={5}>5 - Sangat Tinggi</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kontrol Eksisting Saat Ini *</label>
                <input
                  type="text"
                  name="existingControl"
                  required
                  placeholder="Prosedur, SOP, atau kontrol yang sudah berjalan..."
                  defaultValue={editingRiskItem?.existingControl || ''}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Efektivitas Kontrol *</label>
                <select
                  name="controlEffectiveness"
                  defaultValue={editingRiskItem?.controlEffectiveness || 'Partially Effective'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                >
                  <option value="Effective">Effective (Sangat Efektif)</option>
                  <option value="Partially Effective">Partially Effective (Cukup Efektif)</option>
                  <option value="Ineffective">Ineffective (Belum Efektif)</option>
                </select>
              </div>

              {/* Residual Risk Score */}
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-2">
                <span className="font-bold text-indigo-900 text-xs block">Penilaian Residual Risk (Setelah Kontrol & Mitigasi)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-indigo-800 mb-1">Residual Likelihood (1 - 5)</label>
                    <select
                      name="residualLikelihood"
                      defaultValue={editingRiskItem?.residualLikelihood || 2}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value={1}>1 - Sangat Jarang</option>
                      <option value={2}>2 - Jarang</option>
                      <option value={3}>3 - Kadang-kadang</option>
                      <option value={4}>4 - Sering</option>
                      <option value={5}>5 - Sangat Sering</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-indigo-800 mb-1">Residual Impact (1 - 5)</label>
                    <select
                      name="residualImpact"
                      defaultValue={editingRiskItem?.residualImpact || 2}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value={1}>1 - Sangat Rendah</option>
                      <option value={2}>2 - Rendah</option>
                      <option value={3}>3 - Sedang</option>
                      <option value={4}>4 - Tinggi</option>
                      <option value={5}>5 - Sangat Tinggi</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rencana Aksi Mitigasi *</label>
                <textarea
                  name="actionPlan"
                  required
                  rows={2}
                  placeholder="Langkah perbaikan atau rencana mitigasi tambahan..."
                  defaultValue={editingRiskItem?.actionPlan || ''}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Risk Owner (Pemilik Risiko) *</label>
                  <input
                    type="text"
                    name="riskOwner"
                    required
                    placeholder="Contoh: Dept. Teknik / Dept. Keuangan..."
                    defaultValue={editingRiskItem?.riskOwner || ''}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Penyelesaian *</label>
                  <input
                    type="date"
                    name="targetDate"
                    required
                    defaultValue={editingRiskItem?.targetDate || '2026-10-31'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRiskModalOpen(false);
                    setEditingRiskItem(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan Item Risiko
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
