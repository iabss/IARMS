export function parseAuditCsvClient(csvText: string): any[] {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    const quote = '"';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === quote && i + 1 < line.length && line[i + 1] === quote) {
        current += quote;
        i++;
      } else if (char === quote) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim().toUpperCase());
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const obj: any = {};
    for (let c = 0; c < headers.length; c++) {
      const val = cells[c] || '';
      obj[headers[c]] = val;
    }
    rows.push(obj);
  }
  return rows;
}
