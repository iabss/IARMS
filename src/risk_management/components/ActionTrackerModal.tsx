import React, { useState } from 'react';
import {
  X,
  ListCheck,
  CheckCircle2,
  Circle,
  Calendar,
  User,
  Search,
  ExternalLink,
} from 'lucide-react';
import { RiskItem, ActionItem } from '../types/risk';

interface ActionTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  risks: RiskItem[];
  onToggleActionItem: (riskId: string, actionId: string) => void;
  onSelectRisk: (risk: RiskItem) => void;
}

export const ActionTrackerModal: React.FC<ActionTrackerModalProps> = ({
  isOpen,
  onClose,
  risks,
  onToggleActionItem,
  onSelectRisk,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  // Collect all actions mapped to their risk
  const allActionsWithRisk = risks.flatMap((risk) =>
    (risk.actionItems || []).map((action) => ({
      ...action,
      riskId: risk.id,
      riskCode: risk.code,
      riskTitle: risk.title,
      riskCategory: risk.category,
      riskItem: risk,
    }))
  );

  const total = allActionsWithRisk.length;
  const completedCount = allActionsWithRisk.filter((a) => a.completed).length;
  const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const assignees = Array.from(new Set(allActionsWithRisk.map((a) => a.assignee)));

  const filteredActions = allActionsWithRisk.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.action.toLowerCase().includes(q) &&
        !a.riskCode.toLowerCase().includes(q) &&
        !a.assignee.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filterStatus === 'Pending' && a.completed) return false;
    if (filterStatus === 'Completed' && !a.completed) return false;
    if (selectedAssignee && a.assignee !== selectedAssignee) return false;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
              <ListCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Pelacak Rencana Tindakan Mitigasi (Action Tracker)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengawasan eksekusi rencana perbaikan risiko di seluruh unit kerja.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress summary bar */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-600">
              Total Selesai: <b className="text-slate-900">{completedCount}</b> dari <b className="text-slate-900">{total}</b> Tindakan
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200">
              {completionPercentage}% Selesai
            </span>
          </div>

          <div className="w-full sm:w-48 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari tindakan, PIC, atau kode risiko..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              aria-label="Filter PIC"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-500"
            >
              <option value="">Semua PIC</option>
              {assignees.map((pic) => (
                <option key={pic} value={pic}>
                  {pic}
                </option>
              ))}
            </select>

            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('All')}
                className={`px-3 py-1 rounded-md text-xs transition ${
                  filterStatus === 'All' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterStatus('Pending')}
                className={`px-3 py-1 rounded-md text-xs transition ${
                  filterStatus === 'Pending' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Belum
              </button>
              <button
                onClick={() => setFilterStatus('Completed')}
                className={`px-3 py-1 rounded-md text-xs transition ${
                  filterStatus === 'Completed' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>

        {/* Action Items List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {filteredActions.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">
              Tidak ada rencana aksi yang sesuai dengan kriteria saringan.
            </p>
          ) : (
            filteredActions.map((action) => (
              <div
                key={action.id}
                className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  action.completed
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <button
                    onClick={() => onToggleActionItem(action.riskId, action.id)}
                    className="mt-0.5 text-slate-300 hover:text-emerald-500 transition"
                  >
                    {action.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {action.riskCode}
                      </span>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                        {action.riskCategory}
                      </span>
                    </div>

                    <div
                      className={`text-xs font-semibold mt-1 ${
                        action.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {action.action}
                    </div>

                    <div className="text-xs text-slate-400 mt-0.5">
                      Risiko: <span className="text-slate-600">{action.riskTitle}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs pl-8 sm:pl-0 shrink-0">
                  <div className="text-right">
                    <span className="block font-semibold text-slate-800">
                      PIC: {action.assignee}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center sm:justify-end mt-0.5">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Tenggat: {action.dueDate}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onSelectRisk(action.riskItem);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                    title="Buka Profil Risiko Terkait"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
