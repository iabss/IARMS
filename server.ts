var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import express from"express";import path from"path";import https from"https";import http from"http";import fs from"fs";import"dotenv/config";import{GoogleGenAI}from"@google/genai";import{createServer as createViteServer}from"vite";const app=express();const PORT=Number(process.env.PORT)||3e3;const STATE_FILE_PATH=path.join(process.cwd(),"server_app_state.json");function loadServerState(){try{if(fs.existsSync(STATE_FILE_PATH)){const raw=fs.readFileSync(STATE_FILE_PATH,"utf-8");if(raw&&raw.trim()){return JSON.parse(raw)}}}catch(err){console.error("Error loading server app state:",err)}return{projectConfigs:[],customRows:[],deletedKeys:[],trendExclusions:[],snapshots:[],riskRegisterItems:[],lastUpdated:new Date().toISOString()}}__name(loadServerState,"loadServerState");function saveServerState(state){try{const current=loadServerState();const updated={...current,...state,lastUpdated:new Date().toISOString()};fs.writeFileSync(STATE_FILE_PATH,JSON.stringify(updated,null,2),"utf-8");return updated}catch(err){console.error("Error saving server app state:",err);return loadServerState()}}__name(saveServerState,"saveServerState");app.set("trust proxy",true);app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET, POST, PUT, DELETE, PATCH, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization, X-Requested-With, CF-Connecting-IP, CF-Ray");if(req.method==="OPTIONS"){return res.status(204).end()}next()});app.use(express.json({limit:"10mb"}));app.use(express.urlencoded({extended:true,limit:"10mb"}));function fetchUrl(targetUrl,maxRedirects=5){return new Promise((resolve,reject)=>{if(maxRedirects===0){return reject(new Error("Terlalu banyak pengalihan (Too many redirects)"))}const client=targetUrl.startsWith("https")?https:http;const req=client.get(targetUrl,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,text/csv;q=0.8,*/*;q=0.7"}},res=>{const statusCode=res.statusCode||500;const contentType=res.headers["content-type"]||"";if([301,302,303,307,308].includes(statusCode)&&res.headers.location){let redirectUrl=res.headers.location;if(redirectUrl.startsWith("/")){const parsed=new URL(targetUrl);redirectUrl=`${parsed.protocol}//${parsed.host}${redirectUrl}`}return fetchUrl(redirectUrl,maxRedirects-1).then(resolve).catch(reject)}let data="";res.on("data",chunk=>{data+=chunk});res.on("end",()=>{resolve({statusCode,data,contentType})})});req.on("error",err=>{reject(err)});req.setTimeout(12e3,()=>{req.destroy();reject(new Error("Waktu permintaan habis (Timeout) saat mengakses Google Sheets"))})})}__name(fetchUrl,"fetchUrl");function parseGoogleSheetUrl(urlStr){let sheetId="";let gid="0";const idMatch=urlStr.match(/\/d\/([a-zA-Z0-9-_]+)/);if(idMatch){sheetId=idMatch[1]}const gidMatch=urlStr.match(/[?&]gid=([0-9]+)/)||urlStr.match(/#gid=([0-9]+)/);if(gidMatch){gid=gidMatch[1]}return{sheetId,gid}}__name(parseGoogleSheetUrl,"parseGoogleSheetUrl");function parseCsvRows(text,defaultProject="PR-PAYMENT"){if(!text||!text.trim())return[];const firstLineSample=text.split(/\r?\n/)[0]||"";const delimiter=firstLineSample.includes("	")?"	":",";const rows=[];let curRow=[];let curCell="";let inQuotes=false;for(let i=0;i<text.length;i++){const c=text[i];const nextC=text[i+1];if(c==='"'){if(inQuotes&&nextC==='"'){curCell+='"';i++}else{inQuotes=!inQuotes}}else if(c===delimiter&&!inQuotes){curRow.push(curCell.trim().replace(/^"(.*)"$/,"$1"));curCell=""}else if((c==="\r"||c==="\n")&&!inQuotes){if(c==="\r"&&nextC==="\n"){i++}curRow.push(curCell.trim().replace(/^"(.*)"$/,"$1"));if(curRow.some(cell=>cell.length>0)){rows.push(curRow)}curRow=[];curCell=""}else{curCell+=c}}if(curCell.length>0||curRow.length>0){curRow.push(curCell.trim().replace(/^"(.*)"$/,"$1"));if(curRow.some(cell=>cell.length>0)){rows.push(curRow)}}if(rows.length<2)return[];let headerIndex=0;let maxScore=0;const headerKeywords=["NO","NUM","NOMOR","ITEM","PROJECT","PROGRAM","SEKTOR","AUDIT","SITE","LOKASI","JOB SITE","PROBLEM","FINDING","TEMUAN","JUDUL","URAIAN","KONDISI","STATUS","CLOSING","STATUS TEMUAN","REKOMENDASI","ACTION","TINDAK LANJUT","ACTION PLAN","KRITERIA","SOP","KATEGORI","SEVERITY","RISK","PIC","AUDITEE","DUE DATE","TARGET","DEPT","DEPARTMENT"];for(let r=0;r<Math.min(rows.length,12);r++){const candidateCells=rows[r].map(c=>c.trim().toUpperCase());let score=0;for(const cell of candidateCells){if(headerKeywords.some(kw=>cell===kw||cell.includes(kw))){score++}}if(score>maxScore){maxScore=score;headerIndex=r}}const rawHeaders=rows[headerIndex];const headers=rawHeaders.map(h=>h.trim().toUpperCase());const findVal=__name((values,aliases)=>{for(const alias of aliases){const idx=headers.findIndex(h=>h===alias);if(idx!==-1&&values[idx]!==void 0){return values[idx].trim()}}for(const alias of aliases){const idx=headers.findIndex(h=>{if(!h.includes(alias))return false;if(alias==="STATUS"&&(h.includes("DUE")||h.includes("REMARK")||h.includes("TANGGAL")||h.includes("DATE")||h.includes("DOKUMEN"))){return false}return true});if(idx!==-1&&values[idx]!==void 0){return values[idx].trim()}}return""},"findVal");const parsedRows=[];for(let i=headerIndex+1;i<rows.length;i++){const values=rows[i];if(values.length<2)continue;const no=findVal(values,["NO","NO.","#","NUM","NOMOR","ITEM"]);const proj=findVal(values,["PROJECT AUDIT","PROJECT","NAMA PROJECT","SEKTOR","AUDIT PROGRAM","PENUGASAN"])||defaultProject;const site=findVal(values,["SITE","JOB SITE","LOKASI","CABANG","LOCATION"])||"HO";const dept=findVal(values,["DEPT","DEPARTMENT","DEPARTEMEN","DIVISI","UNIT","BAGIAN","AUDITEE"]);const problem=findVal(values,["PROBLEM/FINDING","PROBLEM","FINDING","TEMUAN","RINGKASAN TEMUAN","URAIAN TEMUAN","KONDISI","CONDITION","JUDUL TEMUAN","POKOK TEMUAN"]);const detail=findVal(values,["DETAIL TEMUAN","DETAIL","PENJELASAN","DESKRIPSI","DESKRIPSI TEMUAN","FAKTA"]);const docTemuan=findVal(values,["DOKUMENTASI TEMUAN","DOKUMENTASI","EVIDENCE","BUKTI TEMUAN"]);const kriteria=findVal(values,["KRITERIA","CRITERIA","DASAR ATURAN","SOP","REGULASI"])||"SOP";const kategori=findVal(values,["KATEGORI","SEVERITY","RISK LEVEL","TINGKAT RISIKO","KLASIFIKASI"])||"MINOR";const rekomendasi=findVal(values,["REKOMENDASI","ACTION PLAN","TINDAK LANJUT","SARAN PERBAIKAN","RECOMMENDATION","ACTION"]);const rawStatus=findVal(values,["STATUS","STATUS TEMUAN","STATUS AUDIT","STATUS AKHIR","STATUS CLOSING","STATUS ITEM","STATUS TINDAK LANJUT","HASIL REVIEW"]).toUpperCase();let status="OPEN";if(rawStatus.includes("CLOSE")||rawStatus.includes("SELESAI")||rawStatus.includes("DONE")||rawStatus.includes("100%")||rawStatus.includes("TERPENUHI")||rawStatus==="CLOSED"||rawStatus==="C"){status="CLOSE"}else if(rawStatus.includes("PROGRESS")||rawStatus.includes("PROSES")||rawStatus.includes("PARTIAL")||rawStatus.includes("ON GOING")||rawStatus.includes("ON-GOING")){status="PROGRESS"}else{status="OPEN"}const picSite=findVal(values,["PIC SITE","PIC LOKASI","AUDITEE SITE","PIC"]);const picHo=findVal(values,["PIC HO","PIC PUSAT","AUDITEE HO"]);const dueDate=findVal(values,["DUE DATE","TARGET CLOSING","TANGGAL DUE","TARGET DATE","TANGGAL JATUH TEMPO","BATAS WAKTU"]);const remarks=findVal(values,["REMARKS","KETERANGAN","STATUS DUE","CATATAN STATUS"]);const docClosing=findVal(values,["DOKUMENTASI CLOSING","BUKTI CLOSING","BUKTI TINDAK LANJUT","LAMPIRAN CLOSING"]);const reviewedUser=findVal(values,["REVIEWED CLOSING FROM USER","REVIEW USER","FEEDBACK USER"]);const reviewedIa=findVal(values,["REVIEWED CLOSING FROM IA","REVIEW IA","VERIFIKASI IA"]);const note=findVal(values,["NOTE","CATATAN","KETERANGAN TAMBAHAN"]);const rawYear=findVal(values,["PERIODE AUDIT","PERIODE","TAHUN","YEAR","TANGGAL AUDIT","TAHUN PELAKSANAAN"]);let finalYear=rawYear;if(!finalYear){const matchDoc=`${docTemuan} ${dueDate} ${problem}`.match(/\b(202[0-9])\b/);finalYear=matchDoc?matchDoc[1]:"2026"}if(!no&&!problem&&!rekomendasi)continue;if(no.toUpperCase()==="NO"||problem.toUpperCase()==="PROBLEM/FINDING")continue;parsedRows.push({_rowId:i,NO:no||String(parsedRows.length+1),"PROJECT AUDIT":proj,SITE:site,"PERIODE AUDIT":finalYear,...dept?{DEPARTMENT:dept}:{},"PROBLEM/FINDING":problem||"Temuan Audit","DETAIL TEMUAN":detail,"DOKUMENTASI TEMUAN":docTemuan,KRITERIA:kriteria,KATEGORI:kategori,REKOMENDASI:rekomendasi,STATUS:status,"PIC SITE":picSite,"PIC HO":picHo,"DUE DATE":dueDate,REMARKS:remarks,"DOKUMENTASI CLOSING":docClosing,"REVIEWED CLOSING FROM USER":reviewedUser,"REVIEWED CLOSING FROM IA":reviewedIa,NOTE:note,"KOLOM BANTU":""})}return parsedRows}__name(parseCsvRows,"parseCsvRows");app.get("/api/health",(req,res)=>{res.json({status:"ok",timestamp:new Date().toISOString()})});app.post("/api/sync-sheet",async(req,res)=>{try{const{sheetUrl,defaultProject="PR-PAYMENT",rawCsvData}=req.body;if(rawCsvData&&typeof rawCsvData==="string"&&rawCsvData.trim().length>0){const rows2=parseCsvRows(rawCsvData,defaultProject);return res.json({success:true,method:"paste_csv",count:rows2.length,rows:rows2,project:defaultProject,timestamp:new Date().toISOString()})}if(!sheetUrl||typeof sheetUrl!=="string"){return res.status(400).json({success:false,error:"URL Google Sheet tidak valid"})}const{sheetId,gid}=parseGoogleSheetUrl(sheetUrl);if(!sheetId){return res.status(400).json({success:false,error:"ID Google Sheet tidak ditemukan pada URL yang diberikan."})}const candidateUrls=[`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`];if(sheetUrl.includes("/pub?")||sheetUrl.includes("output=csv")||sheetUrl.includes("format=csv")){candidateUrls.unshift(sheetUrl)}let fetchedData="";let fetchSuccess=false;let isPrivateSheet=false;for(const url of candidateUrls){try{const result=await fetchUrl(url);if(result.data){const lowerData=result.data.toLowerCase();if(result.statusCode===401||result.statusCode===403||lowerData.includes("sign in")||lowerData.includes("accounts.google.com")||lowerData.includes("<!doctype html>")||lowerData.includes("<html")||lowerData.includes("google-site-verification")||lowerData.includes("denied")){isPrivateSheet=true;continue}if(result.statusCode===200&&(result.data.includes(",")||result.data.includes("	")||result.data.includes("\n"))){fetchedData=result.data;fetchSuccess=true;break}}}catch(err){console.warn(`Failed fetching from candidate URL ${url}:`,err)}}if(!fetchSuccess){return res.json({success:false,isPrivate:true,sheetId,gid,message:'Google Sheet berstatus Akses Terbatas/Privat. Agar server dapat mengunduh data secara otomatis, ubah Akses Umum di Google Sheet menjadi "Siapa saja yang memiliki link" (Viewer) ATAU gunakan tab "Copy-Paste Tabel".'})}const rows=parseCsvRows(fetchedData,defaultProject);return res.json({success:true,method:"url_sync",sheetId,gid,count:rows.length,rows,project:defaultProject,timestamp:new Date().toISOString()})}catch(error){console.error("Error in /api/sync-sheet:",error);return res.status(500).json({success:false,error:error.message||"Terjadi kesalahan saat memproses sinkronisasi Google Sheet."})}});app.get("/api/app-state",(req,res)=>{try{const state=loadServerState();return res.json({success:true,state})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/app-state",(req,res)=>{try{const{projectConfigs,customRows,deletedKeys,trendExclusions,snapshots}=req.body;const updated=saveServerState({...Array.isArray(projectConfigs)?{projectConfigs}:{},...Array.isArray(customRows)?{customRows}:{},...Array.isArray(deletedKeys)?{deletedKeys}:{},...Array.isArray(trendExclusions)?{trendExclusions}:{},...Array.isArray(snapshots)?{snapshots}:{}});return res.json({success:true,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});
const RISK_REGISTER_SHEET_CSV="https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/export?format=csv&gid=1293981214";
const RISK_REGISTER_SHEET_EDIT="https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/edit?gid=1293981214#gid=1293981214";
let cachedRiskSheetData:any[]=[];
let lastRiskSheetFetch=0;

function parseRiskRegisterCsv(se:string){
  const Ie:string[][]=[];let me:string[]=[],xe="",Me=false;
  for(let be=0;be<se.length;be++){
    const Q=se[be];
    Me?(Q==='"'?(be+1<se.length&&se[be+1]==='"'?(xe+='"',be++):Me=false):xe+=Q):(Q==='"'?Me=true:Q===","?(me.push(xe.trim()),xe=""):(Q==="\n"||(Q==="\r"&&se[be+1]==="\n"))?(me.push(xe.trim()),Ie.push(me),me=[],xe="",Q==="\r"&&be++):xe+=Q);
  }
  if(xe||me.length)me.push(xe.trim()),Ie.push(me);
  const K:any[]=[];
  for(let sIdx=3;sIdx<Ie.length;sIdx++){
    const row=Ie[sIdx];
    if(!row||row.length<5)continue;
    const no=(row[0]||"").trim();
    const riskNumber=(row[1]||"").trim();
    const site=(row[2]||"").trim();
    const department=(row[3]||"").trim();
    const riskDesc=(row[8]||"").trim();
    if(!no&&!riskNumber&&!site&&!department&&!riskDesc)continue;
    K.push({
      no,riskNumber,site,department,
      companyObjective:(row[4]||"").trim(),
      kpiObjective:(row[5]||"").trim(),
      businessProcess:(row[6]||"").trim(),
      activity:(row[7]||"").trim(),
      riskDescription:riskDesc,
      top10Risk:(row[9]||"").trim(),
      executiveCategory:(row[10]||"").trim(),
      lossEvent:(row[11]||"").trim(),
      inherentNotes:(row[12]||"").trim(),
      inherentWorstCase:(row[13]||"").trim(),
      inherentFinImpact:(row[18]||"").trim(),
      inherentImpact:(row[23]||"").trim(),
      inherentLikelihood:(row[24]||"").trim(),
      inherentRiskLevel:(row[25]||"").trim()||"Medium",
      controlDescription:(row[26]||"").trim(),
      controlStatus:(row[27]||"").trim(),
      controlEffectiveness:(row[28]||"").trim(),
      residualNotes:(row[29]||"").trim(),
      residualWorstCase:(row[30]||"").trim(),
      residualFinImpact:(row[35]||"").trim(),
      residualImpact:(row[40]||"").trim(),
      residualLikelihood:(row[41]||"").trim(),
      residualRiskLevel:(row[42]||"").trim()||"Low",
      treatmentPlan:(row[43]||"").trim(),
      pic:(row[44]||"").trim(),
      dueDate:(row[45]||"").trim(),
      expectedImpact:(row[46]||"").trim(),
      expectedLikelihood:(row[47]||"").trim(),
      expectedRiskLevel:(row[48]||"").trim()
    });
  }
  return K;
}

async function fetchLiveRiskRegisterFromGoogleSheets(){
  try{
    if(cachedRiskSheetData.length>0&&Date.now()-lastRiskSheetFetch<15000){
      return cachedRiskSheetData;
    }
    const result=await fetchUrl(RISK_REGISTER_SHEET_CSV,3);
    if(result.statusCode===200&&result.data){
      const parsed=parseRiskRegisterCsv(result.data);
      if(parsed.length>0){
        cachedRiskSheetData=parsed;
        lastRiskSheetFetch=Date.now();
        return parsed;
      }
    }
  }catch(err){
    console.warn("Failed fetching live risk register from Google Sheets:",err);
  }
  return cachedRiskSheetData;
}

app.get("/api/risk-register", async (req, res) => {
  try {
    const state = loadServerState();
    const sheetRisks = await fetchLiveRiskRegisterFromGoogleSheets();
    return res.json({
      success: true,
      items: Array.isArray(state.riskRegisterItems) ? state.riskRegisterItems : [],
      sheetRisks: sheetRisks,
      totalSheet: sheetRisks.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, items: [], sheetRisks: [] });
  }
});
app.get("/api/risk-register/live-sheet", async (req, res) => {
  try {
    const sheetRisks = await fetchLiveRiskRegisterFromGoogleSheets();
    return res.json({ success: true, count: sheetRisks.length, sheetRisks });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, sheetRisks: [] });
  }
});
app.post("/api/risk-register", async (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.riskNumber) {
      return res.status(400).json({ success: false, error: "Risk number is required" });
    }
    const state = loadServerState();
    let current = Array.isArray(state.riskRegisterItems) ? [...state.riskRegisterItems] : [];
    const idx = current.findIndex(r => r.riskNumber === item.riskNumber);
    const syncedItem = {
      ...item,
      syncStatus: "synced",
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...syncedItem };
    } else {
      current.unshift({ ...syncedItem, createdAt: new Date().toISOString() });
    }
    const updated = saveServerState({ riskRegisterItems: current });

    // Asynchronously sync to Google Apps Script / Google Sheets
    try {
      const gasPayload = JSON.stringify({
        action: "save_risk_register",
        sheetUrl: RISK_REGISTER_SHEET_EDIT,
        ...item,
        risk: item
      });
      const client = DEFAULT_GAS_BACKEND_URL.startsWith("https") ? https : http;
      const gasReq = client.request(DEFAULT_GAS_BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "Content-Length": Buffer.byteLength(gasPayload),
          "User-Agent": "Mozilla/5.0 (IARMS Server Proxy)"
        }
      });
      gasReq.on("error", e => console.warn("GAS background sync error:", e.message));
      gasReq.setTimeout(8000, () => gasReq.destroy());
      gasReq.write(gasPayload);
      gasReq.end();
    } catch (e) {
      console.warn("GAS trigger error:", e);
    }

    return res.json({
      success: true,
      items: updated.riskRegisterItems,
      item: syncedItem
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/risk-register/:riskNumber", (req, res) => {
  try {
    const { riskNumber } = req.params;
    const state = loadServerState();
    let current = Array.isArray(state.riskRegisterItems) ? [...state.riskRegisterItems] : [];
    current = current.filter(r => r.riskNumber !== riskNumber);
    const updated = saveServerState({ riskRegisterItems: current });

    try {
      const gasPayload = JSON.stringify({
        action: "delete_risk_register",
        riskNumber: riskNumber
      });
      const client = DEFAULT_GAS_BACKEND_URL.startsWith("https") ? https : http;
      const gasReq = client.request(DEFAULT_GAS_BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "Content-Length": Buffer.byteLength(gasPayload)
        }
      });
      gasReq.on("error", () => {});
      gasReq.write(gasPayload);
      gasReq.end();
    } catch {}

    return res.json({ success: true, items: updated.riskRegisterItems });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/afs-projects",(req,res)=>{try{const current=loadServerState();const configs=Array.isArray(current.projectConfigs)?current.projectConfigs:[];const deletedKeys=Array.isArray(current.deletedKeys)?new Set(current.deletedKeys.map(k=>k.trim().toUpperCase())):new Set;const filtered=configs.filter(c=>{const pName=(c.projectName||c.defaultProject||c.project||"").trim().toUpperCase();const pSite=(c.siteName||c.site||"HEAD OFFICE").trim().toUpperCase();const pYear=c.year?String(c.year).trim():"";const pKey=(c.id||`${pName}|${pSite}${pYear?`|${pYear}`:""}`).toUpperCase();if(deletedKeys.has(pKey)||deletedKeys.has(pName))return false;return true});return res.json({success:true,afs_projects:filtered,projects:filtered,total:filtered.length,isEmpty:filtered.length===0,lastUpdated:current.lastUpdated})}catch(err){return res.status(500).json({success:false,error:err.message,afs_projects:[],projects:[]})}});app.post("/api/afs-projects",(req,res)=>{try{const current=loadServerState();const body=req.body;const rawProjects=Array.isArray(body)?body:Array.isArray(body.afs_projects)?body.afs_projects:Array.isArray(body.projects)?body.projects:[body];let configs=Array.isArray(current.projectConfigs)?[...current.projectConfigs]:[];let deletedKeys=Array.isArray(current.deletedKeys)?[...current.deletedKeys]:[];for(const item of rawProjects){if(!item)continue;const targetName=(item.projectName||item.project||item.defaultProject||"").trim().toUpperCase();if(!targetName)continue;const targetSite=(item.siteName||item.site||"HEAD OFFICE").trim().toUpperCase();const targetYear=item.year?String(item.year).trim():"";const targetKey=item.id||`${targetName}|${targetSite}${targetYear?`|${targetYear}`:""}`;deletedKeys=deletedKeys.filter(k=>k!==targetKey&&k!==targetName);const newConfigItem={id:targetKey,projectName:targetName,defaultProject:targetName,project:targetName,siteName:targetSite,site:targetSite,year:targetYear||void 0,sheetUrl:item.sheetUrl||"",status:item.status||(item.sheetUrl&&item.sheetUrl.trim()?"synced":"pending"),rowCount:item.rowCount!==void 0?Number(item.rowCount):0,lastSyncedAt:item.lastSyncedAt||new Date().toISOString()};const existingIndex=configs.findIndex(c=>{if(item.id&&c.id&&item.id===c.id)return true;const cName=(c.projectName||c.defaultProject||c.project||"").trim().toUpperCase();const cSite=(c.siteName||c.site||"HEAD OFFICE").trim().toUpperCase();const cYear=c.year?String(c.year).trim():"";const cKey=c.id||`${cName}|${cSite}${cYear?`|${cYear}`:""}`;return cKey===targetKey});if(existingIndex>=0){configs[existingIndex]={...configs[existingIndex],...newConfigItem,rowCount:item.rowCount!==void 0?Number(item.rowCount):configs[existingIndex].rowCount,lastSyncedAt:item.lastSyncedAt||configs[existingIndex].lastSyncedAt||new Date().toISOString()}}else{configs.push(newConfigItem)}}const updated=saveServerState({projectConfigs:configs,deletedKeys});return res.json({success:true,afs_projects:updated.projectConfigs,projects:updated.projectConfigs,total:updated.projectConfigs?.length||0,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post(["/api/purge-afs-projects","/api/reset-afs-projects"],(req,res)=>{try{const updated=saveServerState({projectConfigs:[],deletedKeys:[]});return res.json({success:true,message:"Semua data project AFS berhasil dibersihkan dari server database master",afs_projects:[],projects:[],total:0,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/save-project",(req,res)=>{try{const config=req.body;if(!config||!config.projectName&&!config.project&&!config.defaultProject){return res.status(400).json({success:false,error:"Nama project audit diperlukan"})}const current=loadServerState();let configs=current.projectConfigs?[...current.projectConfigs]:[];const targetName=(config.projectName||config.project||config.defaultProject||"").trim().toUpperCase();const targetSite=(config.siteName||config.site||"HEAD OFFICE").trim().toUpperCase();const targetYear=config.year?String(config.year).trim():"";const targetKey=config.id||`${targetName}|${targetSite}${targetYear?`|${targetYear}`:""}`;let deletedKeys=current.deletedKeys?[...current.deletedKeys]:[];deletedKeys=deletedKeys.filter(k=>k!==targetKey&&k!==targetName);const existingIndex=configs.findIndex(c=>{if(config.id&&c.id&&config.id===c.id)return true;const cName=(c.projectName||c.defaultProject||c.project||"").trim().toUpperCase();const cSite=(c.siteName||c.site||"HEAD OFFICE").trim().toUpperCase();const cYear=c.year?String(c.year).trim():"";const cKey=c.id||`${cName}|${cSite}${cYear?`|${cYear}`:""}`;return cKey===targetKey});const newConfigItem={id:targetKey,projectName:targetName,defaultProject:targetName,project:targetName,siteName:targetSite,site:targetSite,year:targetYear||void 0,sheetUrl:config.sheetUrl||"",status:config.status||(config.sheetUrl&&config.sheetUrl.trim()?"synced":"pending"),rowCount:config.rowCount!==void 0?Number(config.rowCount):0,lastSyncedAt:config.lastSyncedAt||new Date().toISOString()};if(existingIndex>=0){configs[existingIndex]={...configs[existingIndex],...newConfigItem,rowCount:config.rowCount!==void 0?Number(config.rowCount):configs[existingIndex].rowCount,lastSyncedAt:config.lastSyncedAt||configs[existingIndex].lastSyncedAt||new Date().toISOString()}}else{configs.push(newConfigItem)}const updated=saveServerState({projectConfigs:configs,deletedKeys});return res.json({success:true,projectConfigs:updated.projectConfigs,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/delete-project",(req,res)=>{try{const{id,project,site,year}=req.body;const targetName=(project||"").trim().toUpperCase();const targetSite=(site||"").trim().toUpperCase();const targetYear=year?String(year).trim():"";const targetKey=id||`${targetName}|${targetSite}${targetYear?`|${targetYear}`:""}`;const current=loadServerState();let configs=current.projectConfigs?[...current.projectConfigs]:[];let customRows=current.customRows?[...current.customRows]:[];let deletedKeys=current.deletedKeys?[...current.deletedKeys]:[];if(!deletedKeys.includes(targetKey))deletedKeys.push(targetKey);if(targetName&&!deletedKeys.includes(targetName)&&(!targetSite||targetSite==="HEAD OFFICE")){deletedKeys.push(targetName)}configs=configs.filter(c=>{if(id&&c.id&&c.id===id)return false;const cName=(c.projectName||c.defaultProject||c.project||"").trim().toUpperCase();const cSite=(c.siteName||c.site||"HEAD OFFICE").trim().toUpperCase();const cYear=c.year?String(c.year).trim():"";const cKey=c.id||`${cName}|${cSite}${cYear?`|${cYear}`:""}`;if(cKey===targetKey)return false;if(targetName&&cName===targetName){if(!targetSite||cSite===targetSite){if(!targetYear||cYear===targetYear)return false}}return true});customRows=customRows.filter(r=>{const rProj=(r["PROJECT AUDIT"]||"").trim().toUpperCase();const rSite=(r["SITE"]||"").trim().toUpperCase();const rYear=String(r["PERIODE AUDIT"]||r["TAHUN"]||r["YEAR"]||"").trim();if(targetName&&rProj===targetName){if(!targetSite||rSite===targetSite){if(!targetYear||rYear===targetYear)return false}}return true});const updated=saveServerState({projectConfigs:configs,customRows,deletedKeys});return res.json({success:true,projectConfigs:updated.projectConfigs,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/sync-all-server",async(req,res)=>{try{const state=loadServerState();const configs=state.projectConfigs||[];const configsWithUrl=configs.filter(c=>c.sheetUrl&&c.sheetUrl.trim()!=="");let syncedCount=0;let newMergedRows=[...state.customRows||[]];for(const proj of configsWithUrl){try{const{sheetId,gid}=parseGoogleSheetUrl(proj.sheetUrl);if(!sheetId)continue;const candidateUrls=[`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`];let fetchedData="";for(const url of candidateUrls){try{const result=await fetchUrl(url);if(result.statusCode===200&&result.data&&(result.data.includes(",")||result.data.includes("	"))){fetchedData=result.data;break}}catch(e){}}if(fetchedData){const parsed=parseCsvRows(fetchedData,proj.projectName);if(parsed.length>0){const tProj=(proj.projectName||"").trim().toUpperCase();const tSite=(proj.siteName||"").trim().toUpperCase();const tYear=proj.year?String(proj.year).trim():"";const tagged=parsed.map(r=>({...r,"PROJECT AUDIT":tProj||r["PROJECT AUDIT"]||"AUDIT","SITE":tSite||r["SITE"]||"HEAD OFFICE","PERIODE AUDIT":tYear||r["PERIODE AUDIT"]||"2026"}));newMergedRows=newMergedRows.filter(r=>{const rProj=(r["PROJECT AUDIT"]||"").trim().toUpperCase();const rSite=(r["SITE"]||"").trim().toUpperCase();const rYear=String(r["PERIODE AUDIT"]||r["TAHUN"]||r["YEAR"]||"").trim();if(rProj===tProj){if(!tSite||rSite===tSite){if(!tYear||rYear===tYear)return false}}return true});newMergedRows.push(...tagged);proj.rowCount=tagged.length;proj.status="synced";proj.lastSyncedAt=new Date().toISOString();syncedCount++}}}catch(err){console.warn(`Error syncing project ${proj.projectName} on server:`,err)}}const updated=saveServerState({projectConfigs:configs,customRows:newMergedRows});return res.json({success:true,syncedCount,totalRows:newMergedRows.length,state:updated})}catch(err){return res.status(500).json({success:false,error:err.message})}});const DEFAULT_GAS_BACKEND_URL="https://script.google.com/macros/s/AKfycbzLmowu47-PCtKiSLmXDcTuEnEjnupdCWnQQIqMnYaEIP0jD2c5VOnCFrLX9-8EXmwc2w/exec";app.get("/api/gas-audit-data",async(req,res)=>{try{const targetGasUrl=typeof req.query.targetUrl==="string"&&req.query.targetUrl.startsWith("https://script.google.com/")?req.query.targetUrl:DEFAULT_GAS_BACKEND_URL;const result=await fetchUrl(targetGasUrl,3);if(result.statusCode===200&&result.data){const trimmed=result.data.trim();if(!trimmed.startsWith("<")&&(trimmed.startsWith("{")||trimmed.startsWith("["))){try{const parsed=JSON.parse(trimmed);if(!res.headersSent){return res.json({success:true,data:parsed})}}catch{}}}if(!res.headersSent){return res.json({success:true,data:null,message:"GAS returning non-JSON or offline"})}}catch(err){if(!res.headersSent){return res.json({success:true,data:null,message:"GAS unavailable"})}}});app.post("/api/gas-proxy",async(req,res)=>{let responded=false;const safeJson=__name((data,status=200)=>{if(responded||res.headersSent)return;responded=true;try{res.status(status).json(data)}catch{}},"safeJson");try{const payload=req.body||{};const targetGasUrl=payload._targetGasUrl&&typeof payload._targetGasUrl==="string"&&payload._targetGasUrl.startsWith("https://script.google.com/")?payload._targetGasUrl:DEFAULT_GAS_BACKEND_URL;delete payload._targetGasUrl;const postData=JSON.stringify(payload);const client=targetGasUrl.startsWith("https")?https:http;const gasReq=client.request(targetGasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8","Content-Length":Buffer.byteLength(postData),"User-Agent":"Mozilla/5.0 (IARMS Server Proxy)"}},gasRes=>{let data="";gasRes.on("data",chunk=>{data+=chunk});gasRes.on("end",()=>{const text=data.trim();if(text&&!text.startsWith("<")){try{return safeJson(JSON.parse(text))}catch{}}return safeJson({status:"success",success:true})})});gasReq.on("error",err=>{console.warn("[GAS Proxy] Warning requesting GAS:",err.message);safeJson({status:"offline",success:true})});gasReq.setTimeout(8e3,()=>{safeJson({status:"timeout",success:true});try{gasReq.destroy()}catch{}});gasReq.write(postData);gasReq.end()}catch(err){safeJson({status:"offline",success:true})}});const EMPLOYEE_FILE_PATH=path.join(process.cwd(),"src","data","employeeMasterData.json");app.get("/api/employees",(req,res)=>{try{if(fs.existsSync(EMPLOYEE_FILE_PATH)){const data=JSON.parse(fs.readFileSync(EMPLOYEE_FILE_PATH,"utf-8"));return res.json({success:true,total:data.length,employees:data})}return res.json({success:true,total:0,employees:[]})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/employees/bulk",(req,res)=>{try{const{employees}=req.body;if(!Array.isArray(employees)||employees.length===0){return res.status(400).json({success:false,error:"Data karyawan tidak valid atau kosong"})}const validEmployees=employees.map(emp=>({nik:String(emp.nik||emp.Nik||emp.NIK||"").trim(),name:String(emp.name||emp.nama||emp.Nama||emp.NAMA||"").trim(),jobTitle:String(emp.jobTitle||emp.jabatan||emp.Jabatan||emp.JABATAN||"Staff").trim(),department:String(emp.department||emp.departemen||emp.Departemen||emp.DEPARTEMEN||"Umum").trim(),site:String(emp.site||emp.Site||emp.SITE||"BAYAN").trim(),joinDate:String(emp.joinDate||emp.masuk||emp.Masuk||emp.MASUK||"").trim()})).filter(e=>e.nik&&e.name);if(validEmployees.length===0){return res.status(400).json({success:false,error:"Tidak ditemukan data NIK dan Nama valid"})}fs.writeFileSync(EMPLOYEE_FILE_PATH,JSON.stringify(validEmployees,null,2),"utf-8");return res.json({success:true,message:`Berhasil memperbarui database master dengan ${validEmployees.length} karyawan`,total:validEmployees.length})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/employees/sync-sheet",async(req,res)=>{try{const{sheetUrl}=req.body;if(!sheetUrl){return res.status(400).json({success:false,error:"sheetUrl wajib diisi"})}const{sheetId,gid}=parseGoogleSheetUrl(sheetUrl);if(!sheetId){return res.status(400).json({success:false,error:"Format URL Google Spreadsheet tidak valid"})}const candidateUrls=[`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`];let csvText="";for(const url of candidateUrls){try{const result=await fetchUrl(url);if(result.statusCode===200&&result.data&&(result.data.includes(",")||result.data.includes("	"))){csvText=result.data;break}}catch(e){}}if(!csvText){return res.status(400).json({success:false,error:"Gagal mengunduh CSV dari Google Spreadsheet. Pastikan link dapat diakses publik (Anyone with the link can view)."})}const lines=csvText.split(/\r?\n/).filter(l=>l.trim().length>0);if(lines.length<2){return res.status(400).json({success:false,error:"Spreadsheet tidak berisi data karyawan"})}const delimiter=lines[0].includes("	")?"	":",";const headers=lines[0].split(delimiter).map(h=>h.trim().toUpperCase().replace(/^"(.*)"$/,"$1"));const findIdx=__name(keywords=>{return headers.findIndex(h=>keywords.some(kw=>h===kw||h.includes(kw)))},"findIdx");const nikIdx=findIdx(["NIK","NO INDUK","NOMOR INDUK","ID"]);const namaIdx=findIdx(["NAMA","NAME","KARYAWAN","EMPLOYEE"]);const jabatanIdx=findIdx(["JABATAN","TITLE","POSITION","POSISI","JOB"]);const deptIdx=findIdx(["DEPARTEMEN","DEPT","DEPARTMENT","DIVISI"]);const siteIdx=findIdx(["SITE","LOKASI","LOCATION","CABANG"]);const masukIdx=findIdx(["MASUK","JOIN","TANGGAL","DATE"]);const employees=[];for(let i=1;i<lines.length;i++){const row=lines[i].split(delimiter).map(c=>c.trim().replace(/^"(.*)"$/,"$1"));const nik=nikIdx!==-1?row[nikIdx]:row[0];const name=namaIdx!==-1?row[namaIdx]:row[1];if(!nik||!name)continue;employees.push({nik:nik.trim(),name:name.trim(),jobTitle:jabatanIdx!==-1&&row[jabatanIdx]?row[jabatanIdx].trim():"Staff",department:deptIdx!==-1&&row[deptIdx]?row[deptIdx].trim():"Umum",site:siteIdx!==-1&&row[siteIdx]?row[siteIdx].trim():"BAYAN",joinDate:masukIdx!==-1&&row[masukIdx]?row[masukIdx].trim():""})}if(employees.length===0){return res.status(400).json({success:false,error:"Tidak ada baris karyawan yang valid ditemukan dalam spreadsheet"})}fs.writeFileSync(EMPLOYEE_FILE_PATH,JSON.stringify(employees,null,2),"utf-8");return res.json({success:true,message:`Berhasil mengimpor ${employees.length} karyawan dari Google Sheets`,total:employees.length,employees})}catch(err){return res.status(500).json({success:false,error:err.message})}});let geminiClient=null;function getGeminiClient(){if(!process.env.GEMINI_API_KEY){return null}if(!geminiClient){geminiClient=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY})}return geminiClient}__name(getGeminiClient,"getGeminiClient");app.post("/api/ai/prioritize-recommendations",async(req,res)=>{try{const{items}=req.body;if(!Array.isArray(items)||items.length===0){return res.status(400).json({success:false,error:"Items array is required"})}const ai=getGeminiClient();if(!ai){return res.json({success:false,message:"GEMINI_API_KEY tidak dikonfigurasi, sistem menggunakan algoritma internal multi-faktor",enrichedItems:[]})}const promptText=`Anda adalah Chief Audit Executive (CAE) dan Pakar Manajemen Risiko Enterprise di sistem IARMS (Internal Audit Risk Management Systems).
Berikut adalah daftar temuan audit yang menjadi kandidat Top Prioritas Kritis berdasarkan analisis dampak finansial dan disrupsi operasional.

Tugas Anda:
Analisis setiap temuan di bawah ini. Berikan penjelasan rasional eksekutif ringkas (1-2 kalimat padat profesional dalam Bahasa Indonesia) yang menjelaskan MENGAPA temuan ini kritis, potensi dampak terburuk jika diabaikan, serta 1 aksi mitigasi prioritas taktis.

Daftar Temuan:
${JSON.stringify(items.slice(0,10),null,2)}

Harap kembalikan respon HANYA dalam format JSON valid tanpa markdown, dengan struktur array berikut:
{
  "enrichedItems": [
    {
      "rank": <nomor rank yang sama>,
      "aiRationale": "<alasan eksekutif 1-2 kalimat tajam dan berbobot>",
      "keyMitigationAction": "<tindakan mitigasi taktis prioritas>"
    }
  ]
}`;const response=await ai.models.generateContent({model:"gemini-3.8-flash",contents:promptText,config:{responseMimeType:"application/json",temperature:.2}});const responseText=response.text||"";let parsed={};try{parsed=JSON.parse(responseText)}catch{const match=responseText.match(/\{[\s\S]*\}/);if(match){parsed=JSON.parse(match[0])}}return res.json({success:true,enrichedItems:parsed.enrichedItems||[],source:"gemini-3.8-flash"})}catch(err){console.error("Error in AI prioritization endpoint:",err);return res.json({success:false,error:err.message,enrichedItems:[]})}});async function startServer(){if(process.env.NODE_ENV!=="production"){const vite=await createViteServer({server:{middlewareMode:true},appType:"spa"});app.use(vite.middlewares)}else{const distPath=path.join(process.cwd(),"dist");app.use(express.static(distPath));app.get("*",(req,res)=>{res.sendFile(path.join(distPath,"index.html"))})}app.listen(PORT,"0.0.0.0",()=>{console.log(`Server running on http://localhost:${PORT}`)})}__name(startServer,"startServer");startServer();
