import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Info,
  Layers,
  ArrowRight,
  Check,
  Search,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MandatoryAssignment } from '../types';

interface MandatoryImportViewProps {
  mandatoryAssignments: MandatoryAssignment[];
  onImportMandatory: (
    targetDb: 'MP' | 'Staff',
    items: Array<{
      nik: string;
      nama: string;
      modul: string;
      status: string;
      tanggalSelesai?: string;
      periode?: string;
    }>
  ) => Promise<void>;
}

interface ParsedItem {
  nik: string;
  nama: string;
  modul: string;
  status: string;
  periode: string;
}

export const MandatoryImportView: React.FC<MandatoryImportViewProps> = ({
  mandatoryAssignments,
  onImportMandatory
}) => {
  const [targetDb, setTargetDb] = useState<'MP' | 'Staff'>('MP');
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [tableSearch, setTableSearch] = useState('');
  const [filterDb, setFilterDb] = useState<'ALL' | 'MP' | 'Staff'>('ALL');

  // Parse Excel / CSV file using SheetJS (xlsx)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setSuccessMessage('');

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          setParseError('File tidak berisi data atau format baris tidak terdeteksi.');
          setParsedData([]);
          return;
        }

        // Map column variations
        const parsed: ParsedItem[] = jsonRows
          .map((row) => {
            const nik = String(
              row.NIK || row.nik || row['Nomor Induk'] || row['ID Pegawai'] || ''
            ).trim();
            const nama = String(
              row.Nama || row.nama || row['Nama Lengkap'] || row['Nama Peserta'] || ''
            ).trim();
            const modul = String(
              row.Modul || row.modul || row['Modul Training'] || row.Program || row['Nama Modul'] || ''
            ).trim();
            const rawStatus = String(
              row.Status || row.status || row['Status Mandatory'] || ''
            ).trim().toLowerCase();

            const status = rawStatus === 'done' || rawStatus === 'selesai' || rawStatus === 'kompeten' ? 'Done' : 'Not Yet';
            const periode = String(row.Periode || row.periode || row.Tahun || new Date().getFullYear()).trim();

            return { nik, nama, modul, status, periode };
          })
          .filter((item) => item.nik && item.modul);

        if (parsed.length === 0) {
          setParseError('Tidak ditemukan baris yang memiliki kolom NIK dan Modul. Pastikan header mencakup "NIK" dan "Modul".');
          setParsedData([]);
          return;
        }

        setParsedData(parsed);
      } catch (err: any) {
        setParseError(`Gagal membaca file: ${err.message}`);
        setParsedData([]);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Sample CSV generator for testing
  const handleLoadSampleData = () => {
    setFileName('contoh_monitoring_mandatory_kai.csv');
    setParseError('');
    setSuccessMessage('');
    const sampleItems: ParsedItem[] = [
      { nik: 'KAI-20101', nama: 'Bambang Sudibyo', modul: 'Basic Railway Operation', status: 'Done', periode: '2026' },
      { nik: 'KAI-20104', nama: 'Dedi Prasetyo', modul: 'Basic Railway Operation', status: 'Done', periode: '2026' },
      { nik: 'KAI-20108', nama: 'Arif Kurniawan', modul: 'SOP Pemeliharaan Sarana', status: 'Done', periode: '2026' },
      { nik: 'KAI-20109', nama: 'Bayu Triyanto', modul: 'Troubleshooting Elektrik', status: 'Done', periode: '2026' },
      { nik: 'KAI-20118', nama: 'Indra Wijaya', modul: 'K3 & Keselamatan Operasi KA', status: 'Done', periode: '2026' },
      { nik: 'KAI-20117', nama: 'Budi Santoso', modul: 'Troubleshooting Mekanik', status: 'Not Yet', periode: '2026' },
      { nik: 'KAI-20103', nama: 'Ahmad Fauzi', modul: 'Emergency Response System', status: 'Done', periode: '2026' },
    ];
    setParsedData(sampleItems);
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      '\uFEFF' +
      'NIK,Nama,Modul Training,Status,Periode\n' +
      'KAI-20101,Bambang Sudibyo,K3 & Keselamatan Operasi KA,Done,2026\n' +
      'KAI-20104,Dedi Prasetyo,Basic Railway Operation,Not Yet,2026\n' +
      'KAI-20108,Arif Kurniawan,Troubleshooting Mekanik,Done,2026\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Monitoring_Mandatory_KAI.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteImport = async () => {
    if (parsedData.length === 0) return;

    try {
      setIsProcessing(true);
      setParseError('');
      setSuccessMessage('');

      await onImportMandatory(targetDb, parsedData);

      setSuccessMessage(
        `Sukses! Sebanyak ${parsedData.length} penugasan mandatory berhasil diimpor ke Mandatory Training Database dan status Done telah disinkronkan ke Matrix ${targetDb}.`
      );
      setParsedData([]);
      setFileName('');
    } catch (err: any) {
      setParseError(err.message || 'Gagal melakukan impor data.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter current assignments
  const filteredAssignments = useMemo(() => {
    return mandatoryAssignments.filter((item) => {
      if (filterDb !== 'ALL' && item.targetDb !== filterDb) return false;
      if (tableSearch.trim() !== '') {
        const q = tableSearch.toLowerCase();
        const matchNik = item.nik.toLowerCase().includes(q);
        const matchNama = item.nama.toLowerCase().includes(q);
        const matchMod = item.modul.toLowerCase().includes(q);
        return matchNik || matchNama || matchMod;
      }
      return true;
    });
  }, [mandatoryAssignments, filterDb, tableSearch]);

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Mandatory Import & Monitoring
            </h2>
            <span className="text-xs font-bold font-mono bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
              Sinkronisasi Otomatis
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Unggah file Excel/CSV program monitoring mandatory. Status Done / Not Yet akan disimpan sebagai kewajiban dan menyinkronkan matrix.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Unduh Format Template CSV</span>
        </button>
      </div>

      {/* Business Rule Notice */}
      <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-900">Ketentuan Bisnis Mandatory Training:</strong>{' '}
          Penghitungan ACH Mandatory <em>hanya</em> didasarkan pada modul yang secara resmi ditugaskan kepada personel pada Mandatory Training Database ini. Baris dengan status <strong className="text-emerald-700">Done</strong> otomatis menyinkronkan ceklis pada kolom modul di Matrix target.
        </div>
      </div>

      {/* Upload & Setup Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Langkah 1: Pilih Target Database</h3>
            <p className="text-xs text-slate-600">Tentukan kelompok matriks yang akan disinkronkan</p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTargetDb('MP')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                targetDb === 'MP' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Target Database MP
            </button>
            <button
              onClick={() => setTargetDb('Staff')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                targetDb === 'Staff' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Target Database Training Staff
            </button>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800">
              Langkah 2: Pilih File Spreadsheet (.xlsx, .xls, .csv)
            </label>
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Gunakan Data Contoh Monitoring KAI
            </button>
          </div>

          <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
            <UploadCloud className="w-8 h-8 text-blue-600" />
            <div className="text-center">
              <span className="text-xs font-bold text-slate-800">Klik untuk memilih file</span>{' '}
              <span className="text-xs text-slate-600">atau seret file ke sini</span>
              <p className="text-[11px] text-slate-600 mt-0.5">Format file yang didukung: Excel (.xlsx, .xls) atau CSV</p>
            </div>
            {fileName && (
              <div className="mt-2 text-xs font-mono font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                {fileName}
              </div>
            )}
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Error / Success Notices */}
        {parseError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{parseError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Parsed Preview Table */}
        {parsedData.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Pratinjau Data Impor ({parsedData.length} Baris Terbaca)
                </h4>
                <p className="text-[11px] text-slate-600">Periksa kesesuaian data sebelum memproses sinkronisasi</p>
              </div>
              <button
                onClick={handleExecuteImport}
                disabled={isProcessing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <span>Memproses Sinkronisasi...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Konfirmasi & Impor ke {targetDb}</span>
                  </>
                )}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">NIK</th>
                    <th className="py-2.5 px-3">Nama</th>
                    <th className="py-2.5 px-3">Modul Wajib</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Periode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{item.nik}</td>
                      <td className="py-2 px-3 text-slate-800 font-medium">{item.nama || '-'}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.modul}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'Done'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono">{item.periode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Active Mandatory Database Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Daftar Penugasan Mandatory KAI GAM Aktif</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Basis data resmi untuk perhitungan ACH Mandatory di Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari NIK, modul..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterDb}
              onChange={(e) => setFilterDb(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="ALL">Semua Basis ({mandatoryAssignments.length})</option>
              <option value="MP">Hanya MP</option>
              <option value="Staff">Hanya Staff</option>
            </select>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-10 text-center text-slate-600 text-sm">
            Belum ada penugasan mandatory terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-3 px-5">Target</th>
                  <th className="py-3 px-4">NIK</th>
                  <th className="py-3 px-4">Nama Personel</th>
                  <th className="py-3 px-4">Modul Training</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Periode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAssignments.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {row.targetDb}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 whitespace-nowrap">{row.nik}</td>
                    <td className="py-3 px-4 text-slate-900 font-bold whitespace-nowrap">{row.nama}</td>
                    <td className="py-3 px-4 text-slate-900 font-semibold">{row.modul}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          row.status === 'Done'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {row.status === 'Done' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{row.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{row.periode || '2026'}</td>
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
