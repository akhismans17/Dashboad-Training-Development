import React from 'react';
import { RefreshCw, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  isConnected: boolean;
  isSyncing: boolean;
  onRefresh: () => void;
  spreadsheetName?: string;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isConnected,
  isSyncing,
  onRefresh,
  spreadsheetName,
  onOpenSettings
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Eksekutif & Analitik Pelatihan';
      case 'manpower':
        return 'Direktori & Pengelolaan Data Manpower (MP)';
      case 'matrix':
        return 'Matriks Kualifikasi & Status Kompetensi';
      case 'records':
        return 'Pencatatan & Riwayat Training Database';
      case 'import':
        return 'Impor Data & Sinkronisasi Program Mandatory';
      case 'settings':
        return 'Konfigurasi Endpoint & Status Koneksi Apps Script';
      default:
        return 'PT Karunia Armada Indonesia Site GAM';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 z-10 shadow-xs">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 shrink-0">
          PT Karunia Armada Indonesia (Site GAM)
        </span>
        <span className="text-slate-300">/</span>
        <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
          {getBreadcrumbTitle()}
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {isConnected ? (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
            <span className="truncate max-w-[200px]">{spreadsheetName || 'Tersambung ke Google Sheets'}</span>
          </div>
        ) : (
          <button
            onClick={onOpenSettings}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 font-medium transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-amber-700"></span>
            <span>Mode Demo (Klik Konfigurasi)</span>
          </button>
        )}

        {/* Sync / Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          title="Sinkronkan / Refresh Data"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Memperbarui...' : 'Sinkron'}</span>
        </button>

        {/* Presentation / Projector Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Keluar Fullscreen' : 'Mode Presentasi / Fullscreen Proyektor'}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
