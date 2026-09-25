import React, { useState } from 'react';
import { PieChart, BarChart3, ShieldAlert, ArrowDownRight } from 'lucide-react';
import { RiskItem, RiskCategory, RISK_CATEGORIES } from '../types/risk';

interface RiskChartsProps {
  risks: RiskItem[];
  onSelectCategory: (category: string) => void;
  selectedCategory: string;
}

const CATEGORY_COLORS: Record<RiskCategory, string> = {
  'Operational': '#3b82f6', // blue
  'Financial': '#10b981', // emerald
  'Legal & Regulation': '#8b5cf6', // purple
  'Entity Company': '#06b6d4', // cyan
  'Human Resources': '#f59e0b', // amber
};

export const RiskCharts: React.FC<RiskChartsProps> = ({
  risks,
  onSelectCategory,
  selectedCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'category' | 'reduction' | 'status'>('category');

  // Dynamic list of categories from both constants and any existing risks
  const allCategories = Array.from(new Set([...RISK_CATEGORIES, ...risks.map((r) => r.category)]));

  // Category counts
  const categoryData = allCategories.map((cat) => {
    const count = risks.filter((r) => r.category === cat).length;
    const criticalCount = risks.filter((r) => r.category === cat && r.inherentLevel === 'Critical').length;
    return {
      category: cat,
      count,
      criticalCount,
      color: (CATEGORY_COLORS as Record<string, string>)[cat] || '#ec4899',
    };
  }).filter((d) => d.count > 0);

  const maxCount = Math.max(...categoryData.map((d) => d.count), 1);

  // Status breakdown
  const statusCounts = {
    Mitigating: risks.filter((r) => r.status === 'Mitigating').length,
    Monitored: risks.filter((r) => r.status === 'Monitored').length,
    Open: risks.filter((r) => r.status === 'Open').length,
    Closed: risks.filter((r) => r.status === 'Closed').length,
  };

  // Top reduced risks (greatest impact of mitigation)
  const topMitigatedRisks = [...risks]
    .sort((a, b) => (b.inherentScore - b.residualScore) - (a.inherentScore - a.residualScore))
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs mb-8">
      {/* Header with View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-slate-900">
              Analisis & Distribusi Profil Risiko
            </h2>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              ERM Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Komposisi risiko per kategori, status penanganan, dan efektivitas reduksi pasca mitigasi.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('category')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'category'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Kategori
          </button>
          <button
            onClick={() => setActiveTab('reduction')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'reduction'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Efektivitas Reduksi
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'status'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Status Penanganan
          </button>
        </div>
      </div>

      {/* Tab 1: Category Breakdown */}
      {activeTab === 'category' && (
        <div className="space-y-3">
          {categoryData.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Belum ada data risiko untuk dianalisis per kategori.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryData.map((d) => {
                const isSelected = selectedCategory === d.category;
                const percentage = Math.round((d.count / risks.length) * 100);

                return (
                  <div
                    key={d.category}
                    onClick={() => onSelectCategory(isSelected ? '' : d.category)}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs'
                        : 'border-slate-200 hover:border-indigo-200 bg-slate-50/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="font-semibold text-slate-800">
                          {d.category}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900 font-mono">
                          {d.count} Risiko
                        </span>
                        <span className="text-slate-400">({percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(d.count / maxCount) * 100}%`,
                          backgroundColor: d.color,
                        }}
                      />
                    </div>

                    {d.criticalCount > 0 && (
                      <div className="mt-2 text-[11px] text-rose-600 font-medium flex items-center">
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                        {d.criticalCount} risiko berstatus Kritis
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Reduction Effectiveness (Inherent vs Residual comparison) */}
      {activeTab === 'reduction' && (
        <div className="space-y-3">
          {topMitigatedRisks.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Belum ada profil risiko untuk analisis efektivitas reduksi mitigasi.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2 font-medium">
                Perbandingan Skor Inheren (Sebelum Mitigasi) vs Skor Residual (Setelah Mitigasi) pada 5 risiko teratas:
              </p>

              <div className="space-y-3">
                {topMitigatedRisks.map((risk) => {
                  const reduction = risk.inherentScore - risk.residualScore;
                  const reductionPercent = Math.round((reduction / risk.inherentScore) * 100);

                  return (
                    <div
                      key={risk.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {risk.code} • {risk.category}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-800 mt-0.5">
                            {risk.title}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-2 text-xs">
                          <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                            Inh: {risk.inherentScore}
                          </span>
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            Res: {risk.residualScore}
                          </span>
                          <span className="text-xs font-bold text-emerald-600">
                            (-{reductionPercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Dual comparative bar */}
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center space-x-2">
                          <span className="w-16 text-slate-500 font-medium">Inheren</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-rose-500 h-1.5 rounded-full"
                              style={{ width: `${(risk.inherentScore / 25) * 100}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-slate-500 font-mono font-medium">
                            {risk.inherentScore}/25
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="w-16 text-slate-500 font-medium">Residual</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${(risk.residualScore / 25) * 100}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-emerald-600 font-mono font-bold">
                            {risk.residualScore}/25
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Status Breakdown */}
      {activeTab === 'status' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-sky-50/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700">
              Proses Mitigasi
            </span>
            <div className="mt-2 text-3xl font-bold text-slate-900 font-sans">
              {statusCounts.Mitigating}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rencana aksi sedang aktif diimplementasikan divisi
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-purple-50/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700">
              Dipantau (Monitored)
            </span>
            <div className="mt-2 text-3xl font-bold text-slate-900 font-sans">
              {statusCounts.Monitored}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mitigasi berjalan stabil, evaluasi KRI berkala
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
              Terbuka (Open)
            </span>
            <div className="mt-2 text-3xl font-bold text-slate-900 font-sans">
              {statusCounts.Open}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Baru teridentifikasi, menyusun rencana penanganan
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
              Terkendali (Closed)
            </span>
            <div className="mt-2 text-3xl font-bold text-slate-900 font-sans">
              {statusCounts.Closed}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Risiko telah diturunkan ke level residu yang dapat diterima
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
