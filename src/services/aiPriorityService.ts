import { AFSFindingRecord } from '../types';
import { isStatusClosed, isStatusOpen, isStatusProgress, extractFindingYear } from '../utils/statusHelper';
import { matchesDepartmentRecord } from '../utils/deptHelper';

export type PriorityRiskLevel = 'CRITICAL' | 'HIGH';

export interface PriorityRecommendationItem {
  id: string;
  rank: number;
  score: number; // 0 to 100
  riskLevel: PriorityRiskLevel;
  record: AFSFindingRecord;
  financialImpact: {
    score: number; // 0 - 100
    estimatedValue?: string; // e.g., "Rp 859 Juta"
    description: string;
    level: 'Sangat Tinggi' | 'Tinggi' | 'Sedang' | 'Rendah';
  };
  operationalImpact: {
    score: number; // 0 - 100
    description: string;
    level: 'Sangat Tinggi' | 'Tinggi' | 'Sedang' | 'Rendah';
  };
  urgencyScore: number;
  aiRationale: string;
  keyMitigationAction: string;
  isAiEnriched?: boolean;
}

export interface PriorityFilterOptions {
  site?: string;
  dept?: string;
  year?: string;
  triggerGeminiEnrichment?: boolean;
}

export interface ScoredFindingAnalysis {
  score: number;
  riskLevel: PriorityRiskLevel;
  financialImpact: PriorityRecommendationItem['financialImpact'];
  operationalImpact: PriorityRecommendationItem['operationalImpact'];
  urgencyScore: number;
  aiRationale: string;
  keyMitigationAction: string;
}

// In-memory scoring cache to ensure instant O(1) response without redundant regex parsing
const scoringCache = new Map<string, ScoredFindingAnalysis>();

export function getFindingCacheKey(record: AFSFindingRecord): string {
  return [
    record._rowId ?? '',
    record.NO ?? '',
    record['PROJECT AUDIT'] ?? '',
    record.SITE ?? '',
    record.STATUS ?? '',
    record.REMARKS ?? '',
    record['REVIEWED CLOSING FROM IA'] ?? '',
    record['DUE DATE'] ?? '',
    record.KATEGORI ?? '',
    record['PROBLEM/FINDING'] ?? '',
    record['REKOMENDASI'] ?? ''
  ].join(':::');
}

export function clearPriorityScoringCache(): void {
  scoringCache.clear();
}

export interface PrioritySummary {
  totalCriticalActive: number;
  totalHighActive: number;
  averageDueDays: {
    averageDays: number;
    label: string;
    isOverdueAvg: boolean;
  };
  progressClosing: {
    inProgressCount: number;
    openCount: number;
    inProgressPercentage: number;
    totalActiveAfs: number;
    totalClosedAfs: number;
    overallClosingRate: number;
  };
  totalEstimatedExposure: string;
  nearestDeadline: {
    date: string;
    daysRemaining: number;
    isOverdue: boolean;
    projectName: string;
    pic: string;
  } | null;
  totalCritical: number;
  totalHigh: number;
  totalCompleted: number;
  totalOpenOrProgress: number;
}

// Financial keywords with impact weights
const FINANCIAL_PATTERNS = [
  { regex: /(?:fraud|penggelapan|fiktif|mark[-\s]?up|korupsi)/i, weight: 35, desc: 'Indikasi Fraud / Manipulasi Data Keuangan' },
  { regex: /(?:kerugian|loss|kebocoran dana|defisit)/i, weight: 30, desc: 'Potensi Kerugian Finansial Langsung' },
  { regex: /(?:selisih kas|selisih fisik|shortage|minus kas)/i, weight: 25, desc: 'Selisih Fisik / Kas Opname' },
  { regex: /(?:sisa nilai buku|scrap|penghapusan aset)/i, weight: 25, desc: 'Penurunan Nilai Aset / Risiko Scrap' },
  { regex: /(?:denda|pajak|penalti|sanksi finansial)/i, weight: 25, desc: 'Eksposur Denda Regulator / Pajak' },
  { regex: /(?:overpayment|pembayaran ganda|kelebihan bayar)/i, weight: 20, desc: 'Kelebihan Pembayaran / Overpayment' },
  { regex: /(?:piutang macet|unbilled|unpaid|invoice belum terbit)/i, weight: 20, desc: 'Keterlambatan Penagihan / Piutang' },
  { regex: /(?:tanpa po|tanpa persetujuan|bypass pr|unauthorized)/i, weight: 15, desc: 'Pengadaan Tanpa Otorisasi Resmi' },
  { regex: /(?:solar|bbm|fuel|oli|sparepart|inventory)/i, weight: 15, desc: 'Risiko Material Bernilai Tinggi (Fuel/Sparepart)' },
];

// Operational disruption patterns with impact weights
const OPERATIONAL_PATTERNS = [
  { regex: /(?:stop operasi|terhenti|berhenti beroperasi|shutdown)/i, weight: 40, desc: 'Potensi Penghentian Operasional Proyek' },
  { regex: /(?:fatality|kecelakaan kerja|korban|bahaya fatal)/i, weight: 40, desc: 'Risiko Keselamatan Karyawan & Fatality' },
  { regex: /(?:amdal|izin dicabut|sanksi esdm|ilegal|penyegelan)/i, weight: 35, desc: 'Pelanggaran Regulasi ESDM/Lingkungan (Izin Operasi)' },
  { regex: /(?:breakdown|downtime|unit breakdown|unit rusak)/i, weight: 30, desc: 'Downtime & Kerusakan Unit Produksi Kritis' },
  { regex: /(?:krisis bahan bakar|kehabisan bbm|suplai terputus)/i, weight: 30, desc: 'Gangguan Rantai Pasok Bahan Bakar / Material Utama' },
  { regex: /(?:sistem down|sap error|ipms error|database corrupt)/i, weight: 25, desc: 'Gangguan Sistem & Kegagalan Integrasi IT' },
  { regex: /(?:keterlambatan pengiriman|keterlambatan produksi|bottleneck)/i, weight: 25, desc: 'Hambatan Alur Kerja & Target Produksi Meleset' },
  { regex: /(?:tanpa kalibrasi|unit ilegal|tanpa sertifikasi|kelayakan)/i, weight: 20, desc: 'Ketidaksesuaian Standar Kelaikan Teknis' },
  { regex: /(?:sop tidak dipatuhi|prosedur dilanggar|tidak ada kontrol)/i, weight: 15, desc: 'Kelemahan Kontrol Internal & Pelanggaran SOP' },
];

// Helper to extract nominal monetary values from text
export function extractMonetaryValue(text: string): { rawNominal?: string; estimatedRupiah: number } {
  if (!text) return { estimatedRupiah: 0 };

  // Match: Rp 859 juta, Rp 1,5 Miliar, Rp. 500.000.000, 859 jt, 2.5 M, etc.
  const regexJutaMiliar = /(?:rp\.?|idr)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(miliar|milyar|juta|jt|m|ribu|rb)\b/gi;
  let match = regexJutaMiliar.exec(text);
  if (match) {
    const rawNum = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    let mult = 1;
    if (unit.startsWith('miliar') || unit.startsWith('milyar') || unit === 'm') mult = 1_000_000_000;
    else if (unit.startsWith('juta') || unit === 'jt') mult = 1_000_000;
    else if (unit.startsWith('ribu') || unit === 'rb') mult = 1_000;

    const rupiah = rawNum * mult;
    let label = `Rp ${match[1]} ${unit.toUpperCase()}`;
    if (mult === 1_000_000_000) label = `Rp ${match[1]} Miliar`;
    if (mult === 1_000_000) label = `Rp ${match[1]} Juta`;

    return { rawNominal: label, estimatedRupiah: rupiah };
  }

  // Match full number e.g. Rp 859.000.000 or Rp. 1.250.000.000
  const regexFullRp = /(?:rp\.?|idr)\s*([0-9]{1,3}(?:\.[0-9]{3})+)/gi;
  const matchFull = regexFullRp.exec(text);
  if (matchFull) {
    const cleanStr = matchFull[1].replace(/\./g, '');
    const rupiah = parseInt(cleanStr, 10);
    if (!isNaN(rupiah) && rupiah > 0) {
      const formatted = rupiah >= 1_000_000_000 
        ? `Rp ${(rupiah / 1_000_000_000).toFixed(1)} Miliar`
        : rupiah >= 1_000_000 
          ? `Rp ${(rupiah / 1_000_000).toFixed(0)} Juta`
          : `Rp ${rupiah.toLocaleString('id-ID')}`;
      return { rawNominal: formatted, estimatedRupiah: rupiah };
    }
  }

  return { estimatedRupiah: 0 };
}

// Calculate days remaining or overdue from due date string
export function parseDueDateInfo(dueDateStr?: string): { daysRemaining: number; isOverdue: boolean; formattedDate: string } {
  if (!dueDateStr || !dueDateStr.trim() || dueDateStr === '-' || dueDateStr === 'N/A') {
    return { daysRemaining: 999, isOverdue: false, formattedDate: '-' };
  }

  try {
    const parts = dueDateStr.trim().split(/[\/\-]/);
    let targetDate: Date | null = null;

    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);

      // check if YYYY-MM-DD or MM/DD/YYYY or DD/MM/YYYY
      if (p0 > 1000) {
        // YYYY-MM-DD
        targetDate = new Date(p0, p1 - 1, p2);
      } else if (p2 > 1000) {
        // either MM/DD/YYYY or DD/MM/YYYY
        // In Indonesian sheets, often M/D/YYYY or D/M/YYYY
        if (p0 > 12) {
          targetDate = new Date(p2, p1 - 1, p0); // DD/MM/YYYY
        } else {
          targetDate = new Date(p2, p0 - 1, p1); // MM/DD/YYYY
        }
      }
    } else {
      targetDate = new Date(dueDateStr);
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      return { daysRemaining: 999, isOverdue: false, formattedDate: dueDateStr };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - now.getTime();
    const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0;

    const day = String(targetDate.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = monthNames[targetDate.getMonth()];
    const year = targetDate.getFullYear();

    return {
      daysRemaining,
      isOverdue,
      formattedDate: `${day} ${month} ${year}`
    };
  } catch {
    return { daysRemaining: 999, isOverdue: false, formattedDate: dueDateStr };
  }
}

/**
 * Core Algorithm: Multi-Factor AI Risk Scoring
 * Analyzes financial loss, operational disruption, urgency, and systemic audit categories.
 */
export function scoreFindingRecord(record: AFSFindingRecord): ScoredFindingAnalysis {
  const cacheKey = getFindingCacheKey(record);
  const cached = scoringCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const combinedText = [
    record['PROBLEM/FINDING'] || '',
    record['DETAIL TEMUAN'] || '',
    record['KRITERIA'] || '',
    record['KATEGORI'] || '',
    record['REKOMENDASI'] || '',
    record['REMARKS'] || ''
  ].join(' ');

  // 1. Financial Impact Scoring
  const money = extractMonetaryValue(combinedText);
  let finBaseScore = 30; // default baseline
  let finDesc = 'Dampak finansial rutin / belum ada estimasi kerugian langsung.';
  let finLevel: PriorityRecommendationItem['financialImpact']['level'] = 'Rendah';

  if (money.estimatedRupiah >= 1_000_000_000) {
    finBaseScore = 95;
    finDesc = `Eksposur kerugian material sangat besar (> Rp 1 Miliar): ${money.rawNominal}`;
    finLevel = 'Sangat Tinggi';
  } else if (money.estimatedRupiah >= 500_000_000) {
    finBaseScore = 88;
    finDesc = `Eksposur kerugian material signifikan (Rp 500 Juta - 1 Miliar): ${money.rawNominal}`;
    finLevel = 'Sangat Tinggi';
  } else if (money.estimatedRupiah >= 100_000_000) {
    finBaseScore = 80;
    finDesc = `Kerugian finansial teridentifikasi (Rp 100 Juta - 500 Juta): ${money.rawNominal}`;
    finLevel = 'Tinggi';
  } else if (money.estimatedRupiah > 0) {
    finBaseScore = 65;
    finDesc = `Potensi kerugian finansial terdeteksi: ${money.rawNominal}`;
    finLevel = 'Sedang';
  }

  // Check additional financial keywords
  let keywordFinBonus = 0;
  for (const item of FINANCIAL_PATTERNS) {
    if (item.regex.test(combinedText)) {
      keywordFinBonus += item.weight;
      if (finDesc.includes('rutin')) {
        finDesc = item.desc;
      }
    }
  }

  const finalFinScore = Math.min(100, Math.max(finBaseScore, Math.min(100, finBaseScore + keywordFinBonus * 0.5)));
  if (finalFinScore >= 85) finLevel = 'Sangat Tinggi';
  else if (finalFinScore >= 70) finLevel = 'Tinggi';
  else if (finalFinScore >= 50) finLevel = 'Sedang';
  else finLevel = 'Rendah';

  // 2. Operational Disruption Scoring
  let opsBaseScore = 30;
  let opsDesc = 'Gangguan operasional tingkat standar / administratif.';
  let opsLevel: PriorityRecommendationItem['operationalImpact']['level'] = 'Rendah';
  let keywordOpsBonus = 0;

  for (const item of OPERATIONAL_PATTERNS) {
    if (item.regex.test(combinedText)) {
      keywordOpsBonus += item.weight;
      if (opsDesc.includes('standar')) {
        opsDesc = item.desc;
      }
    }
  }

  const finalOpsScore = Math.min(100, Math.max(opsBaseScore, Math.min(100, opsBaseScore + keywordOpsBonus * 0.8)));
  if (finalOpsScore >= 85) opsLevel = 'Sangat Tinggi';
  else if (finalOpsScore >= 70) opsLevel = 'Tinggi';
  else if (finalOpsScore >= 50) opsLevel = 'Sedang';
  else opsLevel = 'Rendah';

  // 3. Urgency & Status Scoring
  let urgencyScore = 30;
  const isClosed = isStatusClosed(record.STATUS, record.REMARKS, record['REVIEWED CLOSING FROM IA']);
  const isOpen = isStatusOpen(record.STATUS, record.REMARKS, record['REVIEWED CLOSING FROM IA']);
  const isProgress = isStatusProgress(record.STATUS, record.REMARKS, record['REVIEWED CLOSING FROM IA']);
  const remarksText = (record.REMARKS || '').toUpperCase();
  const dueDateInfo = parseDueDateInfo(record['DUE DATE']);

  if (isOpen) {
    urgencyScore += 35;
  } else if (isProgress) {
    urgencyScore += 20;
  } else if (isClosed) {
    // Closed items are resolved, but can be reviewed; slightly lower urgency
    urgencyScore = 15;
  }

  if (remarksText.includes('OVERDUE') || dueDateInfo.isOverdue) {
    urgencyScore += 25;
  } else if (dueDateInfo.daysRemaining <= 7 && dueDateInfo.daysRemaining >= 0) {
    urgencyScore += 15;
  }

  urgencyScore = Math.min(100, urgencyScore);

  // 4. Kategori & Severity Multiplier
  let categoryScore = 40;
  const kat = (record.KATEGORI || '').toUpperCase();
  if (kat.includes('CRITICAL') || kat.includes('KRITIS')) categoryScore = 95;
  else if (kat.includes('MAJOR')) categoryScore = 85;
  else if (kat.includes('MODERATE') || kat.includes('MEDIUM')) categoryScore = 65;
  else if (kat.includes('MINOR')) categoryScore = 45;

  // Composite Formula:
  // Financial 35% + Operational 35% + Urgency 20% + Category 10%
  const compositeRaw = (finalFinScore * 0.35) + (finalOpsScore * 0.35) + (urgencyScore * 0.20) + (categoryScore * 0.10);
  const score = Math.min(100, Math.max(20, Math.round(compositeRaw)));

  const riskLevel: PriorityRiskLevel = score >= 75 ? 'CRITICAL' : 'HIGH';

  // Build high-impact AI executive rationale
  const siteStr = record.SITE || 'Head Office';
  const projStr = record['PROJECT AUDIT'] || 'Audit';
  const recStr = (record.REKOMENDASI || '').trim();

  let aiRationale = '';
  if (money.rawNominal && finalOpsScore >= 70) {
    aiRationale = `Temuan ini menghadirkan kombinasi dampak ganda: eksposur finansial ${money.rawNominal} disertai potensi disrupsi rantai kerja operasional di ${siteStr}. Keterlambatan perbaikan dapat memicu eskalasi kerugian dan hambatan produksi.`;
  } else if (money.rawNominal) {
    aiRationale = `Identifikasi risiko finansial material terdeteksi sebesar ${money.rawNominal} pada project ${projStr}. Memerlukan rekonsiliasi nilai aset dan pengetatan otorisasi pembayaran segera.`;
  } else if (finalOpsScore >= 80) {
    aiRationale = `Tingkat keparahan gangguan operasional di ${siteStr} tergolong kritis, berpotensi menyebabkan penghentian aktivitas kerja, kegagalan kepatuhan izin, atau risiko keselamatan unit/personel.`;
  } else if (remarksText.includes('OVERDUE')) {
    aiRationale = `Temuan telah melampaui batas waktu penanganan (OVERDUE) dengan dampak struktural pada proses ${record['DETAIL TEMUAN'] || projStr}. Diperlukan intervensi manajemen untuk percepatan closing.`;
  } else {
    aiRationale = `Kelemahan kontrol internal pada ${projStr} yang berdampak langsung terhadap efisiensi dan mitigasi risiko operasional perusahaan.`;
  }

  // Key mitigation action
  const keyMitigationAction = recStr.length > 15
    ? recStr
    : `Lakukan investigasi lapangan komprehensif, terbitkan Berita Acara (BA) resmi, dan selesaikan rencana tindakan perbaikan bersama PIC terkait.`;

  const result: ScoredFindingAnalysis = {
    score,
    riskLevel,
    financialImpact: {
      score: finalFinScore,
      estimatedValue: money.rawNominal,
      description: finDesc,
      level: finLevel
    },
    operationalImpact: {
      score: finalOpsScore,
      description: opsDesc,
      level: opsLevel
    },
    urgencyScore,
    aiRationale,
    keyMitigationAction
  };

  scoringCache.set(cacheKey, result);
  return result;
}

/**
 * Filter and resolve hierarchy from merged rows
 */
export function resolveMergedRows(rows: AFSFindingRecord[]): AFSFindingRecord[] {
  let currentNo = '';
  let currentProject = '';
  let currentSite = '';
  let currentProblem = '';
  let currentDetail = '';
  let currentKriteria = '';
  let currentKategori = '';

  return rows.map((r, idx) => {
    if (r.NO && r.NO.trim()) currentNo = r.NO.trim();
    if (r['PROJECT AUDIT'] && r['PROJECT AUDIT'].trim()) currentProject = r['PROJECT AUDIT'].trim();
    if (r.SITE && r.SITE.trim()) currentSite = r.SITE.trim();
    if (r['PROBLEM/FINDING'] && r['PROBLEM/FINDING'].trim()) currentProblem = r['PROBLEM/FINDING'].trim();
    if (r['DETAIL TEMUAN'] && r['DETAIL TEMUAN'].trim()) currentDetail = r['DETAIL TEMUAN'].trim();
    if (r.KRITERIA && r.KRITERIA.trim()) currentKriteria = r.KRITERIA.trim();
    if (r.KATEGORI && r.KATEGORI.trim()) currentKategori = r.KATEGORI.trim();

    return {
      ...r,
      _rowId: r._rowId || idx + 1,
      NO: r.NO && r.NO.trim() ? r.NO : currentNo,
      'PROJECT AUDIT': r['PROJECT AUDIT'] && r['PROJECT AUDIT'].trim() ? r['PROJECT AUDIT'] : currentProject,
      SITE: r.SITE && r.SITE.trim() ? r.SITE : currentSite,
      'PROBLEM/FINDING': r['PROBLEM/FINDING'] && r['PROBLEM/FINDING'].trim() ? r['PROBLEM/FINDING'] : currentProblem,
      'DETAIL TEMUAN': r['DETAIL TEMUAN'] && r['DETAIL TEMUAN'].trim() ? r['DETAIL TEMUAN'] : currentDetail,
      KRITERIA: r.KRITERIA && r.KRITERIA.trim() ? r.KRITERIA : currentKriteria,
      KATEGORI: r.KATEGORI && r.KATEGORI.trim() ? r.KATEGORI : currentKategori
    };
  });
}

/**
 * Synchronous, instant, memoized Top 10 recommendations calculation.
 * Filters out any CLOSED findings strictly. Supports site, dept, and year filtering.
 */
export function computeTop10RecommendationsSync(
  rawRows: AFSFindingRecord[],
  options?: PriorityFilterOptions
): { 
  items: PriorityRecommendationItem[]; 
  summary: PrioritySummary;
  totalMatchingActive: number;
} {
  const resolved = resolveMergedRows(rawRows);

  // Global AFS closing progress metrics
  let totalClosedAfs = 0;
  let totalActiveAfs = 0;
  for (const r of resolved) {
    if (isStatusClosed(r.STATUS, r.REMARKS, r['REVIEWED CLOSING FROM IA'])) {
      totalClosedAfs++;
    } else {
      totalActiveAfs++;
    }
  }
  const totalAfs = totalClosedAfs + totalActiveAfs;
  const overallClosingRate = totalAfs > 0 ? Math.round((totalClosedAfs / totalAfs) * 100) : 0;

  // STRICT RULE: HANYA ambil temuan yang statusnya BELUM CLOSE (Status = OPEN atau IN PROGRESS)
  // Temuan yang sudah berkategori "CLOSE" atau "DONE" DILARANG MUTLAK muncul di daftar Top 10 Prioritas!
  const activeRows = resolved.filter(r => {
    // 1. Must be active (not closed)
    if (isStatusClosed(r.STATUS, r.REMARKS, r['REVIEWED CLOSING FROM IA'])) {
      return false;
    }
    const prob = (r['PROBLEM/FINDING'] || '').trim();
    const rec = (r['REKOMENDASI'] || '').trim();
    const detail = (r['DETAIL TEMUAN'] || '').trim();
    if (prob.length <= 5 && rec.length <= 5 && detail.length <= 5) {
      return false;
    }

    // 2. Filter Site if specified
    if (options?.site && options.site !== 'ALL') {
      const rowSite = (r.SITE || 'HEAD OFFICE').trim().toUpperCase();
      if (rowSite !== options.site.trim().toUpperCase()) {
        return false;
      }
    }

    // 3. Filter Dept if specified
    if (options?.dept && options.dept !== 'ALL') {
      if (!matchesDepartmentRecord(r, options.dept)) {
        return false;
      }
    }

    // 4. Filter Year if specified
    if (options?.year && options.year !== 'ALL') {
      const rowYear = extractFindingYear(r);
      if (rowYear !== options.year.trim()) {
        return false;
      }
    }

    return true;
  });

  const totalMatchingActive = activeRows.length;

  if (activeRows.length === 0) {
    return {
      items: [],
      summary: {
        totalCriticalActive: 0,
        totalHighActive: 0,
        averageDueDays: { averageDays: 0, label: '-', isOverdueAvg: false },
        progressClosing: {
          inProgressCount: 0,
          openCount: 0,
          inProgressPercentage: 0,
          totalActiveAfs,
          totalClosedAfs,
          overallClosingRate
        },
        nearestDeadline: null,
        totalEstimatedExposure: 'Rp 0',
        totalCritical: 0,
        totalHigh: 0,
        totalCompleted: totalClosedAfs,
        totalOpenOrProgress: totalActiveAfs
      },
      totalMatchingActive: 0
    };
  }

  // Score all ACTIVE records with in-memory caching
  const scoredItems: PriorityRecommendationItem[] = activeRows.map((record, index) => {
    const analysis = scoreFindingRecord(record);
    const id = `priority-${record._rowId || index}-${record.NO || ''}-${(record.SITE || '').replace(/\s+/g, '_')}`;

    return {
      id,
      rank: 0, // will assign after sorting
      score: analysis.score,
      riskLevel: analysis.riskLevel,
      record,
      financialImpact: analysis.financialImpact,
      operationalImpact: analysis.operationalImpact,
      urgencyScore: analysis.urgencyScore,
      aiRationale: analysis.aiRationale,
      keyMitigationAction: analysis.keyMitigationAction,
      isAiEnriched: false
    };
  });

  // Sort descending by score. If score is tied, sort by OPEN status first, then by earliest due date
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aOpen = !isStatusClosed(a.record.STATUS, a.record.REMARKS);
    const bOpen = !isStatusClosed(b.record.STATUS, b.record.REMARKS);
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return (a.record._rowId || 0) - (b.record._rowId || 0);
  });

  // Deduplicate near-identical findings if any (same project + problem + recommendation)
  const seenKey = new Set<string>();
  const dedupedItems: typeof scoredItems = [];
  for (const item of scoredItems) {
    const key = `${item.record['PROJECT AUDIT']}|${item.record.SITE}|${item.record['PROBLEM/FINDING']}|${item.record['REKOMENDASI']}`.trim().toUpperCase();
    if (!seenKey.has(key)) {
      seenKey.add(key);
      dedupedItems.push(item);
    }
  }

  // Pick top 10
  const top10 = dedupedItems.slice(0, 10).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));

  // Calculate Summary Statistics for Active Top 10
  let totalCriticalActive = 0;
  let totalHighActive = 0;
  let nearestDeadline: PrioritySummary['nearestDeadline'] = null;
  let totalNominalRupiah = 0;
  let sumDueDays = 0;
  let dueCount = 0;
  let inProgressCount = 0;
  let openCount = 0;

  for (const item of top10) {
    if (item.riskLevel === 'CRITICAL') totalCriticalActive++;
    else totalHighActive++;

    const isProg = isStatusProgress(item.record.STATUS, item.record.REMARKS, item.record['REVIEWED CLOSING FROM IA']);
    if (isProg) {
      inProgressCount++;
    } else {
      openCount++;
    }

    // Money
    const mon = extractMonetaryValue([
      item.record['PROBLEM/FINDING'] || '',
      item.record['DETAIL TEMUAN'] || '',
      item.record['REKOMENDASI'] || ''
    ].join(' '));
    totalNominalRupiah += mon.estimatedRupiah;

    // Due Date & Average Target Days
    const due = parseDueDateInfo(item.record['DUE DATE']);
    if (due.formattedDate !== '-' && due.daysRemaining !== 999) {
      sumDueDays += due.daysRemaining;
      dueCount++;

      if (!nearestDeadline || due.daysRemaining < nearestDeadline.daysRemaining) {
        nearestDeadline = {
          date: due.formattedDate,
          daysRemaining: due.daysRemaining,
          isOverdue: due.isOverdue,
          projectName: item.record['PROJECT AUDIT'] || 'Audit',
          pic: item.record['PIC SITE'] || item.record['PIC HO'] || 'PIC Unit'
        };
      }
    }
  }

  const avgDays = dueCount > 0 ? Math.round(sumDueDays / dueCount) : 0;
  const isOverdueAvg = avgDays < 0;
  const averageDueLabel = dueCount > 0
    ? (isOverdueAvg ? `Rata-rata Overdue ${Math.abs(avgDays)} Hari` : `Rata-rata ${avgDays} Hari Lagi`)
    : 'Belum Ada Target';

  const formattedExposure = totalNominalRupiah >= 1_000_000_000
    ? `Rp ${(totalNominalRupiah / 1_000_000_000).toFixed(2)} Miliar`
    : totalNominalRupiah >= 1_000_000
      ? `Rp ${(totalNominalRupiah / 1_000_000).toFixed(0)} Juta`
      : totalNominalRupiah > 0
        ? `Rp ${totalNominalRupiah.toLocaleString('id-ID')}`
        : 'Signifikan (Kepatuhan & Operasional)';

  const inProgressPercentage = top10.length > 0 ? Math.round((inProgressCount / top10.length) * 100) : 0;

  return {
    items: top10,
    summary: {
      totalCriticalActive,
      totalHighActive,
      averageDueDays: {
        averageDays: avgDays,
        label: averageDueLabel,
        isOverdueAvg
      },
      progressClosing: {
        inProgressCount,
        openCount,
        inProgressPercentage,
        totalActiveAfs,
        totalClosedAfs,
        overallClosingRate
      },
      nearestDeadline,
      totalEstimatedExposure: formattedExposure,
      totalCritical: totalCriticalActive,
      totalHigh: totalHighActive,
      totalCompleted: totalClosedAfs,
      totalOpenOrProgress: top10.length
    },
    totalMatchingActive
  };
}

/**
 * Analyze and select Top 10 Critical Recommendations from AFS data
 */
export async function analyzeTop10Recommendations(
  rawRows: AFSFindingRecord[],
  options?: PriorityFilterOptions
): Promise<{ items: PriorityRecommendationItem[]; summary: PrioritySummary; totalMatchingActive: number }> {
  const result = computeTop10RecommendationsSync(rawRows, options);
  const { items: top10, summary, totalMatchingActive } = result;

  // Optional: Try calling the server Gemini endpoint to enrich rationales if requested
  if (options?.triggerGeminiEnrichment && top10.length > 0) {
    try {
      const resp = await fetch('/api/ai/prioritize-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: top10.map(t => ({
            rank: t.rank,
            score: t.score,
            project: t.record['PROJECT AUDIT'],
            site: t.record.SITE,
            problem: t.record['PROBLEM/FINDING'],
            detail: t.record['DETAIL TEMUAN'],
            recommendation: t.record['REKOMENDASI'],
            pic: t.record['PIC SITE'] || t.record['PIC HO'],
            dueDate: t.record['DUE DATE'],
            status: t.record.STATUS
          }))
        })
      });

      if (resp.ok) {
        const enrichedData = await resp.json();
        if (enrichedData.success && Array.isArray(enrichedData.enrichedItems)) {
          for (const enriched of enrichedData.enrichedItems) {
            const matchIdx = top10.findIndex(t => t.rank === enriched.rank);
            if (matchIdx !== -1 && enriched.aiRationale) {
              top10[matchIdx].aiRationale = enriched.aiRationale;
              if (enriched.keyMitigationAction) {
                top10[matchIdx].keyMitigationAction = enriched.keyMitigationAction;
              }
              top10[matchIdx].isAiEnriched = true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Gemini server enrichment skipped, using built-in high precision AI scoring engine:', err);
    }
  }

  return {
    items: top10,
    summary,
    totalMatchingActive
  };
}
