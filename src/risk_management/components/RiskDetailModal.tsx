import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Building2,
  User,
  Calendar,
  DollarSign,
  Zap,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
  Layers,
  MapPin,
  FileText,
  Table,
} from 'lucide-react';
import { RiskItem, ActionItem } from '../types/risk';
import {
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
  getRiskLevelConfig,
  getStatusConfig,
} from '../utils/riskCalculations';
import { getMasterRiskLevelRow } from '../data/masterRiskLevel';
import { MasterRiskLevelModal } from './MasterRiskLevelModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface RiskDetailModalProps {
  risk: RiskItem | null;
  onClose: () => void;
  onEdit: (risk: RiskItem) => void;
  onDelete?: (riskId: string) => void;
  onToggleActionItem: (riskId: string, actionId: string) => void;
}

export const RiskDetailModal: React.FC<RiskDetailModalProps> = ({
  risk,
  onClose,
  onEdit,
  onDelete,
  onToggleActionItem,
}) => {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isMasterMatrixOpen, setIsMasterMatrixOpen] = useState(false);

  if (!risk) return null;

  const inherentCfg = getRiskLevelConfig(risk.inherentLevel);
  const residualCfg = getRiskLevelConfig(risk.residualLevel);
  const statusCfg = getStatusConfig(risk.status);
  const inherentMasterRow = getMasterRiskLevelRow(risk.inherentImpact);
  const residualMasterRow = getMasterRiskLevelRow(risk.residualImpact);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 border border-slate-300">
                  {risk.code}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md text-rose-700 bg-rose-50 border border-rose-200 flex items-center">
                  <MapPin className="w-2.5 h-2.5 mr-1" />
                  {risk.site || 'MHU'}
                </span>
                <span className="text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded-md text-slate-600 bg-slate-100 border border-slate-200">
                  {risk.category}
                </span>
                <span
                  className={`text-[10px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-md border ${statusCfg.badge}`}
                >
                  {statusCfg.label}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                {risk.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onEdit(risk)}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition"
              title="Edit Profil Risiko"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Hapus Profil Risiko Ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata chips */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                Lokasi / Site
              </span>
              <span className="font-semibold text-slate-800 flex items-center mt-1">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                {risk.site || 'MHU'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                Departemen
              </span>
              <span className="font-semibold text-slate-800 flex items-center mt-1">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                {risk.department}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                Pemilik (Owner)
              </span>
              <span className="font-semibold text-slate-800 flex items-center mt-1">
                <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                {risk.owner}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                Estimasi Dampak Finansial
              </span>
              <span className="font-semibold text-rose-700 font-mono flex items-center mt-1">
                <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                {risk.financialImpactEstimate}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                Kecepatan (Velocity)
              </span>
              <span className="font-semibold text-amber-700 flex items-center mt-1">
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                {risk.velocity === 'Rapid'
                  ? 'Cepat (Rapid)'
                  : risk.velocity === 'Moderate'
                  ? 'Moderat'
                  : 'Lambat'}
              </span>
            </div>
          </div>

          {/* Dual Score Comparison Box (Inherent vs Residual) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inherent Risk Card */}
            <div className={`p-4 rounded-xl border ${inherentCfg.badgeBg} flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold">
                    Risiko Inheren (Awal)
                  </span>
                  <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-md bg-white/70 border border-slate-200">
                    {inherentCfg.idLabel}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline space-x-2">
                  <span className="text-3xl font-bold font-sans">
                    {risk.inherentScore}
                  </span>
                  <span className="text-xs font-mono opacity-70">
                    (L: {risk.inherentLikelihood} × I: {risk.inherentImpact})
                  </span>
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <div>
                    Kemungkinan:{' '}
                    <b className="font-semibold">{LIKELIHOOD_LABELS[risk.inherentLikelihood]?.title}</b>
                  </div>
                  <div>
                    Dampak: <b className="font-semibold">{IMPACT_LABELS[risk.inherentImpact]?.title}</b>
                  </div>
                </div>
              </div>

              {/* Catatan / Skenario Terburuk Inherent */}
              {risk.inherentWorstCaseScenario && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center">
                    <FileText className="w-3 h-3 mr-1 text-rose-600" />
                    Catatan / Skenario Terburuk Inherent
                  </span>
                  <p className="bg-white/80 p-2.5 rounded-lg border border-slate-200 leading-relaxed text-slate-800">
                    {risk.inherentWorstCaseScenario}
                  </p>
                </div>
              )}
            </div>

            {/* Residual Risk Card */}
            <div className={`p-4 rounded-xl border ${residualCfg.badgeBg}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold">
                  Risiko Residual (Target Pasca Mitigasi)
                </span>
                <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-md bg-white/70 border border-slate-200">
                  {residualCfg.idLabel}
                </span>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-3xl font-bold font-sans">
                  {risk.residualScore}
                </span>
                <span className="text-xs font-mono opacity-70">
                  (L: {risk.residualLikelihood} × I: {risk.residualImpact})
                </span>
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div>
                  Kemungkinan:{' '}
                  <b className="font-semibold">{LIKELIHOOD_LABELS[risk.residualLikelihood]?.title}</b>
                </div>
                <div>
                  Dampak: <b className="font-semibold">{IMPACT_LABELS[risk.residualImpact]?.title}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Master Risk Level Criteria Justification */}
          {inherentMasterRow && (
            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold tracking-wider text-sky-800 flex items-center">
                  <Table className="w-3.5 h-3.5 mr-1.5" />
                  Kriteria Master Risk Level (Impact Inheren Level {risk.inherentImpact} - {inherentMasterRow.levelNameEn})
                </span>
                <button
                  type="button"
                  onClick={() => setIsMasterMatrixOpen(true)}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline transition cursor-pointer"
                >
                  Buka Tabel Lengkap 5x5
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 text-xs text-slate-700">
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Entity Wide:</span>
                  <p className="text-slate-800">• {inherentMasterRow.entityWide.join('; ')}</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Output (Operasional):</span>
                  <p className="text-slate-800">• {inherentMasterRow.output.join('; ')}</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Human Resources:</span>
                  <p className="text-slate-800">• {inherentMasterRow.humanResources.join('; ')}</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Legal & Regulatory:</span>
                  <p className="text-slate-800">• {inherentMasterRow.legalRegulatory.join('; ')}</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs sm:col-span-2 md:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Financial:</span>
                  <p className="text-slate-800">• {inherentMasterRow.financial.join('; ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description & Root Cause & Consequences */}
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-sm text-slate-800 mb-1.5">
                Deskripsi Risiko
              </h4>
              <p className="text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                {risk.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-800 mb-1.5">
                  Akar Penyebab (Root Cause)
                </h4>
                <p className="text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                  {risk.rootCause}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800 mb-1.5">
                  Dampak & Konsekuensi
                </h4>
                <p className="text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                  {risk.consequences}
                </p>
              </div>
            </div>
          </div>

          {/* Existing Controls & Mitigation Plan */}
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-sm text-slate-800">
                  Pengendalian Eksisting & Efektivitas Kontrol
                </h4>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  Efektivitas: {risk.controlEffectiveness}
                </span>
              </div>
              <p className="text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                {risk.existingControls}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-sm text-slate-800">
                  Rencana Mitigasi (Treatment Action Plan)
                </h4>
                <span className="text-emerald-700 font-mono text-xs font-bold">
                  Progres: {risk.mitigationProgress}%
                </span>
              </div>
              <p className="text-emerald-900 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 leading-relaxed font-medium">
                {risk.mitigationPlan}
              </p>
            </div>
          </div>

          {/* Action Items Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="font-bold text-sm text-slate-800 flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                Daftar Tindakan Mitigasi (Action Plan Checklist)
              </h4>
              <span className="text-xs text-slate-400">
                Klik baris untuk mengubah status penyelesaian
              </span>
            </div>

            <div className="space-y-2">
              {risk.actionItems && risk.actionItems.length > 0 ? (
                risk.actionItems.map((action) => (
                  <div
                    key={action.id}
                    onClick={() => onToggleActionItem(risk.id, action.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                      action.completed
                        ? 'bg-slate-100/60 border-slate-200 text-slate-400 line-through'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {action.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="font-semibold">{action.action}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 shrink-0">
                      <span>PIC: <b className="text-slate-800">{action.assignee}</b></span>
                      <span>Target: {action.dueDate}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Belum ada rincian action plan.</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Peninjauan Terakhir: <b className="text-slate-800">{risk.lastReviewDate}</b> • Target Penyelesaian: <b className="text-slate-800">{risk.targetDate}</b>
          </div>
          <div className="flex items-center space-x-2">
            {onDelete && (
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition flex items-center space-x-1.5"
                title="Hapus Profil Risiko Ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Risiko</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (onDelete) {
            onDelete(risk.id);
          }
          onClose();
        }}
        title="Hapus Profil Risiko"
        message="Apakah Anda yakin ingin menghapus profil risiko ini secara permanen dari Risk Register?"
        itemDetails={{
          code: risk.code,
          title: risk.title,
          category: risk.category,
          department: risk.department,
        }}
        confirmButtonText="Ya, Hapus Profil Risiko"
      />

      {/* Master Risk Level Table Modal */}
      <MasterRiskLevelModal
        isOpen={isMasterMatrixOpen}
        onClose={() => setIsMasterMatrixOpen(false)}
        currentSelectedLevel={risk.inherentImpact}
      />
    </div>
  );
};
