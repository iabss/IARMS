const fs = require("fs");
const vm = require("vm");

const js = fs.readFileSync("/app/applet/src/bundle.js", "utf8");

let q4Pos = js.indexOf("Q4=JSON.parse(");
let endIdx = js.indexOf(";function wi(", q4Pos);

const ctx = { JSON };
vm.runInNewContext(js.slice(q4Pos, endIdx), ctx);

function wi(t,a,n){const r=(t||"").toUpperCase().trim(),o=(a||"").toUpperCase().trim(),l=(n||"").toUpperCase().trim();return!!(l==="APPROVE"||l==="APPROVED"||l==="SETUJU"||l==="OK"||r==="CLOSE"||r==="CLOSED"||r==="SELESAI"||r==="DONE"||r==="100%"||r==="TERPENUHI"||r==="RESOLVED"||r==="C"||r.startsWith("CLOSE")||r.startsWith("CLOSED")||r.includes("SELESAI")||(o==="DONE"||o==="CLOSED"||o==="CLOSE")&&r!=="OPEN")}

const rows = ctx.Q4;
const closed = rows.filter(r => wi(r.STATUS, r.REMARKS, r["REVIEWED CLOSING FROM IA"])).length;
console.log("Total master records:", rows.length);
console.log("Total closed master records:", closed);
console.log("Macro closing rate:", ((closed / rows.length) * 100).toFixed(2) + "%");
