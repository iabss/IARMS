import React, { useState } from 'react';
import { X, Table, Check, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import {
  MASTER_RISK_LEVEL_DATA,
  MASTER_RISK_DIMENSIONS,
  MasterRiskDimensionKey,
} from '../data/masterRiskLevel';

interface MasterRiskLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLevel?: (level: number, descriptionSummary?: string) => void;
  currentSelectedLevel?: number;
}

export const MasterRiskLevelModal: React.FC<MasterRiskLevelModalProps> = ({
  isOpen,
  onClose,
  onSelectLevel,
  currentSelectedLevel,
}) => {
  const [highlightDimension, setHighlightDimension] = useState<MasterRiskDimensionKey | 'all'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-sky-100 text-sky-800 border border-sky-200 rounded-md">
                  STANDAR MASTER RISK LEVEL
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  ISO 31000 Compliant Matrix
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                Kriteria Spesifikasi Penetapan Nilai Dampak (Impact Level 1 - 5)
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dimension Filter Tabs */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 text-xs font-semibold mr-2">Sorot Dimensi:</span>
          <button
            onClick={() => setHighlightDimension('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              highlightDimension === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Semua Dimensi
          </button>
          {MASTER_RISK_DIMENSIONS.map((dim) => (
            <button
              key={dim.key}
              onClick={() => setHighlightDimension(dim.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                highlightDimension === dim.key
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>

        {/* Modal Content - Table */}
        <div className="p-4 sm:p-5 overflow-x-auto overflow-y-auto flex-1 bg-slate-50/50">
          <div className="min-w-[840px] border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-200">
                  <th className="py-3 px-3 w-28 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-700">
                    Level of Impact
                  </th>
                  <th
                    className={`py-3 px-3 font-semibold text-[11px] border-r border-slate-700 ${
                      highlightDimension === 'entityWide' ? 'bg-sky-800 text-white' : ''
                    }`}
                  >
                    Entity Wide
                  </th>
                  <th
                    className={`py-3 px-3 font-semibold text-[11px] border-r border-slate-700 ${
                      highlightDimension === 'output' ? 'bg-sky-800 text-white' : ''
                    }`}
                  >
                    Output
                  </th>
                  <th
                    className={`py-3 px-3 font-semibold text-[11px] border-r border-slate-700 ${
                      highlightDimension === 'humanResources' ? 'bg-sky-800 text-white' : ''
                    }`}
                  >
                    Human Resources
                  </th>
                  <th
                    className={`py-3 px-3 font-semibold text-[11px] border-r border-slate-700 ${
                      highlightDimension === 'legalRegulatory' ? 'bg-sky-800 text-white' : ''
                    }`}
                  >
                    Legal & Regulatory
                  </th>
                  <th
                    className={`py-3 px-3 font-semibold text-[11px] ${
                      highlightDimension === 'financial' ? 'bg-sky-800 text-white' : ''
                    }`}
                  >
                    Financial
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {MASTER_RISK_LEVEL_DATA.map((row) => {
                  const isSelected = currentSelectedLevel === row.level;

                  return (
                    <tr
                      key={row.level}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-sky-50 ring-1 ring-sky-400'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Level column */}
                      <td className="py-3.5 px-3 border-r border-slate-200 text-center align-top bg-slate-50/50">
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base border ${row.badgeBg} ${row.textColor} ${row.borderColor}`}
                          >
                            {row.level}
                          </span>
                          <span className={`text-[11px] font-semibold mt-1 ${row.textColor}`}>
                            {row.levelNameEn}
                          </span>

                          {onSelectLevel && (
                            <button
                              onClick={() => {
                                onSelectLevel(row.level);
                                onClose();
                              }}
                              className={`mt-2 px-2.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center space-x-1 ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isSelected ? <Check className="w-3 h-3 mr-0.5" /> : null}
                              <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Entity Wide */}
                      <td
                        className={`py-3.5 px-3 border-r border-slate-200 align-top text-slate-700 ${
                          highlightDimension === 'entityWide' ? 'bg-sky-50/60' : ''
                        }`}
                      >
                        <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                          {row.entityWide.map((item, idx) => (
                            <li key={idx} className="marker:text-slate-400">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Output */}
                      <td
                        className={`py-3.5 px-3 border-r border-slate-200 align-top text-slate-700 ${
                          highlightDimension === 'output' ? 'bg-sky-50/60' : ''
                        }`}
                      >
                        <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                          {row.output.map((item, idx) => (
                            <li key={idx} className="marker:text-slate-400">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Human Resources */}
                      <td
                        className={`py-3.5 px-3 border-r border-slate-200 align-top text-slate-700 ${
                          highlightDimension === 'humanResources' ? 'bg-sky-50/60' : ''
                        }`}
                      >
                        <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                          {row.humanResources.map((item, idx) => (
                            <li key={idx} className="marker:text-slate-400">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Legal & Regulatory */}
                      <td
                        className={`py-3.5 px-3 border-r border-slate-200 align-top text-slate-700 ${
                          highlightDimension === 'legalRegulatory' ? 'bg-sky-50/60' : ''
                        }`}
                      >
                        <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                          {row.legalRegulatory.map((item, idx) => (
                            <li key={idx} className="marker:text-slate-400">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Financial */}
                      <td
                        className={`py-3.5 px-3 align-top text-slate-700 ${
                          highlightDimension === 'financial' ? 'bg-sky-50/60' : ''
                        }`}
                      >
                        <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
                          {row.financial.map((item, idx) => (
                            <li key={idx} className="marker:text-slate-400">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            *Pilih level yang paling merepresentasikan konsekuensi terberat dari risiko yang dinilai.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
