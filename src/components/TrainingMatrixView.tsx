import React, { useState, useMemo } from 'react';
import {
  Grid3X3,
  Search,
  Filter,
  Check,
  Info,
  Loader2,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { MatrixData } from '../types';

interface TrainingMatrixViewProps {
  matrixMP: MatrixData;
  matrixStaff: MatrixData;
  onUpdateCell: (targetDb: 'MP' | 'Staff', nik: string, modul: string, newStatus: string) => Promise<void>;
}

export const TrainingMatrixView: React.FC<TrainingMatrixViewProps> = ({
  matrixMP,
  matrixStaff,
  onUpdateCell
}) => {
  const [activeTab, setActiveTab] = useState<'MP' | 'Staff'>('MP');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [updatingCellKey, setUpdatingCellKey] = useState<string | null>(null);

  const currentMatrix = activeTab === 'MP' ? matrixMP : matrixStaff;

  // Extract modules (columns beyond NIK, Nama, Jabatan, Section)
  const baseHeaders = ['NIK', 'Nama', 'Jabatan', 'Section'];
  const moduleHeaders = useMemo(() => {
    return (currentMatrix.headers || []).filter(
      h => !baseHeaders.some(b => b.toLowerCase() === h.trim().toLowerCase())
    );
  }, [currentMatrix.headers]);

  // Extract unique sections
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    currentMatrix.rows.forEach(r => {
      const sec = r.Section || r.section;
      if (sec && sec.trim()) set.add(sec.trim());
    });
    return Array.from(set).sort();
  }, [currentMatrix.rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return currentMatrix.rows.filter(row => {
      const nik = row.NIK || row.nik || '';
      const nama = row.Nama || row.nama || '';
      const section = row.Section || row.section || '';

      if (sectionFilter !== 'ALL' && section !== sectionFilter) {
        return false;
      }

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchNik = nik.toLowerCase().includes(q);
        const matchNama = nama.toLowerCase().includes(q);
        return matchNik || matchNama;
      }

      return true;
    });
  }, [currentMatrix.rows, searchTerm, sectionFilter]);

  // Module completion stats
  const moduleStats = useMemo(() => {
    const stats: Record<string, { done: number; total: number }> = {};
    moduleHeaders.forEach(mod => {
      let done = 0;
      filteredRows.forEach(row => {
        const val = row[mod] || '';
        if (val === 'Done' || val === '✓' || val.toLowerCase() === 'selesai') {
          done++;
        }
      });
      stats[mod] = { done, total: filteredRows.length };
    });
    return stats;
  }, [moduleHeaders, filteredRows]);

  const handleCellClick = async (nik: string, modul: string, currentVal: string) => {
    const cellKey = `${activeTab}_${nik}_${modul}`;
    if (updatingCellKey === cellKey) return;

    const isCurrentlyDone = currentVal === 'Done' || currentVal === '✓' || currentVal.toLowerCase() === 'selesai';
    const nextStatus = isCurrentlyDone ? '' : 'Done';

    try {
      setUpdatingCellKey(cellKey);
      await onUpdateCell(activeTab, nik, modul, nextStatus);
    } catch (err: any) {
      alert(`Gagal memperbarui status matrix: ${err.message}`);
    } finally {
      setUpdatingCellKey(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* View Header & Database Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Training Matrix KAI GAM
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Checklist Kompetensi
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Status pemenuhan modul pelatihan per personel. Klik kotak status untuk memperbarui ke Google Sheets.
          </p>
        </div>

        {/* Database Switcher Tab */}
        <div className="inline-flex rounded-xl bg-slate-200/80 p-1 shrink-0">
          <button
            onClick={() => setActiveTab('MP')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'MP'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Database MP ({matrixMP.rows.length} Personel)
          </button>
          <button
            onClick={() => setActiveTab('Staff')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'Staff'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Database Training Staff ({matrixStaff.rows.length} Personel)
          </button>
        </div>
      </div>

      {/* Business Rule Banner */}
      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-blue-950">Aturan Penggunaan Training Matrix:</strong>{' '}
          Matrix ini adalah status checklist rekam jejak kompetensi personel di KAI GAM. Tidak setiap kolom dianggap sebagai kewajiban seluruh personel; kewajiban spesifik dikelola dan dihitung persentasenya pada{' '}
          <strong>Mandatory Training Database</strong>.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan NIK atau Nama di matrix..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="relative w-full sm:w-64">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
          >
            <option value="ALL">Semua Section ({uniqueSections.length})</option>
            {uniqueSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matrix Table with sticky columns */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-600 text-sm">
            Tidak ada baris data matrix yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="bg-[#0F1E36] text-white sticky top-0 z-20 shadow-xs">
                <tr>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider sticky left-0 bg-[#0F1E36] z-30 min-w-[110px] border-r border-slate-700">
                    NIK
                  </th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider sticky left-[110px] bg-[#0F1E36] z-30 min-w-[170px] border-r border-slate-700">
                    Nama Personel
                  </th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider min-w-[150px] border-r border-slate-700">
                    Section
                  </th>
                  {moduleHeaders.map((mod) => {
                    const st = moduleStats[mod] || { done: 0, total: 0 };
                    return (
                      <th
                        key={mod}
                        className="py-3.5 px-3 font-semibold text-center min-w-[140px] max-w-[180px] border-r border-slate-700/80"
                      >
                        <div className="text-[11px] leading-snug truncate" title={mod}>
                          {mod}
                        </div>
                        <div className="mt-1 text-[10px] text-blue-300 font-mono font-normal">
                          {st.done}/{st.total} ({st.total > 0 ? Math.round((st.done / st.total) * 100) : 0}%)
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRows.map((row, idx) => {
                  const nik = row.NIK || row.nik || `ROW-${idx}`;
                  const nama = row.Nama || row.nama || '-';
                  const section = row.Section || row.section || '-';

                  return (
                    <tr key={nik} className="hover:bg-blue-50/40 transition-colors">
                      {/* Sticky NIK */}
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-blue-50/40 z-10 border-r border-slate-200 whitespace-nowrap">
                        {nik}
                      </td>
                      {/* Sticky Nama */}
                      <td className="py-2.5 px-4 font-bold text-slate-900 sticky left-[110px] bg-white group-hover:bg-blue-50/40 z-10 border-r border-slate-200 whitespace-nowrap">
                        {nama}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {section}
                      </td>

                      {/* Interactive Module Cells */}
                      {moduleHeaders.map((mod) => {
                        const cellVal = row[mod] || '';
                        const isDone = cellVal === 'Done' || cellVal === '✓' || cellVal.toLowerCase() === 'selesai';
                        const cellKey = `${activeTab}_${nik}_${mod}`;
                        const isUpdating = updatingCellKey === cellKey;

                        return (
                          <td
                            key={mod}
                            className="py-2 px-2 text-center border-r border-slate-100"
                          >
                            <button
                              onClick={() => handleCellClick(nik, mod, cellVal)}
                              disabled={isUpdating}
                              title={`Klik untuk ubah status: ${mod}`}
                              className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                isUpdating
                                  ? 'bg-slate-100 text-slate-400'
                                  : isDone
                                  ? 'bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200'
                              }`}
                            >
                              {isUpdating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              ) : isDone ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[11px]">Done</span>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-300 hover:text-slate-500">-</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <span>
            Menampilkan <strong>{filteredRows.length}</strong> personel dan <strong>{moduleHeaders.length}</strong> modul kualifikasi.
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700"></span>
              <span>Done (Kompeten)</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span>Belum Selesai</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
