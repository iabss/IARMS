import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle, 
  X 
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import PublicPortal from './components/PublicPortal';
import InputFindingStatement from './components/InputFindingStatement';
import TrendAchievement from './components/TrendAchievement';
import AchievementDepartment from './components/AchievementDepartment';
import FindingStatement from './components/FindingStatement';
import RiskRegister from './components/RiskRegister';
import Dashboard from './components/Dashboard';
import WorkingPaper from './components/WorkingPaper';
import FieldMobile from './components/FieldMobile';
import Timeframe from './components/Timeframe';
import NewAuditModal from './components/NewAuditModal';
import GoogleDriveSyncModal from './components/GoogleDriveSyncModal';
import DailyCutoffPanel from './components/DailyCutoffPanel';
import { AuditEngagement, PublicAuditItem, ToastMessage } from './types';
import { autoSyncAllProjects, syncWithServer } from './data/dataSyncManager';
import { initDailyCutoffScheduler } from './services/cutoffService';

// Initial Mock Data matching the original specification
const INITIAL_AUDIT_DATA: AuditEngagement[] = [
  { id: 1, title: 'Operational Fuel & Fleet Management', auditor: 'M. Majid', planDays: 10, actDays: 12, progress: 100, status: 'Overdue' },
  { id: 2, title: 'IT Infrastructure & Security (NIST)', auditor: 'Alex S.', planDays: 15, actDays: 8, progress: 65, status: 'On-Going' },
  { id: 3, title: 'Stock Opname Material Gudang Utama', auditor: 'Budi R.', planDays: 5, actDays: 5, progress: 100, status: 'Completed' },
  { id: 4, title: 'Pengadaan & Procurement Contract Compliance', auditor: 'Siti A.', planDays: 12, actDays: 14, progress: 85, status: 'Overdue' },
  { id: 5, title: 'EHS & Safety Audit Site Operasional B', auditor: 'Hendra M.', planDays: 7, actDays: 3, progress: 40, status: 'On-Going' }
];

const INITIAL_PUBLIC_AUDIT_LIST: PublicAuditItem[] = [
  { id: 'P1', projectId: 'PROJ-01', projectName: 'Project Audit Operasional Site B', deptId: 'DEPT-LOG', deptName: 'Logistik & Fuel', closingRate: 100, closedItems: 24, totalItems: 24, targetDays: 10, realDays: 10, qualityScore: 98.2, status: 'Selesai' },
  { id: 'P2', projectId: 'PROJ-02', projectName: 'Project Revamp Digital & IT Security', deptId: 'DEPT-IT', deptName: 'IT & Sistem Informasi', closingRate: 85.7, closedItems: 18, totalItems: 21, targetDays: 15, realDays: 12, qualityScore: 95.0, status: 'On-Progress' },
  { id: 'P3', projectId: 'PROJ-03', projectName: 'Project Modernisasi Logistik & Supply Chain', deptId: 'DEPT-FIN', deptName: 'Keuangan & Procurement', closingRate: 92.0, closedItems: 23, totalItems: 25, targetDays: 12, realDays: 11, qualityScore: 97.5, status: 'Selesai' },
  { id: 'P4', projectId: 'PROJ-04', projectName: 'Project Audit K3L & Environmental Site A', deptId: 'DEPT-EHS', deptName: 'K3L / EHS', closingRate: 95.5, closedItems: 21, totalItems: 22, targetDays: 8, realDays: 7, qualityScore: 96.0, status: 'Selesai' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('public-portal');
  const [afsFilter, setAfsFilter] = useState<{ dept?: string; search?: string; status?: string; project?: string; remarks?: string } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'public' | 'auditor'>('auditor');
  const [auditData, setAuditData] = useState<AuditEngagement[]>(INITIAL_AUDIT_DATA);
  const [publicAuditList] = useState<PublicAuditItem[]>(INITIAL_PUBLIC_AUDIT_LIST);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [currentKkaTitle, setCurrentKkaTitle] = useState('Pengujian Kontrol & Monitoring Log');

  const handleNavigateToAFS = (filter?: { dept?: string; search?: string; status?: string; project?: string; remarks?: string }) => {
    if (filter) {
      setAfsFilter(filter);
    } else {
      setAfsFilter(null);
    }
    setActiveTab('finding-statement');
  };

  // Background auto-sync and server hydration on app startup and every 5 minutes
  useEffect(() => {
    // 1. Initial state hydration from server
    syncWithServer().then(() => {
      // 2. Initial background auto-sync
      autoSyncAllProjects().then((result) => {
        if (result.syncedCount > 0) {
          console.log(`[AutoSync] Background sync completed: ${result.totalRows} rows across ${result.syncedCount} projects.`);
        }
      });
    });

    // Interval every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      autoSyncAllProjects().then((result) => {
        if (result.syncedCount > 0) {
          console.log(`[AutoSync Interval] Sync completed: ${result.totalRows} rows updated.`);
        }
      });
    }, 5 * 60 * 1000);

    // Daily 09:00 Cut-Off Scheduler
    const stopCutoffScheduler = initDailyCutoffScheduler((msg, type) => {
      triggerToast(msg, type);
    });

    return () => {
      clearInterval(interval);
      stopCutoffScheduler();
    };
  }, []);

  // Unified Toast Dispatcher
  const triggerToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast: ToastMessage = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    // Automatically remove after 3.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleCreateAudit = (newAudit: Omit<AuditEngagement, 'id' | 'actDays' | 'progress'>) => {
    const freshRecord: AuditEngagement = {
      ...newAudit,
      id: Date.now(),
      actDays: 1,
      progress: 10,
      status: newAudit.status as any
    };

    setAuditData((prev) => [freshRecord, ...prev]);
    setIsModalOpen(false);
    triggerToast('Audit Program baru berhasil ditambahkan!', 'success');
  };

  const handleOpenKKA = (title: string) => {
    if (userRole === 'public') {
      triggerToast('Akses ditolak: KKA Auditor hanya untuk Lead Auditor!', 'error');
      return;
    }
    setCurrentKkaTitle(title);
    setActiveTab('working-paper');
    triggerToast(`Membuka Kertas Kerja untuk: ${title}`, 'info');
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen md:h-screen flex flex-col md:flex-row md:overflow-hidden antialiased selection:bg-sky-500 selection:text-white font-sans">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        userRole={userRole}
        setUserRole={setUserRole}
        onToast={triggerToast}
        onOpenDriveBackup={() => setIsDriveModalOpen(true)}
      />

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto scroll-smooth">
        
        {/* Top Mobile Role Switcher Bar */}
        <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-slate-200 text-xs">
          <select
            value={userRole}
            onChange={(e) => {
              const nextRole = e.target.value as 'public' | 'auditor';
              setUserRole(nextRole);
              if (nextRole === 'public') {
                setActiveTab('public-portal');
                triggerToast('Mode Akses Publik: Fitur KKA Internal Dibatasi', 'warning');
              } else {
                triggerToast('Mode Lead Auditor: Akses Penuh Sistem Terbuka', 'success');
              }
            }}
            className="bg-slate-100 text-sky-700 font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="public">Mode: Akses Publik</option>
            <option value="auditor">Mode: Lead Auditor</option>
          </select>
          <span className="text-emerald-600 text-[10px] font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Systems Online
          </span>
        </div>

        {/* Main Content Body */}
        <main className="flex-1 w-full max-w-none px-3 sm:px-5 lg:px-6 py-4 pb-16">
          <AnimatePresence mode="wait">
            {activeTab === 'public-portal' && (
              <PublicPortal 
                key="public-portal" 
                publicAuditList={publicAuditList} 
                onToast={triggerToast} 
                onNavigateToAFS={handleNavigateToAFS}
              />
            )}
            {activeTab === 'input-finding-statement' && (
              <InputFindingStatement
                key="input-finding-statement"
                onToast={triggerToast}
                onNavigateToAFS={handleNavigateToAFS}
              />
            )}
            {activeTab === 'trend-achievement' && (
              <TrendAchievement
                key="trend-achievement"
                onToast={triggerToast}
                onNavigateToAFS={handleNavigateToAFS}
                onOpenDriveBackup={() => setIsDriveModalOpen(true)}
              />
            )}
            {activeTab === 'achievement-department' && (
              <AchievementDepartment
                key="achievement-department"
                onToast={triggerToast}
                onNavigateToAFS={handleNavigateToAFS}
              />
            )}
            {activeTab === 'finding-statement' && (
              <FindingStatement
                key="finding-statement"
                onToast={triggerToast}
                onNavigateToInputAFS={() => setActiveTab('input-finding-statement')}
                initialFilter={afsFilter}
              />
            )}
            {activeTab === 'risk-register' && (
              <RiskRegister
                key="risk-register"
                onToast={triggerToast}
              />
            )}
            {activeTab === 'dashboard' && (
              <Dashboard 
                key="dashboard" 
                auditData={auditData} 
                onOpenNewModal={() => setIsModalOpen(true)}
                onOpenKKA={handleOpenKKA}
                onToast={triggerToast}
              />
            )}
            {activeTab === 'working-paper' && (
              <WorkingPaper 
                key="working-paper" 
                currentKkaTitle={currentKkaTitle} 
                onToast={triggerToast} 
              />
            )}
            {activeTab === 'field-mobile' && (
              <FieldMobile 
                key="field-mobile" 
                onToast={triggerToast} 
              />
            )}
            {activeTab === 'timeframe' && (
              <Timeframe 
                key="timeframe" 
                onToast={triggerToast} 
              />
            )}
            {activeTab === 'daily-cutoff' && (
              <div key="daily-cutoff" className="p-4 sm:p-6 max-w-7xl mx-auto">
                <DailyCutoffPanel 
                  onToast={triggerToast} 
                  onOpenDriveBackup={() => setIsDriveModalOpen(true)} 
                />
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Google Drive Sync & Backup Modal */}
      {isDriveModalOpen && (
        <GoogleDriveSyncModal
          isOpen={isDriveModalOpen}
          onClose={() => setIsDriveModalOpen(false)}
          onToast={triggerToast}
        />
      )}

      {/* New Audit Modal */}
      {isModalOpen && (
        <NewAuditModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateAudit}
        />
      )}

      {/* Notification Toast Container */}
      <div id="toast-container" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => {
            let borderBgClass = 'border-sky-300 bg-white text-slate-800';
            let IconComponent = Info;
            let iconColorClass = 'text-sky-600';

            if (toast.type === 'success') {
              borderBgClass = 'border-emerald-300 bg-white text-slate-800';
              IconComponent = CheckCircle2;
              iconColorClass = 'text-emerald-600';
            } else if (toast.type === 'warning') {
              borderBgClass = 'border-amber-300 bg-white text-slate-800';
              IconComponent = AlertTriangle;
              iconColorClass = 'text-amber-600';
            } else if (toast.type === 'error') {
              borderBgClass = 'border-rose-300 bg-white text-slate-800';
              IconComponent = XCircle;
              iconColorClass = 'text-rose-600';
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border shadow-xl text-xs font-semibold ${borderBgClass}`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent className={`w-4 h-4 flex-shrink-0 ${iconColorClass}`} />
                  <span>{toast.message}</span>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
