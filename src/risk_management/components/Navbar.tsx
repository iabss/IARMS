import React from 'react';
import {
  ShieldAlert,
  Plus,
  Download,
  ListCheck,
  RotateCcw,
  Building2,
  Calendar,
  Table,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenActionTracker: () => void;
  onOpenMasterRiskLevel?: () => void;
  onOpenGoogleSheetsSync?: () => void;
  onQuickRefreshSheets?: () => void;
  isGoogleSheetsConnected?: boolean;
  pendingSyncCount?: number;
  isSyncingSheets?: boolean;
  onExportData: (format: 'csv' | 'json') => void;
  onResetData: () => void;
  selectedQuarter: string;
  onSelectQuarter: (quarter: string) => void;
  totalRisks: number;
  openActionsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenActionTracker,
  onOpenMasterRiskLevel,
  onOpenGoogleSheetsSync,
  onQuickRefreshSheets,
  isGoogleSheetsConnected = false,
  pendingSyncCount = 0,
  isSyncingSheets = false,
  onExportData,
  onResetData,
  selectedQuarter,
  onSelectQuarter,
  totalRisks,
  openActionsCount,
}) => {
  const [showExportMenu, setShowExportMenu] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  Risk Management
                </span>
                <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                  ISO 31000:2018
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Enterprise Risk Management (ERM) & Early Warning System
              </p>
            </div>
          </div>

          {/* Center / Right controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Period selector */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">Periode:</span>
              <select
                aria-label="Pilih Periode Laporan"
                value={selectedQuarter}
                onChange={(e) => onSelectQuarter(e.target.value)}
                className="bg-transparent border-none text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="All">Semua Periode</option>
                <option value="Q3 2026">Q3 2026 (Aktif)</option>
                <option value="Q2 2026">Q2 2026</option>
                <option value="Q1 2026">Q1 2026</option>
              </select>
            </div>

            {/* Google Sheets Live Backup & Sync Button */}
            {onOpenGoogleSheetsSync && (
              <div className="flex items-center space-x-1">
                <button
                  id="btn-google-sheets-sync"
                  onClick={onOpenGoogleSheetsSync}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-xs ${
                    isGoogleSheetsConnected
                      ? pendingSyncCount > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:border-emerald-500'
                  }`}
                  title="Integrasi Backup Google Spreadsheet"
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isGoogleSheetsConnected ? (pendingSyncCount > 0 ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-500'}`} />
                  <span className="hidden lg:inline">
                    {isGoogleSheetsConnected
                      ? pendingSyncCount > 0
                        ? `Sheets (${pendingSyncCount} Pending)`
                        : 'Sheets Connected'
                      : 'Google Sheets'}
                  </span>
                  {isGoogleSheetsConnected && pendingSyncCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  )}
                </button>

                {isGoogleSheetsConnected && onQuickRefreshSheets && (
                  <button
                    id="btn-quick-refresh-sheets"
                    onClick={onQuickRefreshSheets}
                    disabled={isSyncingSheets}
                    className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition disabled:opacity-50 shadow-xs"
                    title="Refresh & Sinkronkan Semua Risiko ke Google Sheet"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            )}

            {/* Master Risk Level Matrix Reference Button */}
            {onOpenMasterRiskLevel && (
              <button
                id="btn-master-risk-level"
                onClick={onOpenMasterRiskLevel}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs transition"
                title="Tabel Standar Kriteria Master Risk Level"
              >
                <Table className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden lg:inline">Master Risk Level</span>
              </button>
            )}

            {/* Action Items tracker button */}
            <button
              id="btn-action-tracker"
              onClick={onOpenActionTracker}
              className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition"
              title="Daftar Tindakan Mitigasi Terbuka"
            >
              <ListCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Mitigasi</span>
              {openActionsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                  {openActionsCount}
                </span>
              )}
            </button>

            {/* Export menu dropdown */}
            <div className="relative">
              <button
                id="btn-export-dropdown"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition"
                title="Ekspor Laporan Risiko"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">Ekspor</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs text-slate-700 divide-y divide-slate-100">
                  <div className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                    Format Ekspor ({totalRisks} Risiko)
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onExportData('csv');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 hover:text-indigo-600 flex items-center space-x-2 transition"
                    >
                      <span>📄 Unduh Format Excel / CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        onExportData('json');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 hover:text-indigo-600 flex items-center space-x-2 transition"
                    >
                      <span>💾 Unduh Backup JSON</span>
                    </button>
                    <button
                      onClick={() => {
                        window.print();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 hover:text-indigo-600 flex items-center space-x-2 transition"
                    >
                      <span>🖨️ Cetak / Simpan PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Reset data */}
            <button
              id="btn-reset-demo"
              onClick={onResetData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition border border-transparent"
              title="Reset ke Data Bawaan"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Add Risk Button */}
            <button
              id="btn-add-risk-nav"
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Risiko</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
