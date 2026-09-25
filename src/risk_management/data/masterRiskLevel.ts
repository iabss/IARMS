export type MasterRiskDimensionKey =
  | 'entityWide'
  | 'output'
  | 'humanResources'
  | 'legalRegulatory'
  | 'financial';

export interface MasterRiskDimension {
  key: MasterRiskDimensionKey;
  label: string;
  subLabel: string;
}

export const MASTER_RISK_DIMENSIONS: MasterRiskDimension[] = [
  { key: 'entityWide', label: 'Entity Wide', subLabel: 'Dampak Perusahaan & Kelangsungan Organisasi' },
  { key: 'output', label: 'Output', subLabel: 'Kinerja Operasional & Delivery (QCDSM)' },
  { key: 'humanResources', label: 'Human Resources', subLabel: 'Keselamatan Kerja, Moral, & Citra Karyawan' },
  { key: 'legalRegulatory', label: 'Legal & Regulatory', subLabel: 'Kepatuhan Regulasi & Risiko Hukum' },
  { key: 'financial', label: 'Financial', subLabel: 'Eksposur Kerugian Finansial & Laba' },
];

export interface MasterRiskLevelRow {
  level: number;
  levelNameId: string;
  levelNameEn: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  entityWide: string[];
  output: string[];
  humanResources: string[];
  legalRegulatory: string[];
  financial: string[];
}

export const MASTER_RISK_LEVEL_DATA: MasterRiskLevelRow[] = [
  {
    level: 5,
    levelNameId: 'Katastropik / Sangat Berat',
    levelNameEn: 'Catastrophic',
    badgeBg: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-300',
    entityWide: [
      'Perusahaan tutup',
      'Owner dipidana',
    ],
    output: [
      'Complete cessation of core operations',
    ],
    humanResources: [
      'Multiple fatalities or permanent total disability',
    ],
    legalRegulatory: [
      'Criminal prosecution, revocation of license to operate',
    ],
    financial: [
      'Financial loss > 30% of annual revenue',
    ],
  },
  {
    level: 4,
    levelNameId: 'Major / Berat',
    levelNameEn: 'Major',
    badgeBg: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    entityWide: [
      'Gagal strategi',
      'Kehilangan pangsa pasar besar',
      'Reputasi perusahaan',
      'Kelangsungan organisasi terancam',
    ],
    output: [
      'Target kinerja utama tidak tercapai',
    ],
    humanResources: [
      'Tingginya turnover',
      'Citra buruk sebagai pemberi kerja',
    ],
    legalRegulatory: [
      'Pelanggaran regulasi berat',
      'Potensi gugatan hukum',
    ],
    financial: [
      'Kerugian besar dan berkelanjutan (> 1 tahun)',
    ],
  },
  {
    level: 3,
    levelNameId: 'Moderat / Sedang',
    levelNameEn: 'Moderate',
    badgeBg: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    entityWide: [
      'Reputasi terdampak, namun masih bisa dipulihkan',
    ],
    output: [
      'Penurunan kinerja di beberapa aspek (QCDSM)',
    ],
    humanResources: [
      'Masalah moral karyawan meluas (mempengaruhi QCD di beberapa proses)',
    ],
    legalRegulatory: [
      'Pelanggaran regulasi dengan konsekuensi material',
    ],
    financial: [
      'Kerugian/kelebihan pengeluaran keuangan dalam jumlah IDR dalam satu periode waktu',
      'ROI nol/negatif',
    ],
  },
  {
    level: 2,
    levelNameId: 'Minor / Ringan',
    levelNameEn: 'Minor',
    badgeBg: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    entityWide: [
      'Tidak ada dampak signifikan',
    ],
    output: [
      'Penurunan kinerja kecil di level unit/departemen',
    ],
    humanResources: [
      'Penurunan kepuasan karyawan (dampak kecil terhadap produktivitas & hasil kerja)',
    ],
    legalRegulatory: [
      'Pelanggaran peraturan dengan konsekuensi minimal',
    ],
    financial: [
      'Overbudget departemen secara parsial',
      'Dampak kecil terhadap KPI keuangan',
    ],
  },
  {
    level: 1,
    levelNameId: 'Insignificant / Sangat Rendah',
    levelNameEn: 'Insignificant',
    badgeBg: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    entityWide: [
      'Negligible impact, business as usual',
    ],
    output: [
      'Negligible disruption to operations',
    ],
    humanResources: [
      'Near miss or no injury',
    ],
    legalRegulatory: [
      'Procedural non-compliance, no external reporting needed',
    ],
    financial: [
      'Financial loss < 1% of annual revenue',
    ],
  },
];

export function getMasterRiskLevelRow(level: number): MasterRiskLevelRow | undefined {
  return MASTER_RISK_LEVEL_DATA.find((r) => r.level === level);
}
