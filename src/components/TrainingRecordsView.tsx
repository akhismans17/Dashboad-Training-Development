import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Users,
  Check,
  X,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { TrainingRecord, ManpowerPerson } from '../types';

interface TrainingRecordsViewProps {
  records: TrainingRecord[];
  mpList: ManpowerPerson[];
  onAddRecord: (payload: {
    program: string;
    tanggal: string;
    status: 'Selesai' | 'Belum Selesai';
    kategori: 'Mandatory' | 'Di Luar Mandatory';
    catatan?: string;
    participants: Array<{ nik: string; nama: string }>;
  }) => Promise<void>;
}

export const TrainingRecordsView: React.FC<TrainingRecordsViewProps> = ({
  records,
  mpList,
  onAddRecord
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form Fields
  const [formProgram, setFormProgram] = useState('');
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'Selesai' | 'Belum Selesai'>('Selesai');
  const [formKategori, setFormKategori] = useState<'Mandatory' | 'Di Luar Mandatory'>('Mandatory');
  const [formCatatan, setFormCatatan] = useState('');
  const [selectedNiks, setSelectedNiks] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Filtered Participants in picker modal
  const eligiblePersons = useMemo(() => {
    return mpList.filter(p => p.nik && p.nik.trim() !== '');
  }, [mpList]);

  const filteredPickerPersons = useMemo(() => {
    if (!participantSearch.trim()) return eligiblePersons;
    const q = participantSearch.toLowerCase();
    return eligiblePersons.filter(
      p => p.nik.toLowerCase().includes(q) || p.nama.toLowerCase().includes(q) || (p.section || '').toLowerCase().includes(q)
    );
  }, [eligiblePersons, participantSearch]);

  // Toggle selection
  const handleTogglePerson = (nik: string) => {
    setSelectedNiks(prev =>
      prev.includes(nik) ? prev.filter(n => n !== nik) : [...prev, nik]
    );
  };

  const handleSelectAllFiltered = () => {
    const currentFilteredNiks = filteredPickerPersons.map(p => p.nik);
    const allSelected = currentFilteredNiks.every(n => selectedNiks.includes(n));
    if (allSelected) {
      setSelectedNiks(prev => prev.filter(n => !currentFilteredNiks.includes(n)));
    } else {
      setSelectedNiks(prev => Array.from(new Set([...prev, ...currentFilteredNiks])));
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProgram.trim()) {
      setFormError('Nama program training wajib diisi.');
      return;
    }
    if (selectedNiks.length === 0) {
      setFormError('Pilih minimal satu peserta training.');
      return;
    }

    const participants = selectedNiks.map(nik => {
      const p = mpList.find(item => item.nik === nik);
      return {
        nik,
        nama: p ? p.nama : 'Unknown'
      };
    });

    try {
      setIsSubmitting(true);
      setFormError('');
      await onAddRecord({
        program: formProgram.trim(),
        tanggal: formTanggal,
        status: formStatus,
        kategori: formKategori,
        catatan: formCatatan.trim(),
        participants
      });

      // Reset form
      setFormProgram('');
      setFormCatatan('');
      setSelectedNiks([]);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan rekam training.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Training Records
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      if (categoryFilter !== 'ALL' && rec.kategori !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false;

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchProg = rec.program.toLowerCase().includes(q);
        const matchNik = rec.nik.toLowerCase().includes(q);
        const matchNama = rec.nama.toLowerCase().includes(q);
        const matchNote = (rec.catatan || '').toLowerCase().includes(q);
        return matchProg || matchNik || matchNama || matchNote;
      }

      return true;
    });
  }, [records, searchTerm, categoryFilter, statusFilter]);

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Add Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Training Records (Database Pelatihan)
            </h2>
            <span className="text-xs font-bold font-mono bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
              {records.length} Entri
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Input program training, tanggal, dan peserta (single / bulk). Jika modul ditemukan di Matrix, status otomatis tersinkronisasi.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Input Pelatihan Baru</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari program, NIK, nama peserta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
          >
            <option value="ALL">Semua Kategori (Mandatory & Luar Mandatory)</option>
            <option value="Mandatory">Hanya Mandatory</option>
            <option value="Di Luar Mandatory">Hanya Di Luar Mandatory</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
          >
            <option value="ALL">Semua Status Penyelesaian</option>
            <option value="Selesai">Selesai</option>
            <option value="Belum Selesai">Belum Selesai</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-600 text-sm">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800">Tidak ada rekam pelatihan yang sesuai</h4>
            <p className="text-xs text-slate-600 mt-1">Gunakan tombol "Input Pelatihan Baru" untuk menambah data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0F1E36] text-white">
                <tr>
                  <th className="py-3 px-3 font-semibold text-center w-12">No</th>
                  <th className="py-3 px-3 font-semibold w-28">NIK</th>
                  <th className="py-3 px-3 font-semibold">Nama</th>
                  <th className="py-3 px-3 font-semibold">Tanggal Mulai training</th>
                  <th className="py-3 px-3 font-semibold">Tanggal selesai training</th>
                  <th className="py-3 px-3 font-semibold">Program Training</th>
                  <th className="py-3 px-3 font-semibold text-center w-32">Status Training</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec, idx) => {
                  const sDate = rec.tanggalMulai || rec.startDate || rec.tanggal;
                  const fDate = rec.tanggalSelesai || rec.finishDate || rec.tanggal;
                  const isDone = rec.status === 'Selesai';
                  return (
                    <tr key={rec.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{rec.nik}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{rec.nama}</td>
                      <td className="py-2.5 px-3 text-slate-700">{sDate}</td>
                      <td className="py-2.5 px-3 text-slate-700">{fDate}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{rec.program}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isDone ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Menampilkan <strong>{filteredRecords.length}</strong> riwayat pelatihan</span>
          <span className="italic">Tersimpan di sheet "Training Database" Google Spreadsheet.</span>
        </div>
      </div>

      {/* Input Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                <span>Input Rekam Pelatihan (Training Records)</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Program / Judul Training <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: K3 & Keselamatan Operasi KA / Workshop AI Tools"
                  value={formProgram}
                  onChange={(e) => setFormProgram(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Pelatihan
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Mandatory">Mandatory</option>
                    <option value="Di Luar Mandatory">Di Luar Mandatory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Pelaksanaan
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Selesai">Selesai (Kompeten)</option>
                    <option value="Belum Selesai">Belum Selesai</option>
                  </select>
                </div>
              </div>

              {/* Participant Selection Strip */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>Pilih Peserta Pelatihan ({selectedNiks.length} Terpilih)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-600">Dapat memilih satu atau banyak personel sekaligus</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer self-start sm:self-auto"
                  >
                    Pilih Semua ({filteredPickerPersons.length})
                  </button>
                </div>

                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Saring peserta berdasarkan NIK, nama, section..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                  {filteredPickerPersons.map((p) => {
                    const isSelected = selectedNiks.includes(p.nik);
                    return (
                      <div
                        key={p.nik}
                        onClick={() => handleTogglePerson(p.nik)}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50/60 font-semibold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="font-mono text-slate-600">{p.nik}</span>
                          <span className="text-slate-900 truncate">{p.nama}</span>
                        </div>
                        <span className="text-[11px] text-slate-600 shrink-0">{p.section}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Evaluasi Training
                </label>
                <textarea
                  rows={2}
                  placeholder="misal: Lulus sertifikasi dengan nilai 90, penyelenggara Ditjenka..."
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
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
                    <span>Menyimpan ke Database...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan ({selectedNiks.length} Peserta)</span>
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
