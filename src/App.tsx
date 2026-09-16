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
import PriorityRecommendations from './components/PriorityRecommendations';
import RiskRegister from './components/RiskRegister';
import Dashboard from './components/Dashboard';
import WorkingPaper from './components/WorkingPaper';
import FieldMobile from './components/FieldMobile';
import Timeframe from './components/Timeframe';
import NewAuditModal from './components/NewAuditModal';
import GoogleDriveSyncModal from './components/GoogleDriveSyncModal';
import DailyCutoffPanel from './components/DailyCutoffPanel';
import AuthModal from './components/AuthModal';
import UserProfileModal from './components/UserProfileModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import AccessSettings from './components/AccessSettings';
import LandingPage from './components/LandingPage';
import { AuditEngagement, PublicAuditItem, ToastMessage, UserProfile, UserRole } from './types';
import { autoSyncAllProjects, syncWithServer } from './data/dataSyncManager';
import { initDailyCutoffScheduler } from './services/cutoffService';
import { fetchAuditData, syncAuditData } from './services/api';
import { getCurrentUser, onAuthChange, logoutUser, canUserAccessMenu } from './services/authService';
import { LogIn, UserPlus, LogOut, User as UserIcon, Shield, KeyRound, ShieldCheck } from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [userRole, setUserRole] = useState<UserRole>(() => getCurrentUser()?.role || 'auditor');
  const [exploreAsGuest, setExploreAsGuest] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isForceChangePassword, setIsForceChangePassword] = useState<boolean>(() => !!getCurrentUser()?.mustChangePassword);
  const [auditData, setAuditData] = useState<AuditEngagement[]>(INITIAL_AUDIT_DATA);
  const [publicAuditList] = useState<PublicAuditItem[]>(INITIAL_PUBLIC_AUDIT_LIST);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [currentKkaTitle, setCurrentKkaTitle] = useState('Pengujian Kontrol & Monitoring Log');

  // Listen to global auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      if (user) {
        setUserRole(user.role);
        if (user.mustChangePassword) {
          setIsForceChangePassword(true);
          setIsChangePasswordOpen(true);
        } else {
          setIsForceChangePassword(false);
        }
      } else {
        setUserRole('public');
        setIsForceChangePassword(false);
        setIsChangePasswordOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  // Enforce menu access security based on NIK and permissions
  useEffect(() => {
    if (!canUserAccessMenu(currentUser, activeTab)) {
      setActiveTab('public-portal');
      triggerToast('Akses dibatasi: NIK Anda tidak memiliki izin untuk membuka menu tersebut.', 'warning');
    }
  }, [activeTab, currentUser]);

  const handleNavigateToAFS = (filter?: { dept?: string; search?: string; status?: string; project?: string; remarks?: string }) => {
    if (filter) {
      setAfsFilter(filter);
    } else {
      setAfsFilter(null);
    }
    setActiveTab('finding-statement');
  };

  // Load audit data from Google Apps Script API on initial mount
  useEffect(() => {
    async function loadRemoteAuditData() {
      try {
        const remoteData = await fetchAuditData();
        if (remoteData) {
          if (Array.isArray(remoteData)) {
            setAuditData(remoteData);
          } else if (remoteData.auditData && Array.isArray(remoteData.auditData)) {
            setAuditData(remoteData.auditData);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat data awal dari Google Apps Script:', err);
      }
    }

    loadRemoteAuditData();
  }, []);

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

  const handleCreateAudit = async (newAudit: Omit<AuditEngagement, 'id' | 'actDays' | 'progress'>) => {
    const freshRecord: AuditEngagement = {
      ...newAudit,
      id: Date.now(),
      actDays: 1,
      progress: 10,
      status: newAudit.status as any
    };

    const updatedList = [freshRecord, ...auditData];
    setAuditData(updatedList);
    setIsModalOpen(false);
    triggerToast('Audit Program baru berhasil ditambahkan!', 'success');

    // Sync to Google Sheets via syncAuditData
    try {
      await syncAuditData({
        action: 'create_audit',
        item: freshRecord,
        allAuditData: updatedList,
        timestamp: new Date().toISOString()
      });
      triggerToast('Data audit berhasil disinkronkan ke Google Sheets!', 'success');
    } catch (err) {
      console.warn('Gagal sinkronisasi otomatis ke Google Apps Script:', err);
    }
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

  // If user is not logged in and not exploring as public guest, render the Landing Page
  if (!currentUser && !exploreAsGuest) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white">
        <LandingPage
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setUserRole(user.role);
            setExploreAsGuest(false);
          }}
          onExplorePublic={() => {
            setExploreAsGuest(true);
            setActiveTab('public-portal');
          }}
          onToast={triggerToast}
        />

        {/* Global Toast Notifications on Landing Page */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto p-3.5 rounded-xl shadow-xl flex items-start gap-3 border text-xs leading-relaxed backdrop-blur-md ${
                  toast.type === 'success'
                    ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50 shadow-emerald-950/40'
                    : toast.type === 'warning'
                    ? 'bg-amber-900/90 text-amber-100 border-amber-500/50 shadow-amber-950/40'
                    : toast.type === 'error'
                    ? 'bg-rose-900/90 text-rose-100 border-rose-500/50 shadow-rose-950/40'
                    : 'bg-slate-900/90 text-slate-100 border-slate-700 shadow-slate-950/40'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
                  {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
                </div>
                <div className="flex-1 font-medium">{toast.message}</div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-white/60 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

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
        currentUser={currentUser}
        onOpenAuth={() => {
          setExploreAsGuest(false);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenChangePassword={() => {
          setIsForceChangePassword(false);
          setIsChangePasswordOpen(true);
        }}
        onToast={triggerToast}
        onOpenDriveBackup={() => setIsDriveModalOpen(true)}
      />

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto scroll-smooth">
        
        {/* Top Header Bar with Auth Controls */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-end gap-3 sticky top-0 z-40 shadow-2xs">
          {/* Right Auth / Profile Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer group"
                  title="Lihat profil & pengaturan akun"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                    {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-sky-700 max-w-[140px] truncate">
                        {currentUser.displayName}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 capitalize flex items-center gap-1">
                      {currentUser.isInternalAudit ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> Internal Audit
                        </span>
                      ) : (
                        <span>Non-IA ({currentUser.role})</span>
                      )}
                    </span>
                  </div>
                </button>

                {/* Ganti Password button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsForceChangePassword(false);
                    setIsChangePasswordOpen(true);
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-slate-600 hover:text-sky-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Ganti Password Akun"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline font-semibold">Ganti Password</span>
                </button>

                {/* Return to Landing button */}
                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    setCurrentUser(null);
                    setUserRole('public');
                    setExploreAsGuest(false);
                    triggerToast('Kembali ke Halaman Masuk.', 'info');
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-slate-600 hover:text-sky-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Kembali ke Halaman Landing"
                >
                  <Shield className="w-3.5 h-3.5 text-sky-500" />
                  <span className="hidden sm:inline font-semibold">Landing Page</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    setCurrentUser(null);
                    setUserRole('public');
                    setExploreAsGuest(false);
                    triggerToast('Anda telah keluar dari akun.', 'info');
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Keluar / Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline font-semibold">Keluar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setExploreAsGuest(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#00a3ff] hover:bg-[#0094e8] rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Buka Halaman Masuk & Pendaftaran"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Halaman Masuk (Login / Register)</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Top Mobile Role Switcher Bar */}
        <div className="md:hidden flex items-center justify-between p-2.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Mode:</span>
            <select
              value={userRole}
              onChange={(e) => {
                const nextRole = e.target.value as UserRole;
                setUserRole(nextRole);
                if (nextRole === 'public') {
                  setActiveTab('public-portal');
                  triggerToast('Mode Akses Publik: Fitur KKA Internal Dibatasi', 'warning');
                } else if (nextRole === 'auditee') {
                  triggerToast('Mode Auditee: Fokus Tindak Lanjut Temuan & Closing', 'info');
                } else if (nextRole === 'management') {
                  triggerToast('Mode Manajemen: Ringkasan Eksekutif & Risk Matrix', 'info');
                } else {
                  triggerToast('Mode Lead Auditor: Akses Penuh Sistem Terbuka', 'success');
                }
              }}
              className="bg-white text-sky-700 font-bold border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value="auditor">Lead Auditor</option>
              <option value="auditee">Auditee / PIC</option>
              <option value="management">Manajemen</option>
              <option value="public">Akses Publik</option>
            </select>
          </div>
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
            {activeTab === 'priority-recommendations' && (
              <PriorityRecommendations
                key="priority-recommendations"
                onToast={triggerToast}
                onNavigateToAFS={handleNavigateToAFS}
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
            {activeTab === 'access-settings' && (
              <AccessSettings 
                key="access-settings" 
                currentUser={currentUser} 
                onToast={triggerToast} 
              />
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

      {/* Login & Registration Modal */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onToast={triggerToast}
          onSuccess={(user) => {
            setCurrentUser(user);
            setUserRole(user.role);
          }}
        />
      )}

      {/* User Profile & Management Modal */}
      {isProfileModalOpen && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          currentUser={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onToast={triggerToast}
          onLogout={() => {
            setCurrentUser(null);
            setUserRole('public');
          }}
          onOpenLogin={() => {
            setIsProfileModalOpen(false);
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
          onOpenChangePassword={() => {
            setIsForceChangePassword(false);
            setIsChangePasswordOpen(true);
          }}
        />
      )}

      {/* Change Password Modal (Forced or Manual) */}
      {isChangePasswordOpen && currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          currentUser={currentUser}
          isForced={isForceChangePassword}
          onClose={() => {
            if (!isForceChangePassword) {
              setIsChangePasswordOpen(false);
            }
          }}
          onSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
            setIsChangePasswordOpen(false);
            setIsForceChangePassword(false);
            triggerToast('Kata sandi berhasil diperbarui!', 'success');
          }}
          onToast={triggerToast}
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
