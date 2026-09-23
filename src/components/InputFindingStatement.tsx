import React, { useState, useEffect } from 'react';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import { fetchProjectsFromBackend } from '../services/api';
import { 
  hydrateServerState,
  getProjectLinkConfigs, 
  ProjectLinkConfig 
} from '../data/dataSyncManager';

interface InputFindingStatementProps {
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: () => void;
  key?: string;
}

export default function InputFindingStatement({ onToast, onNavigateToAFS }: InputFindingStatementProps) {
  // 1. INSTANT DISPLAY (UI Shell/Template di-render instan):
  // Mengambil cache sekunder localStorage agar antarmuka terbuka seketika tanpa jeda
  const [afsProjects, setAfsProjects] = useState<ProjectLinkConfig[]>(() => {
    return getProjectLinkConfigs();
  });

  // 2. BACKGROUND FETCHING & SKELETON TRIGGER:
  // Selama background fetch aktif, skeleton loading ditampilkan HANYA di area kontainer tabel project
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(true);

  // 3. AUTO-FETCH DAFTAR PROJECT & DATA TEMUAN DARI SERVER MASTER (Server-First):
  useEffect(() => {
    let isMounted = true;
    setIsLoadingBackend(true);

    fetchProjectsFromBackend()
      .then((backendResult) => {
        if (!isMounted) return;

        // Jika server mengembalikan data project atau temuan audit
        if (backendResult && (
          (backendResult.projects && backendResult.projects.length > 0) ||
          (backendResult.customRows && backendResult.customRows.length > 0)
        )) {
          // 4. OVERRIDE DENGAN DATA SERVER TERPUSAT:
          // Timpa cache localStorage dan internal state dengan data master server
          const hydrated = hydrateServerState({
            projects: backendResult.projects,
            customRows: backendResult.customRows,
            deletedKeys: backendResult.deletedKeys
          });

          setAfsProjects(hydrated.projects);
        }
      })
      .catch((err) => {
        console.warn('Gagal melakukan Server-First auto-fetch project AFS:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingBackend(false);
        }
      });

    return () => {
      isMounted = false;
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
