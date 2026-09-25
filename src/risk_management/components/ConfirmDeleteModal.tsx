import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemDetails?: {
    code?: string;
    title?: string;
    category?: string;
    department?: string;
    count?: number;
  };
  confirmButtonText?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemDetails,
  confirmButtonText = 'Ya, Hapus Sekarang',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

          {itemDetails && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              {itemDetails.count !== undefined && itemDetails.count > 0 && (
                <div className="flex items-center justify-between text-slate-500 font-medium text-xs">
                  <span>Jumlah Data:</span>
                  <span className="font-bold text-rose-600">
                    {itemDetails.count} Profil Risiko
                  </span>
                </div>
              )}
              {itemDetails.code && (
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
                    {itemDetails.code}
                  </span>
                  {itemDetails.category && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                      {itemDetails.category}
                    </span>
                  )}
                </div>
              )}
              {itemDetails.title && (
                <p className="font-semibold text-slate-900 line-clamp-2">
                  {itemDetails.title}
                </p>
              )}
              {itemDetails.department && (
                <p className="text-xs text-slate-500">
                  Departemen: <span className="font-medium text-slate-700">{itemDetails.department}</span>
                </p>
              )}
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              ⚠️ Perhatian: Data profil risiko, penilaian probabilitas & dampak, serta daftar rencana tindakan mitigasi terkait akan dihapus secara permanen.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center space-x-1.5 transition active:scale-95 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
