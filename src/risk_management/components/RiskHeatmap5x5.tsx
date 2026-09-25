import React, { useState } from 'react';
import {
  Info,
  FilterX,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { RiskItem, RiskLevel } from '../types/risk';
import {
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
  calculateRiskLevel,
  getRiskLevelConfig,
} from '../utils/riskCalculations';

interface RiskHeatmap5x5Props {
  risks: RiskItem[];
  selectedCell: { likelihood: number; impact: number } | null;
  onSelectCell: (cell: { likelihood: number; impact: number } | null) => void;
  onSelectRiskItem: (risk: RiskItem) => void;
}

type MatrixViewMode = 'inherent' | 'residual' | 'comparison';

export const RiskHeatmap5x5: React.FC<RiskHeatmap5x5Props> = ({
  risks,
  selectedCell,
  onSelectCell,
  onSelectRiskItem,
}) => {
  const [viewMode, setViewMode] = useState<MatrixViewMode>('inherent');
  const [hoveredCell, setHoveredCell] = useState<{ l: number; i: number } | null>(null);

  // Group risks into cells based on current viewMode
  const getRisksForCell = (l: number, i: number, mode: 'inherent' | 'residual') => {
    return risks.filter((r) => {
      if (mode === 'inherent') {
        return r.inherentLikelihood === l && r.inherentImpact === i;
      } else {
        return r.residualLikelihood === l && r.residualImpact === i;
      }
    });
  };

  // Matrix axes
  const likelihoods = [5, 4, 3, 2, 1]; // Y-axis top to bottom
  const impacts = [1, 2, 3, 4, 5]; // X-axis left to right

  // Stats for the matrix legend
  const currentLevelCounts = {
    Critical: risks.filter((r) => (viewMode === 'inherent' ? r.inherentLevel : r.residualLevel) === 'Critical').length,
    High: risks.filter((r) => (viewMode === 'inherent' ? r.inherentLevel : r.residualLevel) === 'High').length,
    Medium: risks.filter((r) => (viewMode === 'inherent' ? r.inherentLevel : r.residualLevel) === 'Medium').length,
    Low: risks.filter((r) => (viewMode === 'inherent' ? r.inherentLevel : r.residualLevel) === 'Low').length,
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs mb-8">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-slate-900">
              Matriks Peta Panas Risiko 5x5 (ISO 31000)
            </h2>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              Likelihood × Impact
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Klik pada kotak matriks untuk menyaring tabel daftar risiko di bawah.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            id="view-mode-inherent"
            onClick={() => setViewMode('inherent')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              viewMode === 'inherent'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Risiko Inheren
          </button>
          <button
            id="view-mode-residual"
            onClick={() => setViewMode('residual')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              viewMode === 'residual'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Risiko Residual
          </button>
          <button
            id="view-mode-comparison"
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center space-x-1 ${
              viewMode === 'comparison'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Migrasi Mitigasi</span>
          </button>
        </div>
      </div>

      {/* Active filter notification banner */}
      {selectedCell && (
        <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 border-y border-r border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-amber-800">Filter Matriks Aktif:</span>
            <span>
              Kemungkinan (L): <b>{selectedCell.likelihood}</b> × Dampak (I):{' '}
              <b>{selectedCell.impact}</b> (Skor: {selectedCell.likelihood * selectedCell.impact})
            </span>
          </div>
          <button
            onClick={() => onSelectCell(null)}
            className="flex items-center space-x-1 font-semibold hover:underline text-amber-800"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Hapus Filter</span>
          </button>
        </div>
      )}

      {/* 5x5 Matrix Layout */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[540px] flex">
          {/* Y-axis Label */}
          <div className="flex items-center justify-center -rotate-90 text-[10px] uppercase tracking-wider font-semibold text-slate-400 w-8 whitespace-nowrap">
            Kemungkinan (Likelihood)
          </div>

          <div className="flex-1">
            {/* Rows of the matrix */}
            <div className="space-y-1.5">
              {likelihoods.map((l) => (
                <div key={l} className="flex items-center space-x-1.5">
                  {/* Row header (Likelihood label) */}
                  <div
                    className="w-28 text-right pr-2 text-xs font-medium text-slate-600"
                    title={LIKELIHOOD_LABELS[l].desc}
                  >
                    <span className="block text-[11px] leading-tight font-semibold text-slate-700">
                      {LIKELIHOOD_LABELS[l].title}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-normal">
                      {LIKELIHOOD_LABELS[l].en}
                    </span>
                  </div>

                  {/* 5 Cells for this row */}
                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {impacts.map((i) => {
                      const score = l * i;
                      const level = calculateRiskLevel(score);
                      const config = getRiskLevelConfig(level);
                      const isSelected =
                        selectedCell?.likelihood === l && selectedCell?.impact === i;

                      const inherentRisks = getRisksForCell(l, i, 'inherent');
                      const residualRisks = getRisksForCell(l, i, 'residual');

                      const cellRisks =
                        viewMode === 'inherent'
                          ? inherentRisks
                          : viewMode === 'residual'
                          ? residualRisks
                          : inherentRisks;

                      return (
                        <div
                          key={`${l}-${i}`}
                          id={`matrix-cell-${l}-${i}`}
                          onClick={() => {
                            if (isSelected) {
                              onSelectCell(null);
                            } else {
                              onSelectCell({ likelihood: l, impact: i });
                            }
                          }}
                          onMouseEnter={() => setHoveredCell({ l, i })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`relative h-20 p-2 rounded-lg border flex flex-col justify-between cursor-pointer transition-all duration-150 select-none shadow-2xs ${
                            config.matrixCellBg
                          } ${
                            isSelected
                              ? `${config.activeMatrixRing} shadow-md scale-[1.02] z-10 border-slate-400`
                              : 'hover:scale-[1.01] hover:border-slate-400'
                          }`}
                        >
                          {/* Top row inside cell: score & level abbreviation */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold opacity-80">
                              {score}
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-wider opacity-70">
                              {level === 'Critical'
                                ? 'KRITIS'
                                : level === 'High'
                                ? 'TINGGI'
                                : level === 'Medium'
                                ? 'SEDANG'
                                : 'RENDAH'}
                            </span>
                          </div>

                          {/* Center: Risk Count & Chips */}
                          <div className="my-auto flex flex-col items-center justify-center">
                            {viewMode === 'comparison' ? (
                              <div className="flex items-center space-x-1 text-[10px]">
                                <span
                                  className="font-bold px-1.5 py-0.5 rounded bg-white/80 text-slate-700 border border-slate-200 shadow-2xs"
                                  title={`${inherentRisks.length} Risiko Inheren`}
                                >
                                  {inherentRisks.length} Inh
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span
                                  className="font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                                  title={`${residualRisks.length} Risiko Residual`}
                                >
                                  {residualRisks.length} Res
                                </span>
                              </div>
                            ) : cellRisks.length > 0 ? (
                              <div className="flex items-center space-x-1">
                                <span className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs bg-white text-slate-800 border border-slate-200 shadow-xs">
                                  {cellRisks.length}
                                </span>
                                <span className="text-[10px] font-medium hidden md:inline opacity-80">
                                  Risiko
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] opacity-40 font-mono">
                                0
                              </span>
                            )}
                          </div>

                          {/* Bottom: quick code preview or indicator dots */}
                          <div className="flex items-center justify-center space-x-1 overflow-hidden h-3.5">
                            {cellRisks.slice(0, 3).map((r) => (
                              <span
                                key={r.id}
                                className="w-1.5 h-1.5 rounded-full bg-slate-700/60"
                                title={r.code}
                              />
                            ))}
                            {cellRisks.length > 3 && (
                              <span className="text-[9px] font-bold text-slate-600">
                                +{cellRisks.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* X-axis Columns Header */}
            <div className="flex items-start space-x-1.5 mt-2.5">
              <div className="w-28" /> {/* spacer for Y-axis label */}
              <div className="grid grid-cols-5 gap-1.5 flex-1 text-center">
                {impacts.map((i) => (
                  <div key={i} className="px-1" title={IMPACT_LABELS[i].desc}>
                    <span className="block text-[11px] font-semibold text-slate-700">
                      {IMPACT_LABELS[i].title}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-normal">
                      {IMPACT_LABELS[i].en}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* X-axis title */}
            <div className="text-center text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-2">
              Tingkat Dampak (Impact)
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend & Level Breakdown */}
      <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Kategori ISO 31000:
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600 text-xs">
              Kritis (15 - 25):{' '}
              <b className="text-rose-600 font-bold">{currentLevelCounts.Critical}</b>
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-slate-600 text-xs">
              Tinggi (10 - 14):{' '}
              <b className="text-orange-600 font-bold">{currentLevelCounts.High}</b>
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-600 text-xs">
              Sedang (5 - 9):{' '}
              <b className="text-amber-600 font-bold">{currentLevelCounts.Medium}</b>
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 text-xs">
              Rendah (1 - 4):{' '}
              <b className="text-emerald-600 font-bold">{currentLevelCounts.Low}</b>
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center tracking-wide font-medium">
          <Info className="w-3.5 h-3.5 mr-1 text-slate-400" />
          <span>Skor = Likelihood (1-5) × Impact (1-5)</span>
        </div>
      </div>
    </div>
  );
};
