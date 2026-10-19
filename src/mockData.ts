/**
 * KAI GAM — Manpower & Training Development
 * Mock Data untuk Mode Demo (Data Simulasi KAI GAM)
 */

import { AppData, ManpowerPerson, TrainingRecord, MandatoryAssignment } from './types';

export const INITIAL_DEMO_MP: ManpowerPerson[] = [
  { nik: "KAI-20101", nama: "Bambang Sudibyo", jabatan: "Supervisor Pemeliharaan Sarana", section: "Sarana & Lokomotif", grade: "Grade 3", statusPegawai: "Aktif" },
  { nik: "KAI-20102", nama: "Siti Rahmawati", jabatan: "Staff Quality Assurance GAM", section: "Quality & Safety GAM", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20103", nama: "Ahmad Fauzi", jabatan: "Teknisi Sintelis Senior", section: "Sintelis", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20104", nama: "Dedi Prasetyo", jabatan: "Pelaksana Jalan Rel", section: "Jalan Rel & Jembatan", grade: "Grade 1", statusPegawai: "Aktif" },
  { nik: "KAI-20105", nama: "Eko Wahyudi", jabatan: "", section: "Sarana & Lokomotif", grade: "Grade 1", statusPegawai: "Aktif", keterangan: "Mutasi baru, menunggu SK Jabatan" }, // Jabatan kosong -> Perlu Verifikasi
  { nik: "KAI-20106", nama: "Hendro Wibowo", jabatan: "Manager Operasi GAM", section: "Operasi Perjalanan KA", grade: "Grade 4", statusPegawai: "Aktif" },
  { nik: "KAI-20107", nama: "Rina Kusuma", jabatan: "Supervisor Logistik & Suku Cadang", section: "Pengadaan & Logistik", grade: "Grade 3", statusPegawai: "Aktif" },
  { nik: "KAI-20108", nama: "Arif Kurniawan", jabatan: "Teknisi Mekanik Balai Yasa", section: "Sarana & Lokomotif", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20109", nama: "Bayu Triyanto", jabatan: "Pelaksana Listrik Aliran Atas", section: "Sintelis", grade: "Grade 1", statusPegawai: "Aktif" },
  { nik: "KAI-20110", nama: "Fajar Nugraha", jabatan: "", section: "Jalan Rel & Jembatan", grade: "Grade 1", statusPegawai: "Aktif", keterangan: "On boarding calon pegawai" }, // Jabatan kosong -> Perlu Verifikasi
  { nik: "KAI-20111", nama: "Tri Utami", jabatan: "Staff Administrasi & Pelaporan GAM", section: "Quality & Safety GAM", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20112", nama: "Danang Setiawan", jabatan: "Pengawas Jalur & Rel", section: "Jalan Rel & Jembatan", grade: "Grade 3", statusPegawai: "Aktif" },
  { nik: "KAI-20113", nama: "Gilang Permana", jabatan: "Teknisi Sinyal Elektrik", section: "Sintelis", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20114", nama: "Rizky Ramadhan", jabatan: "Pelaksana Gudang Sarana", section: "Pengadaan & Logistik", grade: "Grade 1", statusPegawai: "Aktif" },
  { nik: "KAI-20115", nama: "Agus Pratama", jabatan: "", section: "Operasi Perjalanan KA", grade: "Grade 2", statusPegawai: "Aktif", keterangan: "Proses promosi struktural" }, // Jabatan kosong -> Perlu Verifikasi
  { nik: "KAI-20116", nama: "Yuni Astuti", jabatan: "Safety Officer GAM", section: "Quality & Safety GAM", grade: "Grade 3", statusPegawai: "Aktif" },
  { nik: "KAI-20117", nama: "Budi Santoso", jabatan: "Teknisi Rangka Bawah KA", section: "Sarana & Lokomotif", grade: "Grade 2", statusPegawai: "Aktif" },
  { nik: "KAI-20118", nama: "Indra Wijaya", jabatan: "Pelaksana Las Rel Termit", section: "Jalan Rel & Jembatan", grade: "Grade 1", statusPegawai: "Aktif" },
  { nik: "KAI-20119", nama: "Nur Hidayat", jabatan: "Supervisor Sintelis", section: "Sintelis", grade: "Grade 3", statusPegawai: "Aktif" },
  { nik: "KAI-20120", nama: "Maya Indriani", jabatan: "Staf Perencanaan Material", section: "Pengadaan & Logistik", grade: "Grade 2", statusPegawai: "Aktif" }
];

export const DEMO_MODULES_MP = [
  "K3 & Keselamatan Operasi KA",
  "SOP Pemeliharaan Sarana",
  "Basic Railway Operation",
  "Troubleshooting Elektrik",
  "Troubleshooting Mekanik",
  "Emergency Response System",
  "Customer Service Excellence"
];

export const DEMO_MODULES_STAFF = [
  "Sistem Manajemen Mutu ISO 9001",
  "Data Analytics & Reporting GAM",
  "Budgeting & Pengadaan Barang/Jasa",
  "Leadership & Coaching",
  "Komunikasi Efektif & Negosiasi",
  "Manajemen Risiko Operasional"
];

export const INITIAL_DEMO_MANDATORY: MandatoryAssignment[] = [
  // Assignments for MP
  { nik: "KAI-20101", nama: "Bambang Sudibyo", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-10", periode: "2026" },
  { nik: "KAI-20101", nama: "Bambang Sudibyo", targetDb: "MP", modul: "SOP Pemeliharaan Sarana", status: "Done", tanggalSelesai: "2026-03-01", periode: "2026" },
  { nik: "KAI-20101", nama: "Bambang Sudibyo", targetDb: "MP", modul: "Emergency Response System", status: "Done", tanggalSelesai: "2026-03-15", periode: "2026" },
  
  { nik: "KAI-20103", nama: "Ahmad Fauzi", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-12", periode: "2026" },
  { nik: "KAI-20103", nama: "Ahmad Fauzi", targetDb: "MP", modul: "Troubleshooting Elektrik", status: "Done", tanggalSelesai: "2026-03-20", periode: "2026" },
  { nik: "KAI-20103", nama: "Ahmad Fauzi", targetDb: "MP", modul: "Emergency Response System", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20104", nama: "Dedi Prasetyo", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-01-25", periode: "2026" },
  { nik: "KAI-20104", nama: "Dedi Prasetyo", targetDb: "MP", modul: "Basic Railway Operation", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20108", nama: "Arif Kurniawan", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-14", periode: "2026" },
  { nik: "KAI-20108", nama: "Arif Kurniawan", targetDb: "MP", modul: "Troubleshooting Mekanik", status: "Done", tanggalSelesai: "2026-03-05", periode: "2026" },
  { nik: "KAI-20108", nama: "Arif Kurniawan", targetDb: "MP", modul: "SOP Pemeliharaan Sarana", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20109", nama: "Bayu Triyanto", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-18", periode: "2026" },
  { nik: "KAI-20109", nama: "Bayu Triyanto", targetDb: "MP", modul: "Troubleshooting Elektrik", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20112", nama: "Danang Setiawan", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-01-30", periode: "2026" },
  { nik: "KAI-20112", nama: "Danang Setiawan", targetDb: "MP", modul: "Basic Railway Operation", status: "Done", tanggalSelesai: "2026-02-22", periode: "2026" },

  { nik: "KAI-20113", nama: "Gilang Permana", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-15", periode: "2026" },
  { nik: "KAI-20113", nama: "Gilang Permana", targetDb: "MP", modul: "Troubleshooting Elektrik", status: "Done", tanggalSelesai: "2026-03-12", periode: "2026" },

  { nik: "KAI-20117", nama: "Budi Santoso", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Done", tanggalSelesai: "2026-02-28", periode: "2026" },
  { nik: "KAI-20117", nama: "Budi Santoso", targetDb: "MP", modul: "Troubleshooting Mekanik", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20118", nama: "Indra Wijaya", targetDb: "MP", modul: "K3 & Keselamatan Operasi KA", status: "Not Yet", periode: "2026" },

  // Assignments for Staff
  { nik: "KAI-20102", nama: "Siti Rahmawati", targetDb: "Staff", modul: "Sistem Manajemen Mutu ISO 9001", status: "Done", tanggalSelesai: "2026-01-20", periode: "2026" },
  { nik: "KAI-20102", nama: "Siti Rahmawati", targetDb: "Staff", modul: "Data Analytics & Reporting GAM", status: "Done", tanggalSelesai: "2026-02-10", periode: "2026" },
  { nik: "KAI-20102", nama: "Siti Rahmawati", targetDb: "Staff", modul: "Manajemen Risiko Operasional", status: "Done", tanggalSelesai: "2026-03-18", periode: "2026" },

  { nik: "KAI-20106", nama: "Hendro Wibowo", targetDb: "Staff", modul: "Leadership & Coaching", status: "Done", tanggalSelesai: "2026-01-15", periode: "2026" },
  { nik: "KAI-20106", nama: "Hendro Wibowo", targetDb: "Staff", modul: "Manajemen Risiko Operasional", status: "Done", tanggalSelesai: "2026-02-05", periode: "2026" },

  { nik: "KAI-20107", nama: "Rina Kusuma", targetDb: "Staff", modul: "Budgeting & Pengadaan Barang/Jasa", status: "Done", tanggalSelesai: "2026-02-25", periode: "2026" },
  { nik: "KAI-20107", nama: "Rina Kusuma", targetDb: "Staff", modul: "Komunikasi Efektif & Negosiasi", status: "Done", tanggalSelesai: "2026-03-10", periode: "2026" },
  { nik: "KAI-20107", nama: "Rina Kusuma", targetDb: "Staff", modul: "Manajemen Risiko Operasional", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20111", nama: "Tri Utami", targetDb: "Staff", modul: "Data Analytics & Reporting GAM", status: "Done", tanggalSelesai: "2026-02-28", periode: "2026" },
  { nik: "KAI-20111", nama: "Tri Utami", targetDb: "Staff", modul: "Sistem Manajemen Mutu ISO 9001", status: "Not Yet", periode: "2026" },

  { nik: "KAI-20116", nama: "Yuni Astuti", targetDb: "Staff", modul: "Manajemen Risiko Operasional", status: "Done", tanggalSelesai: "2026-03-02", periode: "2026" },
  { nik: "KAI-20116", nama: "Yuni Astuti", targetDb: "Staff", modul: "Sistem Manajemen Mutu ISO 9001", status: "Done", tanggalSelesai: "2026-03-22", periode: "2026" },

  { nik: "KAI-20120", nama: "Maya Indriani", targetDb: "Staff", modul: "Budgeting & Pengadaan Barang/Jasa", status: "Not Yet", periode: "2026" }
];

export const INITIAL_DEMO_TRAININGS: TrainingRecord[] = [];

export function generateInitialDemoData(): AppData {
  // Build Matrix MP
  const matrixMPHeaders = ["NIK", "Nama", "Jabatan", "Section", ...DEMO_MODULES_MP];
  const matrixMPRows = INITIAL_DEMO_MP.map(person => {
    const row: Record<string, string> = {
      NIK: person.nik,
      Nama: person.nama,
      Jabatan: person.jabatan,
      Section: person.section
    };

    // Check completed trainings or mandatory done
    DEMO_MODULES_MP.forEach(mod => {
      const isDoneMandatory = INITIAL_DEMO_MANDATORY.some(
        m => m.nik === person.nik && m.targetDb === "MP" && m.modul === mod && m.status === "Done"
      );
      const isDoneTraining = INITIAL_DEMO_TRAININGS.some(
        t => t.nik === person.nik && t.program === mod && t.status === "Selesai"
      );
      row[mod] = (isDoneMandatory || isDoneTraining) ? "Done" : "";
    });

    return row;
  });

  // Build Matrix Staff (filter staff-related sections or management)
  const staffPersons = INITIAL_DEMO_MP.filter(p => 
    p.section === "Quality & Safety GAM" || 
    p.section === "Pengadaan & Logistik" || 
    p.section === "Operasi Perjalanan KA" ||
    p.grade === "Grade 3" || p.grade === "Grade 4"
  );

  const matrixStaffHeaders = ["NIK", "Nama", "Jabatan", "Section", ...DEMO_MODULES_STAFF];
  const matrixStaffRows = staffPersons.map(person => {
    const row: Record<string, string> = {
      NIK: person.nik,
      Nama: person.nama,
      Jabatan: person.jabatan,
      Section: person.section
    };

    DEMO_MODULES_STAFF.forEach(mod => {
      const isDoneMandatory = INITIAL_DEMO_MANDATORY.some(
        m => m.nik === person.nik && m.targetDb === "Staff" && m.modul === mod && m.status === "Done"
      );
      const isDoneTraining = INITIAL_DEMO_TRAININGS.some(
        t => t.nik === person.nik && t.program === mod && t.status === "Selesai"
      );
      row[mod] = (isDoneMandatory || isDoneTraining) ? "Done" : "";
    });

    return row;
  });

  return {
    mpList: INITIAL_DEMO_MP,
    trainingRecords: INITIAL_DEMO_TRAININGS,
    matrixMP: {
      headers: matrixMPHeaders,
      rows: matrixMPRows
    },
    matrixStaff: {
      headers: matrixStaffHeaders,
      rows: matrixStaffRows
    },
    mandatoryAssignments: INITIAL_DEMO_MANDATORY
  };
}
