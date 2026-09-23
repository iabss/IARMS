import React, { useState, useEffect, useCallback } from 'react';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import { 
  fetchAfsProjectsFromServer,
  fetchProjectsFromBackend,
  saveAfsProjectsToServer
} from '../services/api';
import { DEFAULT_DEV_AFS_PROJECTS } from '../data/defaultAfsProjects';
import { 
  hydrateServerState,
  getProjectLinkConfigs, 
  overrideProjectLinkConfigs,
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
    if (local.length > 0) return local;
    return DEFAULT_DEV_AFS_PROJECTS;
  });

  // 2. BACKGROUND FETCHING & SKELETON TRIGGER:
  // Selama background fetch aktif, skeleton loading ditampilkan HANYA di area kontainer tabel project
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(() => {
    const local = getProjectLinkConfigs();
    return local.length === 0;
  });

  /**
   * 2. INTEGRASI FRONTEND REACT (Cloudflare KV & Server-First):
   * - Saat komponen AFS dimuat (mount), panggil GET /api/afs-projects.
   * - Jika KV masih kosong, gunakan 11 project AFS yang ada di dev sebagai default data,
   *   lalu kirimkan (POST) ke KV agar tersimpan secara permanen untuk semua user.
   */
  const loadProjectsFromServer = useCallback(async () => {
    setIsLoadingBackend(true);
    try {
      // 1. Panggil GET /api/afs-projects (Membaca dari Cloudflare KV: IARMS_KV.get('afs_projects'))
      let data = await fetchAfsProjectsFromServer();
      let wasSeeded = false;

      // 2. Jika KV masih kosong, gunakan 11 project AFS yang ada di dev sebagai default data
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('Cloudflare KV kosong. Menggunakan 11 Project AFS dev dan menyimpan permanen ke KV...');
        data = DEFAULT_DEV_AFS_PROJECTS;
        wasSeeded = true;

        // Kirimkan (POST) ke KV agar tersimpan secara permanen untuk semua user
        try {
          await fetch('/api/afs-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ afs_projects: DEFAULT_DEV_AFS_PROJECTS })
          });
          // Dual sync ke backend master
          saveAfsProjectsToServer(DEFAULT_DEV_AFS_PROJECTS).catch(() => {});
        } catch (postErr) {
          console.warn('Gagal menyimpan 11 project default ke Cloudflare KV:', postErr);
        }
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

      // 3. SINKRONISASI STATE TABEL:
      // Langsung perbarui state React (setAfsProjects(data)) agar tabel terisi otomatis
      setAfsProjects(mapped);

      // Simpan ke memory state & localStorage
      overrideProjectLinkConfigs(mapped);

      if (wasSeeded) {
        onToast('Daftar 11 Project AFS dev berhasil disimpan ke Cloudflare KV Storage!', 'success');
      }

      // Periksa temuan customRows dari backend master untuk data temuan
      fetchProjectsFromBackend().then(backendResult => {
        if (backendResult?.customRows && backendResult.customRows.length > 0) {
          hydrateServerState({
            projects: mapped,
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
  }, [onToast]);

  // Jalankan saat initial mount
  useEffect(() => {
    loadProjectsFromServer();
  }, [loadProjectsFromServer]);

  return (
    <div className="w-full space-y-6">
      {/* INSTANT DISPLAY: Seluruh Shell/Header/Tab/Tombol tampil instan */}
      <GoogleSheetSyncModal
        isOpen={true}
        isEmbedded={true}
        onToast={onToast}
        onNavigateToAFS={onNavigateToAFS}
        initialAfsProjects={afsProjects}
        isCheckingUpdate={isLoadingBackend}
      />
    </div>
  );
}
