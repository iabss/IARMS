export interface RiskRegisterItem {
  id: string;
  code: string; // Risk Number (e.g., ICGS-01)
  site: string;
  department: string;
  category: string; // Executive Category
  businessProcess: string;
  riskEvent: string; // Risk Description
  causes: string; // Loss Event / Notes
  inherentImpactStr: string;
  inherentLikelihoodStr: string;
  inherentOverall: string; // Low, Medium, High, Extreme
  inherentScore: number;
  existingControl: string; // Control Description
  controlStatus: string;
  controlEffectiveness: 'Effective' | 'Partially Effective' | 'Ineffective' | string;
  residualImpactStr: string;
  residualLikelihoodStr: string;
  residualOverall: string; // Low, Medium, High, Extreme
  residualScore: number;
  riskOwner: string; // PIC or Dept
  actionPlan: string; // Treatment Plan
  targetDate: string; // Due Date
  status: 'Open' | 'In Progress' | 'Closed' | 'Overdue';
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field.trim());
        field = "";
      } else if (c === '\n' || (c === '\r' && text[i+1] === '\n')) {
        row.push(field.trim());
        result.push(row);
        row = [];
        field = "";
        if (c === '\r') i++;
      } else {
        field += c;
      }
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

const LEVEL_SCORE_MAP: Record<string, number> = {
  'insignificant': 1,
  'minor': 2,
  'moderate': 3,
  'major': 4,
  'catastrophic': 5,
  'rare': 1,
  'unlikely': 2,
  'possible': 3,
  'likely': 4,
  'almost certain': 5,
  'low': 2,
  'medium': 6,
  'high': 12,
  'extreme': 20
};

export function mapLevelToScore(str: string): number {
  if (!str) return 2;
  const key = str.toLowerCase().trim();
  return LEVEL_SCORE_MAP[key] || 3;
}

export async function fetchGoogleSheetRiskRegister(sheetUrl: string): Promise<RiskRegisterItem[]> {
  try {
    // Convert edit/view URL to export CSV URL
    let csvUrl = sheetUrl;
    if (sheetUrl.includes('docs.google.com/spreadsheets')) {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const spreadsheetId = match[1];
        let gid = '1293981214'; // Default gid provided
        if (sheetUrl.includes('gid=')) {
          const gidMatch = sheetUrl.match(/gid=(\d+)/);
          if (gidMatch) gid = gidMatch[1];
        }
        csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      }
    }

    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`Gagal mengunduh sheet (status: ${res.status})`);
    }

    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 4) {
      return [];
    }

    const parsedItems: RiskRegisterItem[] = [];

    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 10) continue;

      const code = row[1];
      const riskDescription = row[8];

      // Skip empty risk rows
      if (!code && !riskDescription) continue;

      const site = row[2] || '';
      const department = row[3] || '';
      const businessProcess = row[6] || 'Operasional';
      const category = row[10] || row[11] || 'Umum';
      const lossEvent = row[11] || '';
      const notes = row[12] || '';

      const inherentImpactStr = row[23] || 'Moderate';
      const inherentLikelihoodStr = row[24] || 'Possible';
      const inherentOverall = row[25] || 'Medium';

      const controlDescription = row[26] || 'Kontrol internal standar';
      const controlStatus = row[27] || 'Always';
      const controlEffectiveness = row[28] || 'Moderate';

      const residualImpactStr = row[40] || 'Minor';
      const residualLikelihoodStr = row[41] || 'Possible';
      const residualOverall = row[42] || 'Low';

      const actionPlan = row[43] || row[26] || 'Monitoring rutin';
      const pic = row[44] || department || site || 'Risk Owner';
      const dueDate = row[45] || '2026-12-31';

      const inhImp = mapLevelToScore(inherentImpactStr);
      const inhLik = mapLevelToScore(inherentLikelihoodStr);
      const resImp = mapLevelToScore(residualImpactStr);
      const resLik = mapLevelToScore(residualLikelihoodStr);

      parsedItems.push({
        id: `sheet-${r}-${code || r}`,
        code: code || `RSK-${r}`,
        site,
        department,
        category: category || 'Operasional',
        businessProcess: businessProcess || department || 'Proses Bisnis',
        riskEvent: riskDescription || 'Potensi risiko operasional',
        causes: lossEvent ? `${lossEvent} ${notes ? `(${notes})` : ''}` : notes || 'Faktor operasional & lingkungan',
        inherentImpactStr,
        inherentLikelihoodStr,
        inherentOverall,
        inherentScore: inhImp * inhLik,
        existingControl: controlDescription,
        controlStatus,
        controlEffectiveness,
        residualImpactStr,
        residualLikelihoodStr,
        residualOverall,
        residualScore: resImp * resLik,
        riskOwner: pic,
        actionPlan: actionPlan || 'Monitoring dan mitigasi rutin',
        targetDate: dueDate || 'On Going',
        status: residualOverall.toLowerCase().includes('high') || residualOverall.toLowerCase().includes('extreme') ? 'In Progress' : 'Open'
      });
    }

    return parsedItems;
  } catch (err) {
    console.error('Error fetching Google Sheet risk register:', err);
    throw err;
  }
}
