/**
 * Date and Schedule Row Normalization Utilities
 * Ensures 100% consistent date formatting (YYYY-MM-DD) and uniform data structures
 * between Excel imports, Google Sheets synchronization, Training Records, and Calendar views.
 */

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_MAP_LOOKUP: Record<string, string> = {
  jan: '01', januari: '01', january: '01',
  feb: '02', februari: '02', february: '02',
  mar: '03', maret: '03', march: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06', june: '06',
  jul: '07', juli: '07', july: '07',
  agu: '08', ags: '08', agustus: '08', aug: '08', august: '08',
  sep: '09', september: '09',
  okt: '10', oktober: '10', oct: '10', october: '10',
  nov: '11', november: '11',
  des: '12', desember: '12', dec: '12', december: '12'
};

/**
 * Normalizes any date value (string, Date, Excel serial number, timestamp)
 * into a strict ISO date string: 'YYYY-MM-DD'.
 */
export function normalizeDateToISO(val: unknown): string {
  if (!val) return '';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(val).trim();
  if (!s) return '';

  // 1. ISO format with date: YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Text Month: e.g., 18 Oktober 2026, 18 Okt 2026, 18-Oct-2026
  const textMonthMatch = s.match(/^(\d{1,2})[\s\-\/]+([a-zA-Z]+)[\s\-\/]+(\d{4})/);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0');
    const mKey = textMonthMatch[2].toLowerCase();
    const y = textMonthMatch[3];
    if (MONTH_MAP_LOOKUP[mKey]) {
      return `${y}-${MONTH_MAP_LOOKUP[mKey]}-${d}`;
    }
  }

  // 4. Excel Serial Number (e.g. 45293)
  const num = Number(val);
  if (!isNaN(num) && num > 25000 && num < 80000) {
    const wholeDays = Math.floor(num);
    const d = new Date(Math.round((wholeDays - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  // 5. Fallback via Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return s;
}

/**
 * Parses date range text like "2026-10-18 s/d 2026-10-20" or "18/10/2026 - 20/10/2026"
 */
export function parseDateRange(val: unknown): { start: string; finish: string } {
  if (!val) return { start: '', finish: '' };
  const s = String(val).trim();

  if (s.includes(' s/d ')) {
    const parts = s.split(' s/d ');
    const start = normalizeDateToISO(parts[0]?.trim());
    const finish = normalizeDateToISO(parts[1]?.trim()) || start;
    return { start, finish };
  }

  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    const start = normalizeDateToISO(parts[0]?.trim());
    const finish = normalizeDateToISO(parts[1]?.trim()) || start;
    return { start, finish };
  }

  if (s.includes(' sampai ')) {
    const parts = s.split(' sampai ');
    const start = normalizeDateToISO(parts[0]?.trim());
    const finish = normalizeDateToISO(parts[1]?.trim()) || start;
    return { start, finish };
  }

  const single = normalizeDateToISO(s);
  return { start: single, finish: single };
}

/**
 * Extracts start and finish ISO dates ('YYYY-MM-DD') from any row object,
 * checking all known date property aliases.
 */
export function extractItemDates(item: Record<string, any>): { start: string; finish: string } {
  if (!item) return { start: '', finish: '' };

  const rawStart =
    item['Start Date'] ??
    item['start date'] ??
    item['START DATE'] ??
    item.startDate ??
    item.tanggalMulai ??
    item['TANGGAL MULAI'] ??
    item['tanggal mulai'] ??
    item['START'] ??
    item['start'] ??
    item['TGL MULAI'] ??
    item['TGL START'] ??
    item.tglMulai ??
    '';

  const rawFinish =
    item['Finish Date'] ??
    item['finish date'] ??
    item['FINISH DATE'] ??
    item.finishDate ??
    item.tanggalSelesai ??
    item['TANGGAL SELESAI'] ??
    item['tanggal selesai'] ??
    item['FINISH'] ??
    item['finish'] ??
    item['TGL SELESAI'] ??
    item['TGL FINISH'] ??
    item['END DATE'] ??
    item.tglSelesai ??
    '';

  const rawTrainingDate =
    item.trainingDate ??
    item.tanggal ??
    item['TANGGAL'] ??
    item['tanggal'] ??
    item.dateDisplay ??
    item['TGL'] ??
    item.tgl ??
    '';

  let start = normalizeDateToISO(rawStart);
  let finish = normalizeDateToISO(rawFinish);

  if ((!start || !finish) && rawTrainingDate) {
    const range = parseDateRange(rawTrainingDate);
    if (!start) start = range.start;
    if (!finish) finish = range.finish;
  }

  if (start && !finish) finish = start;
  if (!start && finish) start = finish;

  return { start, finish };
}

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates number of days between two YYYY-MM-DD dates inclusive
 */
export function calculateDays(start: string, finish: string): number {
  const sIso = normalizeDateToISO(start);
  const fIso = normalizeDateToISO(finish) || sIso;
  if (!sIso || !fIso) return 1;
  const d1 = new Date(sIso);
  const d2 = new Date(fIso);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Formats YYYY-MM-DD into Indonesian human-readable date e.g. "18 Okt 2026"
 */
export function formatDateIndo(dateStr: string): string {
  const iso = normalizeDateToISO(dateStr);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(dateStr || '-');
  const [y, m, d] = iso.split('-');
  const mIdx = parseInt(m, 10) - 1;
  const monthName = MONTH_SHORT_ID[mIdx] || m;
  return `${parseInt(d, 10)} ${monthName} ${y}`;
}

/**
 * Normalizes a training schedule row so that:
 * 1. Dates are strictly YYYY-MM-DD (startDate, finishDate, tanggalMulai, tanggalSelesai).
 * 2. All property aliases (nik/NIK, name/nama, moduleName/program/modul) are consistently set.
 * 3. Status is standardized into one of: 'SELESAI', 'DALAM PROSES', 'BELUM SELESAI', 'TERJADWAL'.
 * 4. Matched against people database when possible for accurate names and metadata.
 */
export function normalizeScheduleRow(r: Record<string, any>, allPeople: Record<string, any>[] = []): Record<string, any> {
  const rawNik = String(
    r['NIK'] ?? r['nik'] ?? r['Employee NIK'] ?? r['No Induk'] ?? r['Nomor Induk'] ?? r['NO INDUK'] ?? ''
  ).trim().replace(/\.0+$/, '');

  const rawName = String(
    r['Name'] ?? r['name'] ?? r['NAMA'] ?? r['nama'] ?? r['NAME'] ?? r['Nama Karyawan'] ?? r['EMPLOYEE NAME'] ?? ''
  ).trim();

  const rawPosition = String(
    r['Position'] ?? r['position'] ?? r['POSITION'] ?? r['Jabatan'] ?? r['jabatan'] ?? r['JABATAN'] ?? r['Job Title'] ?? ''
  ).trim();

  const rawSectionSite = String(
    r['Section (Site)'] ?? r['section (site)'] ?? r['SECTION (SITE)'] ?? r['Section(Site)'] ?? r['Section'] ?? r['section'] ?? r['SECTION'] ?? ''
  ).trim();

  const moduleName = String(
    r['Training Tittle'] ??
    r['Training Title'] ??
    r['training tittle'] ??
    r['training title'] ??
    r['TRAINING TITTLE'] ??
    r['TRAINING TITLE'] ??
    r['moduleName'] ??
    r['programTraining'] ??
    r['PROGRAM TRAINING'] ??
    r['program training'] ??
    r['Program Training'] ??
    r['MODUL'] ??
    r['modul'] ??
    r['NAMA TRAINING'] ??
    r['Nama Training'] ??
    r['program'] ??
    r['module'] ??
    r['training'] ??
    r['TRAINING'] ??
    ''
  ).trim() || 'Modul Pelatihan';

  const rawMethod1 = String(
    r['Training Method(In Class Training/Mentoring/OJI)'] ??
    r['Training Method (In Class Training/Mentoring/OJI)'] ??
    r['training method(in class training/mentoring/oji)'] ??
    r['Training Method'] ??
    r['training method'] ??
    r['Method'] ??
    ''
  ).trim();

  const rawWeek = String(
    r['Week'] ?? r['week'] ?? r['WEEK'] ?? r['Minggu'] ?? ''
  ).trim();

  const rawDuration = String(
    r['Duration'] ?? r['duration'] ?? r['DURATION'] ?? r['Durasi'] ?? ''
  ).trim();

  const rawDeliveryMethod = String(
    r['Training Method  (Face to Face / Online Delievery Training)'] ??
    r['Training Method (Face to Face / Online Delievery Training)'] ??
    r['Training Method (Face to Face / Online Delivery Training)'] ??
    r['Training Method  (Face to Face / Online Delivery Training)'] ??
    r['Delivery Method'] ??
    r['delivery method'] ??
    r['Metode Delivery'] ??
    ''
  ).trim();

  const rawSectionLD = String(
    r['Section(L&D)'] ??
    r['Section (L&D)'] ??
    r['section(l&d)'] ??
    r['SECTION(L&D)'] ??
    r['Section L&D'] ??
    r['section l&d'] ??
    ''
  ).trim();

  const rawTrainer = String(
    r['PIC (Trainer)'] ??
    r['pic (trainer)'] ??
    r['PIC(Trainer)'] ??
    r['PIC'] ??
    r['pic'] ??
    r['Trainer'] ??
    r['trainer'] ??
    r['TRAINER'] ??
    r['INSTRUKTUR'] ??
    r['instruktur'] ??
    r['Pengajar'] ??
    ''
  ).trim();

  const rawSite = String(
    r['SITE'] ?? r['site'] ?? r['Site'] ?? r['Lokasi'] ?? r['lokasi'] ?? r['LOKASI'] ?? ''
  ).trim();

  const dates = extractItemDates(r);
  const todayStr = getTodayISO();

  const startDate = dates.start || todayStr;
  const finishDate = dates.finish || startDate;
  const dateDisplay = startDate === finishDate ? startDate : `${startDate} s/d ${finishDate}`;

  const rawStatus = String(
    r.status ?? r.STATUS ?? r.Status ?? r['STATUS PELATIHAN'] ?? r['KETERANGAN'] ?? r['HASIL'] ?? 'TERJADWAL'
  ).trim().toUpperCase();

  let cleanStatus = 'TERJADWAL';
  if (['SELESAI', 'DONE', 'COMPLETED', 'PASS', 'LULUS', '1', 'TRUE'].includes(rawStatus)) {
    cleanStatus = 'SELESAI';
  } else if (['DALAM PROSES', 'ON GOING', 'ONGOING', 'ON-GOING', 'IN PROGRESS', 'PROGRESS', 'RUNNING', 'BERJALAN'].includes(rawStatus)) {
    cleanStatus = 'DALAM PROSES';
  } else if (['BELUM SELESAI', 'BELUM', 'NOT YET', 'NOT YET TRAINING', 'PENDING', 'INCOMPLETE', '0', 'FALSE'].includes(rawStatus)) {
    cleanStatus = 'BELUM SELESAI';
  } else {
    cleanStatus = 'TERJADWAL';
  }

  // Find person if name or department info is missing
  const matchedPerson = allPeople.find(p => {
    const pNik = String(p.NIK ?? p.nik ?? '').trim().replace(/\.0+$/, '');
    if (rawNik && pNik && pNik.toLowerCase() === rawNik.toLowerCase()) return true;
    const pName = String(p.NAME ?? p.Nama ?? p.nama ?? p.name ?? '').trim().toLowerCase();
    if (rawName && pName && pName === rawName.toLowerCase()) return true;
    return false;
  });

  const finalNik = rawNik || (matchedPerson ? String(matchedPerson.NIK || matchedPerson.nik || '') : '');
  const finalName = rawName || (matchedPerson ? String(matchedPerson.NAME || matchedPerson.Nama || matchedPerson.nama || matchedPerson.name || '') : (finalNik ? `Peserta (${finalNik})` : 'Peserta'));
  const target = String(r.target ?? r.TARGET ?? r['TARGET DATABASE'] ?? r['Target Database'] ?? (matchedPerson as any)?.__target ?? 'MP').trim() || 'MP';

  const finalPosition = rawPosition || (matchedPerson ? String((matchedPerson as any).JABATAN || (matchedPerson as any).Jabatan || '') : String(r.jabatan || '-')).trim() || '-';
  const finalSectionSite = rawSectionSite || (matchedPerson ? String((matchedPerson as any).SECTION || (matchedPerson as any).Section || '') : String(r.section || '-')).trim() || '-';

  // Construct readable session time / method description
  let sessionTime = String(r.sessionTime ?? r.sesi ?? r.session ?? r.waktu ?? r['SESI TRAINING'] ?? r['SESI'] ?? '').trim();
  if (!sessionTime) {
    if (rawMethod1 && rawDeliveryMethod) {
      sessionTime = `${rawMethod1} · ${rawDeliveryMethod}`;
    } else if (rawMethod1) {
      sessionTime = rawMethod1;
    } else if (rawDeliveryMethod) {
      sessionTime = rawDeliveryMethod;
    } else {
      sessionTime = 'In Class Training (Face to Face)';
    }
  }

  let location = String(r.location ?? r.ruangan ?? r.lokasi ?? r['LOKASI'] ?? r['RUANGAN'] ?? '').trim();
  if (!location) {
    if (rawSite) {
      location = `Site ${rawSite}`;
    } else {
      location = 'Ruang Training GAM (Lt. 2)';
    }
  }

  const trainer = rawTrainer || String(r.trainer ?? r.instruktur ?? '').trim();
  const inputTime = String(r.inputTime ?? r['WAKTU INPUT'] ?? new Date().toLocaleString('id-ID'));

  return {
    ...r,
    nik: finalNik,
    NIK: finalNik,
    name: finalName,
    nama: finalName,
    NAME: finalName,
    position: finalPosition,
    Position: finalPosition,
    jabatan: finalPosition,
    JABATAN: finalPosition,
    sectionSite: finalSectionSite,
    'Section (Site)': finalSectionSite,
    section: finalSectionSite,
    SECTION: finalSectionSite,
    moduleName,
    'Training Tittle': moduleName,
    'Training Title': moduleName,
    program: moduleName,
    modul: moduleName,
    trainingMethod: rawMethod1 || 'In Class Training',
    'Training Method(In Class Training/Mentoring/OJI)': rawMethod1 || 'In Class Training',
    startDate,
    finishDate,
    'Start Date': startDate,
    'Finish Date': finishDate,
    tanggalMulai: startDate,
    tanggalSelesai: finishDate,
    tanggal: finishDate,
    trainingDate: dateDisplay,
    dateDisplay,
    week: rawWeek,
    Week: rawWeek,
    duration: rawDuration || (calculateDays(startDate, finishDate) + ' Hari'),
    Duration: rawDuration || (calculateDays(startDate, finishDate) + ' Hari'),
    deliveryMethod: rawDeliveryMethod || 'Face to Face',
    'Training Method  (Face to Face / Online Delievery Training)': rawDeliveryMethod || 'Face to Face',
    sectionLD: rawSectionLD || 'L&D',
    'Section(L&D)': rawSectionLD || 'L&D',
    picTrainer: trainer,
    'PIC (Trainer)': trainer,
    trainer,
    site: rawSite || 'GAM',
    SITE: rawSite || 'GAM',
    status: cleanStatus,
    target,
    sessionTime,
    location,
    inputTime
  };
}
