import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Edit2,
  Trash2,
  AlertTriangle,
  UserCheck,
  X,
  Check
} from 'lucide-react';
import { ManpowerPerson } from '../types';

interface ManpowerViewProps {
  mpList: ManpowerPerson[];
  initialFilter?: string;
  onSavePerson: (person: ManpowerPerson) => Promise<void>;
  onDeletePerson: (nik: string) => Promise<void>;
}

export const ManpowerView: React.FC<ManpowerViewProps> = ({
  mpList,
  initialFilter = '',
  onSavePerson,
  onDeletePerson
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>(
    initialFilter === 'unassigned' ? 'UNASSIGNED' : 'ALL'
  );

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ManpowerPerson | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmNik, setDeleteConfirmNik] = useState<string | null>(null);

  // Form State
  const [formNik, setFormNik] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJabatan, setFormJabatan] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formStatusPegawai, setFormStatusPegawai] = useState('Aktif');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formError, setFormError] = useState('');

  // Extract unique sections and grades
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    mpList.forEach(p => {
      if (p.section && p.section.trim()) set.add(p.section.trim());
    });
    return Array.from(set).sort();
  }, [mpList]);

  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    mpList.forEach(p => {
      if (p.grade && p.grade.trim()) set.add(p.grade.trim());
    });
    return Array.from(set).sort();
  }, [mpList]);

  // Total MP: Jumlah baris dengan NIK terisi di sheet MP
  const totalMP = useMemo(() => {
    return mpList.filter(p => p.nik && p.nik.trim() !== '').length;
  }, [mpList]);

  const mpAktifCount = useMemo(() => {
    return mpList.filter(p => p.nik && p.nik.trim() !== '' && p.jabatan && p.jabatan.trim() !== '').length;
  }, [mpList]);

  const unassignedCount = useMemo(() => {
    return mpList.filter(p => p.nik && p.nik.trim() !== '' && (!p.jabatan || p.jabatan.trim() === '')).length;
  }, [mpList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return mpList.filter(p => {
      // Must have NIK
      if (!p.nik || p.nik.trim() === '') return false;

      // Status Filter
      if (statusFilter === 'ACTIVE') {
        if (!p.jabatan || p.jabatan.trim() === '') return false;
      } else if (statusFilter === 'UNASSIGNED') {
        if (p.jabatan && p.jabatan.trim() !== '') return false;
      }

      // Section Filter
      if (sectionFilter !== 'ALL' && p.section !== sectionFilter) {
        return false;
      }

      // Grade Filter
      if (gradeFilter !== 'ALL' && p.grade !== gradeFilter) {
        return false;
      }

      // Search Term
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchNik = p.nik.toLowerCase().includes(query);
        const matchNama = p.nama.toLowerCase().includes(query);
        const matchJabatan = (p.jabatan || '').toLowerCase().includes(query);
        const matchSection = (p.section || '').toLowerCase().includes(query);
        return matchNik || matchNama || matchJabatan || matchSection;
      }

      return true;
    });
  }, [mpList, searchTerm, sectionFilter, gradeFilter, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingPerson(null);
    setFormNik('');
    setFormNama('');
    setFormJabatan('');
    setFormSection(uniqueSections[0] || 'Sarana & Lokomotif');
    setFormGrade(uniqueGrades[0] || 'Grade 1');
    setFormStatusPegawai('Aktif');
    setFormKeterangan('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (person: ManpowerPerson) => {
    setEditingPerson(person);
    setFormNik(person.nik);
    setFormNama(person.nama);
    setFormJabatan(person.jabatan || '');
    setFormSection(person.section || '');
    setFormGrade(person.grade || '');
    setFormStatusPegawai(person.statusPegawai || 'Aktif');
    setFormKeterangan(person.keterangan || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNik.trim()) {
      setFormError('Nomor Induk Karyawan (NIK) wajib diisi.');
      return;
    }
    if (!formNama.trim()) {
      setFormError('Nama lengkap personel wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await onSavePerson({
        nik: formNik.trim(),
        nama: formNama.trim(),
        jabatan: formJabatan.trim(),
        section: formSection.trim(),
        grade: formGrade.trim(),
        statusPegawai: formStatusPegawai.trim(),
        keterangan: formKeterangan.trim()
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (nik: string) => {
    try {
      await onDeletePerson(nik);
      setDeleteConfirmNik(null);
    } catch (err: any) {
      alert(`Gagal menghapus personel: ${err.message}`);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['NIK', 'Nama Lengkap', 'Jabatan', 'Section', 'Grade', 'Status Verifikasi', 'Keterangan'];
    const rows = filteredList.map(p => [
      `"${p.nik}"`,
      `"${p.nama}"`,
      `"${p.jabatan || ''}"`,
      `"${p.section || ''}"`,
      `"${p.grade || ''}"`,
      `"${p.jabatan ? 'Aktif' : 'Perlu Verifikasi'}"`,
      `"${p.keterangan || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KAI_GAM_Manpower_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Direktori Data Manpower (MP)
            </h2>
            <span className="text-xs font-bold font-mono bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
              {totalMP} Personel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Total MP dihitung dari seluruh baris dengan NIK terisi pada Google Sheet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Personel MP</span>
          </button>
        </div>
      </div>

      {/* Filter and Summary Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari NIK, Nama, Jabatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-700 font-medium"
            >
              <option value="ALL">Semua Section ({uniqueSections.length})</option>
              {uniqueSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-700 font-medium"
            >
              <option value="ALL">Semua Grade</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status Quick Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({totalMP})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktif ({mpAktifCount})
            </button>
            <button
              onClick={() => setStatusFilter('UNASSIGNED')}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'UNASSIGNED'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verif ({unassignedCount})
            </button>
          </div>
        </div>

        {/* Info Banner when filter is active */}
        {statusFilter === 'UNASSIGNED' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Menampilkan <strong>{filteredList.length} personel</strong> dengan jabatan kosong yang memerlukan verifikasi/SK penugasan.
              </span>
            </div>
            <button
              onClick={() => setStatusFilter('ALL')}
              className="font-semibold text-amber-800 hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">Tidak ada data personel yang cocok</h4>
            <p className="text-xs text-slate-600 mt-1">Coba sesuaikan kata kunci pencarian atau reset filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">NIK</th>
                  <th className="py-3 px-5">Nama Lengkap</th>
                  <th className="py-3 px-5">Jabatan</th>
                  <th className="py-3 px-5">Section</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Status Verifikasi</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredList.map((person) => {
                  const hasJabatan = Boolean(person.jabatan && person.jabatan.trim());
                  return (
                    <tr key={person.nik} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-900 font-semibold whitespace-nowrap">
                        {person.nik}
                      </td>
                      <td className="py-3.5 px-5 text-slate-900 font-bold whitespace-nowrap">
                        {person.nama}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {hasJabatan ? (
                          <span className="text-slate-800 font-medium">{person.jabatan}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Jabatan Kosong</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        {person.section || '-'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          {person.grade || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasJabatan ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span>MP Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <span>Perlu Verifikasi</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(person)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Personel"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmNik === person.nik ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                              <button
                                onClick={() => handleDelete(person.nik)}
                                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                onClick={() => setDeleteConfirmNik(null)}
                                className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmNik(person.nik)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Personel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Menampilkan <strong>{filteredList.length}</strong> dari <strong>{totalMP}</strong> Total Manpower</span>
          <span className="italic">Sesuai aturan bisnis: baris dengan NIK terisi dihitung penuh ke Total MP.</span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">
                {editingPerson ? 'Perbarui Data Personel MP' : 'Tambah Personel Manpower Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIK <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingPerson)}
                    placeholder="misal: KAI-20121"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Grade
                  </label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Grade 1">Grade 1 (Pelaksana)</option>
                    <option value="Grade 2">Grade 2 (Teknisi Madya)</option>
                    <option value="Grade 3">Grade 3 (Supervisor)</option>
                    <option value="Grade 4">Grade 4 (Manager / Specialist)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama sesuai SK kepegawaian"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jabatan</span>
                  <span className="text-[11px] font-normal text-slate-600">Kosongkan jika menunggu SK</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Teknisi Sintelis Senior (atau kosongkan)"
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Section Unit
                  </label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Sarana & Lokomotif">Sarana & Lokomotif</option>
                    <option value="Sintelis">Sintelis (Sinyal & Listrik)</option>
                    <option value="Jalan Rel & Jembatan">Jalan Rel & Jembatan</option>
                    <option value="Operasi Perjalanan KA">Operasi Perjalanan KA</option>
                    <option value="Quality & Safety GAM">Quality & Safety GAM</option>
                    <option value="Pengadaan & Logistik">Pengadaan & Logistik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Pegawai
                  </label>
                  <select
                    value={formStatusPegawai}
                    onChange={(e) => setFormStatusPegawai(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Mutasi">Mutasi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Catatan Verifikasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan status verifikasi, nomor surat keputusan, dll."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingPerson ? 'Perbarui Personel' : 'Simpan Personel'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
