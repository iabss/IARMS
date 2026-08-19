import React, { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { AuditEngagement } from '../types';

interface NewAuditModalProps {
  onClose: () => void;
  onSubmit: (audit: Omit<AuditEngagement, 'id' | 'actDays' | 'progress'>) => void;
}

export default function NewAuditModal({ onClose, onSubmit }: NewAuditModalProps) {
  const [title, setTitle] = useState('');
  const [auditor, setAuditor] = useState('');
  const [planDays, setPlanDays] = useState('10');
  const [status, setStatus] = useState<'On-Going' | 'Planned' | 'Completed'>('On-Going');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !auditor.trim()) return;

    onSubmit({
      title: title.trim(),
      auditor: auditor.trim(),
      planDays: parseInt(planDays) || 10,
      status: status
    });

    // Reset Form
    setTitle('');
    setAuditor('');
    setPlanDays('10');
    setStatus('On-Going');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 space-y-4 shadow-2xl bg-white">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-sky-600" />
            Tambah Program Audit Baru
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Judul Audit Engagement</label>
            <input
              type="text"
              required
              placeholder="Contoh: Audit Stok Sparepart Gudang C"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white shadow-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Lead Auditor</label>
              <input
                type="text"
                required
                placeholder="Nama Auditor"
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white shadow-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Target Hari (Plan)</label>
              <input
                type="number"
                required
                min="1"
                value={planDays}
                onChange={(e) => setPlanDays(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white shadow-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Status Awal</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white shadow-sm font-semibold text-sky-700"
            >
              <option value="On-Going">On-Going</option>
              <option value="Planned">Planned</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="pt-3 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
            >
              Simpan Engagement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
