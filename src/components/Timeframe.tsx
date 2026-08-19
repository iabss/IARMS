import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Database, 
  TrendingUp, 
  Plus,
  Edit3,
  Trash2,
  Save,
  RotateCcw,
  BarChart3,
  Check,
  X,
  Lock,
  Globe,
  Sliders,
  Award
} from 'lucide-react';

interface TimeframeProps {
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  key?: string;
}

export interface StageItem {
  id: string;
  no: number;
  title: string;
  progress: number; // 0 - 100
  targetDate?: string;
  pic?: string;
  description?: string;
}

export interface WeeklyMilestone {
  id: string;
  weekLabel: string;
  targetPercent: number;
  actualPercent: number;
  notes: string;
  status: 'Selesai' | 'Sesuai Target' | 'Terlambat' | 'Rencana';
}

const STORAGE_KEY_STAGES = 'iams_timeframe_stages_v3';
const STORAGE_KEY_MILESTONES = 'iams_timeframe_milestones_v3';

export default function Timeframe({ onToast }: TimeframeProps) {
  // Initial 6 stages as requested by user
  const initialStages: StageItem[] = [
    {
      id: 'stg-1',
      no: 1,
      title: 'Memasukkan semua data AFS operasional',
      progress: 100,
      targetDate: 'W4 Juli (Jumat, 24 Juli 2026)',
      pic: 'Tim Database Audit',
      description: 'Penginputan 100% data mentah AFS operasional ke dalam sistem database IAMS.'
    },
    {
      id: 'stg-2',
      no: 2,
      title: 'Membuat tren achievement closing perbulan untuk setiap project audit, dan PIC departemen',
      progress: 10,
      targetDate: 'W1 Agustus (Jumat, 31 Juli 2026)',
      pic: 'Frontend & Analytics Developer',
      description: 'Visualisasi grafik tren closing mingguan & bulanan terpilah per lokasi site audit dan PIC departemen.'
    },
    {
      id: 'stg-3',
      no: 3,
      title: 'Membuat mekanisme input dan approval control cek point temuan audit',
      progress: 0,
      targetDate: 'W2 Agustus (Jumat, 7 Agustus 2026)',
      pic: 'Lead Auditor & System Analyst',
      description: 'Alur persetujuan bertingkat (Auditor -> Manager -> Lead PIC) untuk validasi KKA dan bukti tindak lanjut.'
    },
    {
      id: 'stg-4',
      no: 4,
      title: 'Membuat database dan domain agar bisa diakses online publik, dengan mekanisme login',
      progress: 0,
      targetDate: 'W3 Agustus (Jumat, 14 Agustus 2026)',
      pic: 'DevOps & Cloud Engineer',
      description: 'Provisioning cloud database, pengadaan SSL domain publik, dan proteksi portal eksternal.'
    },
    {
      id: 'stg-5',
      no: 5,
      title: 'Menggabungkan system publik ini dengan system lembar kerja internal audit',
      progress: 0,
      targetDate: 'W4 Agustus (Jumat, 21 Agustus 2026)',
      pic: 'Fullstack Developer',
      description: 'Sinkronisasi data dua arah antara portal eksekutif publik dan lembar kerja audit internal (KKA).'
    },
    {
      id: 'stg-6',
      no: 6,
      title: 'Membuat mekanisme login dengan user yang terdaftar dan tidak terdaftar untuk memisahkan aksesability',
      progress: 0,
      targetDate: 'W5 Agustus (Jumat, 28 Agustus 2026)',
      pic: 'Security & Auth Specialist',
      description: 'Role-based access control (RBAC) membedakan pembaca publik, PIC site terdaftar, dan auditor internal.'
    }
  ];

  // Initial weekly milestone data
  const initialWeeklyMilestones: WeeklyMilestone[] = [
    { id: 'wm-1', weekLabel: 'Minggu 1 (W4 Juli, 24 Jul)', targetPercent: 15, actualPercent: 16.7, status: 'Selesai', notes: 'Data AFS operasional 100% terinput' },
    { id: 'wm-2', weekLabel: 'Minggu 2 (W1 Agt, 31 Jul)', targetPercent: 20, actualPercent: 18.3, status: 'Sesuai Target', notes: 'Persiapan struktur widget tren per project & PIC' },
    { id: 'wm-3', weekLabel: 'Minggu 3 (W2 Agt, 7 Ags)', targetPercent: 30, actualPercent: 0, status: 'Rencana', notes: 'Pengembangan modal approval control cek point' },
    { id: 'wm-4', weekLabel: 'Minggu 4 (W3 Agt, 14 Ags)', targetPercent: 45, actualPercent: 0, status: 'Rencana', notes: 'Setup cloud database server & SSL domain' },
    { id: 'wm-5', weekLabel: 'Minggu 5 (W4 Agt, 21 Ags)', targetPercent: 60, actualPercent: 0, status: 'Rencana', notes: 'Integrasi lembar kerja KKA dengan portal' },
    { id: 'wm-6', weekLabel: 'Minggu 6 (W5 Agt, 28 Ags)', targetPercent: 80, actualPercent: 0, status: 'Rencana', notes: 'Pengujian autentikasi user terdaftar vs publik' },
    { id: 'wm-7', weekLabel: 'Minggu 7 (W1 Sep, 4 Sep)', targetPercent: 90, actualPercent: 0, status: 'Rencana', notes: 'Uji coba menyeluruh & UAT user' },
    { id: 'wm-8', weekLabel: 'Minggu 8 (W2 Sep, 11 Sep)', targetPercent: 100, actualPercent: 0, status: 'Rencana', notes: 'Peluncuran resmi versi publik IAMS' }
  ];

  // State initialized with localStorage persistence
  const [stages, setStages] = useState<StageItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Failed to load stages from localStorage:', err);
    }
    return initialStages;
  });

  const [weeklyMilestones, setWeeklyMilestones] = useState<WeeklyMilestone[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MILESTONES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Failed to load milestones from localStorage:', err);
    }
    return initialWeeklyMilestones;
  });

  // Automatically sync to localStorage whenever stages or milestones change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STAGES, JSON.stringify(stages));
    } catch (err) {
      console.error('Failed to save stages to localStorage:', err);
    }
  }, [stages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(weeklyMilestones));
    } catch (err) {
      console.error('Failed to save milestones to localStorage:', err);
    }
  }, [weeklyMilestones]);

  // Modals state
  const [editingStage, setEditingStage] = useState<StageItem | null>(null);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageProgress, setNewStageProgress] = useState<number>(0);
  const [newStagePic, setNewStagePic] = useState('');
  const [newStageTarget, setNewStageTarget] = useState('');

  const [editingMilestone, setEditingMilestone] = useState<WeeklyMilestone | null>(null);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newWmLabel, setNewWmLabel] = useState('');
  const [newWmTarget, setNewWmTarget] = useState<number>(0);
  const [newWmActual, setNewWmActual] = useState<number>(0);
  const [newWmNotes, setNewWmNotes] = useState('');

  // Calculations
  const averageAchievement = stages.length > 0 
    ? (stages.reduce((sum, s) => sum + s.progress, 0) / stages.length) 
    : 0;

  const completedStagesCount = stages.filter(s => s.progress === 100).length;
  const inProgressStagesCount = stages.filter(s => s.progress > 0 && s.progress < 100).length;
  const plannedStagesCount = stages.filter(s => s.progress === 0).length;

  const avgWeeklyTarget = weeklyMilestones.length > 0
    ? (weeklyMilestones.reduce((sum, w) => sum + w.targetPercent, 0) / weeklyMilestones.length)
    : 0;

  const avgWeeklyActual = weeklyMilestones.length > 0
    ? (weeklyMilestones.reduce((sum, w) => sum + w.actualPercent, 0) / weeklyMilestones.length)
    : 0;

  // Handlers for Stage edits
  const handleUpdateStageProgress = (id: string, newProgress: number) => {
    const clampedProgress = Math.min(100, Math.max(0, isNaN(newProgress) ? 0 : newProgress));
    setStages(prev => prev.map(s => s.id === id ? { ...s, progress: clampedProgress } : s));
  };

  const handleSaveEditStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage) return;
    setStages(prev => prev.map(s => s.id === editingStage.id ? editingStage : s));
    setEditingStage(null);
    onToast('Detail tahapan & achievement berhasil disimpan dan tersimpan otomatis', 'success');
  };

  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageTitle.trim()) {
      onToast('Judul tahapan wajib diisi', 'warning');
      return;
    }
    const newStageObj: StageItem = {
      id: `stg-${Date.now()}`,
      no: stages.length + 1,
      title: newStageTitle.trim(),
      progress: Math.min(100, Math.max(0, Number(newStageProgress) || 0)),
      pic: newStagePic || 'Tim Developer',
      targetDate: newStageTarget || `Minggu ${stages.length + 1}, 2026`,
      description: 'Tahapan kustom tambahan.'
    };
    setStages(prev => [...prev, newStageObj]);
    setNewStageTitle('');
    setNewStageProgress(0);
    setNewStagePic('');
    setNewStageTarget('');
    setIsAddStageOpen(false);
    onToast('Tahapan pengembangan baru berhasil ditambahkan dan tersimpan', 'success');
  };

  const handleDeleteStage = (id: string) => {
    setStages(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, no: idx + 1 })));
    onToast('Tahapan berhasil dihapus', 'info');
  };

  // Handlers for Milestone edits
  const handleSaveMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    setWeeklyMilestones(prev => prev.map(m => m.id === editingMilestone.id ? editingMilestone : m));
    setEditingMilestone(null);
    onToast('Pencapaian milestone mingguan berhasil diperbarui dan tersimpan', 'success');
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWmLabel.trim()) {
      onToast('Label minggu wajib diisi', 'warning');
      return;
    }
    const actualVal = Math.min(100, Math.max(0, Number(newWmActual) || 0));
    const targetVal = Math.min(100, Math.max(0, Number(newWmTarget) || 0));
    
    let statusVal: WeeklyMilestone['status'] = 'Rencana';
    if (actualVal >= 100) statusVal = 'Selesai';
    else if (actualVal >= targetVal && actualVal > 0) statusVal = 'Sesuai Target';
    else if (actualVal < targetVal && actualVal > 0) statusVal = 'Terlambat';

    const newWmObj: WeeklyMilestone = {
      id: `wm-${Date.now()}`,
      weekLabel: newWmLabel.trim(),
      targetPercent: targetVal,
      actualPercent: actualVal,
      notes: newWmNotes || '-',
      status: statusVal
    };
    setWeeklyMilestones(prev => [...prev, newWmObj]);
    setNewWmLabel('');
    setNewWmTarget(0);
    setNewWmActual(0);
    setNewWmNotes('');
    setIsAddMilestoneOpen(false);
    onToast('Milestone mingguan baru berhasil ditambahkan dan tersimpan', 'success');
  };

  const handleDeleteMilestone = (id: string) => {
    setWeeklyMilestones(prev => prev.filter(m => m.id !== id));
    onToast('Milestone mingguan berhasil dihapus', 'info');
  };

  const handleResetToDefault = () => {
    setStages(initialStages);
    setWeeklyMilestones(initialWeeklyMilestones);
    try {
      localStorage.removeItem(STORAGE_KEY_STAGES);
      localStorage.removeItem(STORAGE_KEY_MILESTONES);
    } catch (e) {
      console.error(e);
    }
    onToast('Semua data timeframe dikembalikan ke standar awal', 'info');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Timeframe Tahapan Development
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Monitoring pencapaian per tahapan pengembangan sistem IAMS serta tracking milestone mingguan yang disesuaikan secara dinamis.
            </p>
          </div>

          {/* Average Achievement in Header */}
          <div className="flex-shrink-0 bg-white/10 p-4 sm:p-5 rounded-2xl border border-white/15 backdrop-blur-md min-w-[260px] space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" /> Achievement
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {averageAchievement.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-white/10">
              <div 
                className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, averageAchievement)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>



      {/* Main Section 1: Daftar Tahapan Pengembangan (Stages List with editable progress) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Daftar Tahapan Pengembangan (Tahap 1 - {stages.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Geser slider atau masukkan angka langsung untuk memperbarui status pencapaian % masing-masing tahap.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200">
              Avg Achievement: {averageAchievement.toFixed(2)}%
            </span>
            <button
              onClick={() => setIsAddStageOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 border border-indigo-500 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Rencana Baru
            </button>
          </div>
        </div>

        {/* Stages Grid List */}
        <div className="space-y-4">
          {stages.map((stg, idx) => {
            const isFinished = stg.progress === 100;
            const isInProgress = stg.progress > 0 && stg.progress < 100;

            return (
              <div 
                key={`tf-stg-${stg.id || idx}-${idx}`}
                className={`p-4 sm:p-5 rounded-xl border transition-all ${
                  isFinished 
                    ? 'bg-emerald-50/40 border-emerald-200/80' 
                    : isInProgress
                    ? 'bg-amber-50/40 border-amber-200/80 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left Info */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 shadow-xs ${
                      isFinished
                        ? 'bg-emerald-600 text-white'
                        : isInProgress
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      {stg.no}
                    </span>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                          {stg.title}
                        </h3>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase border ${
                          isFinished 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                            : isInProgress
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}>
                          {isFinished ? 'ACHIEVE 100%' : isInProgress ? `BERJALAN (${stg.progress}%)` : '0% - RENCANA'}
                        </span>
                      </div>

                      {stg.description && (
                        <p className="text-xs text-slate-600">
                          {stg.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 font-medium">
                        <span>Target: <strong className="text-slate-800">{stg.targetDate || '-'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Input Progress Controls */}
                  <div className="lg:w-72 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Pencapaian (%):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stg.progress}
                          onChange={(e) => handleUpdateStageProgress(stg.id, Number(e.target.value))}
                          className="w-16 px-2 py-0.5 text-right font-black text-slate-900 border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-slate-50"
                        />
                        <span className="font-bold text-slate-600">%</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={stg.progress}
                      onChange={(e) => handleUpdateStageProgress(stg.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <button
                        onClick={() => setEditingStage(stg)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> Edit Detail
                      </button>

                      {stages.length > 1 && (
                        <button
                          onClick={() => handleDeleteStage(stg.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Section 2: Milestone Achievement Per Week (Pelacakan Mingguan Input Manual) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-600" />
              Milestone Achievement per Week (Input Manual)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian progress mingguan dengan nilai target vs realisasi aktual yang di-input manual per pekan.
            </p>
          </div>

          <button
            onClick={() => setIsAddMilestoneOpen(true)}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> + Tambah Minggu Baru
          </button>
        </div>

        {/* Visual Comparison Bar List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
          {weeklyMilestones.map((wm, idx) => {
            const isCompleted = wm.actualPercent >= 100;
            const isOnTrack = wm.actualPercent >= wm.targetPercent && wm.actualPercent > 0;
            const isBehind = wm.actualPercent < wm.targetPercent && wm.actualPercent > 0;

            return (
              <div 
                key={`tf-wm-${wm.id || idx}-${idx}`}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-sky-300 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">{wm.weekLabel}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isOnTrack
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : isBehind
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      {wm.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingMilestone(wm)}
                      className="p-1 text-slate-400 hover:text-sky-600 rounded transition"
                      title="Edit Milestone"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMilestone(wm.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bars comparison */}
                <div className="space-y-2">
                  {/* Target Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-0.5">
                      <span>Target:</span>
                      <span>{wm.targetPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-slate-400 h-full rounded-full"
                        style={{ width: `${Math.min(100, wm.targetPercent)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Actual Realisasi Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-0.5">
                      <span className="text-slate-700">Realisasi (Input):</span>
                      <span className={wm.actualPercent >= wm.targetPercent ? 'text-emerald-600 font-extrabold' : 'text-slate-900 font-extrabold'}>
                        {wm.actualPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300/60">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          wm.actualPercent >= wm.targetPercent
                            ? 'bg-emerald-500'
                            : wm.actualPercent > 0
                            ? 'bg-amber-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${Math.min(100, wm.actualPercent)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {wm.notes && (
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-medium truncate">
                    Catatan: {wm.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Stage Modal */}
      <AnimatePresence>
        {editingStage && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600" /> Edit Detail Tahapan {editingStage.no}
                </h3>
                <button 
                  onClick={() => setEditingStage(null)} 
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditStage} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Tahapan</label>
                  <input
                    type="text"
                    value={editingStage.title}
                    onChange={(e) => setEditingStage({ ...editingStage, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Progress Pencapaian (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingStage.progress}
                    onChange={(e) => setEditingStage({ ...editingStage, progress: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIC / Person In Charge</label>
                  <input
                    type="text"
                    value={editingStage.pic || ''}
                    onChange={(e) => setEditingStage({ ...editingStage, pic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Waktu</label>
                  <input
                    type="text"
                    value={editingStage.targetDate || ''}
                    onChange={(e) => setEditingStage({ ...editingStage, targetDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deskripsi Tambahan</label>
                  <textarea
                    rows={2}
                    value={editingStage.description || ''}
                    onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStage(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Stage Modal */}
      <AnimatePresence>
        {isAddStageOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Tambah Tahapan Development Baru
                </h3>
                <button 
                  onClick={() => setIsAddStageOpen(false)} 
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddStage} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul / Nama Tahapan *</label>
                  <input
                    type="text"
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                    placeholder="misal: Integrasi Single Sign-On SSO..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Progress Pencapaian Awal (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newStageProgress}
                    onChange={(e) => setNewStageProgress(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIC (Penanggung Jawab)</label>
                  <input
                    type="text"
                    value={newStagePic}
                    onChange={(e) => setNewStagePic(e.target.value)}
                    placeholder="misal: Tim Security / Lead Developer"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Waktu Execution</label>
                  <input
                    type="text"
                    value={newStageTarget}
                    onChange={(e) => setNewStageTarget(e.target.value)}
                    placeholder="misal: Minggu 3, Jul 2026"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddStageOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Tambah Tahapan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Weekly Milestone Modal */}
      <AnimatePresence>
        {editingMilestone && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-sky-600" /> Edit Milestone {editingMilestone.weekLabel}
                </h3>
                <button 
                  onClick={() => setEditingMilestone(null)} 
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMilestone} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Label Pekan / Minggu</label>
                  <input
                    type="text"
                    value={editingMilestone.weekLabel}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, weekLabel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingMilestone.targetPercent}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, targetPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Realisasi Aktual (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editingMilestone.actualPercent}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, actualPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-black text-emerald-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Minggu Ini</label>
                  <select
                    value={editingMilestone.status}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Selesai">Selesai (Achieved)</option>
                    <option value="Sesuai Target">Sesuai Target</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Rencana">Rencana</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan / Progress Highlight</label>
                  <textarea
                    rows={2}
                    value={editingMilestone.notes}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingMilestone(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Weekly Milestone Modal */}
      <AnimatePresence>
        {isAddMilestoneOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-sky-600" /> Input Milestone Mingguan Baru
                </h3>
                <button 
                  onClick={() => setIsAddMilestoneOpen(false)} 
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMilestone} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Label Pekan *</label>
                  <input
                    type="text"
                    value={newWmLabel}
                    onChange={(e) => setNewWmLabel(e.target.value)}
                    placeholder={`misal: Minggu ${weeklyMilestones.length + 1}`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newWmTarget}
                      onChange={(e) => setNewWmTarget(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Realisasi (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={newWmActual}
                      onChange={(e) => setNewWmActual(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-black text-emerald-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan / Progress Highlight</label>
                  <textarea
                    rows={2}
                    value={newWmNotes}
                    onChange={(e) => setNewWmNotes(e.target.value)}
                    placeholder="Catatan hasil perbaikan atau kendala..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddMilestoneOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Tambah Milestone
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
