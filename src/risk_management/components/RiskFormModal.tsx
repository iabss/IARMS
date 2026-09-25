import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  HelpCircle,
  MapPin,
  Building2,
  DollarSign,
  Table,
} from 'lucide-react';
import {
  RiskItem,
  SiteOption,
  SITE_OPTIONS,
  RiskCategory,
  RISK_CATEGORIES,
  Department,
  DEPARTMENTS,
  FINANCIAL_IMPACT_RANGES,
  RiskStatus,
  ControlEffectiveness,
  ActionItem,
} from '../types/risk';
import {
  calculateRiskLevel,
  getRiskLevelConfig,
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
} from '../utils/riskCalculations';
import { ImpactCriteriaPicker } from './ImpactCriteriaPicker';
import { MasterRiskLevelModal } from './MasterRiskLevelModal';

interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (riskData: Omit<RiskItem, 'id'>, existingId?: string) => void;
  editingRisk: RiskItem | null;
  nextCodeNumber: number;
}

export const RiskFormModal: React.FC<RiskFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRisk,
  nextCodeNumber,
}) => {
  // Form State
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [consequences, setConsequences] = useState('');
  const [site, setSite] = useState<SiteOption>('MHU');
  const [category, setCategory] = useState<RiskCategory>('Operational');
  const [department, setDepartment] = useState<Department>('Supply Management');
  const [owner, setOwner] = useState('');
  const [financialImpactEstimate, setFinancialImpactEstimate] = useState<string>('1 - 50 Juta');
  const [velocity, setVelocity] = useState<'Rapid' | 'Moderate' | 'Slow'>('Moderate');

  // Inherent Risk
  const [inherentLikelihood, setInherentLikelihood] = useState<number>(3);
  const [inherentImpact, setInherentImpact] = useState<number>(3);
  const [inherentWorstCaseScenario, setInherentWorstCaseScenario] = useState<string>('');

  // Controls & Mitigation
  const [existingControls, setExistingControls] = useState('');
  const [controlEffectiveness, setControlEffectiveness] = useState<ControlEffectiveness>('Adequate');
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [mitigationProgress, setMitigationProgress] = useState<number>(50);

  // Residual Risk
  const [residualLikelihood, setResidualLikelihood] = useState<number>(2);
  const [residualImpact, setResidualImpact] = useState<number>(2);

  // Status & Timing
  const [status, setStatus] = useState<RiskStatus>('Mitigating');
  const [targetDate, setTargetDate] = useState('2026-11-30');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');

  // Master Risk Level Matrix Modal State
  const [isFullMatrixModalOpen, setIsFullMatrixModalOpen] = useState(false);
  const [matrixTarget, setMatrixTarget] = useState<'inherent' | 'residual'>('inherent');

  // Prepopulate when editing
  useEffect(() => {
    if (editingRisk) {
      setCode(editingRisk.code);
      setTitle(editingRisk.title);
      setDescription(editingRisk.description);
      setRootCause(editingRisk.rootCause || '');
      setConsequences(editingRisk.consequences || '');
      setSite(editingRisk.site || 'MHU');
      setCategory(editingRisk.category || 'Operational');
      setDepartment(editingRisk.department || 'Supply Management');
      setOwner(editingRisk.owner);
      setFinancialImpactEstimate(editingRisk.financialImpactEstimate || '1 - 50 Juta');
      setVelocity(editingRisk.velocity || 'Moderate');
      setInherentLikelihood(editingRisk.inherentLikelihood);
      setInherentImpact(editingRisk.inherentImpact);
      setInherentWorstCaseScenario(editingRisk.inherentWorstCaseScenario || '');
      setExistingControls(editingRisk.existingControls);
      setControlEffectiveness(editingRisk.controlEffectiveness);
      setMitigationPlan(editingRisk.mitigationPlan);
      setMitigationProgress(editingRisk.mitigationProgress);
      setResidualLikelihood(editingRisk.residualLikelihood);
      setResidualImpact(editingRisk.residualImpact);
      setStatus(editingRisk.status);
      setTargetDate(editingRisk.targetDate);
      setActionItems(editingRisk.actionItems || []);
    } else {
      // Default new risk
      setCode(`RSK-NEW-0${nextCodeNumber}`);
      setTitle('');
      setDescription('');
      setRootCause('');
      setConsequences('');
      setSite('MHU');
      setCategory('Operational');
      setDepartment('Supply Management');
      setOwner('');
      setFinancialImpactEstimate('1 - 50 Juta');
      setVelocity('Moderate');
      setInherentLikelihood(3);
      setInherentImpact(3);
      setInherentWorstCaseScenario('');
      setExistingControls('');
      setControlEffectiveness('Adequate');
      setMitigationPlan('');
      setMitigationProgress(20);
      setResidualLikelihood(2);
      setResidualImpact(2);
      setStatus('Open');
      setTargetDate('2026-12-31');
      setActionItems([]);
    }
  }, [editingRisk, nextCodeNumber, isOpen]);

  // Derived scores
  const inherentScore = inherentLikelihood * inherentImpact;
  const inherentLevel = calculateRiskLevel(inherentScore);
  const inherentCfg = getRiskLevelConfig(inherentLevel);

  const residualScore = residualLikelihood * residualImpact;
  const residualLevel = calculateRiskLevel(residualScore);
  const residualCfg = getRiskLevelConfig(residualLevel);

  const handleAddAction = () => {
    if (!newActionText.trim()) return;
    const item: ActionItem = {
      id: `act-temp-${Date.now()}`,
      action: newActionText.trim(),
      assignee: newActionAssignee.trim() || owner || 'Tim Pelaksana',
      dueDate: newActionDueDate || targetDate,
      completed: false,
      status: 'In Progress',
    };
    setActionItems([...actionItems, item]);
    setNewActionText('');
    setNewActionAssignee('');
    setNewActionDueDate('');
  };

  const handleRemoveAction = (id: string) => {
    setActionItems(actionItems.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Mohon isi Judul Risiko.');
      return;
    }

    const payload: Omit<RiskItem, 'id'> = {
      code: code || `RSK-GEN-0${nextCodeNumber}`,
      title: title.trim(),
      description: description.trim(),
      rootCause: rootCause.trim(),
      consequences: consequences.trim(),
      site,
      category,
      department,
      owner: owner.trim() || 'Tim Manajemen Risiko',
      inherentLikelihood,
      inherentImpact,
      inherentScore,
      inherentLevel,
      inherentWorstCaseScenario: inherentWorstCaseScenario.trim(),
      existingControls: existingControls.trim() || 'Standard Operating Procedure (SOP) divisi.',
      controlEffectiveness,
      mitigationPlan: mitigationPlan.trim() || 'Rencana perbaikan dan monitoring berkala.',
      mitigationProgress,
      residualLikelihood,
      residualImpact,
      residualScore,
      residualLevel,
      riskAppetiteStatus: residualScore <= 9 ? 'Within Appetite' : 'At Limit',
      status,
      financialImpactEstimate: financialImpactEstimate || '1 - 50 Juta',
      velocity,
      lastReviewDate: new Date().toISOString().split('T')[0],
      targetDate: targetDate || '2026-12-31',
      quarter: 'Q3 2026',
      actionItems,
    };

    onSave(payload, editingRisk?.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {editingRisk ? 'Perbarui Profil Risiko' : 'Tambah Identifikasi Risiko Baru'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standar ISO 31000: Penilaian kemungkinan (likelihood), dampak (impact), dan rencana mitigasi.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Basic Identifiers */}
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-200 pb-1.5">
              1. Identitas, Lokasi & Kepemilikan Risiko
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Risiko
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Pilihan Site */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500" />
                    Pilihan Site
                  </span>
                  <span className="text-[10px] text-rose-500 font-bold">*Wajib</span>
                </label>
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value as SiteOption)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                >
                  {SITE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Risiko */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Risiko
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RiskCategory)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {RISK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Departemen Penanggung Jawab */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departemen Penanggung Jawab
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul Risiko (Pernyataan Kejadian Tidak Diinginkan)
              </label>
              <input
                type="text"
                placeholder="Contoh: Gangguan Pasokan Bahan Baku Akibat Hambatan Pelabuhan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pemilik Risiko (Risk Owner)
                </label>
                <input
                  type="text"
                  placeholder="Nama & Jabatan PIC"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Estimasi Dampak Finansial Range */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimasi Dampak Finansial
                </label>
                <select
                  value={financialImpactEstimate}
                  onChange={(e) => setFinancialImpactEstimate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                >
                  {FINANCIAL_IMPACT_RANGES.map((rng) => (
                    <option key={rng} value={rng}>
                      {rng}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecepatan Risiko (Velocity)
                </label>
                <select
                  value={velocity}
                  onChange={(e) => setVelocity(e.target.value as 'Rapid' | 'Moderate' | 'Slow')}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Rapid">Cepat (Hitungan hari/minggu)</option>
                  <option value="Moderate">Moderat (1 - 3 bulan)</option>
                  <option value="Slow">Lambat (Jangka panjang / &gt; 3 bulan)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Naratif Risiko
              </label>
              <textarea
                rows={2}
                placeholder="Jelaskan konteks terjadinya risiko secara komprehensif..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Penyebab Akar (Root Cause)
                </label>
                <textarea
                  rows={2}
                  placeholder="Faktor internal/eksternal pemicu terjadinya risiko..."
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dampak & Konsekuensi
                </label>
                <textarea
                  rows={2}
                  placeholder="Dampak pada operasional, hukum, reputasi, atau laba..."
                  value={consequences}
                  onChange={(e) => setConsequences(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Inherent Risk Assessment */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                2. Penilaian Risiko Inheren (Sebelum Mitigasi)
              </h4>
              <div
                className={`text-xs px-3 py-1 rounded-lg font-bold border ${inherentCfg.badgeBg}`}
              >
                Skor Inheren: {inherentScore} ({inherentCfg.idLabel})
              </div>
            </div>

            {/* Pilihan Kriteria Sebelum Penetapan Impact */}
            <ImpactCriteriaPicker
              currentImpact={inherentImpact}
              onSelectImpact={(level) => setInherentImpact(level)}
              onOpenFullMatrixModal={() => {
                setMatrixTarget('inherent');
                setIsFullMatrixModalOpen(true);
              }}
              onApplyDescription={(text) => {
                setInherentWorstCaseScenario((prev) => (prev ? `${prev}\n• ${text}` : `• ${text}`));
              }}
              titlePrefix="Inheren"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Likelihood 1-5 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Kemungkinan Terjadi (Likelihood: 1-5)
                  </label>
                  <span className="font-bold text-rose-600 text-xs">
                    {inherentLikelihood} - {LIKELIHOOD_LABELS[inherentLikelihood]?.en}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={inherentLikelihood}
                  onChange={(e) => setInherentLikelihood(Number(e.target.value))}
                  className="w-full cursor-pointer accent-rose-600"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {LIKELIHOOD_LABELS[inherentLikelihood]?.title}: {LIKELIHOOD_LABELS[inherentLikelihood]?.desc}
                </p>
              </div>

              {/* Impact 1-5 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Tingkat Dampak (Impact: 1-5)
                  </label>
                  <span className="font-bold text-rose-600 text-xs">
                    {inherentImpact} - {IMPACT_LABELS[inherentImpact]?.en}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={inherentImpact}
                  onChange={(e) => setInherentImpact(Number(e.target.value))}
                  className="w-full cursor-pointer accent-rose-600"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {IMPACT_LABELS[inherentImpact]?.title}: {IMPACT_LABELS[inherentImpact]?.desc}
                </p>
              </div>
            </div>

            {/* Kolom Catatan / Skenario Terburuk Inherent */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Catatan / Skenario Terburuk Inherent</span>
                <span className="text-xs text-rose-600 font-medium">Sebelum Kontrol & Mitigasi Diterapkan</span>
              </label>
              <textarea
                rows={2}
                placeholder="Deskripsikan proyeksi skenario terburuk (worst-case scenario) jika risiko ini terjadi secara penuh tanpa adanya proteksi/pengendalian..."
                value={inherentWorstCaseScenario}
                onChange={(e) => setInherentWorstCaseScenario(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Section 3: Existing Controls & Mitigation Treatment */}
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-200 pb-1.5">
              3. Pengendalian & Rencana Mitigasi (Treatment)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pengendalian Internal yang Sudah Ada (Existing Controls)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SOP operasional, asuransi, backup server berkala"
                  value={existingControls}
                  onChange={(e) => setExistingControls(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Efektivitas Pengendalian
                </label>
                <select
                  value={controlEffectiveness}
                  onChange={(e) => setControlEffectiveness(e.target.value as ControlEffectiveness)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Strong">Kuat (Strong)</option>
                  <option value="Adequate">Memadai (Adequate)</option>
                  <option value="Weak">Lemah (Weak)</option>
                  <option value="Deficient">Tidak Efektif (Deficient)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rencana Mitigasi Risiko Tambahan (Action Treatment Plan)
              </label>
              <textarea
                rows={2}
                placeholder="Langkah terstruktur untuk menurunkan kemungkinan atau dampak risiko..."
                value={mitigationPlan}
                onChange={(e) => setMitigationPlan(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Progres Mitigasi ({mitigationProgress}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={mitigationProgress}
                  onChange={(e) => setMitigationProgress(Number(e.target.value))}
                  className="w-full cursor-pointer accent-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Penanganan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RiskStatus)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Open">Terbuka (Open)</option>
                  <option value="Mitigating">Dalam Proses Mitigasi</option>
                  <option value="Monitored">Dipantau Berkala (Monitored)</option>
                  <option value="Closed">Terkendali / Selesai (Closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Jatuh Tempo
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Residual Risk Target */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                4. Target Risiko Residual (Pasca Mitigasi Selesai)
              </h4>
              <div
                className={`text-xs px-3 py-1 rounded-lg font-bold border ${residualCfg.badgeBg}`}
              >
                Skor Residual: {residualScore} ({residualCfg.idLabel})
              </div>
            </div>

            {/* Pilihan Kriteria Sebelum Penetapan Residual Impact */}
            <ImpactCriteriaPicker
              currentImpact={residualImpact}
              onSelectImpact={(level) => setResidualImpact(level)}
              onOpenFullMatrixModal={() => {
                setMatrixTarget('residual');
                setIsFullMatrixModalOpen(true);
              }}
              titlePrefix="Residual"
              isResidual={true}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Residual Likelihood 1-5 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Target Kemungkinan Residual (1-5)
                  </label>
                  <span className="font-bold text-emerald-600 text-xs">
                    {residualLikelihood} - {LIKELIHOOD_LABELS[residualLikelihood]?.en}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={residualLikelihood}
                  onChange={(e) => setResidualLikelihood(Number(e.target.value))}
                  className="w-full cursor-pointer accent-emerald-600"
                />
              </div>

              {/* Residual Impact 1-5 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Target Dampak Residual (1-5)
                  </label>
                  <span className="font-bold text-emerald-600 text-xs">
                    {residualImpact} - {IMPACT_LABELS[residualImpact]?.en}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={residualImpact}
                  onChange={(e) => setResidualImpact(Number(e.target.value))}
                  className="w-full cursor-pointer accent-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Action Items List */}
          <div className="space-y-3">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-200 pb-1.5">
              5. Rincian Milestone / Action Plan
            </h4>

            {/* List existing */}
            <div className="space-y-2">
              {actionItems.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-semibold text-slate-800">
                    {act.action}
                  </span>
                  <div className="flex items-center space-x-3 text-xs text-slate-500">
                    <span>PIC: <strong className="text-slate-800">{act.assignee}</strong></span>
                    <span>Tenggat: {act.dueDate}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAction(act.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new action item inputs */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Rencana tindakan konkret baru..."
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Nama PIC"
                value={newActionAssignee}
                onChange={(e) => setNewActionAssignee(e.target.value)}
                className="w-full sm:w-36 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="date"
                value={newActionDueDate}
                onChange={(e) => setNewActionDueDate(e.target.value)}
                className="w-full sm:w-36 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAction}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition flex items-center justify-center space-x-1 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{editingRisk ? 'Simpan Perubahan' : 'Daftarkan Profil Risiko'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Master Risk Level Table Modal */}
      <MasterRiskLevelModal
        isOpen={isFullMatrixModalOpen}
        onClose={() => setIsFullMatrixModalOpen(false)}
        currentSelectedLevel={matrixTarget === 'inherent' ? inherentImpact : residualImpact}
        onSelectLevel={(level) => {
          if (matrixTarget === 'inherent') {
            setInherentImpact(level);
          } else {
            setResidualImpact(level);
          }
        }}
      />
    </div>
  );
};
