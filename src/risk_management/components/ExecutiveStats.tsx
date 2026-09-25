import React from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldCheck,
  TrendingDown,
  Gauge,
  ListTodo,
} from 'lucide-react';
import { RiskItem, KRIItem } from '../types/risk';

interface ExecutiveStatsProps {
  risks: RiskItem[];
  kris: KRIItem[];
  onFilterCritical: () => void;
  onFilterHigh: () => void;
  onFilterAll: () => void;
  activeLevelFilter: string;
}

export const ExecutiveStats: React.FC<ExecutiveStatsProps> = ({
  risks,
  kris,
  onFilterCritical,
  onFilterHigh,
  onFilterAll,
  activeLevelFilter,
}) => {
  const total = risks.length;
  const criticalCount = risks.filter((r) => r.inherentLevel === 'Critical').length;
  const highCount = risks.filter((r) => r.inherentLevel === 'High').length;
  const mediumCount = risks.filter((r) => r.inherentLevel === 'Medium').length;
  const lowCount = risks.filter((r) => r.inherentLevel === 'Low').length;

  // Residual critical count (after mitigation)
  const residualCriticalCount = risks.filter((r) => r.residualLevel === 'Critical').length;
  const residualHighCount = risks.filter((r) => r.residualLevel === 'High').length;

  // Calculate Average Inherent Score vs Residual Score
  const avgInherent =
    total > 0
      ? (risks.reduce((acc, r) => acc + r.inherentScore, 0) / total).toFixed(1)
      : '0.0';
  const avgResidual =
    total > 0
      ? (risks.reduce((acc, r) => acc + r.residualScore, 0) / total).toFixed(1)
      : '0.0';
  const scoreReductionPercent =
    Number(avgInherent) > 0
      ? Math.round(((Number(avgInherent) - Number(avgResidual)) / Number(avgInherent)) * 100)
      : 0;

  // Action items summary
  const allActionItems = risks.flatMap((r) => r.actionItems || []);
  const completedActions = allActionItems.filter((a) => a.completed).length;
  const totalActions = allActionItems.length;
  const actionCompletionRate =
    totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // KRI alert count
  const kriWarningOrCritical = kris.filter(
    (k) => k.status === 'Warning' || k.status === 'Critical'
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Card 1: Total Risiko Terdaftar */}
      <div
        id="stat-total-risks"
        onClick={onFilterAll}
        className={`bg-white p-5 border rounded-xl shadow-xs transition cursor-pointer hover:shadow-md ${
          activeLevelFilter === ''
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Risiko Terpantau
          </p>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-2 font-sans">
          {total}
        </p>
        <div className="mt-3 flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center text-rose-600 font-semibold">
            {criticalCount} Kritis
          </span>
          <span>•</span>
          <span className="inline-flex items-center text-orange-600 font-semibold">
            {highCount} Tinggi
          </span>
          <span>•</span>
          <span>{mediumCount + lowCount} Moderat/Rendah</span>
        </div>
      </div>

      {/* Card 2: Risiko Kritis & Butuh Perhatian Segera */}
      <div
        id="stat-critical-risks"
        onClick={onFilterCritical}
        className={`bg-white p-5 border rounded-xl shadow-xs transition cursor-pointer hover:shadow-md ${
          activeLevelFilter === 'Critical'
            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Risiko Kritis (Ekstrem)
          </p>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-2 font-sans">
          {criticalCount}
        </p>
        <p className="text-xs text-rose-600 mt-3 font-medium flex items-center">
          {criticalCount > 0 ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
              Perhatian Direksi ({residualCriticalCount} residual)
            </>
          ) : (
            <span className="text-emerald-600">Dalam batas toleransi aman</span>
          )}
        </p>
      </div>

      {/* Card 3: Penurunan Skor Risiko (Efektivitas Mitigasi) */}
      <div
        id="stat-risk-reduction"
        className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rerata Reduksi Risiko
          </p>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-2 font-sans">
          -{scoreReductionPercent}%
        </p>
        <div className="mt-3 flex items-center text-xs text-emerald-600 font-medium">
          <span>{avgInherent} ➔ {avgResidual} pts ({highCount + criticalCount - (residualHighCount + residualCriticalCount)} berkurang)</span>
        </div>
      </div>

      {/* Card 4: KRI Early Warning & Pelaksanaan Action Plan */}
      <div
        id="stat-kri-alerts"
        className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            KRI & Eksekusi Mitigasi
          </p>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <p className="text-3xl font-bold text-slate-900 font-sans">
            {actionCompletionRate}%
          </p>
          {kris.length > 0 ? (
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-md border ${
                kriWarningOrCritical > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {kriWarningOrCritical} Waspada
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-md border bg-slate-100 text-slate-500 border-slate-200">
              0 Waspada
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{completedActions}/{totalActions} mitigasi selesai</span>
          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${actionCompletionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
