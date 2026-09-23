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

// In-memory fallback if KV binding is not attached
let inMemoryState: any = null;

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
            const raw = await kv.get('app_state');
            if (raw) currentState = JSON.parse(raw);
          } else if (inMemoryState) {
            currentState = { ...inMemoryState };
          }

          const updatedState = {
            ...currentState,
            ...body,
            lastUpdated: new Date().toISOString()
          };

          if (kv) {
            await kv.put('app_state', JSON.stringify(updatedState));
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ success: true, state: updatedState }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }
      }

      // GET /api/afs-projects (Cloudflare Workers & KV Support)
      if (url.pathname === '/api/afs-projects' && request.method === 'GET') {
        let state: any = null;
        if (kv) {
          try {
            const raw = await kv.get('app_state');
            if (raw) state = JSON.parse(raw);
          } catch {}
        }
        if (!state) state = inMemoryState;

        const configs = Array.isArray(state?.projectConfigs) ? state.projectConfigs : [];
        const deletedKeys = Array.isArray(state?.deletedKeys) ? new Set(state.deletedKeys.map((k: string) => k.trim().toUpperCase())) : new Set<string>();

        const filtered = configs.filter((c: any) => {
          const pName = (c.projectName || c.defaultProject || c.project || '').trim().toUpperCase();
          const pSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
          const pYear = c.year ? String(c.year).trim() : '';
          const pKey = (c.id || `${pName}|${pSite}${pYear ? `|${pYear}` : ''}`).toUpperCase();
          if (deletedKeys.has(pKey) || deletedKeys.has(pName)) return false;
          return true;
        });

        return new Response(
          JSON.stringify({
            success: true,
            afs_projects: filtered,
            projects: filtered,
            total: filtered.length,
            lastUpdated: state?.lastUpdated
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // POST /api/afs-projects (Save directly to Cloudflare KV / Server Master Database)
      if (url.pathname === '/api/afs-projects' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          let currentState: any = inMemoryState || {};
          if (kv) {
            const raw = await kv.get('app_state');
            if (raw) currentState = JSON.parse(raw);
          }

          const rawProjects = Array.isArray(body)
            ? body
            : (Array.isArray(body.afs_projects) ? body.afs_projects : (Array.isArray(body.projects) ? body.projects : [body]));

          let configs = Array.isArray(currentState.projectConfigs) ? [...currentState.projectConfigs] : [];
          let deletedKeys = Array.isArray(currentState.deletedKeys) ? [...currentState.deletedKeys] : [];

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
              status: item.status || (item.sheetUrl && item.sheetUrl.trim() ? 'synced' : 'pending'),
              rowCount: item.rowCount !== undefined ? Number(item.rowCount) : 0,
              lastSyncedAt: item.lastSyncedAt || new Date().toISOString()
            };

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

          const updatedState = {
            ...currentState,
            projectConfigs: configs,
            deletedKeys,
            lastUpdated: new Date().toISOString()
          };

          if (kv) {
            await kv.put('app_state', JSON.stringify(updatedState));
            await kv.put('afs_projects', JSON.stringify(configs));
          }
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({
              success: true,
              afs_projects: configs,
              projects: configs,
              total: configs.length,
              state: updatedState
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
            const raw = await kv.get('app_state');
            if (raw) currentState = JSON.parse(raw);
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
          if (kv) await kv.put('app_state', JSON.stringify(updatedState));
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ success: true, projectConfigs: configs, state: updatedState }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        } catch (err: any) {
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
            const raw = await kv.get('app_state');
            if (raw) currentState = JSON.parse(raw);
          }

          const targetName = (body.project || '').trim().toUpperCase();
          const targetSite = (body.site || '').trim().toUpperCase();
          const targetYear = body.year ? String(body.year).trim() : '';
          const targetKey = body.id || `${targetName}|${targetSite}${targetYear ? `|${targetYear}` : ''}`;

          let configs = Array.isArray(currentState.projectConfigs) ? [...currentState.projectConfigs] : [];
          configs = configs.filter((c: any) => {
            if (body.id && c.id && c.id === body.id) return false;
            const cName = (c.projectName || c.defaultProject || '').trim().toUpperCase();
            const cSite = (c.siteName || c.site || 'HEAD OFFICE').trim().toUpperCase();
            const cYear = c.year ? String(c.year).trim() : '';
            const cKey = c.id || `${cName}|${cSite}${cYear ? `|${cYear}` : ''}`;
            return cKey !== targetKey;
          });

          const updatedState = { ...currentState, projectConfigs: configs, lastUpdated: new Date().toISOString() };
          if (kv) await kv.put('app_state', JSON.stringify(updatedState));
          inMemoryState = updatedState;

          return new Response(
            JSON.stringify({ success: true, projectConfigs: configs, state: updatedState }),
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

