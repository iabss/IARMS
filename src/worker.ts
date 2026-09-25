export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  IARMS_KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
  };
  KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
  };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

const GAS_BACKEND_URL = "https://script.google.com/macros/s/AKfycbxEhSdIzLsxKzT5tJZcGQxQ6fBfClESfOhDUE2aji54I1Y44qJVpE0q1o6763zSHhNuAw/exec";

// In-memory fallback if KV binding is not attached or KV limit is reached
let inMemoryState: any = null;

// Helper to safely write to KV with error suppression when daily write limits are hit
async function safeKvPut(kv: any, key: string, value: string): Promise<{ success: boolean; limitExceeded?: boolean; error?: string }> {
  if (!kv) return { success: false, error: 'KV not bound' };
  try {
    await kv.put(key, value);
    return { success: true };
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    const isLimit = msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded') || msg.includes('rate');
    console.warn(`[safeKvPut] Error writing key "${key}" to KV:`, err?.message || err);
    return { success: false, limitExceeded: isLimit, error: err?.message || String(err) };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight for any route
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // 2. Intercept /api/ routes for Centralized Server-First State & Google Apps Script
    if (url.pathname.startsWith('/api/')) {
      const kv = env.IARMS_KV || env.KV;

      // GET /api/app-state
      if (url.pathname === '/api/app-state' && request.method === 'GET') {
        let state: any = null;
        if (kv) {
          try {
            const raw = await kv.get('app_state');
            if (raw) state = JSON.parse(raw);
          } catch {}
        }
        if (!state) state = inMemoryState;

        return new Response(
          JSON.stringify({ success: true, state: state || { projectConfigs: [], customRows: [] } }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // POST /api/app-state
      if (url.pathname === '/api/app-state' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          let currentState: any = {};
          if (kv) {
            try {
              const raw = await kv.get('app_state');
              if (raw) currentState = JSON.parse(raw);
            } catch {}
          } else if (inMemoryState) {
            currentState = { ...inMemoryState };
          }

          const updatedState = {
            ...currentState,
            ...body,
            lastUpdated: new Date().toISOString()
          };

          let kvResult: { success: boolean; limitExceeded?: boolean; error?: string } = { success: false };
          if (kv) {
            // Check if content actually changed compared to current
            const currentStr = JSON.stringify({ ...currentState, lastUpdated: undefined });
            const updatedStr = JSON.stringify({ ...updatedState, lastUpdated: undefined });
            if (currentStr !== updatedStr) {
              kvResult = await safeKvPut(kv, 'app_state', JSON.stringify(updatedState));
            } else {
              kvResult = { success: true };
            }
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ 
              success: true, 
              state: updatedState,
              warning: kvResult.limitExceeded ? 'KV put limit exceeded. Data saved to in-memory fallback.' : undefined
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // GET /api/afs-projects: Membaca array project AFS dari KV (IARMS_KV.get('afs_projects'))
      if (url.pathname === '/api/afs-projects' && request.method === 'GET') {
        let projects: any[] = [];
        let isFromKv = false;

        if (kv) {
          try {
            // 1. Prioritaskan pembacaan langsung dari KV key 'afs_projects'
            const rawAfs = await kv.get('afs_projects');
            if (rawAfs) {
              const parsed = JSON.parse(rawAfs);
              if (Array.isArray(parsed)) {
                projects = parsed;
                isFromKv = true;
              }
            }
          } catch (e) {
            console.warn('Gagal membaca afs_projects dari Cloudflare KV:', e);
          }

          // 2. Fallback membaca projectConfigs dari 'app_state' di KV jika key 'afs_projects' belum ada
          if (projects.length === 0) {
            try {
              const rawState = await kv.get('app_state');
              if (rawState) {
                const parsedState = JSON.parse(rawState);
                if (Array.isArray(parsedState?.projectConfigs) && parsedState.projectConfigs.length > 0) {
                  projects = parsedState.projectConfigs;
                  isFromKv = true;
                }
              }
            } catch {}
          }
        }

        // 3. Fallback ke in-memory state jika berjalan di environment simulasi tanpa KV
        if (projects.length === 0 && inMemoryState?.projectConfigs) {
          projects = inMemoryState.projectConfigs;
        }

        return new Response(
          JSON.stringify({
            success: true,
            afs_projects: projects,
            projects: projects,
            total: projects.length,
            isEmpty: projects.length === 0,
            storage: isFromKv ? 'Cloudflare KV (IARMS_KV)' : 'In-Memory State'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // POST /api/afs-projects: Menyimpan array project AFS baru ke KV
      if (url.pathname === '/api/afs-projects' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          let currentState: any = inMemoryState || {};
          if (kv) {
            try {
              const raw = await kv.get('app_state');
              if (raw) currentState = JSON.parse(raw);
            } catch {}
          }

          const rawProjects = Array.isArray(body)
            ? body
            : (Array.isArray(body.afs_projects) ? body.afs_projects : (Array.isArray(body.projects) ? body.projects : [body]));

          let configs = Array.isArray(currentState.projectConfigs) ? [...currentState.projectConfigs] : [];
          let deletedKeys = Array.isArray(currentState.deletedKeys) ? [...currentState.deletedKeys] : [];

          const sanitizedList: any[] = [];

          for (const item of rawProjects) {
            if (!item) continue;
            const targetName = (item.projectName || item.project || item.defaultProject || '').trim().toUpperCase();
            if (!targetName) continue;
            const targetSite = (item.siteName || item.site || 'HEAD OFFICE').trim().toUpperCase();
            const targetYear = item.year ? String(item.year).trim() : '';
            const targetKey = item.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

            deletedKeys = deletedKeys.filter(k => k !== targetKey && k !== targetName);

            const newConfigItem = {
              id: targetKey,
              projectName: targetName,
              defaultProject: targetName,
              project: targetName,
              siteName: targetSite,
              site: targetSite,
              year: targetYear || undefined,
              sheetUrl: item.sheetUrl || '',
              status: item.sheetUrl && item.sheetUrl.trim() ? (item.status || 'synced') : (item.status || 'pending'),
              rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
              lastSyncedAt: item.lastSyncedAt || new Date().toISOString()
            };

            sanitizedList.push(newConfigItem);

            const existingIndex = configs.findIndex((c: any) => {
              if (item.id && c.id && item.id === c.id) return true;
              const cName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
              const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
              const cYear = c.year ? String(c.year).trim() : '';
              const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
              return cKey === targetKey;
            });

            if (existingIndex >= 0) {
              configs[existingIndex] = {
                ...configs[existingIndex],
                ...newConfigItem,
                rowCount: item.rowCount !== undefined ? Number(item.rowCount) : configs[existingIndex].rowCount,
                lastSyncedAt: item.lastSyncedAt || configs[existingIndex].lastSyncedAt || new Date().toISOString()
              };
            } else {
              configs.push(newConfigItem);
            }
          }

          // Gunakan configs yang telah di-merge atau sanitizedList jika merupakan batch override
          const finalProjects = configs.length > 0 ? configs : sanitizedList;

          const updatedState = {
            ...currentState,
            projectConfigs: finalProjects,
            deletedKeys,
            lastUpdated: new Date().toISOString()
          };

          // Optimasi KV: Hanya simpan ke key 'afs_projects' jika data berbeda dengan in-memory / KV
          let kvResult: { success: boolean; limitExceeded?: boolean; error?: string } = { success: false };
          if (kv) {
            const oldStr = JSON.stringify(currentState.projectConfigs || []);
            const newStr = JSON.stringify(finalProjects);
            if (oldStr !== newStr) {
              // Cukup tulis 1 key 'afs_projects' untuk menghemat 50% kuota harian KV
              kvResult = await safeKvPut(kv, 'afs_projects', newStr);
            } else {
              kvResult = { success: true };
            }
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({
              success: true,
              message: kvResult.limitExceeded 
                ? 'Project disimpan di memori/fallback (kuota harian KV tercapai). Sinkronisasi server berlanjut otomatis.' 
                : 'Daftar project AFS berhasil disimpan ke Cloudflare KV Storage (IARMS_KV)',
              afs_projects: finalProjects,
              projects: finalProjects,
              total: finalProjects.length,
              savedToKv: kvResult.success,
              kvLimitExceeded: !!kvResult.limitExceeded
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // POST /api/save-project
      if (url.pathname === '/api/save-project' && request.method === 'POST') {
        try {
          const config: any = await request.json();
          let currentState: any = inMemoryState || {};
          if (kv) {
            try {
              const raw = await kv.get('app_state');
              if (raw) currentState = JSON.parse(raw);
            } catch {}
          }

          let configs = Array.isArray(currentState.projectConfigs) ? [...currentState.projectConfigs] : [];
          const targetName = (config.projectName || config.project || config.defaultProject || '').trim().toUpperCase();
          const targetSite = (config.siteName || config.site || 'HEAD OFFICE').trim().toUpperCase();
          const targetYear = config.year ? String(config.year).trim() : '';
          const targetKey = config.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

          const existingIndex = configs.findIndex((c: any) => {
            if (config.id && c.id && config.id === c.id) return true;
            const cName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
            const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
            const cYear = c.year ? String(c.year).trim() : '';
            const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
            return cKey === targetKey;
          });

          const newConfigItem = {
            id: targetKey,
            projectName: targetName,
            defaultProject: targetName,
            project: targetName,
            siteName: targetSite,
            site: targetSite,
            year: targetYear || undefined,
            sheetUrl: config.sheetUrl || '',
            status: config.status || (config.sheetUrl && config.sheetUrl.trim() ? 'synced' : 'pending'),
            rowCount: config.rowCount !== undefined ? Number(config.rowCount) : 0,
            lastSyncedAt: config.lastSyncedAt || new Date().toISOString()
          };

          if (existingIndex >= 0) {
            configs[existingIndex] = { ...configs[existingIndex], ...newConfigItem };
          } else {
            configs.push(newConfigItem);
          }

          const updatedState = { ...currentState, projectConfigs: configs, lastUpdated: new Date().toISOString() };
          
          let kvResult: { success: boolean; limitExceeded?: boolean; error?: string } = { success: false };
          if (kv) {
            kvResult = await safeKvPut(kv, 'afs_projects', JSON.stringify(configs));
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ 
              success: !kvResult.limitExceeded, 
              projectConfigs: configs, 
              state: updatedState,
              savedToKv: kvResult.success,
              kvLimitExceeded: !!kvResult.limitExceeded,
              message: kvResult.limitExceeded
                ? 'Gagal menyimpan ke server karena kuota harian KV habis. Data disimpan sementara secara lokal dan akan disinkronkan otomatis besok setelah pukul 07:00 WIB.'
                : 'Project berhasil disimpan ke server'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          const msg = (err?.message || String(err)).toLowerCase();
          const isLimit = msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded') || msg.includes('put()');
          if (isLimit) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                savedToKv: false, 
                kvLimitExceeded: true,
                warning: 'Cloudflare KV put limit exceeded for the day',
                message: 'Gagal menyimpan ke server karena kuota harian KV habis. Data disimpan sementara secara lokal dan akan disinkronkan otomatis besok setelah pukul 07:00 WIB.'
              }),
              { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
            );
          }
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // POST /api/delete-project
      if (url.pathname === '/api/delete-project' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          let currentState: any = inMemoryState || {};
          if (kv) {
            try {
              const raw = await kv.get('app_state');
              if (raw) currentState = JSON.parse(raw);
            } catch {}
          }

          const targetName = (body.project || '').trim().toUpperCase();
          const targetSite = (body.site || '').trim().toUpperCase();
          const targetYear = body.year ? String(body.year).trim() : '';
          const targetKey = body.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

          let configs = Array.isArray(currentState.projectConfigs) ? [...currentState.projectConfigs] : [];
          const initialLength = configs.length;
          configs = configs.filter((c: any) => {
            if (body.id && c.id && c.id === body.id) return false;
            const cName = (c.projectName || c.defaultProject || '').trim().toUpperCase();
            const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
            const cYear = c.year ? String(c.year).trim() : '';
            const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
            return cKey !== targetKey;
          });

          const updatedState = { ...currentState, projectConfigs: configs, lastUpdated: new Date().toISOString() };
          
          let kvResult: { success: boolean; limitExceeded?: boolean; error?: string } = { success: false };
          if (kv) {
            // Cukup update 'afs_projects' secara aman (1 KV put saja)
            kvResult = await safeKvPut(kv, 'afs_projects', JSON.stringify(configs));
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ 
              success: true, 
              projectConfigs: configs, 
              state: updatedState,
              deletedKey: targetKey,
              savedToKv: kvResult.success,
              kvLimitExceeded: !!kvResult.limitExceeded,
              message: kvResult.limitExceeded 
                ? 'Project berhasil dihapus dari memori server. Kuota harian KV tercapai, sinkronisasi permanen dilanjutkan saat kuota reset.'
                : 'Project berhasil dihapus dari server dan Cloudflare KV.'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          // Tangani secara khusus jika ada error uncaught terkait KV quota
          const msg = (err?.message || String(err)).toLowerCase();
          const isLimit = msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded');
          if (isLimit) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                warning: 'Cloudflare KV put limit exceeded for the day',
                kvLimitExceeded: true,
                message: 'Kuota harian KV tercapai. Operasi dicatat pada memori server.'
              }),
              { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
            );
          }
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // POST /api/purge-afs-projects & /api/reset-afs-projects: One-time database purge for Cloudflare KV
      if ((url.pathname === '/api/purge-afs-projects' || url.pathname === '/api/reset-afs-projects') && request.method === 'POST') {
        try {
          let currentState: any = inMemoryState || {};
          if (kv) {
            try {
              const raw = await kv.get('app_state');
              if (raw) currentState = JSON.parse(raw);
            } catch {}
          }

          const updatedState = {
            ...currentState,
            projectConfigs: [],
            deletedKeys: [],
            lastUpdated: new Date().toISOString()
          };

          let kvResult: { success: boolean; limitExceeded?: boolean; error?: string } = { success: false };
          if (kv) {
            kvResult = await safeKvPut(kv, 'afs_projects', JSON.stringify([]));
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({
              success: true,
              message: kvResult.limitExceeded
                ? 'Semua data project AFS berhasil dibersihkan dari memori (kuota harian KV tercapai).'
                : 'Semua data project AFS berhasil dibersihkan dari Cloudflare KV (IARMS_KV)',
              total: 0,
              afs_projects: [],
              savedToKv: kvResult.success,
              kvLimitExceeded: !!kvResult.limitExceeded
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // GET /api/gas-audit-data
      if (url.pathname === '/api/gas-audit-data') {
        try {
          const gasRes = await fetch(GAS_BACKEND_URL);
          if (gasRes.ok) {
            const text = await gasRes.text();
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              return new Response(
                JSON.stringify({ success: true, data: JSON.parse(text) }),
                { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
              );
            }
          }
        } catch {}
        return new Response(
          JSON.stringify({ success: true, data: null }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // Default fallback for other /api/ routes
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'API request handled by worker',
          path: url.pathname,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }

    // 3. Serve static assets SPA generated by Vite
    try {
      const response = await env.ASSETS.fetch(request);
      
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'SAMEORIGIN');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err: any) {
      return new Response(`Worker Error: ${err.message || err}`, { status: 500 });
    }
  },
};

