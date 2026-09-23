import React, { useState, useEffect, useCallback } from 'react';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import { fetchProjects, fetchProjectsFromBackend } from '../services/api';
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
    return getProjectLinkConfigs();
  });

  // 2. BACKGROUND FETCHING & SKELETON TRIGGER:
  // Selama background fetch aktif, skeleton loading ditampilkan HANYA di area kontainer tabel project
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(() => {
    // Jika localStorage kosong (seperti saat pertama login di Incognito / HP baru), set loading true
    const local = getProjectLinkConfigs();
    return local.length === 0;
  });

  /**
   * 2. FETCH DAFTAR PROJECT SAAT INITIAL LOAD / MOUNT:
   * Membaca daftar project langsung dari API Server (GET /api/afs-projects).
   * Jika localStorage kosong (seperti saat pertama login di Incognito/HP baru),
   * secara otomatis panggil API Server tersebut untuk memuat daftar project AFS yang sudah didaftarkan sebelumnya.
   */
  const loadProjectsFromServer = useCallback(async () => {
    setIsLoadingBackend(true);
    try {
      // Panggil API Server GET /api/afs-projects (dengan fallback ke backend master)
      const data = await fetchProjects();

      if (Array.isArray(data) && data.length > 0) {
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
            status: item.sheetUrl && item.sheetUrl.trim() ? 'synced' : (item.status || 'pending'),
            rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
            lastSyncedAt: item.lastSyncedAt || null
          };
        });

        // 3. SINKRONISASI STATE TABEL:
        // Langsung perbarui state React (setAfsProjects(data)) agar tabel langsung terisi otomatis
        setAfsProjects(mapped);

        // Update localStorage dan memory state
        overrideProjectLinkConfigs(mapped);

        // Juga panggil hydrate lengkap jika ada temuan customRows dari backend master
        fetchProjectsFromBackend().then(backendResult => {
          if (backendResult?.customRows && backendResult.customRows.length > 0) {
            hydrateServerState({
              projects: mapped,
              customRows: backendResult.customRows,
              deletedKeys: backendResult.deletedKeys
            });
          }
        }).catch(() => {});
      } else {
        // Jika /api/afs-projects belum terisi, coba dari master backend
        const backendResult = await fetchProjectsFromBackend();
        if (backendResult && backendResult.projects && backendResult.projects.length > 0) {
          const hydrated = hydrateServerState({
            projects: backendResult.projects,
            customRows: backendResult.customRows,
            deletedKeys: backendResult.deletedKeys
          });
          setAfsProjects(hydrated.projects);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat daftar project dari API Server (/api/afs-projects):', err);
    } finally {
      setIsLoadingBackend(false);
    }
  }, []);

  // Jalankan saat initial mount
  useEffect(() => {
    loadProjectsFromServer();

    // Dengarkan event sinkronisasi internal
    const handleLinksUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setAfsProjects(e.detail);
      } else {
        setAfsProjects(getProjectLinkConfigs());
      }
    };

    window.addEventListener('afs_project_links_updated', handleLinksUpdated);
    return () => {
      window.removeEventListener('afs_project_links_updated', handleLinksUpdated);
    };
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
        onAfsProjectsChange={setAfsProjects}
        isCheckingUpdate={isLoadingBackend}
      />
    </div>
  );
}
