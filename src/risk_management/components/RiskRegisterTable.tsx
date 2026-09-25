import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Building2,
  User,
  Calendar,
  Sparkles,
  Layers,
  Plus,
  CheckSquare,
  MapPin,
  FileText,
  FileSpreadsheet,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { RiskItem, RiskLevel, SITE_OPTIONS } from '../types/risk';
import { getRiskLevelConfig, getStatusConfig } from '../utils/riskCalculations';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface RiskRegisterTableProps {
  risks: RiskItem[];
  onViewRisk: (risk: RiskItem) => void;
  onEditRisk: (risk: RiskItem) => void;
  onDeleteRisk: (id: string) => void;
  onDeleteMultipleRisks?: (ids: string[]) => void;
  onClearAllRisks?: () => void;
  onOpenAddRisk?: () => void;
  syncedRiskIds?: Set<string>;
  onOpenGoogleSheetsSync?: () => void;
  onQuickRefreshSheets?: () => void;
  isSyncingSheets?: boolean;
  selectedSite?: string;
  onSelectSite?: (site: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedLevel: string;
  onSelectLevel: (lvl: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDepartment: string;
  onSelectDepartment: (dept: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  onClearFilters: () => void;
}

export const RiskRegisterTable: React.FC<RiskRegisterTableProps> = ({
  risks,
  onViewRisk,
  onEditRisk,
  onDeleteRisk,
  onDeleteMultipleRisks,
  onClearAllRisks,
  onOpenAddRisk,
  syncedRiskIds = new Set(),
  onOpenGoogleSheetsSync,
  onQuickRefreshSheets,
  isSyncingSheets = false,
  selectedSite = '',
  onSelectSite,
  selectedCategory,
  onSelectCategory,
  selectedLevel,
  onSelectLevel,
  searchQuery,
  onSearchChange,
  selectedDepartment,
  onSelectDepartment,
  selectedStatus,
  onSelectStatus,
  onClearFilters,
}) => {
  const [sortField, setSortField] = useState<'inherentScore' | 'residualScore' | 'code' | 'progress'>('inherentScore');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [deleteTargetRisk, setDeleteTargetRisk] = useState<RiskItem | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);

  // Lists for dropdown
  const availableSites = Array.from(
    new Set([...SITE_OPTIONS, ...(risks.map((r) => r.site).filter(Boolean) as string[])])
  );
  const departments = Array.from(new Set(risks.map((r) => r.department)));
  const categories = Array.from(new Set(risks.map((r) => r.category)));

  // Filter logic
  const filteredRisks = risks.filter((r) => {
    // Search query
    if (
      searchQuery &&
      !r.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.owner.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.department.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(r.site && r.site.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !(r.inherentWorstCaseScenario && r.inherentWorstCaseScenario.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      return false;
    }

    // Site filter
    if (selectedSite && r.site !== selectedSite) {
      return false;
    }

    // Category filter
    if (selectedCategory && r.category !== selectedCategory) {
      return false;
    }

    // Level filter
    if (selectedLevel && r.inherentLevel !== selectedLevel) {
      return false;
    }

    // Department filter
    if (selectedDepartment && r.department !== selectedDepartment) {
      return false;
    }

    // Status filter
    if (selectedStatus && r.status !== selectedStatus) {
      return false;
    }

    return true;
  });

  // Sort logic
  const sortedRisks = [...filteredRisks].sort((a, b) => {
    let comp = 0;
    if (sortField === 'inherentScore') {
      comp = a.inherentScore - b.inherentScore;
    } else if (sortField === 'residualScore') {
      comp = a.residualScore - b.residualScore;
    } else if (sortField === 'progress') {
      comp = a.mitigationProgress - b.mitigationProgress;
    } else if (sortField === 'code') {
      comp = a.code.localeCompare(b.code);
    }
    return sortAsc ? comp : -comp;
  });

  const handleSort = (field: 'inherentScore' | 'residualScore' | 'code' | 'progress') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending for risk scores
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedSite) ||
    Boolean(selectedCategory) ||
    Boolean(selectedLevel) ||
    Boolean(selectedDepartment) ||
    Boolean(selectedStatus);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-8">
      {/* Table Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Profil Risiko (Risk Register)
              </h2>
              <span className="text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {sortedRisks.length} dari {risks.length} Risiko
              </span>
              {onOpenGoogleSheetsSync && (
                <button
                  type="button"
                  onClick={onOpenGoogleSheetsSync}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Kelola backup otomatis Google Spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Sheets Sync</span>
                </button>
              )}
              {risks.length > 0 && (
                <button
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer"
                  title="Kosongkan seluruh daftar profil risiko"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Semua</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Identifikasi risiko komprehensif, evaluasi dampak, status mitigasi, dan risiko residual.
            </p>
          </div>

          {/* Quick Level Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => onSelectLevel('')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedLevel === ''
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => onSelectLevel('Critical')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedLevel === 'Critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => onSelectLevel('High')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedLevel === 'High'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
              }`}
            >
              Tinggi
            </button>
            <button
              onClick={() => onSelectLevel('Medium')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedLevel === 'Medium'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Sedang
            </button>
            <button
              onClick={() => onSelectLevel('Low')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                selectedLevel === 'Low'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Rendah
            </button>
          </div>
        </div>

        {/* Search & Select Filters Row */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kode risiko, judul, pemilik, atau divisi..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition"
            />
          </div>

          {/* Site Filter */}
          <select
            aria-label="Filter Site"
            value={selectedSite}
            onChange={(e) => onSelectSite && onSelectSite(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Site</option>
            {availableSites.map((st) => (
              <option key={st} value={st}>
                Site: {st}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            aria-label="Filter Departemen"
            value={selectedDepartment}
            onChange={(e) => onSelectDepartment(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Departemen</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            aria-label="Filter Kategori"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            aria-label="Filter Status"
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Open">Terbuka (Open)</option>
            <option value="Mitigating">Proses Mitigasi</option>
            <option value="Monitored">Dipantau (Monitored)</option>
            <option value="Closed">Selesai (Closed)</option>
          </select>

          {/* Clear Filters button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition whitespace-nowrap"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedRiskIds.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 animate-fade-in text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold text-rose-900">
              {selectedRiskIds.length} profil risiko dipilih
            </span>
            <button
              type="button"
              onClick={() => setSelectedRiskIds([])}
              className="text-[11px] text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer font-medium"
            >
              Batalkan Pilihan
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedRiskIds.length} Risiko Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead className="bg-slate-50 text-[11px] uppercase font-semibold tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  aria-label="Pilih semua risiko di tabel"
                  checked={sortedRisks.length > 0 && sortedRisks.every((r) => selectedRiskIds.includes(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allVisibleIds = sortedRisks.map((r) => r.id);
                      setSelectedRiskIds(Array.from(new Set([...selectedRiskIds, ...allVisibleIds])));
                    } else {
                      const visibleIdSet = new Set(sortedRisks.map((r) => r.id));
                      setSelectedRiskIds(selectedRiskIds.filter((id) => !visibleIdSet.has(id)));
                    }
                  }}
                  className="rounded accent-indigo-600 cursor-pointer w-4 h-4 align-middle"
                />
              </th>
              <th className="py-3.5 px-4 font-semibold">
                <button
                  onClick={() => handleSort('code')}
                  className="flex items-center space-x-1 hover:text-slate-900 transition"
                >
                  <span>Identifikasi Risiko</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">Departemen & Pemilik</th>
              <th className="py-3.5 px-3 font-semibold text-center">
                <button
                  onClick={() => handleSort('inherentScore')}
                  className="inline-flex items-center space-x-1 hover:text-slate-900 transition"
                >
                  <span>Risiko Inheren (L×I)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">
                <button
                  onClick={() => handleSort('progress')}
                  className="flex items-center space-x-1 hover:text-slate-900 transition"
                >
                  <span>Progres Mitigasi</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold text-center">
                <button
                  onClick={() => handleSort('residualScore')}
                  className="inline-flex items-center space-x-1 hover:text-slate-900 transition"
                >
                  <span>Risiko Residual</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">Status & Jadwal</th>
              <th className="py-3.5 px-4 font-semibold text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {risks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">Daftar Risiko Masih Kosong</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Daftar risiko lama telah dibersihkan. Anda dapat mulai mendaftarkan profil risiko baru sekarang.
                      </p>
                    </div>
                    {onOpenAddRisk && (
                      <button
                        onClick={onOpenAddRisk}
                        className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Profil Risiko Baru</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : sortedRisks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="w-7 h-7 text-slate-300" />
                    <p className="text-xs text-slate-600">Tidak ada risiko yang sesuai dengan kriteria filter.</p>
                    <button
                      onClick={onClearFilters}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Hapus semua filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedRisks.map((risk) => {
                const inherentCfg = getRiskLevelConfig(risk.inherentLevel);
                const residualCfg = getRiskLevelConfig(risk.residualLevel);
                const statusCfg = getStatusConfig(risk.status);

                return (
                  <tr
                    key={risk.id}
                    id={`risk-row-${risk.code}`}
                    className={`hover:bg-slate-50/80 transition group ${
                      selectedRiskIds.includes(risk.id) ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Pilih profil risiko ${risk.code}`}
                        checked={selectedRiskIds.includes(risk.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedRiskIds((prev) => [...prev, risk.id]);
                          } else {
                            setSelectedRiskIds((prev) => prev.filter((id) => id !== risk.id));
                          }
                        }}
                        className="rounded accent-indigo-600 cursor-pointer w-4 h-4 align-middle"
                      />
                    </td>

                    {/* Code & Title */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {risk.code}
                        </span>
                        {risk.site && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-rose-700 bg-rose-50 border border-rose-200 flex items-center">
                            <MapPin className="w-2.5 h-2.5 mr-0.5" />
                            {risk.site}
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200">
                          {risk.category}
                        </span>
                        {syncedRiskIds.has(risk.id) ? (
                          <span
                            title="Tersinkronisasi ke Google Spreadsheet Backup"
                            className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center"
                          >
                            <FileSpreadsheet className="w-3 h-3 mr-1 text-emerald-600" />
                            Synced
                          </span>
                        ) : (
                          <span
                            title="Belum ter-backup ke Google Sheet. Klik Refresh untuk menyinkronkan."
                            className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200 inline-flex items-center"
                          >
                            <Clock className="w-3 h-3 mr-1 text-amber-500" />
                            Pending Sync
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => onViewRisk(risk)}
                        className="mt-1 font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer line-clamp-1 transition"
                        title={risk.title}
                      >
                        {risk.title}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {risk.description}
                      </p>
                    </td>

                    {/* Department & Owner */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center text-slate-800 font-semibold">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                        <span>{risk.department}</span>
                      </div>
                      <div className="flex items-center text-xs text-slate-500 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                        <span className="truncate max-w-[130px]">{risk.owner}</span>
                      </div>
                    </td>

                    {/* Inherent Risk Score */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center">
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-bold ${inherentCfg.badgeBg}`}
                        >
                          <span className="font-mono text-xs">{risk.inherentScore}</span>
                          <span className="text-[10px] font-mono font-normal ml-1 opacity-70">
                            ({risk.inherentLikelihood}×{risk.inherentImpact})
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-1">
                          {inherentCfg.idLabel}
                        </span>
                        {risk.inherentWorstCaseScenario && (
                          <span
                            className="text-[10px] text-rose-600 hover:text-rose-700 mt-1 block max-w-[125px] truncate cursor-help flex items-center font-medium"
                            title={`Catatan / Skenario Terburuk Inherent: ${risk.inherentWorstCaseScenario}`}
                          >
                            <FileText className="w-3 h-3 mr-0.5 shrink-0" />
                            Skenario Terburuk
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Mitigation Plan & Progress */}
                    <td className="py-3.5 px-3 max-w-[200px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">
                          {risk.mitigationProgress}% Selesai
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {risk.actionItems?.filter((a) => a.completed).length}/
                          {risk.actionItems?.length || 0} Aksi
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            risk.mitigationProgress >= 80
                              ? 'bg-emerald-500'
                              : risk.mitigationProgress >= 40
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${risk.mitigationProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1" title={risk.mitigationPlan}>
                        {risk.mitigationPlan}
                      </p>
                    </td>

                    {/* Residual Risk Score */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center">
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-bold ${residualCfg.badgeBg}`}
                        >
                          <span className="font-mono text-xs">{risk.residualScore}</span>
                          <span className="text-[10px] font-mono font-normal ml-1 opacity-70">
                            ({risk.residualLikelihood}×{risk.residualImpact})
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-1">
                          {residualCfg.idLabel}
                        </span>
                      </div>
                    </td>

                    {/* Status & Review Date */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusCfg.badge}`}
                      >
                        {statusCfg.label}
                      </span>
                      <div className="flex items-center text-xs text-slate-400 mt-1 font-medium">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                        <span>Target: {risk.targetDate}</span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onViewRisk(risk)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Lihat Detail Profil Risiko"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditRisk(risk)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Edit Risiko"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetRisk(risk)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus Profil Risiko"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal for Single Risk Delete */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetRisk)}
        onClose={() => setDeleteTargetRisk(null)}
        onConfirm={() => {
          if (deleteTargetRisk) {
            onDeleteRisk(deleteTargetRisk.id);
            setSelectedRiskIds((prev) => prev.filter((id) => id !== deleteTargetRisk.id));
            setDeleteTargetRisk(null);
          }
        }}
        title="Hapus Profil Risiko"
        message="Apakah Anda yakin ingin menghapus profil risiko ini? Data profil risiko dan rencana tindakan mitigasinya akan dihapus dari Risk Register."
        itemDetails={
          deleteTargetRisk
            ? {
                code: deleteTargetRisk.code,
                title: deleteTargetRisk.title,
                category: deleteTargetRisk.category,
                department: deleteTargetRisk.department,
              }
            : undefined
        }
        confirmButtonText="Ya, Hapus Profil Risiko"
      />

      {/* Confirmation Modal for Bulk Delete */}
      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={() => {
          if (onDeleteMultipleRisks) {
            onDeleteMultipleRisks(selectedRiskIds);
          } else {
            selectedRiskIds.forEach((id) => onDeleteRisk(id));
          }
          setSelectedRiskIds([]);
          setIsBulkDeleteModalOpen(false);
        }}
        title="Hapus Profil Risiko Terpilih"
        message={`Apakah Anda yakin ingin menghapus ${selectedRiskIds.length} profil risiko terpilih secara bersamaan? Tindakan ini tidak dapat dibatalkan.`}
        itemDetails={{
          count: selectedRiskIds.length,
        }}
        confirmButtonText={`Hapus ${selectedRiskIds.length} Risiko`}
      />

      {/* Confirmation Modal for Clear All Risks */}
      <ConfirmDeleteModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirm={() => {
          if (onClearAllRisks) {
            onClearAllRisks();
          } else {
            risks.forEach((r) => onDeleteRisk(r.id));
          }
          setSelectedRiskIds([]);
          setIsClearAllModalOpen(false);
        }}
        title="Kosongkan Seluruh Profil Risiko"
        message="Apakah Anda yakin ingin menghapus seluruh daftar profil risiko yang ada saat ini? Semua data profil risiko dan rencana tindakan mitigasi akan dibersihkan untuk memulai daftar baru."
        itemDetails={{
          count: risks.length,
        }}
        confirmButtonText="Kosongkan Semua Risiko"
      />
    </div>
  );
};
