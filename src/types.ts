/**
 * KAI GAM — Manpower & Training Development
 * Core TypeScript Types
 */

export interface ManpowerPerson {
  nik: string;
  nama: string;
  jabatan: string;
  section: string;
  grade: string;
  statusPegawai?: string;
  keterangan?: string;
}

export interface TrainingRecord {
  id: string;
  program: string;
  tanggal: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  startDate?: string;
  finishDate?: string;
  status: 'Selesai' | 'Belum Selesai' | string;
  nik: string;
  nama: string;
  kategori: 'Mandatory' | 'Di Luar Mandatory' | string;
  catatan?: string;
}

export interface MatrixData {
  headers: string[]; // e.g. ['NIK', 'Nama', 'Jabatan', 'Section', 'Modul 1', ...]
  rows: Array<Record<string, string>>;
}

export interface MandatoryAssignment {
  nik: string;
  nama: string;
  targetDb: 'MP' | 'Staff';
  modul: string;
  status: 'Done' | 'Not Yet';
  tanggalSelesai?: string;
  periode?: string;
}

export interface AppData {
  mpList: ManpowerPerson[];
  trainingRecords: TrainingRecord[];
  matrixMP: MatrixData;
  matrixStaff: MatrixData;
  mandatoryAssignments: MandatoryAssignment[];
}

export interface ConnectionStatus {
  isConnected: boolean;
  appScriptUrl: string;
  lastTestedAt?: string;
  spreadsheetName?: string;
  errorMessage?: string;
}
