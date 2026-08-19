import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Save, 
  Send, 
  CheckSquare, 
  Link2, 
  SearchCheck, 
  UploadCloud, 
  FileSpreadsheet, 
  Globe, 
  AlertCircle, 
  FileImage,
  ExternalLink,
  FileText,
  Download,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowLeft,
  Building2,
  FolderArchive,
  FileCheck,
  RotateCcw,
  Clock,
  HelpCircle
} from 'lucide-react';

interface WorkingPaperProps {
  currentKkaTitle: string;
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  key?: string;
}

interface ChecklistItem {
  id: string;
  no: number;
  kategori: string;
  pertanyaan: string;
  referensiSop: string;
  bobotRisiko: 'MAJOR' | 'MINOR' | 'IMPROVEMENT';
  metodePengujian?: string;
  status: 'PASS' | 'FAIL' | 'UNCHECKED' | 'NA';
  catatanAuditor: string;
  buktiLink?: string;
}

interface AuditFileChecklist {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: 'xlsx' | 'pdf';
  scope: string;
  department: string;
  totalQuestions: number;
  lastUpdated: string;
  status: 'Siap Digunakan' | 'Dalam Audit' | 'Selesai Insepsi';
  author: string;
  items: ChecklistItem[];
}

export default function WorkingPaper({ currentKkaTitle, onToast }: WorkingPaperProps) {
  // Master list of Checklist Files for Audit
  const [checklistFiles, setChecklistFiles] = useState<AuditFileChecklist[]>([
    {
      id: 'file-01',
      fileName: 'CHECKLIST_AUDIT_OPERASIONAL_ALAT_BERAT.xlsx',
      fileSize: '1.4 MB',
      fileType: 'xlsx',
      scope: 'Operasional Site & Unit Fleet',
      department: 'Plant & Operation',
      totalQuestions: 6,
      lastUpdated: '25 Jul 2026',
      status: 'Dalam Audit',
      author: 'Tim Audit Operasional',
      items: [
        {
          id: 'q1',
          no: 1,
          kategori: 'Perawatan Fleet & P2H',
          pertanyaan: 'Apakah lembar Pelaksanaan Perawatan Harian (P2H) alat berat diisi lengkap oleh operator sebelum shift berjalan dan divalidasi Foreman?',
          referensiSop: 'SOP-PLT-012 Bab IV',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Observasi Fisik & Sampling Logbook',
          status: 'FAIL',
          catatanAuditor: 'Ditemukan 12 unit excavator di Site B tidak memiliki logbook P2H terisi untuk shift malam.',
          buktiLink: 'sharepoint.internal/docs/p2h-site-b.pdf'
        },
        {
          id: 'q2',
          no: 2,
          kategori: 'K3LH & Safety Kabin',
          pertanyaan: 'Apakah sertifikat Kelayakan K3 (Sertifikasi Riksa Uji) alat berat masih dalam masa berlaku dan stiker ditempel di kaca kabin?',
          referensiSop: 'SOP-SHE-005',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Vouching Sertifikat & Cek Fisik Stiker',
          status: 'PASS',
          catatanAuditor: 'Seluruh unit dump truck dan dozer memiliki sertifikat aktif hingga akhir tahun 2026.',
        },
        {
          id: 'q3',
          no: 3,
          kategori: 'Kalibrasi Fuel Dispenser',
          pertanyaan: 'Apakah flowmeter dispenser fuel solar di Fuel Station Site dikalibrasi berkala setiap 3 bulan oleh tera resmi?',
          referensiSop: 'SOP-LOG-044',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Inspeksi Dokumen Tera & Segel Metering',
          status: 'FAIL',
          catatanAuditor: 'Tera resmi terakhir dilakukan 8 bulan yang lalu, berpotensi menyebabkan akumulasi selisih catat fuel.',
          buktiLink: 'sharepoint.internal/docs/fuel-calibration.pdf'
        },
        {
          id: 'q4',
          no: 4,
          kategori: 'Manajemen Sparepart Gudang',
          pertanyaan: 'Apakah komponen sparepart fast-moving di gudang fisik sesuai 100% dengan saldo persediaan pada sistem ERP/SAP?',
          referensiSop: 'SOP-SCM-089',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Physical Stock Opname & Recounting',
          status: 'FAIL',
          catatanAuditor: 'Hasil fisik stock opname menunjukkan variansi selisih 14 unit filter oli belum di-issue sistem.',
        },
        {
          id: 'q5',
          no: 5,
          kategori: 'Kepatuhan APD Pekerja',
          pertanyaan: 'Apakah seluruh mekanik dan helper di workshop menggunakan APD lengkap sesuai standar risiko area (Safety Boots, Vest, Goggles)?',
          referensiSop: 'SOP-SHE-001',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Observasi Langsung Workshop Site',
          status: 'PASS',
          catatanAuditor: 'Tingkat kepatuhan APD di workshop tergolong sangat baik (98%).',
        },
        {
          id: 'q6',
          no: 6,
          kategori: 'Sistem Pencahayaan Pit Malam',
          pertanyaan: 'Apakah tower lamp dan penerangan di area Pit Tambang mencukupi lux standar untuk aktivitas hauling shift malam?',
          referensiSop: 'SOP-OPS-033',
          bobotRisiko: 'IMPROVEMENT',
          metodePengujian: 'Pengukuran Lux Meter & Night Survey',
          status: 'PASS',
          catatanAuditor: 'Tower LED berfungsi optimal di seluruh junction jalan tambang.',
        }
      ]
    },
    {
      id: 'file-02',
      fileName: 'CHECKLIST_AUDIT_K3LH_ENVIRONMENTAL_SAFETY.pdf',
      fileSize: '850 KB',
      fileType: 'pdf',
      scope: 'K3LH & Pengelolaan Lingkungan',
      department: 'HSE / K3LH',
      totalQuestions: 5,
      lastUpdated: '22 Jul 2026',
      status: 'Siap Digunakan',
      author: 'Lead Auditor HSE',
      items: [
        {
          id: 'q2-1',
          no: 1,
          kategori: 'Pengelolaan Limbah B3',
          pertanyaan: 'Apakah TPS Limbah B3 memiliki perizinan aktif, Manifest B3 terisi lengkap, dan TPS dilengkapi oil trap & spill kit?',
          referensiSop: 'SOP-ENV-001',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Inspeksi Fisik TPS & Wawancara DLH',
          status: 'PASS',
          catatanAuditor: 'Izin TPS B3 berlaku sampai 2028, log manifest tercatat teratur.',
        },
        {
          id: 'q2-2',
          no: 2,
          kategori: 'Inspeksi Fire Extinguisher (APAR)',
          pertanyaan: 'Apakah APAR di seluruh fasilitas kantor site & workshop diperiksa bulanan dan tekanan pressure gauge berada di zona hijau?',
          referensiSop: 'SOP-SHE-020',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Cek Fisik Segel & Kartu Gantung',
          status: 'PASS',
          catatanAuditor: 'Kartu inspeksi APAR ter-update bulan berjalan.',
        },
        {
          id: 'q2-3',
          no: 3,
          kategori: 'Pengujian Baku Mutu Air Settling Pond',
          pertanyaan: 'Apakah sampel air outlet settling pond diuji laboratorium terakreditasi setiap bulan sebelum dialirkan ke badan air umum?',
          referensiSop: 'SOP-ENV-014',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Review Laporan Lab Terakreditasi KAN',
          status: 'PASS',
          catatanAuditor: 'Hasil lab menunjukkan parameter TSS dan pH sesuai ambang batas baku mutu.',
        },
        {
          id: 'q2-4',
          no: 4,
          kategori: 'Induksi Safety Tamu & Subkontraktor',
          pertanyaan: 'Apakah seluruh pengunjung & karyawan baru wajib mengikuti Safety Induction sebelum mendapatkan SIMPER / Pass Masuk?',
          referensiSop: 'SOP-SHE-002',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Sampling Logbook e-Induction Gate',
          status: 'PASS',
          catatanAuditor: 'Sistem e-Induction berjalan baik di pintu pendaftaran utama.',
        },
        {
          id: 'q2-5',
          no: 5,
          kategori: 'Emergency Response Preparedness',
          pertanyaan: 'Apakah simulasi tanggap darurat (Emergency Drill) dilaksanakan minimal 1 kali dalam 6 bulan untuk tim ERT Site?',
          referensiSop: 'SOP-SHE-099',
          bobotRisiko: 'IMPROVEMENT',
          metodePengujian: 'Review Berkas Notulen & Foto Drill',
          status: 'UNCHECKED',
          catatanAuditor: 'Belum dilakukan pengujian di lapangan.',
        }
      ]
    },
    {
      id: 'file-03',
      fileName: 'CHECKLIST_AUDIT_LOGISTIK_SPAREPART_FUEL.xlsx',
      fileSize: '2.1 MB',
      fileType: 'xlsx',
      scope: 'Pengadaan & Manajemen Rantai Pasok',
      department: 'Supply Chain & Warehouse',
      totalQuestions: 4,
      lastUpdated: '18 Jul 2026',
      status: 'Dalam Audit',
      author: 'Tim Audit Logistik',
      items: [
        {
          id: 'q3-1',
          no: 1,
          kategori: 'Otorisasi Requisition Order',
          pertanyaan: 'Apakah setiap Purchase Requisition (PR) sparepart di atas Rp 50 juta memiliki Approval Matrix dari Project Manager & HO?',
          referensiSop: 'SOP-FIN-031',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Audit Trail Sistem ERP / SAP',
          status: 'PASS',
          catatanAuditor: 'Seluruh sampel PR terverifikasi approval digital lengkap.',
        },
        {
          id: 'q3-2',
          no: 2,
          kategori: 'Penerimaan Barang (Good Receipt)',
          pertanyaan: 'Apakah fisik barang yang diterima di gudang site dilakukan pemeriksaan spesifikasi teknis dan dicocokkan dengan Surat Jalan supplier?',
          referensiSop: 'SOP-LOG-012',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Vouching PO, SJ & Certificate of Analysis',
          status: 'FAIL',
          catatanAuditor: 'Terdapat 3 kasus penerimaan oli pelumas tanpa melampirkan Certificate of Analysis (COA) dari vendor.',
        },
        {
          id: 'q3-3',
          no: 3,
          kategori: 'Keamanan Gudang & Akses Terbatas',
          pertanyaan: 'Apakah area gudang sparepart bernilai tinggi (High Value Parts) dikunci dan hanya diakses oleh petugas gudang yang berwenang?',
          referensiSop: 'SOP-LOG-050',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Observasi Pintu Terkunci & Access Card',
          status: 'PASS',
          catatanAuditor: 'Akses gudang menggunakan kartu RFID dan diawasi kamera CCTV 24 jam.',
        },
        {
          id: 'q3-4',
          no: 4,
          kategori: 'Penanganan Barang Fast vs Slow Moving',
          pertanyaan: 'Apakah item dead stock / slow moving di atas 1 tahun diidentifikasi dan dilaporkan ke manajemen untuk langkah pengapkiratannya?',
          referensiSop: 'SOP-LOG-088',
          bobotRisiko: 'IMPROVEMENT',
          metodePengujian: 'Analisis Fast-Slow Moving Aging Report',
          status: 'UNCHECKED',
          catatanAuditor: 'Perlu verifikasi fisik ke rak bagian belakang gudang C.',
        }
      ]
    },
    {
      id: 'file-04',
      fileName: 'CHECKLIST_AUDIT_KEUANGAN_PETTY_CASH_SITE.pdf',
      fileSize: '620 KB',
      fileType: 'pdf',
      scope: 'Verifikasi Keuangan & Kas Kecil Site',
      department: 'Finance & Accounting',
      totalQuestions: 4,
      lastUpdated: '15 Jul 2026',
      status: 'Selesai Insepsi',
      author: 'Auditor Keuangan HO',
      items: [
        {
          id: 'q4-1',
          no: 1,
          kategori: 'Cash Opname Kas Kecil',
          pertanyaan: 'Apakah saldo fisik uang tunai di brankas kasir site cocok 100% dengan saldo Buku Kas Kecil dan kwitansi penggantian?',
          referensiSop: 'SOP-FIN-002',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Surprise Cash Opname & Perhitungan Fisik',
          status: 'PASS',
          catatanAuditor: 'Cash opname mendadak tanggal 15 Jul menunjukkan saldo klop Rp 25.000.000.',
        },
        {
          id: 'q4-2',
          no: 2,
          kategori: 'Kelengkapan Bukti Transaksi',
          pertanyaan: 'Apakah setiap kwitansi pembayaran Petty Cash dilampirkan nota asli berstempel lunas dan kwitansi penerima sah?',
          referensiSop: 'SOP-FIN-005',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Vouching 100% Nota Kas Kecil',
          status: 'PASS',
          catatanAuditor: 'Lampiran nota biaya operasional BBM lokal terlampir rapi.',
        },
        {
          id: 'q4-3',
          no: 3,
          kategori: 'Penyimpanan Kunci Brankas',
          pertanyaan: 'Apakah kunci brankas dan kombinasi angka brankas dipegang oleh dua orang yang berbeda (Dual Control System)?',
          referensiSop: 'SOP-FIN-009',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Wawancara & Test Segregation of Duties',
          status: 'PASS',
          catatanAuditor: 'Prinsip Segregation of Duties terdistribusi dengan baik antara Kasir & Admin Finance.',
        },
        {
          id: 'q4-4',
          no: 4,
          kategori: 'Batas Maksimal Pengeluaran Kas',
          pertanyaan: 'Apakah transaksi pengeluaran di atas Rp 2.000.000 wajib menggunakan transfer bank resmi dan tidak dari petty cash?',
          referensiSop: 'SOP-FIN-015',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Testing Invoice Splitting & Bank Statement',
          status: 'PASS',
          catatanAuditor: 'Sesuai prosedur, tidak ditemukan pemecahan nota (invoice splitting).',
        }
      ]
    },
    {
      id: 'file-05',
      fileName: 'CHECKLIST_AUDIT_HR_MANPOWER_PERIZINAN.xlsx',
      fileSize: '1.1 MB',
      fileType: 'xlsx',
      scope: 'Legalitas Tenaga Kerja & Kehadiran',
      department: 'Human Capital & General Affair',
      totalQuestions: 4,
      lastUpdated: '10 Jul 2026',
      status: 'Siap Digunakan',
      author: 'HR Compliance Auditor',
      items: [
        {
          id: 'q5-1',
          no: 1,
          kategori: 'SIMPER & Lisensi K3 Operator',
          pertanyaan: 'Apakah seluruh operator alat berat & driver unit pendukung memiliki Surat Izin Mengemudi Perusahaan (SIMPER) aktif sesuai kelas unit?',
          referensiSop: 'SOP-HR-022',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Cross-Check Database SIMPER vs Absensi Site',
          status: 'PASS',
          catatanAuditor: 'Seluruh operator memiliki SIO ESDM & SIMPER aktif.',
        },
        {
          id: 'q5-2',
          no: 2,
          kategori: 'Kepatuhan Jam Kerja & Lembur',
          pertanyaan: 'Apakah jam kerja lembur karyawan tidak melebihi batas regulasi Ketenagakerjaan (maks 18 jam/minggu) dan divalidasi atasan?',
          referensiSop: 'SOP-HR-040',
          bobotRisiko: 'MINOR',
          metodePengujian: 'Recap Data Biometric Fingerprint & SPL',
          status: 'PASS',
          catatanAuditor: 'Otorisasi Surat Perintah Lembur (SPL) divalidasi digital.',
        },
        {
          id: 'q5-3',
          no: 3,
          kategori: 'Pemeriksaan Kesehatan Berkala (MCU)',
          pertanyaan: 'Apakah seluruh karyawan site telah menjalani Medical Check Up (MCU) tahunan & Fit to Work sebelum memasuki lokasi tambang?',
          referensiSop: 'SOP-HR-011',
          bobotRisiko: 'MAJOR',
          metodePengujian: 'Review Rekam Medis & Sertifikat Fit to Work',
          status: 'PASS',
          catatanAuditor: 'Hasil MCU 100% terdata di klinik site.',
        },
        {
          id: 'q5-4',
          no: 4,
          kategori: 'Fasilitas Mess & Sanitasi Karyawan',
          pertanyaan: 'Apakah fasilitas akomodasi mess karyawan, kantin, dan sanitasi memenuhi standar kelayakan K3LH dan inspeksi berkala?',
          referensiSop: 'SOP-GA-008',
          bobotRisiko: 'IMPROVEMENT',
          metodePengujian: 'Inspeksi Lapangan Mess & Dapur',
          status: 'UNCHECKED',
          catatanAuditor: 'Jadwal inspeksi minggu depan.',
        }
      ]
    }
  ]);

  // Active view state: 'list' (files overview) or 'detail' (inspect questions inside a file)
  const [selectedFileId, setSelectedFileId] = useState<string | null>('file-01');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal for adding a new checklist file
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileDepartment, setNewFileDepartment] = useState('Plant & Operation');
  const [newFileScope, setNewFileScope] = useState('');

  // Selected file reference
  const currentFile = useMemo(() => {
    return checklistFiles.find(f => f.id === selectedFileId) || checklistFiles[0];
  }, [checklistFiles, selectedFileId]);

  // Filtered Checklist items inside the selected file
  const filteredQuestions = useMemo(() => {
    if (!currentFile) return [];
    return currentFile.items.filter(item => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchQ = item.pertanyaan.toLowerCase().includes(q);
        const matchCat = item.kategori.toLowerCase().includes(q);
        const matchSop = item.referensiSop.toLowerCase().includes(q);
        const matchNote = item.catatanAuditor.toLowerCase().includes(q);
        if (!matchQ && !matchCat && !matchSop && !matchNote) return false;
      }
      // Status filter
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      return true;
    });
  }, [currentFile, searchQuery, filterStatus]);

  // Toggle question status (PASS / FAIL / NA)
  const handleUpdateItemStatus = (questionId: string, newStatus: 'PASS' | 'FAIL' | 'UNCHECKED' | 'NA') => {
    setChecklistFiles(prev => prev.map(file => {
      if (file.id !== selectedFileId) return file;
      const updatedItems = file.items.map(q => {
        if (q.id === questionId) {
          return { ...q, status: newStatus };
        }
        return q;
      });
      return { ...file, items: updatedItems };
    }));
    onToast(`Status checklist berhasil diperbarui menjadi ${newStatus}`, 'info');
  };

  // Update auditor remarks for a question
  const handleUpdateItemNotes = (questionId: string, text: string) => {
    setChecklistFiles(prev => prev.map(file => {
      if (file.id !== selectedFileId) return file;
      const updatedItems = file.items.map(q => {
        if (q.id === questionId) {
          return { ...q, catatanAuditor: text };
        }
        return q;
      });
      return { ...file, items: updatedItems };
    }));
  };

  // Create new Audit Checklist File
  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) {
      onToast('Masukkan nama file lembar kerja checklist', 'warning');
      return;
    }

    const formattedName = newFileName.toUpperCase().endsWith('.XLSX') || newFileName.toUpperCase().endsWith('.PDF') 
      ? newFileName 
      : `${newFileName}.xlsx`;

    const newFile: AuditFileChecklist = {
      id: `file-${Date.now()}`,
      fileName: formattedName,
      fileSize: '1.2 MB',
      fileType: formattedName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'xlsx',
      scope: newFileScope || 'Audit Lapangan General',
      department: newFileDepartment,
      totalQuestions: 3,
      lastUpdated: 'Hari ini',
      status: 'Siap Digunakan',
      author: 'Lead Auditor',
      items: [
        {
          id: `new-q-1`,
          no: 1,
          kategori: 'Verifikasi Fisik & Dokumen',
          pertanyaan: 'Apakah dokumen kelengkapan operasional tersedia dan diperbarui sesuai standar?',
          referensiSop: 'SOP-GEN-001',
          bobotRisiko: 'MAJOR',
          status: 'UNCHECKED',
          catatanAuditor: 'Belum dilakukan pengujian di lapangan.',
        },
        {
          id: `new-q-2`,
          no: 2,
          kategori: 'Kepatuhan Prosedur K3',
          pertanyaan: 'Apakah prosedur aspek keselamatan kerja telah disosialisasikan secara rutin?',
          referensiSop: 'SOP-SHE-010',
          bobotRisiko: 'MINOR',
          status: 'UNCHECKED',
          catatanAuditor: 'Memerlukan pengecekan absensi daftar hadir safety talk.',
        },
        {
          id: `new-q-3`,
          no: 3,
          kategori: 'Akurasi Laporan Logbook',
          pertanyaan: 'Apakah data sampel pencatatan di lapangan akurat tanpa indikasi perbedaan data?',
          referensiSop: 'SOP-LOG-005',
          bobotRisiko: 'MAJOR',
          status: 'UNCHECKED',
          catatanAuditor: 'Sampel akan ditarik secara acak.',
        }
      ]
    };

    setChecklistFiles(prev => [newFile, ...prev]);
    setSelectedFileId(newFile.id);
    setIsAddFileModalOpen(false);
    setNewFileName('');
    setNewFileScope('');
    onToast(`File checklist baru '${formattedName}' berhasil ditambahkan!`, 'success');
  };

  // Add a new question checklist item to current selected file
  const handleAddNewQuestion = () => {
    if (!currentFile) return;
    const newQId = `q-${Date.now()}`;
    const newNo = currentFile.items.length + 1;
    const newItem: ChecklistItem = {
      id: newQId,
      no: newNo,
      kategori: 'Item Pertanyaan Tambahan',
      pertanyaan: 'Tuliskan poin pertanyaan audit baru yang akan diverifikasi pada pelaksanaan audit...',
      referensiSop: 'SOP-AUDIT-001',
      bobotRisiko: 'MAJOR',
      status: 'UNCHECKED',
      catatanAuditor: 'Catatan hasil pengujian auditor...',
    };

    setChecklistFiles(prev => prev.map(file => {
      if (file.id !== currentFile.id) return file;
      return {
        ...file,
        totalQuestions: file.totalQuestions + 1,
        items: [...file.items, newItem]
      };
    }));

    onToast('Poin pertanyaan checklist audit berhasil ditambahkan!', 'success');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold tracking-wide">
              <Lock className="w-3.5 h-3.5" /> Restriksi Akses Internal Auditor
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Lembar Kerja Auditor (KKA & Checklist Audit)
            </h1>
            <p className="text-xs md:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              Berkas daftar file lembar kerja audit berisi item pertanyaaan & checklist pengujian kontrol yang ditanyakan secara terstruktur pada saat pelaksanaan audit di lapangan.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List of Audit Checklist Files (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Daftar Berkas File Checklist ({checklistFiles.length})
                </h3>
              </div>
            </div>

            {/* List of Files */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {checklistFiles.map((file, idx) => {
                const isSelected = file.id === selectedFileId;
                const passCount = file.items.filter(i => i.status === 'PASS').length;
                const failCount = file.items.filter(i => i.status === 'FAIL').length;
                const total = file.items.length;

                return (
                  <div
                    key={`wp-file-${file.id || idx}-${idx}`}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected 
                        ? 'bg-indigo-50/80 border-indigo-400 shadow-md ring-1 ring-indigo-300' 
                        : 'bg-slate-50/70 border-slate-200/90 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl flex-shrink-0 ${
                          file.fileType === 'xlsx' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900 leading-snug break-words" title={file.fileName}>
                            {file.fileName}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                            {file.department} • {file.fileSize}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                        file.status === 'Dalam Audit' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : file.status === 'Selesai Insepsi'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {file.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-2 font-medium line-clamp-1">
                      Scope: {file.scope}
                    </p>

                    {/* Progress Bar & Items count */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-indigo-600" />
                        {total} Pertanyaan Checklist
                      </span>

                      <div className="flex items-center gap-2 font-extrabold">
                        {passCount > 0 && <span className="text-emerald-600">{passCount} Pass</span>}
                        {failCount > 0 && <span className="text-rose-600">{failCount} Fail</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active File Inspection & Checklist Questions Table (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            {/* Active File Metadata Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
                  <FileCheck className="w-4 h-4" />
                  <span>Berkas Aktif Ref: {currentFile.id.toUpperCase()}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 font-mono">Updated: {currentFile.lastUpdated}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {currentFile.fileName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Departemen: <strong className="text-slate-800">{currentFile.department}</strong> | Scope: <strong className="text-slate-800">{currentFile.scope}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleAddNewQuestion}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Pertanyaan
                </button>
                <button
                  onClick={() => onToast(`Mengunduh file template ${currentFile.fileName}`, 'info')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </button>
              </div>
            </div>

            {/* Filter & Search Bar for Questions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari poin pertanyaan, kategori, SOP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Status Hasil</option>
                  <option value="PASS">PASS (Sesuai)</option>
                  <option value="FAIL">FAIL (Tidak Sesuai)</option>
                  <option value="UNCHECKED">Belum Diperiksa</option>
                  <option value="NA">N/A (Not Applicable)</option>
                </select>
              </div>
            </div>

            {/* Checklist Questions Accordion / List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  Daftar Pertanyaan Checklist Audit ({filteredQuestions.length} Items)
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  Klik tombol status [Pass / Fail] saat pelaksanaan audit
                </span>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Tidak ada pertanyaan checklist yang cocok dengan filter</p>
                  <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau reset filter status.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredQuestions.map((q, idx) => {
                    const statusBadgeClass = 
                      q.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : q.status === 'FAIL'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : q.status === 'NA'
                        ? 'bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200';

                    return (
                      <div 
                        key={`wp-q-${q.id || idx}-${idx}`} 
                        className={`p-4 rounded-2xl border transition-all ${
                          q.status === 'FAIL'
                            ? 'bg-rose-50/30 border-rose-200'
                            : q.status === 'PASS'
                            ? 'bg-emerald-50/20 border-emerald-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {/* Question Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-start gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              {q.no}
                            </span>
                            <div>
                              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mb-1">
                                {q.kategori}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 leading-relaxed">
                                {q.pertanyaan}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              q.bobotRisiko === 'MAJOR' 
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {q.bobotRisiko}
                            </span>

                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                              {q.status === 'PASS' ? 'PASS (Sesuai)' : q.status === 'FAIL' ? 'FAIL (Temuan)' : q.status === 'NA' ? 'N/A' : 'Belum Ditinjau'}
                            </span>
                          </div>
                        </div>

                        {/* SOP Reference & Action Control Bar */}
                        <div className="mt-2.5 pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Ref SOP: <strong className="text-slate-800">{q.referensiSop}</strong></span>
                            {q.metodePengujian && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-semibold">
                                Metode: <strong>{q.metodePengujian}</strong>
                              </span>
                            )}
                          </div>

                          {/* Interactive Execution Status Selector */}
                          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              onClick={() => handleUpdateItemStatus(q.id, 'PASS')}
                              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                                q.status === 'PASS' 
                                  ? 'bg-emerald-600 text-white shadow-sm' 
                                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                            </button>

                            <button
                              onClick={() => handleUpdateItemStatus(q.id, 'FAIL')}
                              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                                q.status === 'FAIL' 
                                  ? 'bg-rose-600 text-white shadow-sm' 
                                  : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" /> FAIL
                            </button>

                            <button
                              onClick={() => handleUpdateItemStatus(q.id, 'NA')}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                                q.status === 'NA' 
                                  ? 'bg-slate-700 text-white shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              N/A
                            </button>
                          </div>
                        </div>

                        {/* Auditor Remarks Input */}
                        <div className="mt-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Catatan & Hasil Observasi Auditor:
                          </label>
                          <textarea
                            rows={2}
                            value={q.catatanAuditor}
                            onChange={(e) => handleUpdateItemNotes(q.id, e.target.value)}
                            placeholder="Tuliskan detail temuan atau bukti pendukung pengujian..."
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          />
                        </div>

                        {/* Optional Evidence link */}
                        {q.buktiLink && (
                          <div className="mt-2 text-[11px] flex items-center gap-1.5 text-sky-700 font-medium">
                            <Link2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>Link Lampiran Bukti:</span>
                            <a href={`https://${q.buktiLink}`} target="_blank" rel="noreferrer" className="underline font-bold hover:text-sky-900 truncate max-w-md">
                              {q.buktiLink}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Semua perubahan catatan & hasil checklist otomatis tersimpan ke draft.
              </span>

              <button
                onClick={() => onToast(`Draft Lembar Kerja Checklist '${currentFile.fileName}' Berhasil Disimpan`, 'success')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Simpan Hasil Audit Checklist
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Modal Add New Checklist File */}
      {isAddFileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <UploadCloud className="w-5 h-5" />
                <h3 className="text-sm font-black text-slate-900">Upload / Buat Berkas Checklist Audit</h3>
              </div>
              <button
                onClick={() => setIsAddFileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewFile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama File Checklist (.xlsx / .pdf):
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CHECKLIST_AUDIT_INFRASTRUKTUR_IT.xlsx"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Departemen / Penanggung Jawab:
                </label>
                <select
                  value={newFileDepartment}
                  onChange={(e) => setNewFileDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                >
                  <option value="Plant & Operation">Plant & Operation</option>
                  <option value="HSE / K3LH">HSE / K3LH</option>
                  <option value="Supply Chain & Warehouse">Supply Chain & Warehouse</option>
                  <option value="Finance & Accounting">Finance & Accounting</option>
                  <option value="IT & Cyber Security">IT & Cyber Security</option>
                  <option value="Human Capital & General Affair">Human Capital & General Affair</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Scope / Area Pengujian Audit:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inspeksi Server Room & Back Up Data Site"
                  value={newFileScope}
                  onChange={(e) => setNewFileScope(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFileModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition shadow-md cursor-pointer"
                >
                  Buat Berkas
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </motion.div>
  );
}
