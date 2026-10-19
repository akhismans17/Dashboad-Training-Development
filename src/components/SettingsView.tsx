import React, { useState } from 'react';
import {
  Settings,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  FileCode,
  ShieldAlert,
  Save,
  Check,
  RotateCcw
} from 'lucide-react';
import { ConnectionStatus } from '../types';

interface SettingsViewProps {
  connectionStatus: ConnectionStatus;
  onSaveUrl: (url: string) => Promise<void>;
  onTestConnection: (url: string) => Promise<void>;
  onSetupTemplate: () => Promise<void>;
  onResetToDemo: () => void;
  isTestingConnection: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  connectionStatus,
  onSaveUrl,
  onTestConnection,
  onSetupTemplate,
  onResetToDemo,
  isTestingConnection
}) => {
  const [urlInput, setUrlInput] = useState(connectionStatus.appScriptUrl || '');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    await onSaveUrl(urlInput);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTest = async () => {
    await onTestConnection(urlInput);
  };

  const handleTemplate = async () => {
    if (!connectionStatus.isConnected) {
      alert('Harap tes dan pastikan koneksi ke Google Apps Script berhasil terlebih dahulu.');
      return;
    }
    const confirmSetup = window.confirm(
      'Apakah Anda ingin menyiapkan struktur lembar kerja (Data MP, Training Database, Matrix MP, Matrix Staff, Mandatory Training Database) di Google Spreadsheet Anda?'
    );
    if (!confirmSetup) return;

    try {
      setIsSettingUp(true);
      await onSetupTemplate();
    } finally {
      setIsSettingUp(false);
    }
  };

  const copyScriptGuide = () => {
    navigator.clipboard.writeText(`// Silakan buka file Code.gs pada repositori proyek ini, atau salin seluruh isi Code.gs ke Google Apps Script Anda.`);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          <span>Pengaturan & Integrasi Google Sheets</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Hubungkan frontend KAI GAM ke database Google Spreadsheet menggunakan Google Apps Script Web App (JSONP).
        </p>
      </div>

      {/* Live Status Card */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          connectionStatus.isConnected
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs'
            : 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl text-white shrink-0 mt-0.5 ${
                connectionStatus.isConnected ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            >
              {connectionStatus.isConnected ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80">
                  {connectionStatus.isConnected ? 'TERHUBUNG (CONNECTED)' : 'MODE DEMO (DISCONNECTED)'}
                </span>
                {connectionStatus.lastTestedAt && (
                  <span className="text-xs text-slate-600">
                    Diuji pukul {connectionStatus.lastTestedAt}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold mt-1">
                {connectionStatus.isConnected
                  ? `Berhasil tersambung ke: ${connectionStatus.spreadsheetName || 'Google Spreadsheet'}`
                  : 'Aplikasi belum terhubung ke Google Apps Script'}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-90 max-w-xl">
                {connectionStatus.isConnected
                  ? 'Data yang ditampilkan dan disimpan secara langsung disinkronkan ke Google Sheets aktual Anda.'
                  : 'Saat ini aplikasi menampilkan data simulasi contoh (Bukan data riil). Masukkan URL Web App di bawah ini untuk menghubungkan.'}
              </p>
            </div>
          </div>

          {connectionStatus.isConnected && (
            <button
              onClick={onResetToDemo}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Putuskan & Kembali ke Demo</span>
            </button>
          )}
        </div>

        {connectionStatus.errorMessage && (
          <div className="mt-4 p-3 bg-rose-100/80 border border-rose-300 text-rose-900 rounded-xl text-xs font-mono">
            <strong>Keterangan Kegagalan:</strong> {connectionStatus.errorMessage}
          </div>
        )}
      </div>

      {/* URL Configuration Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Konfigurasi URL Google Apps Script Web App</span>
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Pastikan URL berakhiran <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-700">/exec</code> dan deployment diset dengan akses <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">Anyone</code>.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Web App URL (/exec)
            </label>
            <input
              type="url"
              required
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan URL</span>
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={isTestingConnection || !urlInput.trim()}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isTestingConnection ? 'Menguji Koneksi...' : 'Tes Koneksi'}</span>
            </button>

            {connectionStatus.isConnected && (
              <button
                type="button"
                onClick={handleTemplate}
                disabled={isSettingUp}
                className="px-4 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer ml-auto"
              >
                <FileCode className="w-4 h-4" />
                <span>{isSettingUp ? 'Menyiapkan Template...' : 'Buat / Cek Template Sheet Otomatis'}</span>
              </button>
            )}
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>URL berhasil disimpan ke penyimpanan lokal aplikasi.</span>
            </div>
          )}
        </form>
      </div>

      {/* Guide & Setup Instructions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Petunjuk Pemasangan Google Apps Script (Code.gs)
            </h3>
          </div>
          <button
            onClick={copyScriptGuide}
            className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copySuccess ? 'Disalin!' : 'Salin Info'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              1
            </div>
            <h4 className="font-bold text-slate-900 pt-1">Buka Google Sheets</h4>
            <p className="text-slate-600 leading-relaxed">
              Buat spreadsheet baru atau gunakan spreadsheet KAI GAM Anda. Masuk ke menu <strong>Extensions &gt; Apps Script</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              2
            </div>
            <h4 className="font-bold text-slate-900 pt-1">Paste Kode Code.gs</h4>
            <p className="text-slate-600 leading-relaxed">
              Salin kode dari file <code>Code.gs</code> yang telah disertakan di root project ini, lalu paste ke editor Apps Script dan klik Save.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              3
            </div>
            <h4 className="font-bold text-slate-900 pt-1">Deploy sebagai Web App</h4>
            <p className="text-slate-600 leading-relaxed">
              Klik <strong>Deploy &gt; New deployment &gt; Web app</strong>. Atur <em>Execute as: Me</em> dan <em>Who has access: Anyone</em>. Salin URL <code>/exec</code> ke form di atas.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            Nama sheet yang digunakan oleh backend: <code>Data MP</code>, <code>Training Database</code>, <code>Matrix MP</code>, <code>Matrix Staff</code>, dan <code>Mandatory Training Database</code>.
          </span>
          <span className="font-bold text-blue-700 font-mono text-[11px]">JSONP Protocol Active</span>
        </div>
      </div>
    </div>
  );
};
