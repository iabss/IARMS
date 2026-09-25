import { RiskLevel } from '../types/risk';

export const LIKELIHOOD_LABELS: Record<number, { title: string; desc: string; en: string }> = {
  1: { title: '1 - Sangat Jarang', desc: '< 1x per 3 tahun', en: 'Rare' },
  2: { title: '2 - Jarang Terjadi', desc: '1x per 1-3 tahun', en: 'Unlikely' },
  3: { title: '3 - Mungkin Terjadi', desc: '1x per tahun', en: 'Possible' },
  4: { title: '4 - Sering', desc: 'Beberapa kali per tahun', en: 'Likely' },
  5: { title: '5 - Hampir Pasti', desc: 'Rutin / > 1x per bulan', en: 'Almost Certain' },
};

export const IMPACT_LABELS: Record<number, { title: string; desc: string; en: string }> = {
  1: { title: '1 - Sangat Rendah', desc: 'Dampak finansial/operasional minimal (< Rp 50Jt)', en: 'Insignificant' },
  2: { title: '2 - Rendah', desc: 'Kerugian terukur, operasional terganggu sejenak', en: 'Minor' },
  3: { title: '3 - Moderat', desc: 'Dampak signifikan pada divisi, biaya Rp 200Jt-1M', en: 'Moderate' },
  4: { title: '4 - Tinggi', desc: 'Gangguan operasional meluas, reputasi tercoreng', en: 'Major' },
  5: { title: '5 - Katastropik', desc: 'Ancaman kelangsungan usaha, sanksi berat', en: 'Catastrophic' },
};

/**
 * ISO 31000 Standard 5x5 Scoring:
 * Score = Likelihood (1-5) * Impact (1-5)
 * 15 - 25: Critical / Ekstrem (Merah)
 * 10 - 14: High / Tinggi (Oranye)
 * 5 - 9:   Medium / Moderat (Kuning)
 * 1 - 4:   Low / Rendah (Hijau)
 */
export function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 15) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

export function getRiskLevelConfig(level: RiskLevel) {
  switch (level) {
    case 'Critical':
      return {
        idLabel: 'Ekstrem / Kritis',
        enLabel: 'Critical',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500',
        matrixCellBg: 'bg-rose-100/90 hover:bg-rose-200/90 border-rose-300 text-rose-900',
        activeMatrixRing: 'ring-rose-500 ring-2',
        hex: '#e11d48',
        actionRequired: 'Penanganan Darurat Direksi & Pemantauan Mingguan',
      };
    case 'High':
      return {
        idLabel: 'Tinggi',
        enLabel: 'High',
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        dotColor: 'bg-orange-500',
        matrixCellBg: 'bg-orange-100/90 hover:bg-orange-200/90 border-orange-300 text-orange-900',
        activeMatrixRing: 'ring-orange-500 ring-2',
        hex: '#ea580c',
        actionRequired: 'Rencana Mitigasi Khusus & Pelaporan Bulanan',
      };
    case 'Medium':
      return {
        idLabel: 'Moderat / Sedang',
        enLabel: 'Medium',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        dotColor: 'bg-amber-500',
        matrixCellBg: 'bg-amber-100/90 hover:bg-amber-200/90 border-amber-300 text-amber-900',
        activeMatrixRing: 'ring-amber-500 ring-2',
        hex: '#d97706',
        actionRequired: 'Pengawasan Prosedur Rutin oleh Manajer Terkait',
      };
    case 'Low':
    default:
      return {
        idLabel: 'Rendah',
        enLabel: 'Low',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
        matrixCellBg: 'bg-emerald-100/90 hover:bg-emerald-200/90 border-emerald-300 text-emerald-900',
        activeMatrixRing: 'ring-emerald-500 ring-2',
        hex: '#059669',
        actionRequired: 'Diterima dalam Batas Toleransi Risiko',
      };
  }
}

export function getStatusConfig(status: string) {
  switch (status) {
    case 'Open':
      return {
        label: 'Terbuka (Open)',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    case 'Mitigating':
      return {
        label: 'Proses Mitigasi',
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    case 'Monitored':
      return {
        label: 'Dipantau (Monitored)',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'Closed':
      return {
        label: 'Selesai / Terkendali',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    default:
      return {
        label: status,
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}
