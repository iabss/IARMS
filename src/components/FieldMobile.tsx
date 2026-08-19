import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  WifiOff, 
  Wifi, 
  QrCode, 
  Camera, 
  RefreshCw, 
  Smartphone 
} from 'lucide-react';

interface FieldMobileProps {
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  key?: string;
}

export default function FieldMobile({ onToast }: FieldMobileProps) {
  const [scannedId, setScannedId] = useState('BSS-EX302-OPS');
  const [isSynced, setIsSynced] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [checklist, setChecklist] = useState({
    nomorSerasi: true,
    hmFisik: true,
    segelTangki: false
  });

  const handleScan = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const newCode = `BSS-EX${randomNum}-OPS`;
    setScannedId(newCode);
    setIsSynced(false); // Reset sync on new inspection
    onToast(`Barcode terdeteksi: ${newCode}`, 'info');
  };

  const handleCapturePhoto = () => {
    setHasPhoto(true);
    setIsSynced(false); // Reset sync on change
    onToast('Foto bukti unit berhasil ditangkap', 'success');
  };

  const handleSyncData = () => {
    setIsSynced(true);
    onToast('Data Inspeksi Lapangan Berhasil Disinkronkan ke Database Pusat!', 'success');
  };

  const handleChecklistChange = (key: 'nomorSerasi' | 'hmFisik' | 'segelTangki') => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setIsSynced(false); // Reset sync on changes
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      <div className="max-w-md mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <Smartphone className="w-5 h-5 text-sky-600" /> Simulator Mobile Audit Lapangan
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Simulasi aplikasi smartphone yang digunakan auditor di site/gudang
          </p>
        </div>

        {/* Smartphone Mockup Wrapper */}
        <div className="bg-slate-900 border-4 border-slate-800 rounded-[2.5rem] p-4 shadow-xl relative overflow-hidden">
          {/* Phone Speaker Notch */}
          <div className="w-28 h-4 bg-slate-800 rounded-b-xl mx-auto mb-4 border-x border-b border-slate-700 flex items-center justify-center">
            <div className="w-8 h-1 bg-slate-600 rounded-full"></div>
          </div>

          {/* App Mobile Interface */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-200">
            {/* App Top Bar */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-sky-700 tracking-wider uppercase block">
                  Audit Mobile Inspector
                </span>
                <h3 className="text-xs font-bold text-slate-900 leading-tight">
                  Opname Unit & Stok Site B
                </h3>
              </div>
              <span 
                className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1.5 transition-all ${
                  isSynced 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                {isSynced ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 text-emerald-600 animate-pulse" /> Synced Live
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-amber-600" /> Offline Local
                  </>
                )}
              </span>
            </div>

            {/* Barcode Scanner Simulation Button */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-semibold">1. Scan Barcode / Tag Unit:</span>
                <span className="text-sky-700 font-mono font-bold" id="scanned-id">
                  {scannedId}
                </span>
              </div>
              <button 
                onClick={handleScan}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-sky-400" />
                [Simulasi] Scan QR Code Lambung
              </button>
            </div>

            {/* Inspection Checklist */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">2. Item Verifikasi Fisik:</span>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 shadow-sm transition">
                  <input 
                    type="checkbox" 
                    checked={checklist.nomorSerasi} 
                    onChange={() => handleChecklistChange('nomorSerasi')}
                    className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4"
                  />
                  <span className="text-slate-800 font-semibold">Fisik Unit & Nomor Serasi</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 shadow-sm transition">
                  <input 
                    type="checkbox" 
                    checked={checklist.hmFisik} 
                    onChange={() => handleChecklistChange('hmFisik')}
                    className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4"
                  />
                  <span className="text-slate-800 font-semibold">Kondisi Hour Meter (HM) Fisik</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 shadow-sm transition">
                  <input 
                    type="checkbox" 
                    checked={checklist.segelTangki} 
                    onChange={() => handleChecklistChange('segelTangki')}
                    className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4"
                  />
                  <span className="text-slate-800 font-semibold">Segel Tangki Bahan Bakar Utuh</span>
                </label>
              </div>
            </div>

            {/* Photo Attachment Simulation */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">3. Tangkap Foto Bukti Lapangan:</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleCapturePhoto}
                  className="h-20 bg-white border border-dashed border-slate-300 hover:border-sky-500 rounded-xl flex flex-col items-center justify-center text-slate-500 text-[11px] gap-1 transition shadow-sm font-semibold cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-sky-600" />
                  + Ambil Foto
                </button>
                <div className="h-20 bg-slate-200 rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden relative">
                  {hasPhoto ? (
                    <>
                      <img 
                        src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80" 
                        className="w-full h-full object-cover" 
                        alt="Unit Inspection"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-1 right-1 text-[8px] bg-slate-900/80 text-emerald-400 px-1 font-bold rounded">
                        Captured
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic font-medium">Belum ada foto</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sync Data Action */}
            <div className="pt-2">
              <button 
                onClick={handleSyncData}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
                Sinkronkan Data ke Database Pusat
              </button>
            </div>
          </div>

          {/* Phone Home Bar */}
          <div className="w-32 h-1 bg-slate-700 rounded-full mx-auto mt-4"></div>
        </div>
      </div>
    </motion.div>
  );
}
