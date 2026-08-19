import fs from 'fs';
import { execSync } from 'child_process';

const csvUrl = "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/export?format=csv";
const csv = execSync(`curl -sL "${csvUrl}"`).toString();

function parseCSV(text) {
  const lines = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') lines.push(row);
  return lines;
}

const rows = parseCSV(csv);
console.log('Total parsed rows:', rows.length);
console.log('Headers:', rows[0].slice(0, 20));

// Let's filter non-empty data rows
const headers = rows[0].map(h => h.trim());
const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim() !== ''));
console.log('Non-empty data rows:', dataRows.length);

// Let's see some samples
const sample = dataRows.slice(0, 5).map(r => {
  const obj = {};
  headers.forEach((h, idx) => {
    if (h && r[idx]) obj[h] = r[idx];
  });
  return obj;
});

console.log('Sample data:', JSON.stringify(sample, null, 2));

// Save to src/data/sheetData.json
fs.mkdirSync('./src/data', { recursive: true });

let lastNo = '';
let lastProject = '';
let lastSite = '';
let lastProblem = '';
let lastKategori = '';

const allParsed = dataRows.map((r, idx) => {
  const obj = { _rowId: idx + 1 };
  headers.forEach((h, idxH) => {
    if (h) obj[h] = r[idxH] || '';
  });

  // Handle merged cells forward fill for parent columns
  if (obj['NO']) lastNo = obj['NO'];
  else if (lastNo) obj['NO'] = lastNo;

  if (obj['PROJECT AUDIT']) lastProject = obj['PROJECT AUDIT'];
  else if (lastProject) obj['PROJECT AUDIT'] = lastProject;

  if (obj['SITE']) lastSite = obj['SITE'];
  else if (lastSite) obj['SITE'] = lastSite;

  if (obj['PROBLEM/FINDING']) lastProblem = obj['PROBLEM/FINDING'];
  else if (lastProblem) obj['PROBLEM/FINDING'] = lastProblem;

  if (obj['KATEGORI']) lastKategori = obj['KATEGORI'];
  else if (lastKategori) obj['KATEGORI'] = lastKategori;

  return obj;
});

fs.writeFileSync('./src/data/sheetData.json', JSON.stringify({
  sourceUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit",
  lastFetched: new Date().toISOString(),
  headers: headers.filter(h => h !== ''),
  rows: allParsed
}, null, 2));

console.log('Saved data to src/data/sheetData.json');
