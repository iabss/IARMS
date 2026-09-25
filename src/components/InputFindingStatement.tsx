import React, { useState, useEffect, useCallback } from 'react';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import { 
  fetchAfsProjectsFromServer,
  fetchProjectsFromBackend,
  purgeAfsProjectsFromServer
} from '../services/api';
import { 
  hydrateServerState,
  getProjectLinkConfigs, 
  overrideProjectLinkConfigs,
  purgeAllAfsProjectsLocalAndStorage,
  getDeletedProjectKeys,
  ProjectLinkConfig 
} from '../data/dataSyncManager';

interface InputFindingStatementProps {
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: () => void;
  key?: string;
}

export default function InputFindingStatement({ onToast, onNavigateToAFS }: InputFindingStatementProps) {
  // 1. INSTANT DISPLAY (UI Shell / Template di-render instan):
  // Mengambil cache sekunder localStorage agar antarmuka terbuka seketika tanpa jeda
  const [afsProjects, setAfsProjects] = useState<ProjectLinkConfig[]>(() => {
    const local = getProjectLinkConfigs();
    return local;
  });

  // 2. BACKGROUND FETCHING & SKELETON TRIGGER:
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(false);

  /**
   * INTEGRASI FRONTEND REACT (Cloudflare KV & Server-First):
   * - Membaca data project AFS dari Cloudflare KV / Server master (/api/afs-projects)
   * - Jika kosong, biarkan kosong agar user dapat input link AFS bersih dari awal
   */
  const loadProjectsFromServer = useCallback(async () => {
    setIsLoadingBackend(true);
    try {
      // 1. Panggil GET /api/afs-projects (Membaca dari Cloudflare KV: IARMS_KV.get('afs_projects'))
      const data = await fetchAfsProjectsFromServer();

      if (!data || !Array.isArray(data) || data.length === 0) {
        // PERBAIKAN STATE TAMPILAN (OPTIMISTIC UI):
        // Jika server mengembalikan kosong (misal kuota KV habis), pertahankan data lokal user
        const local = getProjectLinkConfigs();
        if (local && local.length > 0) {
          setAfsProjects(local);
          return;
        }
        setAfsProjects([]);
        overrideProjectLinkConfigs([]);
        return;
      }

      // Map data agar sesuai dengan interface ProjectLinkConfig
      const mapped: ProjectLinkConfig[] = data.map((item: any) => {
        const pName = (item.projectName || item.project || item.defaultProject || '').trim().toUpperCase();
        const pSite = (item.siteName || item.site || 'HEAD OFFICE').trim().toUpperCase();
        const pYear = item.year ? String(item.year).trim() : '';
        const pKey = item.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`;

        return {
          id: pKey,
          projectName: pName,
          defaultProject: pName,
          project: pName,
          siteName: pSite,
          site: pSite,
          year: pYear || undefined,
          sheetUrl: item.sheetUrl || '',
          status: item.sheetUrl && item.sheetUrl.trim() ? (item.status || 'synced') : (item.status || 'pending'),
          rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
          lastSyncedAt: item.lastSyncedAt || null
        };
      });

      // GABUNGKAN DENGAN PENDING LOCAL PROJECTS (Optimistic UI):
      // Pertahankan project lokal yang baru diinput user meskipun belum masuk KV karena kuota habis
      const local = getProjectLinkConfigs();
      const deletedKeys = getDeletedProjectKeys();
      const serverKeySet = new Set(mapped.map(m => m.id || `${m.projectName}|${m.siteName}${m.year ? `|${m.year}` : ''}`));

      const pendingLocal = local.filter(loc => {
        const locKey = loc.id || `${loc.projectName}|${loc.siteName}${loc.year ? `|${loc.year}` : ''}`;
        if (deletedKeys.has(locKey) || deletedKeys.has(loc.projectName)) return false;
        return !serverKeySet.has(locKey);
      });

      const combined = [...mapped, ...pendingLocal];

      // 3. SINKRONISASI STATE TABEL:
      setAfsProjects(combined);
      overrideProjectLinkConfigs(combined);

      // Periksa temuan customRows dari backend master untuk data temuan
      fetchProjectsFromBackend().then(backendResult => {
        if (backendResult?.customRows && backendResult.customRows.length > 0) {
          hydrateServerState({
            projects: combined,
            customRows: backendResult.customRows,
            deletedKeys: backendResult.deletedKeys
          });
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Gagal memuat daftar project dari Cloudflare KV (/api/afs-projects):', err);
    } finally {
      setIsLoadingBackend(false);
    }
  }, []);

  // 1-Time database purge check and initial load
  useEffect(() => {
    const PURGE_KEY = 'iarms_kv_purged_v3';
    if (localStorage.getItem(PURGE_KEY) !== 'done') {
      localStorage.setItem(PURGE_KEY, 'done');
      setIsLoadingBackend(true);
      purgeAllAfsProjectsLocalAndStorage();
      setAfsProjects([]);
      purgeAfsProjectsFromServer()
        .then(() => {
          onToast('Pembersihan total database Cloudflare KV & cache lokal berhasil dilakukan!', 'success');
        })
        .catch(err => {
          console.warn('Purge KV error:', err);
        })
        .finally(() => {
          setIsLoadingBackend(false);
        });
    } else {
      loadProjectsFromServer();
    }
  }, [loadProjectsFromServer, onToast]);

  // Listen to afs_project_links_updated event from dataSyncManager
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setAfsProjects(e.detail);
      }
    };
    window.addEventListener('afs_project_links_updated', handleUpdated);
    return () => {
      window.removeEventListener('afs_project_links_updated', handleUpdated);
    };
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* INSTANT DISPLAY: Seluruh Shell/Header/Tab/Tombol tampil instan */}
      <GoogleSheetSyncModal
        isOpen={true}
        isEmbedded={true}
        onToast={onToast}
        onNavigateToAFS={onNavigateToAFS}
        initialAfsProjects={afsProjects}
        onAfsProjectsChange={setAfsProjects}
        isCheckingUpdate={isLoadingBackend}
      />
    </div>
  );
}
