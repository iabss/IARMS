import React, { useState, useEffect } from 'react';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import { fetchProjectsFromGasBackend } from '../services/api';
import { 
  overrideProjectLinkConfigs, 
  getProjectLinkConfigs, 
  getProjectCompositeKey, 
  ProjectLinkConfig 
} from '../data/dataSyncManager';

interface InputFindingStatementProps {
  onToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: () => void;
  key?: string;
}

export default function InputFindingStatement({ onToast, onNavigateToAFS }: InputFindingStatementProps) {
  // State afsProjects di komponen InputFindingStatement
  const [afsProjects, setAfsProjects] = useState<ProjectLinkConfig[]>(() => {
    // Membaca initial data dari localStorage tanpa mock fallback
    const raw = localStorage.getItem('afsProjects') || localStorage.getItem('afs_project_links');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // FORCE OVERRIDE SERVER DATA:
  // Saat komponen di-mount, panggil API Google Apps Script (doGet).
  // Jika data server berhasil didapatkan, LANGSUNG TIMPA (OVERRIDE) state afsProjects dan localStorage.
  // JANGAN digabungkan (merge) dengan data mock/cache lokal.
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

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

          // FORCE OVERRIDE: Timpa state afsProjects dan localStorage tanpa merge dengan mock/cache lokal
          overrideProjectLinkConfigs(mappedConfigs);
          setAfsProjects(mappedConfigs);
          try {
            localStorage.setItem('afsProjects', JSON.stringify(mappedConfigs));
          } catch (e) {}
        } else {
          // Jika server belum/tidak memiliki data baru, ambil hanya data tersimpan yang valid (bukan mock fallback)
          const saved = getProjectLinkConfigs();
          setAfsProjects(saved);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat data AFS Projects dari doGet Google Apps Script:', err);
        if (isMounted) {
          const saved = getProjectLinkConfigs();
          setAfsProjects(saved);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full space-y-6">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-white border border-slate-200 rounded-3xl shadow-sm text-center">
          <div className="w-10 h-10 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4" />
          <h3 className="text-base font-bold text-slate-800">Menyinkronkan Data AFS Project...</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
            Memuat data project terbaru langsung dari Google Apps Script server (doGet). Mohon tunggu sebentar...
          </p>
        </div>
      ) : (
        <GoogleSheetSyncModal
          isOpen={true}
          isEmbedded={true}
          onToast={onToast}
          onNavigateToAFS={onNavigateToAFS}
          initialAfsProjects={afsProjects}
          onAfsProjectsChange={setAfsProjects}
        />
      )}
    </div>
  );
}
