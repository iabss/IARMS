import React, { useState } from 'react';
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  ExternalLink,
} from 'lucide-react';
import { KRIItem, RiskItem } from '../types/risk';

interface KRISectionProps {
  kris: KRIItem[];
  risks: RiskItem[];
  onSelectRiskCode: (code: string) => void;
}

export const KRISection: React.FC<KRISectionProps> = ({
  kris,
  risks,
  onSelectRiskCode,
}) => {
  const [filterWarningOnly, setFilterWarningOnly] = useState(false);

  const displayedKRIs = filterWarningOnly
    ? kris.filter((k) => k.status !== 'Normal')
    : kris;

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-slate-900">
              Key Risk Indicators (KRI) - Sistem Peringatan Dini
            </h2>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              Early Warning Metrics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Metrik operasional & finansial berkala untuk mendeteksi deviasi sebelum risiko material.
          </p>
        </div>

        {kris.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterWarningOnly(!filterWarningOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center space-x-1.5 shadow-xs ${
                filterWarningOnly
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 text-amber-500" />
              <span>Hanya Peringatan / Waspada ({kris.filter((k) => k.status !== 'Normal').length})</span>
            </button>
          </div>
        )}
      </div>

      {kris.length === 0 ? (
        <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400 shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Key Risk Indicators (KRI) Telah Dikosongkan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Indikator peringatan dini contoh telah dibersihkan karena data risiko terkait sudah tidak ada.
          </p>
        </div>
      ) : displayedKRIs.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
          <p className="text-xs text-slate-500">Tidak ada KRI dengan status Peringatan atau Waspada.</p>
        </div>
      ) : (
        /* Grid of KRI Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedKRIs.map((kri) => {
            const associatedRisk = risks.find((r) => r.code === kri.associatedRiskCode);

            return (
              <div
                key={kri.id}
                className={`p-4 rounded-xl border transition-all ${
                  kri.status === 'Critical'
                    ? 'bg-rose-50/40 border-rose-200 ring-1 ring-rose-200'
                    : kri.status === 'Warning'
                    ? 'bg-amber-50/40 border-amber-200 ring-1 ring-amber-200'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top info */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                      {kri.code} • {kri.frequency}
                    </span>
                    <h3 className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">
                      {kri.name}
                    </h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${
                      kri.status === 'Critical'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : kri.status === 'Warning'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {kri.status === 'Critical'
                      ? 'Kritis'
                      : kri.status === 'Warning'
                      ? 'Waspada'
                      : 'Aman'}
                  </span>
                </div>

                {/* Current Value & Trend */}
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-slate-900 font-sans">
                      {kri.currentValue}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{kri.unit}</span>
                  </div>

                  <div className="flex items-center text-xs font-semibold space-x-1">
                    {kri.trend === 'up' ? (
                      <span className="flex items-center text-amber-600">
                        <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Naik ({kri.previousValue})
                      </span>
                    ) : kri.trend === 'down' ? (
                      <span className="flex items-center text-emerald-600">
                        <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> Turun ({kri.previousValue})
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-400">
                        <Minus className="w-3.5 h-3.5 mr-0.5" /> Stabil
                      </span>
                    )}
                  </div>
                </div>

                {/* Thresholds line */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between items-center">
                    <span>Batas Aman: <strong className="text-emerald-700 font-semibold">{kri.thresholdGreen}</strong></span>
                    <span>Waspada: <strong className="text-amber-700 font-semibold">{kri.thresholdAmber}</strong></span>
                  </div>
                </div>

                {/* Associated Risk reference */}
                {associatedRisk && (
                  <button
                    onClick={() => onSelectRiskCode(kri.associatedRiskCode)}
                    className="mt-3 w-full text-left py-1.5 px-2.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 flex items-center justify-between text-xs text-slate-700 hover:text-indigo-700 transition group shadow-2xs"
                  >
                    <span className="truncate pr-2">
                      Terkait: <b className="text-slate-900">{associatedRisk.code}</b> ({associatedRisk.category})
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
