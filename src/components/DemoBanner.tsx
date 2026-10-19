import React from 'react';
import { AlertTriangle, ArrowRight, Database } from 'lucide-react';

interface DemoBannerProps {
  isConnected: boolean;
  onOpenSettings: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ isConnected, onOpenSettings }) => {
  if (isConnected) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-950 px-4 py-2.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 font-medium">
          <div className="p-1 rounded-md bg-amber-500 text-white shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-900 uppercase tracking-wider mr-2 text-[11px] bg-amber-200/80 px-2 py-0.5 rounded">
              Mode Demo Aktif
            </span>
            <span className="text-amber-900">
              Aplikasi saat ini menampilkan data simulasi lokal KAI GAM (Bukan data aktual dari Google Sheets).
            </span>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition-colors shrink-0 shadow-sm"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Hubungkan Google Sheets</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
