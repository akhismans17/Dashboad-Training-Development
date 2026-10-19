import React, { useMemo } from 'react';
import {
  Users,
  UserCheck,
  AlertTriangle,
  Award,
  Sparkles,
  TrendingUp,
  Briefcase,
  Layers,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { AppData } from '../types';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  data: AppData;
  onNavigate: (tab: NavTab, filter?: string) => void;
}

const GRADE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate }) => {
  // Business Rules Computations:
  // 1. Total MP: Semua baris dengan NIK terisi di sheet MP
  const totalMP = useMemo(() => {
    return data.mpList.filter(p => p.nik && p.nik.trim() !== '').length;
  }, [data.mpList]);

  // 2. MP Aktif: Baris dengan NIK dan Jabatan terisi
  const mpAktif = useMemo(() => {
    return data.mpList.filter(p => p.nik && p.nik.trim() !== '' && p.jabatan && p.jabatan.trim() !== '').length;
  }, [data.mpList]);

  // 3. Jabatan Kosong / Perlu Verifikasi: NIK terisi namun Jabatan kosong
  const jabatanKosong = useMemo(() => {
    return data.mpList.filter(p => p.nik && p.nik.trim() !== '' && (!p.jabatan || p.jabatan.trim() === '')).length;
  }, [data.mpList]);

  // 4. ACH Mandatory: Dihitung HANYA dari modul yang benar-benar ditugaskan pada Mandatory Training Database
  const mandatoryStats = useMemo(() => {
    const assignments = data.mandatoryAssignments || [];
    const totalAssigned = assignments.length;
    const totalDone = assignments.filter(m => m.status === 'Done').length;
    const percent = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;

    // Breakdown MP vs Staff
    const mpAssignments = assignments.filter(m => m.targetDb === 'MP');
    const mpDone = mpAssignments.filter(m => m.status === 'Done').length;
    const mpPercent = mpAssignments.length > 0 ? Math.round((mpDone / mpAssignments.length) * 100) : 0;

    const staffAssignments = assignments.filter(m => m.targetDb === 'Staff');
    const staffDone = staffAssignments.filter(m => m.status === 'Done').length;
    const staffPercent = staffAssignments.length > 0 ? Math.round((staffDone / staffAssignments.length) * 100) : 0;

    return {
      totalAssigned,
      totalDone,
      percent,
      mpAssigned: mpAssignments.length,
      mpDone,
      mpPercent,
      staffAssigned: staffAssignments.length,
      staffDone,
      staffPercent
    };
  }, [data.mandatoryAssignments]);

  // 5. Training di luar mandatory: dicatat pada Training Database tapi tidak masuk ACH mandatory
  const trainingLuarMandatoryStats = useMemo(() => {
    const list = data.trainingRecords.filter(t => t.kategori === 'Di Luar Mandatory');
    const completed = list.filter(t => t.status === 'Selesai');
    return {
      total: list.length,
      completed: completed.length
    };
  }, [data.trainingRecords]);

  // 6. Section Distribution
  const sectionChartData = useMemo(() => {
    const counts: Record<string, { total: number; active: number; unassigned: number }> = {};
    data.mpList.forEach(p => {
      const sec = p.section?.trim() || 'Tanpa Section';
      if (!counts[sec]) {
        counts[sec] = { total: 0, active: 0, unassigned: 0 };
      }
      counts[sec].total += 1;
      if (p.jabatan && p.jabatan.trim() !== '') {
        counts[sec].active += 1;
      } else {
        counts[sec].unassigned += 1;
      }
    });

    return Object.entries(counts).map(([name, val]) => ({
      name,
      total: val.total,
      active: val.active,
      unassigned: val.unassigned,
      rate: val.total > 0 ? Math.round((val.active / val.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [data.mpList]);

  // 7. Grade Composition
  const gradeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.mpList.forEach(p => {
      const g = p.grade?.trim() || 'Belum Ditentukan';
      counts[g] = (counts[g] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [data.mpList]);

  // 8. Recent Trainings (Last 6 entries)
  const recentTrainings = useMemo(() => {
    return [...data.trainingRecords]
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
      .slice(0, 6);
  }, [data.trainingRecords]);

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Executive Welcome & Header Presentation Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0F1E36] via-[#1E3A8A] to-[#1E293B] text-white p-6 rounded-2xl shadow-lg border border-slate-700/60">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-md border border-amber-400/20 mb-2">
            <span>Executive Dashboard</span>
            <span>·</span>
            <span>Unit Sarana & Operasi GAM</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Ringkasan Kesiapan Manpower & Program Pelatihan
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Monitoring komprehensif pemenuhan kompetensi wajib (Mandatory), komposisi struktur personel, dan rekam jejak pengembangan keahlian teknis KAI GAM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('records')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Catat Pelatihan Baru</span>
          </button>
          <button
            onClick={() => onNavigate('matrix')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lihat Training Matrix</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Total MP */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Manpower (MP)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">{totalMP}</span>
            <span className="text-xs text-slate-600">Personel terdaftar</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Dihitung dari NIK terisi di sheet MP</span>
            <button
              onClick={() => onNavigate('manpower')}
              className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Detail</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: MP Aktif */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">MP Aktif Bertugas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono tabular-nums">{mpAktif}</span>
            <span className="text-xs text-slate-600">
              ({totalMP > 0 ? Math.round((mpAktif / totalMP) * 100) : 0}% rasio aktif)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>NIK & Jabatan terverifikasi</span>
            <span className="text-emerald-700 font-medium">Valid Terisi</span>
          </div>
        </div>

        {/* KPI 3: Jabatan Kosong / Perlu Verifikasi */}
        <div
          onClick={() => onNavigate('manpower', 'unassigned')}
          className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Jabatan Kosong / Verifikasi</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 font-mono tabular-nums">{jabatanKosong}</span>
            <span className="text-xs text-amber-800">Perlu tindak lanjut</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">NIK ada tapi jabatan kosong</span>
            <span className="text-amber-800 font-semibold group-hover:underline inline-flex items-center gap-0.5">
              <span>Filter Data</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* KPI 4: ACH Mandatory */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">ACH Mandatory KAI</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600 font-mono tabular-nums">
              {mandatoryStats.percent}%
            </span>
            <span className="text-xs text-slate-600">
              ({mandatoryStats.totalDone}/{mandatoryStats.totalAssigned} Modul)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Hanya penugasan wajib di Mandatory DB</span>
            <span className="font-semibold text-indigo-600">{mandatoryStats.totalDone} Selesai</span>
          </div>
        </div>
      </div>

      {/* Progress Breakdown Row (Mandatory MP vs Staff & Training Di Luar Mandatory) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card: Progres Mandatory MP */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mandatory Manpower (MP)</h3>
              <p className="text-xs text-slate-600">Kualifikasi teknis operasional lapangan</p>
            </div>
            <span className="text-xs font-bold font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {mandatoryStats.mpPercent}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${mandatoryStats.mpPercent}%` }}
            ></div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <span>Tercapai: <strong className="text-slate-800">{mandatoryStats.mpDone}</strong> modul</span>
            <span>Total Ditugaskan: <strong className="text-slate-800">{mandatoryStats.mpAssigned}</strong></span>
          </div>
        </div>

        {/* Card: Progres Mandatory Training Staff */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mandatory Training Staff</h3>
              <p className="text-xs text-slate-600">Kualifikasi manajerial & kepatuhan mutu</p>
            </div>
            <span className="text-xs font-bold font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
              {mandatoryStats.staffPercent}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${mandatoryStats.staffPercent}%` }}
            ></div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <span>Tercapai: <strong className="text-slate-800">{mandatoryStats.staffDone}</strong> modul</span>
            <span>Total Ditugaskan: <strong className="text-slate-800">{mandatoryStats.staffAssigned}</strong></span>
          </div>
        </div>

        {/* Card: ACH Training Di Luar Mandatory */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Training di Luar Mandatory</h3>
              <p className="text-xs text-slate-600">Inisiatif pengembangan & keahlian mandiri</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-600 font-mono tabular-nums">
              {trainingLuarMandatoryStats.completed}
            </span>
            <span className="text-xs text-slate-600">
              dari {trainingLuarMandatoryStats.total} program terlaksana
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
            Tercatat pada Training Database dan tidak mempengaruhi persentase ACH Mandatory.
          </p>
        </div>
      </div>

      {/* Charts Section: Section Distribution & Grade Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribusi Section (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Distribusi Personel per Section KAI GAM</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Perbandingan jumlah personel aktif bertugas dan personel yang memerlukan verifikasi
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded bg-blue-600"></span>
                <span>Aktif</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded bg-amber-400"></span>
                <span>Perlu Verifikasi</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={sectionChartData}
                margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#10B981' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (name === '% Kelengkapan') return [`${val}%`, name];
                    return [`${val} Personel`, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#0F1E36',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none'
                  }}
                />
                <Bar yAxisId="left" dataKey="active" name="Aktif" fill="#2563EB" stackId="a" radius={[0, 0, 4, 4]} />
                <Bar yAxisId="left" dataKey="unassigned" name="Perlu Verifikasi" fill="#F59E0B" stackId="a" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="% Kelengkapan" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Komposisi Grade (1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Komposisi Grade Personel</h3>
              <p className="text-xs text-slate-600 mt-0.5">Proporsi jenjang karir dalam struktur GAM</p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {gradeChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={GRADE_COLORS[index % GRADE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Orang`, '']}
                    contentStyle={{
                      backgroundColor: '#0F1E36',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-700">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Total Kategori Grade</span>
            <span className="font-semibold text-slate-800 font-mono">{gradeChartData.length} Kategori</span>
          </div>
        </div>
      </div>

      {/* Recent Training Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Riwayat Pelatihan Terkini</h3>
          </div>
          <button
            onClick={() => onNavigate('records')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Semua Riwayat</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTrainings.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">
            Belum ada riwayat training yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Tanggal</th>
                  <th className="py-3 px-4">Program Training</th>
                  <th className="py-3 px-4">Peserta (NIK - Nama)</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentTrainings.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5 font-mono text-slate-600 whitespace-nowrap">
                      {rec.tanggal || '-'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                      {rec.program}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-slate-600 mr-2">{rec.nik}</span>
                      <span className="text-slate-800">{rec.nama}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          rec.kategori === 'Mandatory'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {rec.kategori}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          rec.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right text-slate-600 truncate max-w-xs">
                      {rec.catatan || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
