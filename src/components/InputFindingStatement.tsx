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
  // 1. INSTANT DISPLAY (TANPA LOADING FULLSCREEN):
  // Langsung ambil data afsProjects yang ada di localStorage/memory agar UI terbuka instan
  const [afsProjects, setAfsProjects] = useState<ProjectLinkConfig[]>(() => {
    return getProjectLinkConfigs();
  });

  // 2. SILENT BACKGROUND FETCH:
  // Indikator kecil "Memeriksa pembaharuan..." berjalan di background tanpa memblokir UI
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(true);

  // Background sync doGet ke Google Apps Script
  useEffect(() => {
    let isMounted = true;
    setIsCheckingUpdate(true);

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

          // 3. SILENT OVERRIDE UPDATE:
          // Langsung perbarui state afsProjects dan localStorage tanpa mereset/merusak UI
          overrideProjectLinkConfigs(mappedConfigs);
          setAfsProjects(mappedConfigs);
          try {
            localStorage.setItem('afsProjects', JSON.stringify(mappedConfigs));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Silent background check ke Google Apps Script gagal:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingUpdate(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* INSTANT DISPLAY: Langsung render GoogleSheetSyncModal tanpa layar loading fullscreen */}
      <GoogleSheetSyncModal
        isOpen={true}
        isEmbedded={true}
        onToast={onToast}
        onNavigateToAFS={onNavigateToAFS}
        initialAfsProjects={afsProjects}
        onAfsProjectsChange={setAfsProjects}
        isCheckingUpdate={isCheckingUpdate}
      />
    </div>
  );
}
