import React, { useState } from 'react';
import {
  Check,
  HelpCircle,
  Table,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  MASTER_RISK_LEVEL_DATA,
  MASTER_RISK_DIMENSIONS,
  MasterRiskDimensionKey,
  getMasterRiskLevelRow,
} from '../data/masterRiskLevel';

interface ImpactCriteriaPickerProps {
  currentImpact: number;
  onSelectImpact: (level: number) => void;
  onOpenFullMatrixModal: () => void;
  onApplyDescription?: (text: string) => void;
  titlePrefix?: string;
  isResidual?: boolean;
}

export const ImpactCriteriaPicker: React.FC<ImpactCriteriaPickerProps> = ({
  currentImpact,
  onSelectImpact,
  onOpenFullMatrixModal,
  onApplyDescription,
  titlePrefix = 'Inherent',
  isResidual = false,
}) => {
  const [activeDimension, setActiveDimension] = useState<MasterRiskDimensionKey>('output');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const selectedRow = getMasterRiskLevelRow(currentImpact);
  const activeDimConfig = MASTER_RISK_DIMENSIONS.find((d) => d.key === activeDimension);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-3">
      {/* Header with toggle and Matrix Modal button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-800 tracking-wide flex items-center">
            Pilihan Kriteria Master Risk Level ({titlePrefix} Impact)
          </h4>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
            5 Dimensi Evaluasi
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onOpenFullMatrixModal}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition flex items-center space-x-1 shadow-2xs"
            title="Buka tabel lengkap master risk level"
          >
            <Table className="w-3.5 h-3.5 mr-1 text-blue-600" />
            <span>Tabel Matriks Lengkap</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-700 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Dimension Selector Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pilih Perspektif / Dimensi Dampak Risiko:
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline-block">
                {activeDimConfig?.subLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {MASTER_RISK_DIMENSIONS.map((dim) => {
                const isActive = activeDimension === dim.key;
                return (
                  <button
                    key={dim.key}
                    type="button"
                    onClick={() => setActiveDimension(dim.key)}
                    className={`py-1.5 px-2.5 rounded-lg text-left border transition text-xs flex flex-col ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <span className="truncate text-xs font-semibold">{dim.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level Cards Selector (1 to 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
            {MASTER_RISK_LEVEL_DATA.slice()
              .sort((a, b) => a.level - b.level)
              .map((row) => {
                const isSelected = currentImpact === row.level;
                const criteriaItems = row[activeDimension] || [];

                return (
                  <div
                    key={row.level}
                    onClick={() => onSelectImpact(row.level)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between text-left ${
                      isSelected
                        ? `bg-white ${row.borderColor} ring-2 ring-blue-500 shadow-sm`
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      {/* Top badge */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border ${row.badgeBg} ${row.textColor} ${row.borderColor}`}
                        >
                          {row.level}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider ${row.textColor}`}
                        >
                          {row.levelNameEn}
                        </span>
                      </div>

                      {/* Criteria list for this dimension */}
                      <div className="space-y-1 my-2">
                        {criteriaItems.map((item, idx) => (
                          <p
                            key={idx}
                            className="text-xs leading-snug text-slate-600 line-clamp-3"
                          >
                            • {item}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Bottom action button */}
                    <div className="pt-2 border-t border-slate-100 mt-auto flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-blue-600 flex items-center' : 'text-slate-400'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 inline text-blue-600" />
                            Terpilih
                          </>
                        ) : (
                          'Pilih Level'
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Selected Level Summary & Quick Copy */}
          {selectedRow && (
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${selectedRow.badgeBg} ${selectedRow.textColor}`}
                >
                  {selectedRow.level}
                </span>
                <span className="text-slate-800 font-medium">
                  Impact Terpilih: <strong className="text-slate-900">Level {selectedRow.level} ({selectedRow.levelNameId})</strong>
                </span>
                <span className="text-slate-500 hidden md:inline text-xs">
                  — {selectedRow[activeDimension]?.[0]}
                </span>
              </div>

              {onApplyDescription && (
                <button
                  type="button"
                  onClick={() => {
                    const sampleText = selectedRow[activeDimension]?.join('; ');
                    if (sampleText) {
                      onApplyDescription(sampleText);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold transition flex items-center self-start sm:self-auto shrink-0 shadow-2xs"
                  title="Salin deskripsi kriteria ini ke skenario terburuk"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Salin ke Catatan Skenario
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
