import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Link, 
  ClipboardList, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X, 
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Database,
  ArrowRight,
  Plus,
  Trash2,
  FolderKanban,
  FileSpreadsheet,
  Check,
  Play
} from 'lucide-react';
import { AFSFindingRecord } from '../types';
import { 
  GOOGLE_SCRIPT_URL,
  syncAuditData, 
  fetchCsvFromGoogleSheet, 
  fetchProjectsFromGasBackend,
  deleteProjectFromBackend,
  syncSheetUrlToBackend
} from '../services/api';
import { parseAuditCsvClient } from '../utils/csvParser';
import { 
  saveSyncedRows, 
  getSyncMetadata, 
  clearAllData,
  getProjectLinkConfigs,
  saveProjectLinkConfig,
  deleteProjectLinkConfig,
  deleteProjectLinkConfigById,
  cleanupDuplicates,
  getDeletedProjectKeys,
  getProjectCompositeKey,
  overrideProjectLinkConfigs,
  ProjectLinkConfig
} from '../data/dataSyncManager';

interface GoogleSheetSyncModalProps {
  isOpen?: boolean;
  isEmbedded?: boolean;
  onClose?: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onSyncComplete?: (rowsCount: number) => void;
  onNavigateToAFS?: () => void;
}

export default function GoogleSheetSyncModal({
  isOpen = true,
  isEmbedded = false,
  onClose,
  onToast,
  onSyncComplete,
  onNavigateToAFS
}: GoogleSheetSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'url' | 'paste' | 'file'>('projects');
  
  // Per-project link configs
  const [projectConfigs, setProjectConfigs] = useState<ProjectLinkConfig[]>([]);
  const [syncingProjects, setSyncingProjects] = useState<Record<string, boolean>>({});
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  // Single URL tab state
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1EbW-jLKB93mRXgcPfLh8LGuzj-AiJA9uwdTj-Tjl3dE/edit?pli=1&gid=1675231303#gid=1675231303'
  );
  const [targetProject, setTargetProject] = useState('PR-PAYMENT');
  const [targetSite, setTargetSite] = useState('HEAD OFFICE');
  const [pastedData, setPastedData] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Add new project form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSite, setNewProjectSite] = useState('HEAD OFFICE');
  const [newProjectYear, setNewProjectYear] = useState('2026');
  const [newProjectUrl, setNewProjectUrl] = useState('');
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);

  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    isPrivate?: boolean;
    count?: number;
    rows?: AFSFindingRecord[];
    message?: string;
  } | null>(null);

  const meta = getSyncMetadata();

  // Load initial data on mount (useEffect):
  // Saat halaman dimuat, Wajib panggil fungsi doGet ke Google Apps Script terlebih dahulu.
  // Jika data dari Apps Script berhasil diterima, langsung TIMPA (OVERRIDE) state afsProjects
  // dan localStorage browser dengan data dari server tersebut. Jangan menggabungkan (merge) dengan data lokal lama.
  useEffect(() => {
    if (isOpen) {
      setSyncResult(null);
      let isMounted = true;
      setIsLoadingBackend(true);

      // Panggil doGet ke Google Apps Script terlebih dahulu
      fetchProjectsFromGasBackend()
        .then((backendProjects) => {
          if (!isMounted) return;
          if (backendProjects && backendProjects.length > 0) {
            const mappedConfigs: ProjectLinkConfig[] = backendProjects.map(bp => {
              const bpProj = (bp.defaultProject || bp.project || bp.projectName || '').trim().toUpperCase();
              const bpSite = (bp.site || bp.siteName || 'HEAD OFFICE').trim().toUpperCase();
              const bpYear = bp.year ? String(bp.year).trim() : '';
              const bpKey = bp.id || getProjectCompositeKey(bpProj, bpSite, bpYear);

              return {
                id: bpKey,
                projectName: bpProj,
                siteName: bpSite,
                year: bpYear || undefined,
                sheetUrl: bp.sheetUrl || '',
                rowCount: bp.rowCount || 0,
                status: bp.sheetUrl && bp.sheetUrl.trim() ? 'synced' : 'pending',
                lastSyncedAt: bp.lastSyncedAt || null,
                defaultProject: bpProj,
                project: bpProj,
                site: bpSite
              };
            });

            // Langsung TIMPA (OVERRIDE) state dan localStorage tanpa merge
            overrideProjectLinkConfigs(mappedConfigs);
            setProjectConfigs(mappedConfigs);
          } else {
            // Jika backend kosong/offline, gunakan config yang ada
            setProjectConfigs(getProjectLinkConfigs());
          }
        })
        .catch((err) => {
          console.warn('Gagal memuat daftar project awal dari Google Apps Script:', err);
          if (isMounted) {
            setProjectConfigs(getProjectLinkConfigs());
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingBackend(false);
        });

      const handleLinksUpdated = () => {
        setProjectConfigs(getProjectLinkConfigs());
      };

      window.addEventListener('afs_project_links_updated', handleLinksUpdated);
      window.addEventListener('afs_data_synced', handleLinksUpdated);

      return () => {
        isMounted = false;
        window.removeEventListener('afs_project_links_updated', handleLinksUpdated);
        window.removeEventListener('afs_data_synced', handleLinksUpdated);
      };
    }
  }, [isOpen]);

  if (!isOpen && !isEmbedded) return null;

  // Refresh project config state
  const refreshProjectConfigs = () => {
    setProjectConfigs(getProjectLinkConfigs());
  };

  // Manual refresh from backend GAS (Override state & localStorage)
  const handleRefreshFromBackend = async () => {
    setIsLoadingBackend(true);
    try {
      const backendProjects = await fetchProjectsFromGasBackend();
      if (backendProjects && backendProjects.length > 0) {
        const mappedConfigs: ProjectLinkConfig[] = backendProjects.map(bp => {
          const bpProj = (bp.defaultProject || bp.project || bp.projectName || '').trim().toUpperCase();
          const bpSite = (bp.site || bp.siteName || 'HEAD OFFICE').trim().toUpperCase();
          const bpYear = bp.year ? String(bp.year).trim() : '';
          const bpKey = bp.id || getProjectCompositeKey(bpProj, bpSite, bpYear);

          return {
            id: bpKey,
            projectName: bpProj,
            siteName: bpSite,
            year: bpYear || undefined,
            sheetUrl: bp.sheetUrl || '',
            rowCount: bp.rowCount || 0,
            status: bp.sheetUrl && bp.sheetUrl.trim() ? 'synced' : 'pending',
            lastSyncedAt: bp.lastSyncedAt || null,
            defaultProject: bpProj,
            project: bpProj,
            site: bpSite
          };
        });

        // Langsung TIMPA (OVERRIDE) state dan localStorage dengan data dari Apps Script
        overrideProjectLinkConfigs(mappedConfigs);
        setProjectConfigs(mappedConfigs);
        onToast(`Berhasil memuat ${backendProjects.length} project dari Google Apps Script!`, 'success');
      } else {
        onToast('Daftar project di Google Apps Script sudah up-to-date', 'info');
      }
    } catch (e: any) {
      onToast(`Gagal memuat project dari backend: ${e.message}`, 'error');
    } finally {
      setIsLoadingBackend(false);
    }
  };

  // Manual trigger to clean duplicate projects and findings
  const handleCleanupDuplicates = () => {
    const { removedRows, removedConfigs } = cleanupDuplicates();
    refreshProjectConfigs();

    if (removedRows > 0 || removedConfigs > 0) {
      onToast(`Berhasil membersihkan ${removedConfigs} project duplikat dan ${removedRows} temuan duplikat!`, 'success');
    } else {
      onToast('Data sudah bersih. Tidak ditemukan project atau temuan duplikat.', 'info');
    }
  };

  // Fungsi Sync (Sync Project Ini / Sync Semua Project):
  // Saat tombol sync diklik, kirim payload JSON:
  // {
  //   "action": "sync_sheet_url",
  //   "project": item.defaultProject || item.project,
  //   "site": item.site,
  //   "year": item.year,
  //   "sheetUrl": item.sheetUrl,
  //   "timestamp": new Date().toISOString()
  // }
  // Gunakan header 'Content-Type': 'text/plain;charset=utf-8'
  const handleSyncSingleProject = async (
    itemOrProjName: ProjectLinkConfig | string, 
    urlToSyncArg?: string, 
    siteToSyncArg?: string, 
    yearToSyncArg?: string | number
  ) => {
    let item: ProjectLinkConfig;
    if (typeof itemOrProjName === 'string') {
      item = {
        projectName: itemOrProjName,
        sheetUrl: urlToSyncArg || '',
        siteName: siteToSyncArg || 'HEAD OFFICE',
        year: yearToSyncArg,
        defaultProject: itemOrProjName,
        project: itemOrProjName,
        site: siteToSyncArg || 'HEAD OFFICE'
      };
    } else {
      item = itemOrProjName;
    }

    const projName = (item.defaultProject || item.project || item.projectName || '').trim().toUpperCase();
    const siteToSync = (item.site || item.siteName || 'HEAD OFFICE').trim().toUpperCase();
    const yearToSync = item.year ? String(item.year).trim() : (yearToSyncArg ? String(yearToSyncArg).trim() : '');
    const urlToSync = (item.sheetUrl || urlToSyncArg || '').trim();

    if (!urlToSync) {
      onToast(`Silakan masukkan link Google Sheet untuk project ${projName}`, 'warning');
      return;
    }

    const syncKey = item.id || `${projName}_${siteToSync}_${yearToSync}`;
    setSyncingProjects(prev => ({ ...prev, [syncKey]: true, [projName]: true }));
    setSyncResult(null);
    window.dispatchEvent(new CustomEvent('afs_sync_status_changed', { detail: { isSyncing: true } }));

    try {
      // 1. Kirim payload JSON ke backend Google Apps Script dengan header 'Content-Type': 'text/plain;charset=utf-8'
      const syncPayload = {
        action: "sync_sheet_url",
        project: item.defaultProject || item.project || projName,
        site: item.site || siteToSync,
        year: item.year ? String(item.year).trim() : yearToSync,
        sheetUrl: urlToSync,
        timestamp: new Date().toISOString()
      };

      const backendSyncPromise = fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(syncPayload)
      }).catch(e => {
        console.warn("GAS backend sync notification error:", e);
        return null;
      });

      // 2. Fetch CSV dari Google Sheet langsung untuk memproses dan menyimpan temuan AFS ke dalam aplikasi
      let parsedRows: any[] = [];
      let fetchSuccess = false;

      try {
        const rawCsv = await fetchCsvFromGoogleSheet(urlToSync);
        parsedRows = parseAuditCsvClient(rawCsv, projName);
        fetchSuccess = true;
      } catch (clientErr: any) {
        console.warn(`Direct fetch failed for ${projName}, waiting for backend response...`, clientErr);
        const gasResponse = await backendSyncPromise;
        if (gasResponse && gasResponse.ok) {
          try {
            const gasText = await gasResponse.text();
            const gasJson = JSON.parse(gasText);
            if (gasJson && gasJson.rows && gasJson.rows.length > 0) {
              parsedRows = gasJson.rows;
              fetchSuccess = true;
            } else if (gasJson && gasJson.rawCsvData) {
              parsedRows = parseAuditCsvClient(gasJson.rawCsvData, projName);
              fetchSuccess = true;
            }
          } catch (_) {}
        }
        if (!fetchSuccess && clientErr.message && clientErr.message.includes('privat')) {
          throw clientErr;
        }
      }

      await backendSyncPromise;

      if (fetchSuccess && parsedRows.length > 0) {
        saveSyncedRows(
          parsedRows, 
          projName, 
          {
            syncedProject: projName,
            sourceType: 'url',
            sheetUrl: urlToSync
          },
          siteToSync,
          yearToSync
        );

        saveProjectLinkConfig({
          id: item.id,
          projectName: projName,
          siteName: siteToSync,
          year: yearToSync || undefined,
          sheetUrl: urlToSync,
          status: 'synced',
          rowCount: parsedRows.length,
          lastSyncedAt: new Date().toISOString(),
          defaultProject: projName,
          project: projName,
          site: siteToSync
        });

        refreshProjectConfigs();

        setSyncResult({
          success: true,
          count: parsedRows.length,
          rows: parsedRows,
          message: `Berhasil mensinkronkan ${parsedRows.length} data audit untuk ${projName}!`
        });

        onToast(`Sukses: ${parsedRows.length} temuan ${projName} (${siteToSync}${yearToSync ? ' - ' + yearToSync : ''}) berhasil diperbarui!`, 'success');
        if (onSyncComplete) onSyncComplete(parsedRows.length);
      } else {
        saveProjectLinkConfig({
          id: item.id,
          projectName: projName,
          siteName: siteToSync,
          year: yearToSync || undefined,
          sheetUrl: urlToSync,
          status: fetchSuccess ? 'synced' : 'pending',
          rowCount: parsedRows.length,
          lastSyncedAt: new Date().toISOString(),
          defaultProject: projName,
          project: projName,
          site: siteToSync
        });
        refreshProjectConfigs();
        onToast(`Link ${projName} (${siteToSync}) berhasil disinkronkan ke backend Google Apps Script!`, 'success');
      }
    } catch (err: any) {
      console.error(`Error syncing project ${projName}:`, err);
      const isPrivate = err.message && (err.message.includes('privat') || err.message.includes('terkunci'));
      saveProjectLinkConfig({
        id: item.id,
        projectName: projName,
        siteName: siteToSync,
        year: yearToSync || undefined,
        sheetUrl: urlToSync,
        status: isPrivate ? 'private' : 'error',
        errorMessage: err.message || 'Gagal sinkronisasi'
      });
      refreshProjectConfigs();
      onToast(isPrivate ? `Google Sheet ${projName} privat/terkunci` : `Gagal: ${err.message}`, 'error');
    } finally {
      setSyncingProjects(prev => ({ ...prev, [syncKey]: false, [projName]: false }));
      window.dispatchEvent(new CustomEvent('afs_sync_status_changed', { detail: { isSyncing: false } }));
    }
  };

  // Sync all projects sequentially
  const handleSyncAllProjects = async () => {
    const projectsWithUrl = projectConfigs.filter(p => p.sheetUrl && p.sheetUrl.trim());
    if (projectsWithUrl.length === 0) {
      onToast('Belum ada link Google Sheet yang diinput untuk project', 'warning');
      return;
    }

    setIsSyncing(true);

    for (const proj of projectsWithUrl) {
      await handleSyncSingleProject(proj);
    }

    // Auto-refresh dari backend GAS setelah semua project disinkronkan
    try {
      const refreshedProjects = await fetchProjectsFromGasBackend();
      if (refreshedProjects && refreshedProjects.length > 0) {
        const mappedConfigs: ProjectLinkConfig[] = refreshedProjects.map(bp => {
          const bpProj = (bp.defaultProject || bp.project || bp.projectName || '').trim().toUpperCase();
          const bpSite = (bp.site || bp.siteName || 'HEAD OFFICE').trim().toUpperCase();
          const bpYear = bp.year ? String(bp.year).trim() : '';
          const bpKey = bp.id || getProjectCompositeKey(bpProj, bpSite, bpYear);

          return {
            id: bpKey,
            projectName: bpProj,
            siteName: bpSite,
            year: bpYear || undefined,
            sheetUrl: bp.sheetUrl || '',
            rowCount: bp.rowCount || 0,
            status: bp.sheetUrl && bp.sheetUrl.trim() ? 'synced' : 'pending',
            lastSyncedAt: bp.lastSyncedAt || null,
            defaultProject: bpProj,
            project: bpProj,
            site: bpSite
          };
        });
        overrideProjectLinkConfigs(mappedConfigs);
        setProjectConfigs(mappedConfigs);
      }
    } catch (err) {
      console.warn('Auto-refresh backend setelah sync gagal:', err);
    }

    setIsSyncing(false);
    onToast('Selesai mensinkronkan seluruh Project Audit ke Google Sheets!', 'success');
  };

  // Save changes to a project URL input field
  const handleUpdateProjectUrl = (proj: ProjectLinkConfig, newUrl: string) => {
    saveProjectLinkConfig({
      ...proj,
      sheetUrl: newUrl,
      status: 'pending'
    });
    refreshProjectConfigs();
  };

  // Save changes to a project Site input field
  const handleUpdateProjectSite = (proj: ProjectLinkConfig, newSite: string) => {
    saveProjectLinkConfig({
      ...proj,
      siteName: newSite.toUpperCase(),
      site: newSite.toUpperCase(),
      status: 'pending'
    });
    refreshProjectConfigs();
  };

  // Save changes to a project Year input field
  const handleUpdateProjectYear = (proj: ProjectLinkConfig, newYear: string) => {
    saveProjectLinkConfig({
      ...proj,
      year: newYear.trim(),
      status: 'pending'
    });
    refreshProjectConfigs();
  };

  // Add new project link
  const handleAddNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      onToast('Silakan masukkan nama Project Audit', 'warning');
      return;
    }

    const formattedProj = newProjectName.trim().toUpperCase();
    const formattedSite = newProjectSite.trim().toUpperCase() || 'HEAD OFFICE';
    const formattedYear = newProjectYear.trim();

    const uniqueId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newConfig: ProjectLinkConfig = {
      id: uniqueId,
      projectName: formattedProj,
      defaultProject: formattedProj,
      project: formattedProj,
      siteName: formattedSite,
      site: formattedSite,
      year: formattedYear,
      sheetUrl: newProjectUrl.trim(),
      status: 'pending'
    };

    saveProjectLinkConfig(newConfig);

    setNewProjectName('');
    setNewProjectSite('HEAD OFFICE');
    setNewProjectYear('2026');
    setNewProjectUrl('');
    setShowAddProjectForm(false);
    refreshProjectConfigs();
    onToast(`Project ${formattedProj} (${formattedSite}${formattedYear ? ' - ' + formattedYear : ''}) berhasil ditambahkan!`, 'success');

    // If new project includes URL, sync it to backend immediately
    if (newProjectUrl.trim()) {
      handleSyncSingleProject(newConfig);
    }
  };

  // Fungsi Hapus (Delete Icon):
  // Saat tombol hapus diklik, kirim request POST ke backend dengan payload JSON:
  // {
  //   "action": "delete_project",
  //   "project": item.defaultProject || item.project,
  //   "site": item.site,
  //   "year": item.year
  // }
  // Gunakan header 'Content-Type': 'text/plain;charset=utf-8' dan perbarui local state agar item langsung hilang dari UI.
  const handleDeleteProject = async (item: ProjectLinkConfig) => {
    const projectToDelete = item.defaultProject || item.project || item.projectName;
    const siteToDelete = item.site || item.siteName || 'HEAD OFFICE';
    const yearToDelete = item.year ? String(item.year).trim() : '';

    // Perbarui local state agar item langsung hilang dari UI
    setProjectConfigs(prev => prev.filter(p => {
      const pProj = p.defaultProject || p.project || p.projectName;
      const pSite = p.site || p.siteName || 'HEAD OFFICE';
      const pYear = p.year ? String(p.year).trim() : '';

      if (p.id && item.id && p.id === item.id) return false;
      if (pProj === projectToDelete && pSite === siteToDelete && pYear === yearToDelete) return false;
      return true;
    }));

    // Update persistent local storage and dispatch events
    deleteProjectLinkConfig(projectToDelete, siteToDelete, yearToDelete);
    if (item.id) {
      deleteProjectLinkConfigById(item.id);
    }
    refreshProjectConfigs();

    onToast(`Project ${projectToDelete} (${siteToDelete}${yearToDelete ? ' ' + yearToDelete : ''}) dihapus`, 'info');

    // Kirim request POST ke backend dengan payload JSON
    try {
      const payload = {
        action: "delete_project",
        project: item.defaultProject || item.project || item.projectName,
        site: item.site || item.siteName || "HEAD OFFICE",
        year: item.year ? String(item.year).trim() : ""
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Gagal mengirim request delete_project ke Google Apps Script backend:", err);
    }
  };

  // Handle URL Sync (Single Tab)
  const handleUrlSync = async () => {
    if (!sheetUrl.trim()) {
      onToast('Silakan masukkan link Google Sheet terlebih dahulu', 'warning');
      return;
    }
    await handleSyncSingleProject(targetProject, sheetUrl, targetSite);
  };

  // Handle Copy-Paste Text Sync
  const handlePasteSync = async () => {
    if (!pastedData.trim()) {
      onToast('Silakan tempel (paste) tabel dari Google Sheet terlebih dahulu', 'warning');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      let parsedRows = parseAuditCsvClient(pastedData.trim(), targetProject.trim());

      // If client parse returned no rows, fall back to Google Apps Script
      if (!parsedRows || parsedRows.length === 0) {
        const gasRes = await syncAuditData({
          action: 'parse_pasted_data',
          rawCsvData: pastedData.trim(),
          defaultProject: targetProject.trim(),
          site: targetSite,
          timestamp: new Date().toISOString()
        });
        if (gasRes && gasRes.rows) {
          parsedRows = gasRes.rows;
        }
      }

      if (parsedRows && parsedRows.length > 0) {
        saveSyncedRows(
          parsedRows, 
          targetProject, 
          {
            syncedProject: targetProject,
            sourceType: 'paste'
          },
          targetSite
        );

        // Sync to GAS
        syncAuditData({
          action: 'paste_synced',
          projectName: targetProject.trim(),
          count: parsedRows.length,
          site: targetSite,
          timestamp: new Date().toISOString()
        }).catch(e => console.warn('GAS paste sync warning:', e));

        setSyncResult({
          success: true,
          count: parsedRows.length,
          rows: parsedRows,
          message: `Berhasil memproses & mensinkronkan ${parsedRows.length} baris data ${targetProject} (Site: ${targetSite})!`
        });

        onToast(`Impor Sukses: ${parsedRows.length} data audit ${targetProject} diperbarui!`, 'success');
        if (onSyncComplete) onSyncComplete(parsedRows.length);
      } else {
        onToast('Gagal membaca format tabel. Pastikan baris pertama berisi header (NO, PROJECT AUDIT, STATUS, dll)', 'error');
      }
    } catch (err: any) {
      console.error('Error parsing pasted data:', err);
      onToast('Gagal memproses data tempel', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPastedData(text);
        setActiveTab('paste');
        onToast(`File ${file.name} dimuat. Klik "Impor & Sinkronkan" untuk memproses.`, 'info');
      }
    };
    reader.readAsText(file);
  };

  const innerContent = (
    <div className={`bg-white ${isEmbedded ? 'rounded-2xl border border-slate-200/90 shadow-sm' : 'rounded-3xl border border-slate-200 shadow-2xl max-w-4xl my-8'} w-full overflow-hidden`}>
      
      {/* Header Modal */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-950 p-6 text-white flex items-start justify-between relative">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500/20 rounded-2xl border border-sky-400/30 text-sky-300 flex-shrink-0">
            <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin text-sky-200' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                Input Finding Statement (AFS)
              </h2>
              <span className="bg-sky-500/30 text-sky-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-sky-400/30 uppercase">
                Multi-Project Sync
              </span>
            </div>
            <p className="text-xs text-sky-200/80 mt-1">
              Kelola & sinkronkan link Google Sheet AFS per Project Audit, Jobsite, dan Tahun Periode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToAFS && (
            <button
              onClick={onNavigateToAFS}
              className="px-3.5 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-white rounded-xl transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-700" />
              <span>Lihat Resume AFS</span>
            </button>
          )}

          {!isEmbedded && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Sync Mode Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2 text-xs font-extrabold overflow-x-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-white text-sky-700 border-slate-200 border-b-white -mb-px font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-sky-600" />
            Link Per Project Audit
            <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-black">
              {projectConfigs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
              activeTab === 'url'
                ? 'bg-white text-sky-700 border-slate-200 border-b-white -mb-px font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Link className="w-4 h-4" />
            Input Link Tunggal
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
              activeTab === 'paste'
                ? 'bg-white text-sky-700 border-slate-200 border-b-white -mb-px font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Copy-Paste Tabel
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
              activeTab === 'file'
                ? 'bg-white text-sky-700 border-slate-200 border-b-white -mb-px font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File CSV
          </button>
        </div>

        {/* Modal / Page Body */}
        <div className={`p-6 space-y-5 ${isEmbedded ? '' : 'max-h-[70vh] overflow-y-auto'}`}>

          {/* TAB 1: PER PROJECT LINK MANAGER */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              
              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-sky-50/70 p-4 rounded-2xl border border-sky-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Daftar Link Google Sheet AFS Per Project Audit
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Masukkan link Google Sheet untuk masing-masing project secara mandiri.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCleanupDuplicates}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                    title="Bersihkan duplikat project & data temuan audit"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Bersihkan Duplikat
                  </button>

                  <button
                    onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Project
                  </button>

                  <button
                    onClick={handleRefreshFromBackend}
                    disabled={isLoadingBackend}
                    className="px-3 py-2 bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    title="Sinkronkan daftar project dari Google Apps Script"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackend ? 'animate-spin text-sky-600' : 'text-sky-600'}`} />
                    {isLoadingBackend ? 'Memuat Project...' : 'Refresh dari GAS'}
                  </button>

                  <button
                    onClick={handleSyncAllProjects}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 border border-sky-800 shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync Semua Project
                  </button>
                </div>
              </div>

              {/* Form Add New Project */}
              {showAddProjectForm && (
                <form onSubmit={handleAddNewProject} className="bg-slate-50 border border-sky-200 p-4 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-900 uppercase">Tambah Project Audit Baru</span>
                    <button 
                      type="button" 
                      onClick={() => setShowAddProjectForm(false)} 
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Project Audit</label>
                      <input
                        type="text"
                        placeholder="Contoh: AUDIT OPERASIONAL"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Site / Lokasi</label>
                      <input
                        type="text"
                        placeholder="Contoh: JKT / KPT / HO"
                        value={newProjectSite}
                        onChange={(e) => setNewProjectSite(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Tahun Periode</label>
                      <input
                        type="text"
                        placeholder="Contoh: 2026 / 2027"
                        value={newProjectYear}
                        onChange={(e) => setNewProjectYear(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Link Google Sheet AFS</label>
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={newProjectUrl}
                        onChange={(e) => setNewProjectUrl(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddProjectForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs bg-sky-700 text-white hover:bg-sky-800 rounded-lg font-bold"
                    >
                      Simpan Project
                    </button>
                  </div>
                </form>
              )}

              {/* Project Cards List */}
              <div className="space-y-3">
                {projectConfigs.map((proj, idx) => {
                  const isCurrentSyncing = syncingProjects[proj.projectName] || false;

                  return (
                    <div 
                      key={`gs-proj-${proj.projectName || idx}-${idx}`}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-sky-300 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-sky-100 text-sky-900 font-black text-xs rounded-lg uppercase tracking-wide">
                            {proj.projectName}
                          </span>

                          {proj.siteName && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[11px] rounded-md uppercase border border-slate-200">
                              Site: {proj.siteName}
                            </span>
                          )}

                          {proj.year && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 font-black text-[11px] rounded-md uppercase border border-indigo-200">
                              Tahun: {proj.year}
                            </span>
                          )}

                          {proj.status === 'synced' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <Check className="w-3 h-3 text-emerald-600" />
                              {proj.rowCount || 0} Temuan Ter-Sync
                            </span>
                          )}

                          {proj.status === 'private' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              Google Sheet Privat
                            </span>
                          )}

                          {proj.status === 'pending' && !proj.sheetUrl && (
                            <span className="text-[11px] text-slate-400 italic">
                              Link Belum Diisi
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {proj.sheetUrl && (
                            <a
                              href={proj.sheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-all"
                              title="Buka Google Sheet"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeleteProject(proj)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Hapus Project Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Site Name, Year & URL Input & Sync Row */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                            Nama Site / Lokasi
                          </label>
                          <input
                            type="text"
                            value={proj.siteName || ''}
                            onChange={(e) => handleUpdateProjectSite(proj, e.target.value)}
                            placeholder="Contoh: JKT / KPT / HO"
                            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 uppercase"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                            Tahun
                          </label>
                          <input
                            type="text"
                            value={proj.year || ''}
                            onChange={(e) => handleUpdateProjectYear(proj, e.target.value)}
                            placeholder="2026 / 2027"
                            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                            Link Google Sheet AFS
                          </label>
                          <input
                            type="url"
                            value={proj.sheetUrl || ''}
                            onChange={(e) => handleUpdateProjectUrl(proj, e.target.value)}
                            placeholder={`Tempelkan link Google Sheet AFS untuk ${proj.projectName} di sini...`}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="md:col-span-3 flex items-end">
                          <button
                            onClick={() => handleSyncSingleProject(proj)}
                            disabled={isCurrentSyncing || !proj.sheetUrl || !proj.sheetUrl.trim()}
                            className="w-full px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-sky-800 shadow-2xs disabled:opacity-40 whitespace-nowrap h-[38px]"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isCurrentSyncing ? 'animate-spin' : ''}`} />
                            {isCurrentSyncing ? 'Syncing...' : 'Sync Project Ini'}
                          </button>
                        </div>
                      </div>

                      {proj.lastSyncedAt && (
                        <p className="text-[10px] text-slate-400">
                          Terakhir disinkronkan: {new Date(proj.lastSyncedAt).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 2: SINGLE URL SYNC */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              
              {/* Target Project & Site Selector */}
              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  <span className="font-extrabold text-slate-800">Target Project & Site:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-600">Project:</span>
                    <input
                      type="text"
                      value={targetProject}
                      onChange={(e) => setTargetProject(e.target.value.toUpperCase())}
                      className="bg-white border border-sky-300 rounded-xl px-2.5 py-1 font-black text-sky-900 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"
                      placeholder="PR-PAYMENT"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-600">Site:</span>
                    <input
                      type="text"
                      value={targetSite}
                      onChange={(e) => setTargetSite(e.target.value.toUpperCase())}
                      className="bg-white border border-sky-300 rounded-xl px-2.5 py-1 font-black text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 w-32"
                      placeholder="HEAD OFFICE"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5 uppercase tracking-wider">
                  Link Google Sheet (AFS Audit)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1EbW-jLKB93mRXgcPfLh8LGuzj-AiJA9uwdTj-Tjl3dE/edit..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                    />
                  </div>
                  <button
                    onClick={handleUrlSync}
                    disabled={isSyncing}
                    className="px-6 py-3 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 border border-sky-800 shadow-md disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Proses Sync...' : 'Sinkronkan Sekarang'}
                  </button>
                </div>
              </div>

              {/* Instructions if Private / Restricted */}
              {syncResult?.isPrivate && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    Google Sheet Memerlukan Akses Publik
                  </div>
                  <p className="text-amber-800 leading-relaxed font-medium">
                    Google Sheet ini saat ini berstatus <strong>Restricted / Private</strong>. Agar server dapat mengunduh dan mensinkronkan data secara otomatis, pilih salah satu opsi mudah berikut:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                      <span className="font-black text-sky-900 block text-[11px] uppercase">Opsi 1: Bagikan Akses Lihat</span>
                      <ol className="list-decimal list-inside text-[11px] text-slate-700 space-y-1 font-medium">
                        <li>Buka Google Sheet di tab baru</li>
                        <li>Klik tombol <strong>Bagikan (Share)</strong></li>
                        <li>Ubah Akses umum jadi <strong>"Siapa saja yang memiliki link"</strong> (Viewer)</li>
                        <li>Klik "Sinkronkan Sekarang" lagi di aplikasi ini</li>
                      </ol>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                      <span className="font-black text-indigo-900 block text-[11px] uppercase">Opsi 2: Instan Copy-Paste</span>
                      <p className="text-[11px] text-slate-700 leading-tight">
                        Tanpa mengubah izin sheet! Cukup buka Google Sheet, tekan <strong>Ctrl+A</strong> lalu <strong>Ctrl+C</strong>, lalu klik tab <strong>"Copy-Paste Tabel"</strong> di atas dan tempel di sana!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PASTE TABEL DIRECT */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              {/* Target Project & Site Selector */}
              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  <span className="font-extrabold text-slate-800">Target Project & Site:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-600">Project:</span>
                    <input
                      type="text"
                      value={targetProject}
                      onChange={(e) => setTargetProject(e.target.value.toUpperCase())}
                      className="bg-white border border-sky-300 rounded-xl px-2.5 py-1 font-black text-sky-900 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"
                      placeholder="PR-PAYMENT"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-600">Site:</span>
                    <input
                      type="text"
                      value={targetSite}
                      onChange={(e) => setTargetSite(e.target.value.toUpperCase())}
                      className="bg-white border border-sky-300 rounded-xl px-2.5 py-1 font-black text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 w-32"
                      placeholder="HEAD OFFICE"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    Tempel (Paste) Tabel Google Sheet
                  </label>
                  <span className="text-[11px] text-sky-700 font-bold">
                    *Tekan Ctrl+A lalu Ctrl+C di Google Sheet, lalu Ctrl+V di sini
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder={`NO\tPROJECT AUDIT\tSITE\tPROBLEM/FINDING\tKRITERIA\tKATEGORI\tSTATUS\tDUE DATE\n1\tPR-PAYMENT\tJKT\tContoh temuan 1\tSOP\tMAJOR\tCLOSE\t8/4/2026\n2\tPR-PAYMENT\tJKT\tContoh temuan 2\tIK\tMINOR\tOPEN\t8/4/2026`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePasteSync}
                  disabled={isSyncing || !pastedData.trim()}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all flex items-center gap-2 border border-emerald-700 shadow-md disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isSyncing ? 'Memproses Data...' : 'Impor & Sinkronkan Data'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: UPLOAD CSV FILE */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-sky-300 bg-sky-50/40 rounded-3xl p-8 text-center space-y-3 hover:bg-sky-50 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-10 h-10 text-sky-600 mx-auto" />
                <div>
                  <p className="text-sm font-extrabold text-slate-800">
                    Klik atau drag & drop file CSV / TSV di sini
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    File hasil ekspor Google Sheets (Format .csv / .tsv)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sync Result Banner */}
          {syncResult?.success && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-900 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-black text-emerald-950 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Data Berhasil Disinkronkan!
              </div>
              <p className="text-emerald-800 font-medium">
                {syncResult.message} Seluruh grafik, tabel, dan indikator achievement telah diperbarui secara otomatis secara real-time.
              </p>
            </div>
          )}

          {/* Active Metadata Info */}
          <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div>
              <span className="font-bold text-slate-800">Status Data: </span>
              {meta.lastSyncTimestamp ? (
                <span>
                  Disinkronkan pada {new Date(meta.lastSyncTimestamp).toLocaleString('id-ID')} ({meta.totalSyncedRows} Total Data Audit)
                </span>
              ) : meta.totalSyncedRows > 0 ? (
                <span>{meta.totalSyncedRows} Data Tersedia</span>
              ) : (
                <span className="text-amber-700 font-bold">Data Kosong / Belum Disinkronkan</span>
              )}
            </div>

            <button
              onClick={() => {
                clearAllData();
                refreshProjectConfigs();
                onToast('Data telah dibersihkan. Silakan sinkronkan atau tempel link baru.', 'info');
                setSyncResult(null);
                if (onSyncComplete) onSyncComplete(0);
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline hover:no-underline flex items-center gap-1"
            >
              Bersihkan Seluruh Data
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        {!isEmbedded && onClose && (
          <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup Window
            </button>
          </div>
        )}

      </div>
    );

  if (isEmbedded) {
    return <div className="w-full animate-fade-in">{innerContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      {innerContent}
    </div>
  );
}
