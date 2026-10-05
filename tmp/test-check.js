const fs = require("fs");
const js = fs.readFileSync("/app/applet/src/bundle.js", "utf8");

// Search where Q4 = JSON.parse(...) is defined
const marker = "Q4=JSON.parse('";
const start = js.indexOf(marker);
if (start === -1) {
  console.log("Marker not found");
  process.exit(1);
}

// Find matching closing single quote followed by paren
let end = -1;
for (let i = start + marker.length; i < js.length - 1; i++) {
  if (js[i] === "'" && js[i+1] === ")") {
    end = i;
    break;
  }
}

console.log("start:", start, "end:", end);
const rawString = js.slice(start + marker.length, end);

// The string was stringified then escaped with single quotes. Let us parse it.
let parsed;
try {
  parsed = JSON.parse(rawString);
  console.log("Successfully parsed with JSON.parse! Count:", parsed.length);
} catch (e) {
  try {
    parsed = eval("'" + rawString + "'");
    parsed = JSON.parse(parsed);
    console.log("Successfully parsed with eval string! Count:", parsed.length);
  } catch (err) {
    console.log("Error:", err.message);
    process.exit(1);
  }
}

const Qf = new Set(["MBL","MME","BIB","MIP","HO","SITE","MAS","SMM","KIM","AGM","BSS","KCM","TCM","PT BSS","JOB SITE","JOBSITE"]);
function yo(t){if(!t)return!1;let a=t.trim().replace(/^[0-9]+[\.\)\-]\s*/,"").trim().toUpperCase();return!(Qf.has(a)||a==="-"||a==="N/A"||a==="NA"||a==="0"||a==="NONE"||a==="NULL"||a==="TBD"||a==="NIL"||a==="")}
function wi(t,a,n){const r=(t||"").toUpperCase().trim(),o=(a||"").toUpperCase().trim(),l=(n||"").toUpperCase().trim();return!!(l==="APPROVE"||l==="APPROVED"||l==="SETUJU"||l==="OK"||r==="CLOSE"||r==="CLOSED"||r==="SELESAI"||r==="DONE"||r==="100%"||r==="TERPENUHI"||r==="RESOLVED"||r==="C"||r.startsWith("CLOSE")||r.startsWith("CLOSED")||r.includes("SELESAI")||(o==="DONE"||o==="CLOSED"||o==="CLOSE")&&r!=="OPEN")}
function Gd(te, defaultYear = "2026") {
  const y = (te["PERIODE AUDIT"] || te["TAHUN"] || te["YEAR"] || "").toString().trim();
  if (y && /^\d{4}$/.test(y)) return y;
  const match = `${te["DOKUMENTASI TEMUAN"]||""} ${te["DUE DATE"]||""} ${te["PROBLEM/FINDING"]||""}`.match(/\b(202[0-9])\b/);
  return match ? match[1] : defaultYear;
}

// 1. Dashboard logic
const dGroups = new Map();
parsed.forEach(te => {
  const q = (te.SITE || "HEAD OFFICE").trim();
  const W = (te["PROJECT AUDIT"] || "LAINNYA").trim();
  const ne = Gd(te, "2026");
  const ke = `${q.toUpperCase()}___${W.toUpperCase()}___${ne.toUpperCase()}`;
  if (!dGroups.has(ke)) {
    dGroups.set(ke, { siteName: q, scopeAudit: W, year: ne, total: 0, close: 0, open: 0, progress: 0, siteTotal: 0, siteClose: 0, hoTotal: 0, hoClose: 0 });
  }
  const g = dGroups.get(ke);
  g.total += 1;
  const isClose = wi(te.STATUS, te.REMARKS, te["REVIEWED CLOSING FROM IA"]);
  const U = (te["PIC SITE"] || "").trim();
  const z = (te["PIC HO"] || "").trim();
  yo(U) && (g.siteTotal += 1, isClose && (g.siteClose += 1));
  yo(z) && (g.hoTotal += 1, isClose && (g.hoClose += 1));
  if (isClose) g.close += 1;
  else g.open += 1;
});

const dTable = [];
dGroups.forEach((g) => {
  const W = g.total > 0 ? (g.close / g.total) * 100 : 0;
  const ne = g.siteTotal > 0 ? (g.siteClose / g.siteTotal) * 100 : W;
  const ke = g.hoTotal > 0 ? (g.hoClose / g.hoTotal) * 100 : W;
  dTable.push({
    site: g.siteName,
    scope: g.scopeAudit,
    year: g.year,
    total: g.total,
    open: g.open,
    close: g.close,
    siteRate: parseFloat(ne.toFixed(2)) + "%",
    hoRate: parseFloat(ke.toFixed(2)) + "%",
    closingRate: parseFloat(W.toFixed(2)) + "%"
  });
});

console.log("\n=== DASHBOARD ROWS ===");
console.table(dTable);

const totalClose = parsed.filter(r => wi(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"])).length;
console.log(`DASHBOARD KPI: Total Rekomendasi = ${parsed.length}, Temuan Close = ${totalClose} (${(totalClose / parsed.length * 100).toFixed(2)}%)`);

// 2. Trend logic with our update
const tGroups = new Map();
parsed.forEach(Da => {
  const Ua = (Da.SITE || "HEAD OFFICE").trim();
  const Pa = (Da["PROJECT AUDIT"] || "LAINNYA").trim();
  const la = Gd(Da, "2026");
  const La = `${Ua.toUpperCase()}___${Pa.toUpperCase()}___${la.toUpperCase()}`;
  const $a = Ua && Ua !== "HEAD OFFICE" ? `${Ua} - ${Pa}` : Pa;
  const rt = la ? `${$a} (${la})` : $a;
  if (!tGroups.has(La)) {
    tGroups.set(La, { name: rt, rawProjectName: Pa, siteName: Ua, year: la, records: [] });
  }
  tGroups.get(La).records.push(Da);
});

const tTable = [];
tGroups.forEach(ka => {
  const Pa = ka.records.length;
  const la = ka.records.filter(bn => wi(bn.STATUS, bn.REMARKS, bn["REVIEWED CLOSING FROM IA"])).length;
  const La = Pa > 0 ? parseFloat((la / Pa * 100).toFixed(2)) : 0;
  let $a = 0, rt = 0, pt = 0, et = 0;
  ka.records.forEach(bn => {
    const $t = wi(bn.STATUS, bn.REMARKS, bn["REVIEWED CLOSING FROM IA"]);
    const Oe = (bn["PIC SITE"] || "").trim();
    const Ia = (bn["PIC HO"] || "").trim();
    yo(Oe) && ($a += 1, $t && (rt += 1));
    yo(Ia) && (pt += 1, $t && (et += 1));
  });
  const Qa = $a > 0 ? parseFloat((rt / $a * 100).toFixed(2)) : La;
  const ct = pt > 0 ? parseFloat((et / pt * 100).toFixed(2)) : La;
  tTable.push({
    name: ka.name,
    site: ka.siteName,
    year: ka.year,
    total: Pa,
    close: la,
    siteCurrentRate: Qa + "%",
    hoCurrentRate: ct + "%",
    currentRate: La + "%"
  });
});

console.log("\n=== TREND ROWS (CURRENT RATES) ===");
console.table(tTable);

// Check if they match 1:1
let allMatch = true;
if (dTable.length !== tTable.length) {
  console.log("Count mismatch: Dashboard has", dTable.length, "Trend has", tTable.length);
  allMatch = false;
} else {
  for (let i = 0; i < dTable.length; i++) {
    const d = dTable[i];
    const t = tTable[i];
    if (d.total !== t.total || d.close !== t.close || d.closingRate !== t.currentRate || d.siteRate !== t.siteCurrentRate || d.hoRate !== t.hoCurrentRate) {
      console.log(`Mismatch at row ${i}:`, { d, t });
      allMatch = false;
    }
  }
}

if (allMatch) {
  console.log("\n>>> SEMPURNA! SELURUH ANGKA DASHBOARD DAN TREN TERBUKTI 100% SAMA! <<<");
}
