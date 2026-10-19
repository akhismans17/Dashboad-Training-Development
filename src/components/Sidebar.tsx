import React from 'react';
import {
  LayoutDashboard,
  Users,
  Grid3X3,
  ClipboardCheck,
  FileSpreadsheet,
  Settings,
  Train,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type NavTab = 'dashboard' | 'manpower' | 'matrix' | 'records' | 'import' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isConnected: boolean;
  totalMP: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isConnected,
  totalMP
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard Eksekutif', icon: LayoutDashboard },
    { id: 'manpower' as NavTab, label: 'Data Manpower', icon: Users, badge: totalMP },
    { id: 'matrix' as NavTab, label: 'Training Matrix', icon: Grid3X3 },
    { id: 'records' as NavTab, label: 'Training Records', icon: ClipboardCheck },
    { id: 'import' as NavTab, label: 'Mandatory Import', icon: FileSpreadsheet },
    { id: 'settings' as NavTab, label: 'Pengaturan & Koneksi', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0F1E36] text-slate-200 flex flex-col shrink-0 border-r border-slate-800 shadow-xl transition-all duration-300">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-blue-600 to-indigo-900 flex items-center justify-center text-white shadow-md shadow-blue-900/40 border border-amber-400/20 font-black text-sm">
            KAI
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white leading-tight">PT Karunia Armada Indonesia</span>
            </div>
            <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Site GAM · People Dev</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Modul Utama
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono tabular-nums ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection & Footer Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400 font-medium">Status Database:</span>
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Google Sheets</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Simulasi Demo</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Site Ganda Alam Makmur (GAM)
          <br />
          PT Karunia Armada Indonesia
        </p>
      </div>
    </aside>
  );
};
