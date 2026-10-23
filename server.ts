import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const CONFIG_FILE = path.join(__dirname, 'server_config.json');
const DATA_FILE = path.join(__dirname, 'server_data.json');

// Helper to read JSON file safely
function readJsonFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultVal;
}

// Helper to write JSON file safely
function writeJsonFile(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Ensure default config file exists
interface ServerConfig {
  gasUrl: string;
  spreadsheetName?: string;
  lastConnected?: string;
  autoSync?: boolean;
}

interface ServerData {
  data?: any;
  history?: any[];
  lastSync?: string;
  updatedBy?: string;
}

// --- API ROUTES ---

// 1. Get current server configuration (shared across all devices)
app.get('/api/config', (req, res) => {
  const config = readJsonFile<ServerConfig>(CONFIG_FILE, {
    gasUrl: '',
    spreadsheetName: 'KAI GAM Spreadsheet',
    autoSync: true
  });
  res.json({
    ok: true,
    config
  });
});

// 2. Save server configuration (shared across all devices)
app.post('/api/config', (req, res) => {
  const { gasUrl, spreadsheetName, lastConnected } = req.body || {};
  const current = readJsonFile<ServerConfig>(CONFIG_FILE, {
    gasUrl: '',
    autoSync: true
  });

  const updated: ServerConfig = {
    ...current,
    gasUrl: typeof gasUrl === 'string' ? gasUrl.trim() : current.gasUrl,
    spreadsheetName: spreadsheetName || current.spreadsheetName || 'KAI GAM Spreadsheet',
    lastConnected: lastConnected || new Date().toISOString(),
    autoSync: true
  };

  writeJsonFile(CONFIG_FILE, updated);

  res.json({
    ok: true,
    message: 'Konfigurasi Google Sheets berhasil disimpan di server (tersedia untuk semua device).',
    config: updated
  });
});

// 3. Get shared application data (manpower, mandatory, schedule training)
app.get('/api/shared-data', (req, res) => {
  const shared = readJsonFile<ServerData>(DATA_FILE, {});
  const config = readJsonFile<ServerConfig>(CONFIG_FILE, { gasUrl: '' });
  res.json({
    ok: true,
    gasUrl: config.gasUrl || '',
    sharedData: shared
  });
});

// 4. Save shared application data (called when user imports Excel, updates schedules or syncs)
app.post('/api/shared-data', (req, res) => {
  const { data, history, updatedBy } = req.body || {};
  const current = readJsonFile<ServerData>(DATA_FILE, {});

  const updated: ServerData = {
    ...current,
    data: data !== undefined ? data : current.data,
    history: history !== undefined ? history : current.history,
    lastSync: new Date().toISOString(),
    updatedBy: updatedBy || 'web-client'
  };

  writeJsonFile(DATA_FILE, updated);

  res.json({
    ok: true,
    message: 'Data bersama (Mandatory & Schedule Training) berhasil disimpan secara permanen.',
    lastSync: updated.lastSync
  });
});

// 5. Server-side proxy for Google Apps Script (handles CORS and direct fetch if client-side JSONP fails)
app.all('/api/proxy-gas', async (req, res) => {
  const targetUrl = (req.query.url as string) || (req.body && req.body.url);
  const action = (req.query.action as string) || (req.body && req.body.action);

  if (!targetUrl) {
    return res.status(400).json({ ok: false, message: 'URL Google Apps Script tidak disertakan.' });
  }

  try {
    const urlObj = new URL(targetUrl);
    if (action) urlObj.searchParams.set('action', action);
    urlObj.searchParams.set('api', '1');

    let fetchOptions: RequestInit = {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    if (req.method === 'POST' && req.body && req.body.payload) {
      fetchOptions.body = JSON.stringify(req.body.payload);
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json'
      };
    }

    const response = await fetch(urlObj.toString(), fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await response.json();
      return res.json(json);
    } else {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
        return res.send(text);
      }
    }
  } catch (err: any) {
    console.error('Proxy GAS error:', err);
    return res.status(500).json({
      ok: false,
      message: `Gagal menghubungi Google Apps Script melalui proxy server: ${err?.message || String(err)}`
    });
  }
});

// Mount Vite or static files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] KAI GAM Manpower & Training System running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Failed to start server:', err);
  process.exit(1);
});
