/**
 * KAI GAM — Manpower & Training Development
 * Communication Layer with Google Apps Script Web App via JSONP
 */

export type ApiAction =
  | 'ping'
  | 'testConnection'
  | 'getInitialData'
  | 'getDashboard'
  | 'getTrainingHistory'
  | 'saveMP'
  | 'saveTraining'
  | 'saveTrainingResult'
  | 'saveBulkSchedule'
  | 'updateTrainingSession'
  | 'deleteTrainingSession'
  | 'addTrainingModule'
  | 'importMandatoryTraining'
  | string;

export interface GasApiResponse<T = any> {
  ok: boolean;
  data?: T;
  message?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  totalMP?: number;
  totalStaff?: number;
}

export const STORAGE_KEY_URL = 'kaiGamAppsScriptUrl';
export const STORAGE_KEY_URL_ALT = 'kai_gam_apps_script_url';

export function getStoredAppsScriptUrl(): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY_URL) ||
      localStorage.getItem(STORAGE_KEY_URL_ALT) ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function saveStoredAppsScriptUrl(url: string): void {
  const clean = String(url || '').trim();
  try {
    localStorage.setItem(STORAGE_KEY_URL, clean);
    localStorage.setItem(STORAGE_KEY_URL_ALT, clean);
  } catch (err) {
    console.warn('Gagal menyimpan URL Apps Script ke localStorage', err);
  }

  // Also sync to server so other devices get it automatically
  if (clean) {
    saveServerConfig(clean).catch(err => console.warn('Gagal sync config ke server:', err));
  }
}

export function clearStoredAppsScriptUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_URL_ALT);
  } catch (err) {
    console.warn('Gagal menghapus URL Apps Script dari localStorage', err);
  }

  // Also clear on server
  saveServerConfig('').catch(err => console.warn('Gagal reset config server:', err));
}

/**
 * Extracts URL from query parameter if user opened link like ?gas=... or ?api=... or ?url=...
 */
export function extractUrlFromQuery(): string {
  try {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const gas = params.get('gas') || params.get('api') || params.get('url') || '';
    if (gas && gas.trim()) {
      return gas.trim();
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Fetches server-stored Google Apps Script Web App URL (shared for all devices).
 */
export async function fetchServerConfig(): Promise<string> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.config && typeof data.config.gasUrl === 'string') {
        return data.config.gasUrl.trim();
      }
    }
  } catch (err) {
    console.warn('Could not fetch /api/config:', err);
  }
  return '';
}

/**
 * Saves Google Apps Script URL to server storage so that any other device
 * opening the app immediately connects without manual input.
 */
export async function saveServerConfig(gasUrl: string): Promise<boolean> {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl: gasUrl.trim() })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save /api/config:', err);
    return false;
  }
}

/**
 * Fetches shared data cached on server (Manpower, Mandatory Assignments, and Schedule Training).
 */
export async function fetchServerSharedData(): Promise<{
  data?: any;
  history?: any[];
  gasUrl?: string;
  lastSync?: string;
} | null> {
  try {
    const res = await fetch('/api/shared-data');
    if (res.ok) {
      const body = await res.json();
      return {
        gasUrl: body.gasUrl,
        data: body.sharedData?.data,
        history: body.sharedData?.history,
        lastSync: body.sharedData?.lastSync
      };
    }
  } catch (err) {
    console.warn('Could not fetch /api/shared-data:', err);
  }
  return null;
}

/**
 * Saves shared data to server cache so when opening on other devices,
 * schedules and assignments are immediately visible even before fetching from Sheets.
 */
export async function saveServerSharedData(data?: any, history?: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/shared-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, history })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save /api/shared-data:', err);
    return false;
  }
}

/**
 * Generates an auto-connect share link containing the active Google Sheets URL.
 */
export function createShareableLink(gasUrl?: string): string {
  try {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    const target = gasUrl || getStoredAppsScriptUrl();
    if (!target) return base;
    return `${base}?gas=${encodeURIComponent(target)}`;
  } catch {
    return '';
  }
}

/**
 * Normalizes and validates the user-supplied Apps Script Web App URL.
 * Catches common user mistakes (such as pasting spreadsheet link instead of Web App link).
 */
export function normalizeAppsScriptUrl(rawUrl: string): { valid: boolean; url: string; error?: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, url: '', error: 'URL Google Apps Script belum diisi.' };
  }

  // Common user mistake 1: Pasting Google Spreadsheet link
  if (trimmed.includes('docs.google.com/spreadsheets')) {
    return {
      valid: false,
      url: trimmed,
      error:
        'URL yang Anda masukkan adalah tautan Google Spreadsheet, bukan Web App Apps Script. Silakan buka Spreadsheet Anda > Ekstensi (Extensions) > Apps Script > Deploy > New Deployment > Web App, lalu salin URL yang berakhiran /exec.'
    };
  }

  // Common user mistake 2: Pasting Apps Script project editor link
  if (trimmed.includes('script.google.com/home') || (trimmed.includes('script.google.com/d/') && trimmed.includes('/edit'))) {
    return {
      valid: false,
      url: trimmed,
      error:
        'URL yang Anda masukkan adalah tautan editor kode Apps Script. Klik tombol "Deploy" berwarna biru di kanan atas Apps Script > New deployment > Web App (Who has access: Anyone), lalu salin URL Web App yang berakhiran /exec.'
    };
  }

  try {
    const urlObj = new URL(trimmed);

    // Strip pre-existing query parameters and hash
    urlObj.search = '';
    urlObj.hash = '';

    let pathname = urlObj.pathname.replace(/\/+$/, '');

    // If it's a macros/s URL, make sure it ends with /exec or /dev
    if (pathname.includes('/macros/s/') && !pathname.endsWith('/exec') && !pathname.endsWith('/dev')) {
      pathname += '/exec';
    }

    urlObj.pathname = pathname;
    return { valid: true, url: urlObj.toString() };
  } catch {
    return {
      valid: false,
      url: trimmed,
      error: 'Format URL tidak valid. Pastikan dimulai dengan https://script.google.com/macros/s/.../exec'
    };
  }
}

/**
 * Helper to encode object into Base64 WebSafe format accepted by Code.gs:
 * Utilities.base64DecodeWebSafe(params.payload)
 */
function encodeWebSafeBase64(data: unknown): string {
  try {
    const jsonStr = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    console.error('Gagal meng-encode payload base64 websafe', err);
    return '';
  }
}

/**
 * Primary JSONP call function for communicating with Apps Script Web App.
 * Matches `handleApiRequest_(e)` in Code.gs:
 * - api=1
 * - action
 * - callback
 * - payload (base64 websafe)
 */
export function jsonp<T = any>(
  baseUrl: string,
  action: ApiAction,
  payload?: unknown,
  timeoutMs: number = 18000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const normalized = normalizeAppsScriptUrl(baseUrl);
    if (!normalized.valid) {
      return reject(new Error(normalized.error || 'URL Google Apps Script tidak valid.'));
    }

    const targetUrl = normalized.url;
    const callbackName = `__kai_gam_cb_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    let script: HTMLScriptElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      window.removeEventListener('error', windowErrorHandler);
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
        script = null;
      }
      delete (window as any)[callbackName];
    };

    const windowErrorHandler = (event: ErrorEvent) => {
      if (
        event &&
        (event.message?.includes('Unexpected token') ||
          event.filename?.includes('script.google') ||
          event.filename?.includes('script.googleusercontent'))
      ) {
        cleanup();
        reject(
          new Error(
            'Google Apps Script mengembalikan halaman HTML/error (bukan format JSONP). Pastikan: (1) Hak akses Web App diset ke "Who has access: Anyone", (2) File Code.gs tidak memiliki error syntax, dan (3) Buat versi baru (New version) saat deploy.'
          )
        );
      }
    };

    window.addEventListener('error', windowErrorHandler);

    // Register global callback handler
    (window as any)[callbackName] = (response: GasApiResponse<T>) => {
      cleanup();
      if (!response) {
        reject(new Error('Respon kosong dari Google Apps Script.'));
        return;
      }

      if (response.ok) {
        resolve(response.data as T);
      } else {
        reject(
          new Error(
            response.message || 'Permintaan gagal diproses oleh Google Apps Script.'
          )
        );
      }
    };

    try {
      const urlObj = new URL(targetUrl);
      // Query parameters required by Code.gs handleApiRequest_
      urlObj.searchParams.set('api', '1');
      urlObj.searchParams.set('action', action);
      urlObj.searchParams.set('callback', callbackName);
      urlObj.searchParams.set('_t', Date.now().toString());

      if (payload !== undefined && payload !== null) {
        urlObj.searchParams.set('payload', encodeWebSafeBase64(payload));
      }

      script = document.createElement('script');
      script.src = urlObj.toString();
      script.async = true;

      script.onerror = () => {
        cleanup();
        reject(
          new Error(
            'Gagal memuat respon dari Google Apps Script. Pastikan Web App dideploy dengan hak akses "Who has access: Anyone" (Siapa saja) dan URL berakhiran /exec.'
          )
        );
      };

      timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Batas waktu koneksi (${timeoutMs / 1000} detik) habis. Google Apps Script belum merespons. Pastikan URL Apps Script benar, deployment aktif, dan coba klik "Uji Koneksi" lagi.`
          )
        );
      }, timeoutMs);

      document.body.appendChild(script);
    } catch (err: any) {
      cleanup();
      reject(new Error(`Gagal membangun request URL Apps Script: ${err?.message || err}`));
    }
  });
}

/**
 * Dedicated test connection function.
 * Actually invokes getInitialData from Apps Script and checks whether data is received.
 */
export async function testAppsScriptConnection(url: string, timeoutMs: number = 18000): Promise<TestConnectionResult> {
  const normalized = normalizeAppsScriptUrl(url);
  if (!normalized.valid) {
    return {
      success: false,
      message: normalized.error || 'URL tidak valid.',
      error: normalized.error
    };
  }

  try {
    // Attempt fetching getInitialData (verifies action getInitialData, api=1, and sheets readability)
    const data = await jsonp<any>(normalized.url, 'getInitialData', null, timeoutMs);

    if (!data) {
      return {
        success: false,
        message: 'Respon kosong diterima dari Google Apps Script.',
        error: 'Data kosong dari Apps Script.'
      };
    }

    if (!Array.isArray(data.mp)) {
      return {
        success: false,
        message: 'Respon diterima dari Apps Script namun data sheet "MP" tidak valid atau kosong. Pastikan sheet MP tersedia.',
        error: 'Data sheet MP tidak ditemukan dalam respon getInitialData.'
      };
    }

    const totalMP = data.mp.filter((r: any) => {
      const nik = String(r.NIK || r.nik || r['Employee NIK'] || '').trim();
      return nik !== '';
    }).length;

    const totalStaff = Array.isArray(data.training) ? data.training.length : 0;
    const mpModules = Array.isArray(data.mpTrainingHeaders) ? data.mpTrainingHeaders.length : 0;
    const staffModules = Array.isArray(data.trainingMatrixHeaders) ? data.trainingMatrixHeaders.length : 0;

    return {
      success: true,
      message: `Koneksi berhasil! Terhubung ke Google Spreadsheet KAI GAM (${totalMP} baris MP terdaftar, ${totalStaff} staf, ${mpModules} modul MP, ${staffModules} modul staf).`,
      data,
      totalMP,
      totalStaff
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || 'Gagal terhubung ke Google Apps Script.';
    return {
      success: false,
      message: errorMsg,
      error: errorMsg
    };
  }
}

// Backward compatibility export
export const callGasJsonp = jsonp;
