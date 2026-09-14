import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile
} from 'firebase/auth';
import { auth } from './googleDriveService';
import { UserProfile, UserRole, MenuItemConfig, InternalAuditMember } from '../types';
import { 
  syncAuditData, 
  sendRegisterUserToBackend, 
  sendResetPasswordToBackend, 
  sendResendVerificationToBackend 
} from './api';
import { findEmployeeByNik } from '../data/employeeMasterData';

const STORAGE_KEY_CURRENT_USER = 'iarms_current_user_v3';
const STORAGE_KEY_USERS_DB = 'iarms_registered_users_v3';
const STORAGE_KEY_IA_MEMBERS = 'iarms_ia_members_v3';
const STORAGE_KEY_AUDITEE_CONFIG = 'iarms_auditee_menus_config_v3';
const STORAGE_KEY_MENU_PERMISSIONS = 'iarms_menu_permissions_v3';

// OFFICIAL MASTER LIST OF INTERNAL AUDIT PERSONNEL
export const OFFICIAL_INTERNAL_AUDIT_MEMBERS: InternalAuditMember[] = [
  { nik: '1006059', nama: 'Renny Antikawati', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'renny.antikawati@iarms.co.id' },
  { nik: '1013751', nama: 'Farhan Zulfikar R', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'farhan.zulfikar@iarms.co.id' },
  { nik: '1015590', nama: 'Habibie Rahman', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'habibie.rahman@iarms.co.id' },
  { nik: '1018646', nama: 'Josua Mandala Putra', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'josua.mandala@iarms.co.id' },
  { nik: '1021048', nama: 'Miftahul Majid', jabatan: 'Lead Internal Auditor', departemen: 'Internal Audit', email: 'miftahul.majid@iarms.co.id' },
  { nik: '1021485', nama: 'Rangga Primayuda', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'rangga.primayuda@iarms.co.id' },
  { nik: '1022189', nama: 'Mahardian Ardhi Bramantyo', jabatan: 'Internal Auditor', departemen: 'Internal Audit', email: 'mahardian.bramantyo@iarms.co.id' }
];

// System Available Menus (12 Full System Menus)
export const SYSTEM_MENUS: MenuItemConfig[] = [
  {
    id: 'public-portal',
    label: 'Dashboard Achievement Closing Audit',
    category: 'Monitoring & Dashboard',
    description: 'Halaman dashboard utama monitoring status dan persentase achievement closing temuan audit.',
    defaultRoles: ['auditor', 'auditee', 'management', 'public']
  },
  {
    id: 'trend-achievement',
    label: 'Trend Achievement Closing Audit',
    category: 'Monitoring & Dashboard',
    description: 'Grafik tren dan performa tindak lanjut temuan audit dari waktu ke waktu.',
    defaultRoles: ['auditor', 'auditee', 'management', 'public']
  },
  {
    id: 'achievement-department',
    label: 'Achievement Department',
    category: 'Monitoring & Dashboard',
    description: 'Ringkasan tingkat penyelesaian temuan audit per departemen/unit kerja.',
    defaultRoles: ['auditor', 'auditee', 'management', 'public']
  },
  {
    id: 'finding-statement',
    label: 'Resume Audit Finding Statement (AFS)',
    category: 'Temuan & Tindak Lanjut',
    description: 'Tabel daftar resume AFS, status open/closed, filter departemen, dan detail rekomendasi.',
    defaultRoles: ['auditor', 'auditee', 'management', 'public']
  },
  {
    id: 'priority-recommendations',
    label: 'Rekomendasi Prioritas',
    category: 'Temuan & Tindak Lanjut',
    description: 'Top 10 Rekomendasi Paling Kritis dengan AI Scoring berbasis dampak finansial dan operasional.',
    defaultRoles: ['auditor', 'auditee', 'management', 'public']
  },
  {
    id: 'input-finding-statement',
    label: 'Input Finding Statement',
    category: 'Audit Execution',
    description: 'Formulir pencatatan temuan audit baru oleh tim auditor.',
    defaultRoles: ['auditor']
  },
  {
    id: 'working-paper',
    label: 'Kertas Kerja Audit (KKA)',
    category: 'Audit Execution',
    description: 'Dokumen kerja audit internal, bukti pengujian, kontrol, dan monitoring log rahasia.',
    defaultRoles: ['auditor']
  },
  {
    id: 'risk-register',
    label: 'Risk Register (Inherent & Residual)',
    category: 'Risk Management',
    description: 'Registrasi risiko lengkap, penilaian dampak finansial, mitigasi risiko, dan residual score.',
    defaultRoles: ['auditor', 'management']
  },
  {
    id: 'dashboard',
    label: 'Company Risk Matrix Dashboard',
    category: 'Risk Management',
    description: 'Matriks sebaran risiko perusahaan (5x5 Heatmap) dan profil risiko agregat.',
    defaultRoles: ['auditor', 'management']
  },
  {
    id: 'field-mobile',
    label: 'Mobile Field Audit',
    category: 'Audit Execution',
    description: 'Aplikasi lapangan mobile untuk verifikasi fisik, upload foto temuan, dan checklist lokasi.',
    defaultRoles: ['auditor']
  },
  {
    id: 'timeframe',
    label: 'Rencana Timeframe Audit',
    category: 'Audit Planning',
    description: 'Jadwal penugasan audit tahunan/bulanan, PIC engagement, dan milestone audit.',
    defaultRoles: ['auditor']
  },
  {
    id: 'daily-cutoff',
    label: 'Cut-Off Harian (00:00 WIB)',
    category: 'System Control',
    description: 'Panel pemantauan dan pemicu cutoff harian otomatis sistem IARMS.',
    defaultRoles: ['auditor']
  },
  {
    id: 'access-settings',
    label: 'Konfigurasi Akses Menu',
    category: 'Sistem Administrasi',
    description: 'Konfigurasi menu apa saja yang bisa diakses dan tidak bisa diakses oleh Auditee.',
    defaultRoles: ['auditor']
  }
];

// Get Whitelisted Internal Audit Members
export function getInternalAuditMembers(): InternalAuditMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IA_MEMBERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback
  }
  // Initialize with official list
  localStorage.setItem(STORAGE_KEY_IA_MEMBERS, JSON.stringify(OFFICIAL_INTERNAL_AUDIT_MEMBERS));
  return OFFICIAL_INTERNAL_AUDIT_MEMBERS;
}

// Add or update Internal Audit Member
export function saveInternalAuditMembers(members: InternalAuditMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_IA_MEMBERS, JSON.stringify(members));
  } catch (e) {
    console.error('Failed to save IA members:', e);
  }
}

// Check if an IA member has Open All Access enabled without requiring registration first
export function isIaMemberOpenAllAccess(nik?: string): boolean {
  if (!nik) return false;
  const cleanNik = nik.trim();
  const members = getInternalAuditMembers();
  const match = members.find(m => m.nik === cleanNik);
  return Boolean(match?.openAllAccess);
}

// Toggle or set Open All Access for an IA member (Admin action)
export function toggleIaMemberOpenAllAccess(nik: string, openAllAccess?: boolean): InternalAuditMember[] {
  const cleanNik = nik.trim();
  const members = getInternalAuditMembers();
  const updated = members.map(m => {
    if (m.nik === cleanNik) {
      return {
        ...m,
        openAllAccess: openAllAccess !== undefined ? openAllAccess : !m.openAllAccess
      };
    }
    return m;
  });
  saveInternalAuditMembers(updated);
  return updated;
}

// Find if NIK belongs to Internal Audit
export function getInternalAuditInfo(nik?: string): InternalAuditMember | undefined {
  if (!nik) return undefined;
  const cleanNik = nik.trim();
  const members = getInternalAuditMembers();
  return members.find(m => m.nik === cleanNik);
}

// Helper to test if a NIK belongs to Internal Audit
export function checkIsInternalAudit(nik?: string, role?: UserRole, dept?: string): boolean {
  if (role === 'auditor') return true;
  if (!nik) return false;
  const cleanNik = nik.trim();
  
  // Exact match against official Internal Audit whitelist
  const members = getInternalAuditMembers();
  if (members.some(m => m.nik === cleanNik)) {
    return true;
  }

  // Prefix checks for flexibility (e.g. IA-1021048)
  const upper = cleanNik.toUpperCase();
  if (upper.startsWith('IA') || upper.startsWith('AUD')) {
    return true;
  }

  if (dept && dept.toLowerCase().includes('internal audit')) {
    return true;
  }

  return false;
}

// Default menu permissions for Auditees (Akses Terbatas)
export const DEFAULT_AUDITEE_MENUS: string[] = [
  'public-portal',
  'trend-achievement',
  'achievement-department',
  'finding-statement',
  'priority-recommendations'
];

// Get Auditee Configured Menus (Menu apa saja yang bisa diakses oleh Auditee)
export function getAuditeeConfiguredMenus(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDITEE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_AUDITEE_MENUS;
}

// Save Auditee Configured Menus (Disimpan oleh Internal Audit)
export function saveAuditeeConfiguredMenus(allowedMenus: string[]): void {
  try {
    // Never allow access-settings for auditee
    const safeMenus = allowedMenus.filter(id => id !== 'access-settings');
    localStorage.setItem(STORAGE_KEY_AUDITEE_CONFIG, JSON.stringify(safeMenus));

    // Also update role permissions table for consistency
    const rolePerms = getRoleMenuPermissions();
    rolePerms.auditee = safeMenus;
    saveRoleMenuPermissions(rolePerms);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iarms_permissions_changed', { detail: safeMenus }));
    }
  } catch (e) {
    console.error('Failed to save auditee configured menus:', e);
  }
}

// Preset default demo accounts with official Internal Audit members and Auditee
export const DEMO_ACCOUNTS: (UserProfile & { password?: string })[] = [
  {
    uid: 'demo-ia-majid',
    nik: '1021048',
    displayName: 'Miftahul Majid',
    email: 'miftahul.majid@iarms.co.id',
    role: 'auditor',
    isInternalAudit: true,
    department: 'Internal Audit',
    jobTitle: 'Lead Internal Auditor',
    password: 'password123',
    mustChangePassword: false,
    createdAt: '2026-01-01T08:00:00.000Z',
    allowedMenus: SYSTEM_MENUS.map(m => m.id)
  },
  {
    uid: 'demo-ia-renny',
    nik: '1006059',
    displayName: 'Renny Antikawati',
    email: 'renny.antikawati@iarms.co.id',
    role: 'auditor',
    isInternalAudit: true,
    department: 'Internal Audit',
    jobTitle: 'Internal Auditor',
    password: 'password123',
    mustChangePassword: false,
    createdAt: '2026-01-01T08:00:00.000Z',
    allowedMenus: SYSTEM_MENUS.map(m => m.id)
  },
  {
    uid: 'demo-auditee-pic',
    nik: '1088921',
    displayName: 'Ahmad Yani',
    email: 'ahmad.pic@iarms.co.id',
    role: 'auditee',
    isInternalAudit: false,
    department: 'Plant & Operasional Site AGM',
    jobTitle: 'Supervisor Plant Operasional',
    password: 'password123',
    mustChangePassword: false,
    createdAt: '2026-02-15T09:30:00.000Z',
    allowedMenus: DEFAULT_AUDITEE_MENUS
  },
  {
    uid: 'demo-mgmt-bambang',
    nik: '2019045',
    displayName: 'Bambang Soediro',
    email: 'bambang.mgmt@iarms.co.id',
    role: 'management',
    isInternalAudit: false,
    department: 'Executive Committee',
    jobTitle: 'VP Risk & Compliance',
    password: 'password123',
    mustChangePassword: false,
    createdAt: '2026-01-10T11:00:00.000Z',
    allowedMenus: ['public-portal', 'trend-achievement', 'achievement-department', 'finding-statement', 'risk-register', 'dashboard']
  }
];

// Default menu access per role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  auditor: SYSTEM_MENUS.map(m => m.id), // All 12 menus
  auditee: DEFAULT_AUDITEE_MENUS,
  management: ['public-portal', 'trend-achievement', 'achievement-department', 'finding-statement', 'risk-register', 'dashboard'],
  public: DEFAULT_AUDITEE_MENUS
};

// Generate a random secure temporary password
export function generateRandomPassword(length = 8): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%&*';
  
  let pwd = '';
  pwd += letters[Math.floor(Math.random() * letters.length)];
  pwd += letters[Math.floor(Math.random() * letters.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];
  
  const allChars = letters + numbers + specials;
  for (let i = pwd.length; i < length; i++) {
    pwd += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

// Initialize users database in local storage
export function initUsersDatabase(): (UserProfile & { password?: string })[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS_DB);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(DEMO_ACCOUNTS));
      return DEMO_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(DEMO_ACCOUNTS));
      return DEMO_ACCOUNTS;
    }
    return parsed;
  } catch (e) {
    return DEMO_ACCOUNTS;
  }
}

// Get saved role menu permissions
export function getRoleMenuPermissions(): Record<UserRole, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MENU_PERMISSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ROLE_PERMISSIONS,
        ...parsed,
        auditor: SYSTEM_MENUS.map(m => m.id)
      };
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_ROLE_PERMISSIONS;
}

// Save role menu permissions
export function saveRoleMenuPermissions(perms: Record<UserRole, string[]>): void {
  try {
    const toSave = {
      ...perms,
      auditor: SYSTEM_MENUS.map(m => m.id)
    };
    localStorage.setItem(STORAGE_KEY_MENU_PERMISSIONS, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save permissions:', e);
  }
}

// Check if user has permission to access a specific menu ID
export function canUserAccessMenu(user: UserProfile | null, menuId: string): boolean {
  // If guest or no user session, follow Auditee configured menus
  if (!user) {
    const auditeeMenus = getAuditeeConfiguredMenus();
    return auditeeMenus.includes(menuId);
  }

  // RULE 1: NIK Internal Audit bisa akses SEMUA menu
  if (user.isInternalAudit || checkIsInternalAudit(user.nik, user.role, user.department)) {
    return true;
  }

  // Menu Konfigurasi Akses strictly restricted to Internal Audit only
  if (menuId === 'access-settings') {
    return false;
  }

  // RULE 2: Per-user allowedMenus override
  if (Array.isArray(user.allowedMenus) && user.allowedMenus.length > 0) {
    return user.allowedMenus.includes(menuId);
  }

  // RULE 3: Auditee global configured menus
  const auditeeMenus = getAuditeeConfiguredMenus();
  return auditeeMenus.includes(menuId);
}

const STORAGE_KEY_MANUAL_LOGIN = 'iarms_manual_login';

// Get saved user from localStorage
export function getCurrentUser(): UserProfile | null {
  try {
    const isManual = localStorage.getItem(STORAGE_KEY_MANUAL_LOGIN);
    if (!isManual) {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    return null;
  }
}

// Save current user to localStorage and dispatch event
export function setCurrentUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_MANUAL_LOGIN, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem(STORAGE_KEY_MANUAL_LOGIN);
    }
  } catch (e) {
    console.error('Failed to store user profile in localStorage:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('iarms_auth_changed', { detail: user }));
  }
}

// Register user using NIK and Email, auto-generating random password
export async function registerUserWithNik(params: {
  nik: string;
  email: string;
  displayName?: string;
  department?: string;
  jobTitle?: string;
  role?: UserRole;
}): Promise<{ user: UserProfile; generatedPassword: string }> {
  const { nik, email, displayName, department, jobTitle, role } = params;
  const cleanNik = nik.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanNik) {
    throw new Error('NIK (Nomor Induk Karyawan) wajib diisi.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Alamat email tidak valid.');
  }

  const usersDb = initUsersDatabase();

  // Check duplicate NIK or Email
  const existingByNik = usersDb.find(u => u.nik && u.nik.toLowerCase() === cleanNik.toLowerCase());
  if (existingByNik) {
    throw new Error(`NIK "${cleanNik}" sudah terdaftar atas nama ${existingByNik.displayName} (${existingByNik.email}). Silakan masuk.`);
  }

  const existingByEmail = usersDb.find(u => u.email.toLowerCase() === cleanEmail);
  if (existingByEmail) {
    throw new Error(`Email "${cleanEmail}" sudah terdaftar dengan NIK ${existingByEmail.nik}. Silakan gunakan menu Masuk.`);
  }

  // Determine if this user is Internal Audit based on official NIK whitelist
  const iaInfo = getInternalAuditInfo(cleanNik);
  const isIA = Boolean(iaInfo) || checkIsInternalAudit(cleanNik, role, department);
  const assignedRole: UserRole = isIA ? 'auditor' : (role || 'auditee');

  // Generate random password
  const generatedPassword = generateRandomPassword(8);
  const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  // Derive allowed menus
  const auditeeMenus = getAuditeeConfiguredMenus();
  const allowedMenus = isIA ? SYSTEM_MENUS.map(m => m.id) : auditeeMenus;

  // User manual input priority with fallback to IA whitelist or Master Employee database
  const masterEmp = findEmployeeByNik(cleanNik);
  const finalName = displayName?.trim() || iaInfo?.nama || masterEmp?.name || `Karyawan (${cleanNik})`;
  const finalDept = department?.trim() || iaInfo?.departemen || masterEmp?.department || (isIA ? 'Internal Audit' : 'Operasional & Unit Kerja');
  const finalTitle = jobTitle?.trim() || iaInfo?.jabatan || masterEmp?.jobTitle || (isIA ? 'Internal Auditor' : 'Auditee / PIC');

  // 1. Panggil API Google Apps Script terlebih dahulu SEBELUM menyimpan data ke localStorage
  const roleOrTitle = finalTitle || (isIA ? 'Internal Auditor' : (assignedRole || 'auditee'));
  let gasResponse: any = null;
  try {
    gasResponse = await sendRegisterUserToBackend({
      nik: cleanNik,
      email: cleanEmail,
      name: finalName,
      department: finalDept,
      role: roleOrTitle,
      tempPassword: generatedPassword
    });
  } catch (backendError: any) {
    console.error('Panggilan API Google Apps Script registrasi gagal:', backendError);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.');
  }

  // 2. Verifikasi status respon dari backend
  if (!gasResponse || (gasResponse.status !== 'success' && gasResponse.success !== true)) {
    console.error('Backend Google Apps Script tidak mengembalikan status success:', gasResponse);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.');
  }

  // 3. HANYA JIKA respon backend berhasil (status: "success"), simpan data user ke state/localStorage
  const newProfile: UserProfile = {
    uid,
    nik: cleanNik,
    displayName: finalName,
    email: cleanEmail,
    role: assignedRole,
    isInternalAudit: isIA,
    department: finalDept,
    jobTitle: finalTitle,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isCustomAccount: true,
    mustChangePassword: true, // "untuk login harus buat pasword baru"
    tempPassword: generatedPassword,
    welcomeEmailSent: true,
    allowedMenus
  };

  // Optional background Firebase Auth attempt
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, generatedPassword);
    if (userCredential.user) {
      try {
        await updateProfile(userCredential.user, { displayName: finalName });
      } catch (e) {
        // ignore
      }
    }
  } catch (fbErr: any) {
    console.warn('Firebase Auth register warning (fallback to local auth):', fbErr.message || fbErr);
  }

  // Simpan ke database pengguna lokal (localStorage)
  usersDb.push({
    ...newProfile,
    password: generatedPassword,
    welcomeEmailSent: true
  });
  localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));

  return {
    user: newProfile,
    generatedPassword
  };
}

/**
 * Fitur Update Email / Akun Tersangkut
 * Memungkinkan pengguna memperbarui alamat email jika salah input atau belum menerima email verifikasi,
 * lalu mengirimkan ulang kredensial verifikasi ke email yang baru melalui Google Apps Script.
 * ATOMIC: Hanya menyimpan perubahan jika respon backend adalah "success".
 */
export async function updateStuckAccountEmail(params: {
  nik: string;
  newEmail: string;
}): Promise<{ user: UserProfile; generatedPassword: string }> {
  const cleanNik = params.nik.trim();
  const cleanEmail = params.newEmail.trim().toLowerCase();

  if (!cleanNik) {
    throw new Error('NIK (Nomor Induk Karyawan) wajib diisi.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Alamat email baru tidak valid.');
  }

  const usersDb = initUsersDatabase();
  const existingByNikIndex = usersDb.findIndex(
    u => u.nik && u.nik.toLowerCase() === cleanNik.toLowerCase()
  );

  // Periksa apakah email baru telah digunakan oleh akun dengan NIK berbeda
  const conflictEmail = usersDb.find(
    u => u.email && u.email.toLowerCase() === cleanEmail && (!u.nik || u.nik.toLowerCase() !== cleanNik.toLowerCase())
  );
  if (conflictEmail) {
    throw new Error(`Email "${cleanEmail}" telah terdaftar dengan NIK lain (${conflictEmail.nik}). Gunakan alamat email Anda yang valid.`);
  }

  // Dapatkan profil karyawan dari IA whitelist atau Master Data
  const iaInfo = getInternalAuditInfo(cleanNik);
  const masterEmp = findEmployeeByNik(cleanNik);
  const isIA = Boolean(iaInfo) || checkIsInternalAudit(cleanNik);
  const assignedRole: UserRole = isIA ? 'auditor' : 'auditee';

  const existing = existingByNikIndex !== -1 ? usersDb[existingByNikIndex] : null;
  const finalName = existing?.displayName || iaInfo?.nama || masterEmp?.name || `Karyawan (${cleanNik})`;
  const finalDept = existing?.department || iaInfo?.departemen || masterEmp?.department || (isIA ? 'Internal Audit' : 'Operasional & Unit Kerja');
  const finalTitle = existing?.jobTitle || iaInfo?.jabatan || masterEmp?.jobTitle || (isIA ? 'Internal Auditor' : 'Auditee / PIC');
  const allowedMenus = existing?.allowedMenus || (isIA ? SYSTEM_MENUS.map(m => m.id) : getAuditeeConfiguredMenus());

  const generatedPassword = generateRandomPassword(8);

  // 1. Panggil API Google Apps Script terlebih dahulu SEBELUM menyimpan data ke localStorage
  let gasResponse: any = null;
  try {
    gasResponse = await sendResendVerificationToBackend({
      nik: cleanNik,
      email: cleanEmail,
      name: finalName,
      department: finalDept,
      role: finalTitle,
      tempPassword: generatedPassword
    });
  } catch (backendError: any) {
    console.error('Panggilan API GAS update email gagal:', backendError);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.');
  }

  // 2. Verifikasi status respon dari backend
  if (!gasResponse || (gasResponse.status !== 'success' && gasResponse.success !== true)) {
    console.error('Backend Google Apps Script tidak mengembalikan status success untuk update email:', gasResponse);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.');
  }

  // 3. ATOMIC: Hanya jika respon backend berhasil (status: "success"), perbarui data di localStorage
  let updatedProfile: UserProfile;
  if (existingByNikIndex !== -1) {
    usersDb[existingByNikIndex].email = cleanEmail;
    usersDb[existingByNikIndex].password = generatedPassword;
    usersDb[existingByNikIndex].tempPassword = generatedPassword;
    usersDb[existingByNikIndex].mustChangePassword = true;
    usersDb[existingByNikIndex].welcomeEmailSent = true;
    usersDb[existingByNikIndex].lastLoginAt = new Date().toISOString();
    
    const { password: _, tempPassword: __, ...safe } = usersDb[existingByNikIndex];
    updatedProfile = safe as UserProfile;
  } else {
    const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newRecord: UserProfile & { password?: string; tempPassword?: string } = {
      uid,
      nik: cleanNik,
      displayName: finalName,
      email: cleanEmail,
      role: assignedRole,
      isInternalAudit: isIA,
      department: finalDept,
      jobTitle: finalTitle,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isCustomAccount: true,
      mustChangePassword: true,
      tempPassword: generatedPassword,
      welcomeEmailSent: true,
      allowedMenus,
      password: generatedPassword
    };
    usersDb.push(newRecord);
    const { password: _, tempPassword: __, ...safe } = newRecord;
    updatedProfile = safe as UserProfile;
  }

  localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));

  return {
    user: updatedProfile,
    generatedPassword
  };
}

/**
 * Logika Reset Password: Step 1 - Minta Kode OTP
 * Mengirimkan payload action: "reset_password" ke Google Apps Script backend.
 */
export async function requestPasswordReset(identifier: string): Promise<{
  success: boolean;
  email: string;
  nik: string;
  name: string;
  message: string;
}> {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId) {
    throw new Error('Masukkan NIK atau Email terdaftar Anda.');
  }

  const usersDb = initUsersDatabase();
  const matchedUser = usersDb.find(
    u => (u.nik && u.nik.toLowerCase() === cleanId) || (u.email && u.email.toLowerCase() === cleanId)
  );

  let targetNik = '';
  let targetEmail = '';
  let targetName = '';

  if (matchedUser) {
    targetNik = matchedUser.nik || '';
    targetEmail = matchedUser.email || '';
    targetName = matchedUser.displayName || '';
  } else {
    // Check in Internal Audit list
    const iaMember = getInternalAuditInfo(identifier.trim());
    if (iaMember) {
      targetNik = iaMember.nik;
      targetEmail = iaMember.email || '';
      targetName = iaMember.nama;
    } else {
      // Check Master Employee list
      const emp = findEmployeeByNik(identifier.trim());
      if (emp) {
        targetNik = emp.nik;
        targetEmail = cleanId.includes('@') ? cleanId : ((emp as any).email || '');
        targetName = emp.name;
      }
    }
  }

  if (!targetNik && !targetEmail) {
    throw new Error(`Akun dengan NIK/Email "${identifier}" tidak ditemukan dalam sistem.`);
  }

  if (!targetEmail || !targetEmail.includes('@')) {
    throw new Error(`Akun NIK ${targetNik} belum memiliki alamat email terdaftar.`);
  }

  // Generate 6-digit random numeric OTP
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  // Kirimkan payload action: "reset_password" ke Google Apps Script
  let gasResponse: any = null;
  try {
    gasResponse = await sendResetPasswordToBackend({
      nik: targetNik,
      email: targetEmail,
      name: targetName,
      otp: otpCode
    });
  } catch (backendError: any) {
    console.error('GAS reset password request failed:', backendError);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba beberapa saat lagi.');
  }

  if (!gasResponse || (gasResponse.status !== 'success' && gasResponse.success !== true)) {
    console.error('GAS backend response not success for reset_password:', gasResponse);
    throw new Error('Gagal mengirim email verifikasi. Pastikan email Anda aktif.');
  }

  // Simpan state sesi verifikasi OTP ke sessionStorage (berlaku 15 menit)
  const sessionData = {
    nik: targetNik,
    email: targetEmail,
    name: targetName,
    otp: otpCode,
    expiresAt: Date.now() + 15 * 60 * 1000
  };
  try {
    sessionStorage.setItem('iarms_reset_pwd_session', JSON.stringify(sessionData));
  } catch (e) {
    // ignore
  }

  return {
    success: true,
    email: targetEmail,
    nik: targetNik,
    name: targetName,
    message: `Kode OTP 6-digit telah berhasil dikirimkan ke email: ${targetEmail}`
  };
}

/**
 * Logika Reset Password: Step 2 - Verifikasi OTP & Simpan Password Baru
 */
export async function completePasswordReset(params: {
  identifier: string;
  otp: string;
  newPassword: string;
}): Promise<UserProfile> {
  const { otp, newPassword } = params;
  const cleanOtp = otp.trim();

  if (!cleanOtp || cleanOtp.length !== 6) {
    throw new Error('Masukkan 6 digit kode OTP verifikasi dengan lengkap.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal harus 6 karakter.');
  }

  // Verifikasi kode OTP dari sessionStorage
  let savedSession: any = null;
  try {
    const raw = sessionStorage.getItem('iarms_reset_pwd_session');
    if (raw) savedSession = JSON.parse(raw);
  } catch (e) {
    // ignore
  }

  if (!savedSession) {
    throw new Error('Sesi verifikasi reset kata sandi tidak ditemukan atau telah berakhir. Silakan minta kode OTP baru.');
  }

  if (Date.now() > savedSession.expiresAt) {
    sessionStorage.removeItem('iarms_reset_pwd_session');
    throw new Error('Kode OTP telah kedaluwarsa (berlaku 15 menit). Silakan minta kode OTP baru.');
  }

  if (savedSession.otp !== cleanOtp) {
    throw new Error('Kode OTP yang Anda masukkan salah. Silakan periksa kembali email Anda.');
  }

  const targetNik = savedSession.nik;
  const targetEmail = savedSession.email;

  const usersDb = initUsersDatabase();
  let userIndex = usersDb.findIndex(
    u => (u.nik && u.nik.toLowerCase() === targetNik.toLowerCase()) || 
         (u.email && u.email.toLowerCase() === targetEmail.toLowerCase())
  );

  let updatedUser: UserProfile;

  if (userIndex !== -1) {
    usersDb[userIndex].password = newPassword;
    usersDb[userIndex].tempPassword = undefined;
    usersDb[userIndex].mustChangePassword = false;
    usersDb[userIndex].lastLoginAt = new Date().toISOString();

    const { password: _, tempPassword: __, ...safe } = usersDb[userIndex];
    updatedUser = safe as UserProfile;
  } else {
    // Buat profil jika belum ada di localStorage
    const iaInfo = getInternalAuditInfo(targetNik);
    const masterEmp = findEmployeeByNik(targetNik);
    const isIA = Boolean(iaInfo) || checkIsInternalAudit(targetNik);
    const assignedRole: UserRole = isIA ? 'auditor' : 'auditee';
    const finalName = savedSession.name || iaInfo?.nama || masterEmp?.name || `Karyawan (${targetNik})`;
    const finalDept = iaInfo?.departemen || masterEmp?.department || (isIA ? 'Internal Audit' : 'Operasional');
    const finalTitle = iaInfo?.jabatan || masterEmp?.jobTitle || (isIA ? 'Internal Auditor' : 'Auditee');
    const allowedMenus = isIA ? SYSTEM_MENUS.map(m => m.id) : getAuditeeConfiguredMenus();

    const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newRecord = {
      uid,
      nik: targetNik,
      displayName: finalName,
      email: targetEmail,
      role: assignedRole,
      isInternalAudit: isIA,
      department: finalDept,
      jobTitle: finalTitle,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isCustomAccount: true,
      mustChangePassword: false,
      allowedMenus,
      password: newPassword
    };
    usersDb.push(newRecord);
    const { password: _, ...safe } = newRecord;
    updatedUser = safe as UserProfile;
  }

  localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));
  sessionStorage.removeItem('iarms_reset_pwd_session');

  // Beritahukan sinkronisasi ke backend (action: password_updated)
  syncAuditData({
    action: 'password_updated',
    nik: targetNik,
    email: targetEmail,
    timestamp: new Date().toISOString()
  }).catch(e => console.warn('Sync password updated warning:', e));

  // Set currentUser langsung ke sesi aktif
  setCurrentUser(updatedUser);

  return updatedUser;
}

// Login user with NIK or Email and Password
export async function loginUserWithNikOrEmail(
  identifier: string, 
  passwordInput: string
): Promise<{ user: UserProfile; mustChangePassword: boolean }> {
  const cleanId = identifier.trim().toLowerCase();
  const usersDb = initUsersDatabase();

  // Find user by NIK or Email
  const matchedUser = usersDb.find(u => 
    (u.nik && u.nik.toLowerCase() === cleanId) || 
    (u.email && u.email.toLowerCase() === cleanId)
  );

  if (!matchedUser) {
    // Check if identifier is in official Internal Audit list but hasn't logged in yet
    const iaMember = getInternalAuditInfo(identifier.trim());
    if (iaMember) {
      throw new Error(`NIK "${identifier}" terdaftar sebagai Internal Audit (${iaMember.nama}). Silakan klik "Daftar Akun" untuk mengaktifkan akun dan menerima password awal ke email.`);
    }
    throw new Error(`Akun dengan NIK/Email "${identifier}" tidak ditemukan dalam sistem. Silakan lakukan registrasi akun.`);
  }

  // Check password
  const isMatch = matchedUser.password === passwordInput || matchedUser.tempPassword === passwordInput;
  
  if (!isMatch) {
    try {
      if (matchedUser.email) {
        await signInWithEmailAndPassword(auth, matchedUser.email, passwordInput);
      } else {
        throw new Error('Kata sandi salah.');
      }
    } catch (fbErr: any) {
      throw new Error('Kata sandi yang Anda masukkan salah. Jika baru mendaftar, gunakan kata sandi yang dikirimkan ke email Anda.');
    }
  }

  // Clean profile
  const { password: _, tempPassword: __, ...safeProfile } = matchedUser;
  const isIA = checkIsInternalAudit(safeProfile.nik, safeProfile.role, safeProfile.department);

  const updatedProfile: UserProfile = {
    ...(safeProfile as UserProfile),
    isInternalAudit: isIA,
    lastLoginAt: new Date().toISOString()
  };

  // If user still must change password, return flag without activating full session
  if (matchedUser.mustChangePassword) {
    return {
      user: updatedProfile,
      mustChangePassword: true
    };
  }

  // Check if first-time login and welcome email notification has not been triggered
  if (!matchedUser.welcomeEmailSent) {
    matchedUser.welcomeEmailSent = true;
    const userIndex = usersDb.findIndex(u => u.uid === matchedUser.uid);
    if (userIndex !== -1) {
      usersDb[userIndex] = matchedUser;
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));
    }

    sendRegisterUserToBackend({
      nik: updatedProfile.nik,
      email: updatedProfile.email,
      name: updatedProfile.displayName,
      department: updatedProfile.department || '',
      role: updatedProfile.role
    }).catch(e => console.warn('Sync first login email warning:', e));
  }

  // Session activated
  setCurrentUser(updatedProfile);
  return {
    user: updatedProfile,
    mustChangePassword: false
  };
}

// Complete First-Time Password Change
export async function completeFirstLoginPasswordChange(
  uid: string, 
  newPassword: string
): Promise<UserProfile> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal harus 6 karakter.');
  }

  const usersDb = initUsersDatabase();
  const idx = usersDb.findIndex(u => u.uid === uid);

  if (idx === -1) {
    throw new Error('Data pengguna tidak ditemukan.');
  }

  const target = usersDb[idx];
  target.password = newPassword;
  target.mustChangePassword = false;
  target.tempPassword = undefined;
  target.lastLoginAt = new Date().toISOString();
  target.welcomeEmailSent = true;

  usersDb[idx] = target;
  localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));

  const { password: _, tempPassword: __, ...safeProfile } = target;
  const isIA = checkIsInternalAudit(safeProfile.nik, safeProfile.role, safeProfile.department);
  const updatedUser: UserProfile = {
    ...(safeProfile as UserProfile),
    isInternalAudit: isIA,
    mustChangePassword: false,
    welcomeEmailSent: true
  };

  setCurrentUser(updatedUser);

  // Send first login completion notification via Google Apps Script (action: register_user)
  sendRegisterUserToBackend({
    nik: updatedUser.nik,
    email: updatedUser.email,
    name: updatedUser.displayName,
    department: updatedUser.department || '',
    role: updatedUser.role
  }).catch(e => console.warn('Sync first login register_user email warning:', e));

  // Sync password change
  syncAuditData({
    action: 'password_updated',
    nik: updatedUser.nik,
    email: updatedUser.email,
    timestamp: new Date().toISOString()
  }).catch(e => console.warn('Sync password GAS warning:', e));

  return updatedUser;
}

// Update User Menu Permissions (Per-User override)
export function updateUserMenuPermissions(
  uid: string, 
  allowedMenus: string[], 
  isInternalAudit?: boolean
): UserProfile {
  const usersDb = initUsersDatabase();
  const idx = usersDb.findIndex(u => u.uid === uid);

  if (idx === -1) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const current = getCurrentUser();
  if (!current || (!current.isInternalAudit && current.role !== 'auditor')) {
    throw new Error('Akses ditolak: Hanya NIK Internal Audit yang dapat mengatur hak akses menu.');
  }

  const user = usersDb[idx];
  user.allowedMenus = allowedMenus;
  if (typeof isInternalAudit === 'boolean') {
    user.isInternalAudit = isInternalAudit;
    if (isInternalAudit) {
      user.role = 'auditor';
      user.allowedMenus = SYSTEM_MENUS.map(m => m.id);
    }
  }

  usersDb[idx] = user;
  localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));

  if (current.uid === uid) {
    const { password: _, tempPassword: __, ...safe } = user;
    setCurrentUser(safe as UserProfile);
  }

  return user;
}

// Quick login using predefined demo account
export function quickLoginDemo(account: UserProfile): UserProfile {
  const usersDb = initUsersDatabase();
  const existing = usersDb.find(u => (u.nik && u.nik === account.nik) || u.email.toLowerCase() === account.email.toLowerCase());

  const isIA = checkIsInternalAudit(account.nik, account.role, account.department);
  const profile: UserProfile = {
    ...account,
    isInternalAudit: isIA,
    lastLoginAt: new Date().toISOString(),
    allowedMenus: isIA ? SYSTEM_MENUS.map(m => m.id) : (account.allowedMenus || getAuditeeConfiguredMenus())
  };

  if (!existing) {
    usersDb.push(profile);
    localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));
  }

  setCurrentUser(profile);
  return profile;
}

// Logout
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
  setCurrentUser(null);
}

// Update User Profile
export function updateUserProfile(updates: Partial<UserProfile>): UserProfile {
  const current = getCurrentUser();
  if (!current) {
    throw new Error('Tidak ada sesi pengguna aktif.');
  }

  const updated: UserProfile = {
    ...current,
    ...updates
  };

  const usersDb = initUsersDatabase();
  const idx = usersDb.findIndex(u => u.uid === current.uid || u.email.toLowerCase() === current.email.toLowerCase());
  if (idx !== -1) {
    usersDb[idx] = {
      ...usersDb[idx],
      ...updates
    };
    localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));
  }

  setCurrentUser(updated);
  return updated;
}

// Get all registered users for administration
export function getRegisteredUsers(): UserProfile[] {
  const usersDb = initUsersDatabase();
  return usersDb.map(({ password, tempPassword, ...safe }) => safe as UserProfile);
}

// Listen to auth changes
export function onAuthChange(callback: (user: UserProfile | null) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<UserProfile | null>;
    callback(customEvent.detail);
  };

  window.addEventListener('iarms_auth_changed', handler);
  return () => {
    window.removeEventListener('iarms_auth_changed', handler);
  };
}
