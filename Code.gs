const CONFIG = {



  MP_SHEET: 'MP',



  TRAINING_SHEET: 'Training Staff',



  HISTORY_SHEET: 'Training Database',







  MP_HEADER_ROW: 3,



  TRAINING_HEADER_ROW: 5,







  MP_DATA_START_ROW: 4,



  TRAINING_DATA_START_ROW: 6,







  // Training matrix masing-masing modul



  MP_TRAINING_START: 'BMC',



  MP_TRAINING_END: 'Air Conditioning System',







  TRAINING_START: 'Avengers',



  TRAINING_END: 'QCC',







  // Kolom MP yang tidak ditampilkan



  MP_HIDDEN_COLUMNS: [



    'COL_1',



    'Send WA',



    'Column 28'



  ]



};







function doGet(e) {
  // API JSONP untuk frontend React dari Google AI Studio.
  // Bila ada parameter api=1, callback, atau action, layani request API.
  if (e && e.parameter && (e.parameter.api === '1' || e.parameter.callback || e.parameter.action)) {
    return handleApiRequest_(e);
  }

  // Respon status default bila URL dibuka langsung di browser
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    status: 'online',
    app: 'KAI GAM — Manpower & Training Development Web App API',
    message: 'Backend Google Apps Script aktif dan siap menerima request JSONP dari frontend React.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}







function getSS_() {



  return SpreadsheetApp.getActiveSpreadsheet();



}







/**



 * Membaca data sheet berdasarkan header.



 */



function getSheetData_(sheetName, headerRow) {
  let sh = getSS_().getSheetByName(sheetName);
  if (!sh) {
    const all = getSS_().getSheets();
    const targetNorm = String(sheetName || '').trim().toLowerCase();
    const found = all.find(s => s.getName().trim().toLowerCase() === targetNorm);
    if (found) sh = found;
  }

  if (!sh) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan. Pastikan spreadsheet memiliki sheet bernama "${sheetName}".`);
  }







  const lastRow = sh.getLastRow();



  const lastCol = sh.getLastColumn();







  if (lastRow < headerRow || lastCol === 0) {



    return {



      headers: [],



      rows: []



    };



  }







  const values = sh



    .getRange(



      headerRow,



      1,



      lastRow - headerRow + 1,



      lastCol



    )



    .getDisplayValues();







  const rawHeaders = values.shift();







  const headers = rawHeaders.map((h, i) => {



    const header = String(h || '').trim();



    return header || `COL_${i + 1}`;



  });







  return {



    headers,



    rows: values



  };



}







/**



 * Data awal untuk HTML.



 */



function getInitialData() {



  const mp = getSheetData_(



    CONFIG.MP_SHEET,



    CONFIG.MP_HEADER_ROW



  );







  const training = getSheetData_(



    CONFIG.TRAINING_SHEET,



    CONFIG.TRAINING_HEADER_ROW



  );







  const mpHeaders = buildMPHeaders_(mp.headers);



  const trainingHeaders = buildTrainingHeaders_(training.headers);







  return {



    mp: normalizeRows_(mp.headers, mp.rows),



    training: normalizeRows_(training.headers, training.rows),







    mpHeaders: mpHeaders,



    trainingHeaders: trainingHeaders,







    mpTrainingHeaders: getTrainingRangeHeaders_(



      mp.headers,



      CONFIG.MP_TRAINING_START,



      CONFIG.MP_TRAINING_END



    ),







    trainingMatrixHeaders: getTrainingRangeHeaders_(



      training.headers,



      CONFIG.TRAINING_START,



      CONFIG.TRAINING_END



    ),

    mandatoryAssignments: getMandatoryAssignments_()



  };



}







/**



 * Header MP:



 * menghilangkan kolom yang tidak diperlukan.



 */



function buildMPHeaders_(headers) {



  const hidden = CONFIG.MP_HIDDEN_COLUMNS.map(normalizeHeader_);







  return headers.filter(h => {



    return !hidden.includes(normalizeHeader_(h));



  });



}







/**



 * Header Training Staff tetap menggunakan semua header.



 */



function buildTrainingHeaders_(headers) {



  return headers.slice();



}







/**



 * Normalisasi data menjadi object.



 */



function normalizeRows_(headers, rows) {



  return rows



    .filter(r =>



      r.some(v => String(v).trim() !== '')



    )



    .map(r => {



      const o = {};







      headers.forEach((h, i) => {



        o[h] = r[i] ?? '';



      });







      return o;



    });



}







/**



 * Normalisasi nama header.



 */



function normalizeHeader_(value) {



  return String(value || '')



    .trim()



    .toLowerCase();



}







/**



 * Mendapatkan header training berdasarkan range:



 * startHeader -> endHeader



 */



function getTrainingRangeHeaders_(headers, startHeader, endHeader) {



  const normalized = headers.map(normalizeHeader_);







  const start = normalized.indexOf(



    normalizeHeader_(startHeader)



  );







  const end = normalized.indexOf(



    normalizeHeader_(endHeader)



  );







  if (start === -1) {



    throw new Error(



      `Kolom training "${startHeader}" tidak ditemukan.`



    );



  }







  if (end === -1) {



    throw new Error(



      `Kolom training "${endHeader}" tidak ditemukan.`



    );



  }







  if (start > end) {



    throw new Error(



      `Urutan kolom training ${startHeader} sampai ${endHeader} tidak valid.`



    );



  }







  return headers.slice(start, end + 1);



}







/**



 * Mengambil nilai sebuah kolom dengan aman.



 */



function getValue_(row, header) {



  if (



    Object.prototype.hasOwnProperty.call(row, header)



  ) {



    return row[header];



  }







  const target = normalizeHeader_(header);







  const key = Object.keys(row).find(



    k => normalizeHeader_(k) === target



  );







  return key ? row[key] : '';



}







/**



 * Apakah nilai training dianggap selesai?



 *



 * Mendukung:



 * TRUE



 * true



 * ✓



 * ✔



 * yes



 * 1



 */



function isTrainingDone_(value) {



  const v = String(value || '')



    .trim()



    .toLowerCase();







  return [



    'true',



    '✓',



    '✔',



    'yes',



    '1'



  ].includes(v);



}







/**



 * Hitung ACH satu manpower.



 */



function calculateACH_(row, trainingHeaders) {



  if (!trainingHeaders.length) {



    return 0;



  }







  let done = 0;







  trainingHeaders.forEach(header => {



    if (



      isTrainingDone_(



        getValue_(row, header)



      )



    ) {



      done++;



    }



  });







  return done / trainingHeaders.length * 100;



}







/**



 * Hitung informasi achievement.



 */



function getAchievement_(row, trainingHeaders) {



  const total = trainingHeaders.length;







  let done = 0;







  trainingHeaders.forEach(header => {



    if (



      isTrainingDone_(



        getValue_(row, header)



      )



    ) {



      done++;



    }



  });







  return {



    done: done,



    total: total,



    ach: total



      ? Number((done / total * 100).toFixed(1))



      : 0



  };



}







/**



 * Dashboard.



 */




function getDashboard() {
  const data = getInitialData();
  const mp = data.mp || [];
  const trainingStaff = data.training || [];
  const mpHeaders = data.mpTrainingHeaders || [];
  const trainingHeaders = data.trainingMatrixHeaders || [];
  const assignments = data.mandatoryAssignments || [];
  const active = mp.filter(r => String(getValue_(r, 'NIK')).trim() !== '');
  const bySection = {}, byGrade = {}, bySubsection = {};
  active.forEach(r => {
    const sec = getValue_(r, 'SECTION') || 'Belum diisi';
    const grade = getValue_(r, 'GRADE') || 'Belum diisi';
    const sub = getValue_(r, 'SubSection') || 'Belum diisi';
    bySection[sec] = (bySection[sec] || 0) + 1;
    byGrade[grade] = (byGrade[grade] || 0) + 1;
    bySubsection[sub] = (bySubsection[sub] || 0) + 1;
  });
  function summarize(rows, headers, target) {
    let totalPossible = 0, totalDone = 0, achSum = 0, assignedPeople = 0;
    rows.forEach(row => {
      const nik = normalizeNIK_(getValue_(row, 'NIK'));
      if (!nik) return;
      const modules = new Set(assignments.filter(a =>
        normalizeNIK_(a.nik) === nik && (!a.target || a.target === target) && a.moduleName
      ).map(a => normalizeHeader_(a.moduleName)));
      if (!modules.size) return;
      let done = 0;
      modules.forEach(moduleKey => {
        const header = headers.find(h => normalizeHeader_(h) === moduleKey);
        if (header && isTrainingDone_(getValue_(row, header))) done++;
      });
      totalPossible += modules.size;
      totalDone += done;
      achSum += done / modules.size * 100;
      assignedPeople++;
    });
    return {headers, totalTraining: headers.length, totalPossible, totalDone, assignedPeople,
      averageACH: assignedPeople ? Number((achSum / assignedPeople).toFixed(1)) : 0};
  }
  return {
    total: active.length, bySection, byGrade, bySubsection,
    mpTraining: summarize(active, mpHeaders, 'MP'),
    trainingStaff: summarize(trainingStaff, trainingHeaders, 'Training Staff')
  };
}

function findRowByNIK_(sheet, headerRow, dataStartRow, record) {



  const nik = String(



    getValue_(record, 'NIK')



  ).trim();







  if (!nik) {



    return null;



  }







  const lastRow =



    sheet.getLastRow();







  if (lastRow < dataStartRow) {



    return null;



  }







  const headers =



    sheet



      .getRange(



        headerRow,



        1,



        1,



        sheet.getLastColumn()



      )



      .getDisplayValues()[0];







  const nikIndex =



    headers.findIndex(



      h =>



        normalizeHeader_(h) ===



        normalizeHeader_('NIK')



    );







  if (nikIndex === -1) {



    return null;



  }







  const values =



    sheet



      .getRange(



        dataStartRow,



        nikIndex + 1,



        lastRow - dataStartRow + 1,



        1



      )



      .getDisplayValues();







  for (let i = 0; i < values.length; i++) {



    if (



      String(values[i][0]).trim() === nik



    ) {



      return dataStartRow + i;



    }



  }







  return null;



}







/**



 * Save MP.



 */



function saveMP(record, rowNumber) {



  const sh =



    getSS_().getSheetByName(



      CONFIG.MP_SHEET



    );







  if (!sh) {



    throw new Error(



      'Sheet MP tidak ditemukan.'



    );



  }







  const headers =



    sh



      .getRange(



        CONFIG.MP_HEADER_ROW,



        1,



        1,



        sh.getLastColumn()



      )



      .getDisplayValues()[0];







  let targetRow =



    rowNumber



      ? Number(rowNumber)



      : null;







  // Jika edit tidak membawa row,



  // coba cari berdasarkan NIK.



  if (!targetRow) {



    targetRow =



      findRowByNIK_(



        sh,



        CONFIG.MP_HEADER_ROW,



        CONFIG.MP_DATA_START_ROW,



        record



      );



  }







  const values =



    headers.map(header => {



      const value =



        getValue_(record, header);







      // Untuk matrix training:



      // ✓ disimpan sebagai TRUE.



      if (



        isInsideTrainingRange_(



          headers,



          header,



          CONFIG.MP_TRAINING_START,



          CONFIG.MP_TRAINING_END



        )



      ) {



        return isTrainingDone_(value)



          ? true



          : false;



      }







      return value ?? '';



    });







  if (targetRow) {



    sh



      .getRange(



        targetRow,



        1,



        1,



        values.length



      )



      .setValues([values]);



  } else {



    sh.appendRow(values);



  }







  return true;



}







/**



 * Save Training Staff.



 */



function saveTraining(record, rowNumber) {



  const sh =



    getSS_().getSheetByName(



      CONFIG.TRAINING_SHEET



    );







  if (!sh) {



    throw new Error(



      'Sheet Training Staff tidak ditemukan.'



    );



  }







  const headers =



    sh



      .getRange(



        CONFIG.TRAINING_HEADER_ROW,



        1,



        1,



        sh.getLastColumn()



      )



      .getDisplayValues()[0];







  let targetRow =



    rowNumber



      ? Number(rowNumber)



      : null;







  if (!targetRow) {



    targetRow =



      findRowByNIK_(



        sh,



        CONFIG.TRAINING_HEADER_ROW,



        CONFIG.TRAINING_DATA_START_ROW,



        record



      );



  }







  const values =



    headers.map(header => {



      const value =



        getValue_(record, header);







      // Matrix Training Staff:



      // Avengers -> QCC



      if (



        isInsideTrainingRange_(



          headers,



          header,



          CONFIG.TRAINING_START,



          CONFIG.TRAINING_END



        )



      ) {



        return isTrainingDone_(value)



          ? true



          : false;



      }







      return value ?? '';



    });







  if (targetRow) {



    sh



      .getRange(



        targetRow,



        1,



        1,



        values.length



      )



      .setValues([values]);



  } else {



    sh.appendRow(values);



  }







  return true;



}







/**



 * Apakah header berada dalam training matrix?



 */



function isInsideTrainingRange_(



  headers,



  header,



  startHeader,



  endHeader



) {



  const normalized =



    headers.map(normalizeHeader_);







  const start =



    normalized.indexOf(



      normalizeHeader_(startHeader)



    );







  const end =



    normalized.indexOf(



      normalizeHeader_(endHeader)



    );







  const current =



    normalized.indexOf(



      normalizeHeader_(header)



    );







  if (



    start === -1 ||



    end === -1 ||



    current === -1



  ) {



    return false;



  }







  return current >= start &&



         current <= end;



}



/* =========================================================

   TRAINING DATABASE - RIWAYAT HASIL TRAINING

\========================================================= */



function getTrainingHistorySheet_() {

  const ss = getSS_();

  let sh = ss.getSheetByName(CONFIG.HISTORY_SHEET);



  if (!sh) {

    sh = ss.insertSheet(CONFIG.HISTORY_SHEET);

    sh.appendRow([

      'NIK', 'Nama', 'Modul Training', 'Tanggal Training',

      'Status', 'Waktu Input'

    ]);

    sh.setFrozenRows(1);

    sh.getRange('D:D').setNumberFormat('yyyy-mm-dd');

    sh.getRange('F:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');

  }

  return sh;

}



function normalizeDateToISO_(val) {
  if (!val) return '';
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const m = isoMatch[2].length === 1 ? '0' + isoMatch[2] : isoMatch[2];
    const d = isoMatch[3].length === 1 ? '0' + isoMatch[3] : isoMatch[3];
    return isoMatch[1] + '-' + m + '-' + d;
  }
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].length === 1 ? '0' + dmyMatch[1] : dmyMatch[1];
    const m = dmyMatch[2].length === 1 ? '0' + dmyMatch[2] : dmyMatch[2];
    const y = dmyMatch[3];
    return y + '-' + m + '-' + d;
  }
  return s;
}

function getTrainingHistory() {
  const sh = getTrainingHistorySheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const startRow = Math.max(2, lastRow - 199);
  const lastCol = Math.max(9, sh.getLastColumn());
  return sh.getRange(startRow, 1, lastRow - startRow + 1, lastCol)
    .getDisplayValues()
    .reverse()
    .map(function(r) {
      const rawDate = String(r[3] || '');
      let sDate = rawDate;
      let fDate = rawDate;
      if (rawDate.indexOf(' s/d ') > -1) {
        const parts = rawDate.split(' s/d ');
        sDate = parts[0].trim();
        fDate = parts[1].trim();
      } else if (rawDate.indexOf(' - ') > -1) {
        const parts = rawDate.split(' - ');
        sDate = parts[0].trim();
        fDate = parts[1].trim();
      }
      const isoStart = normalizeDateToISO_(sDate);
      const isoFinish = normalizeDateToISO_(fDate) || isoStart;
      const dateDisplay = isoStart && isoFinish && isoStart !== isoFinish ? (isoStart + ' s/d ' + isoFinish) : (isoStart || rawDate);
      return {
        nik: r[0],
        NIK: r[0],
        name: r[1],
        nama: r[1],
        NAME: r[1],
        moduleName: r[2],
        program: r[2],
        modul: r[2],
        trainingDate: dateDisplay,
        dateDisplay: dateDisplay,
        startDate: isoStart,
        finishDate: isoFinish,
        tanggalMulai: isoStart,
        tanggalSelesai: isoFinish,
        tanggal: isoFinish,
        status: r[4],
        inputTime: r[5],
        sessionTime: r[6] || 'Sesi 1 (Pagi · 08:00 - 12:00)',
        location: r[7] || 'Ruang Training GAM (Lt. 2)',
        trainer: r[8] || ''
      };
    });
}

function normalizeTrainingStatus_(status) {
  const s = String(status || '').trim().toUpperCase();
  if (['SELESAI', 'DONE', 'COMPLETED', 'COMPLETE', 'PASS', 'LULUS', '1', 'TRUE'].includes(s)) return 'SELESAI';
  if (['TERJADWAL', 'SCHEDULED', 'UPCOMING', 'PLANNED', 'DIJADWALKAN', 'RENCANA'].includes(s)) return 'TERJADWAL';
  if (['DALAM PROSES', 'ON GOING', 'ON-GOING', 'ONGOING', 'IN PROGRESS', 'PROGRESS', 'RUNNING'].includes(s)) return 'DALAM PROSES';
  if (['BELUM SELESAI', 'BELUM', 'NOT YET', 'NOT YET TRAINING', 'PENDING', 'INCOMPLETE', '0', 'FALSE'].includes(s)) return 'BELUM SELESAI';
  return s || 'TERJADWAL';
}

function saveTrainingResult(payload) {
  if (!payload) throw new Error('Data training tidak ditemukan.');

  const participantNiks = Array.isArray(payload.participantNiks)
    ? [...new Set(payload.participantNiks.map(v => String(v || '').trim()).filter(Boolean))]
    : [String(payload.nik || '').trim()].filter(Boolean);
  const moduleName = String(payload.moduleName || '').trim();
  const startDateText = String(payload.startDate || payload.trainingDate || '').trim();
  const finishDateText = String(payload.finishDate || payload.endDate || payload.trainingDate || startDateText).trim();
  const dateText = finishDateText || startDateText;
  const rawStatus = String(payload.status || '').trim();
  const status = normalizeTrainingStatus_(rawStatus);
  const requestedTarget = String(payload.target || 'Keduanya').trim();
  if (!['MP', 'Training Staff', 'Keduanya'].includes(requestedTarget)) {
    throw new Error('Target database training tidak valid.');
  }

  if (!participantNiks.length || !moduleName || !dateText || !status) {
    throw new Error('Pilih modul, tanggal mulai & selesai, status, dan minimal satu peserta training.');
  }
  const validStatuses = [
    'SELESAI', 'BELUM SELESAI', 'TERJADWAL', 'DALAM PROSES',
    'ON GOING', 'ONGOING', 'UPCOMING', 'PLANNED', 'SCHEDULED', 'COMPLETED', 'DONE'
  ];
  if (!validStatuses.includes(status) && !validStatuses.includes(rawStatus.toUpperCase())) {
    throw new Error('Status training tidak valid. Pilihan: Selesai, Terjadwal, Dalam Proses / On Going, Belum Selesai.');
  }

  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) throw new Error('Format tanggal training tidak valid.');
  const trainingDate = new Date(
    Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), 12
  );
  if (
    trainingDate.getFullYear() !== Number(dateMatch[1]) ||
    trainingDate.getMonth() !== Number(dateMatch[2]) - 1 ||
    trainingDate.getDate() !== Number(dateMatch[3])
  ) throw new Error('Tanggal training tidak valid.');

  const ss = getSS_();
  const completed = (status === 'SELESAI');
  const matrices = [
    {
      target: 'MP',
      sheetName: CONFIG.MP_SHEET,
      headerRow: CONFIG.MP_HEADER_ROW,
      dataStartRow: CONFIG.MP_DATA_START_ROW,
      startHeader: CONFIG.MP_TRAINING_START,
      endHeader: CONFIG.MP_TRAINING_END
    },
    {
      target: 'Training Staff',
      sheetName: CONFIG.TRAINING_SHEET,
      headerRow: CONFIG.TRAINING_HEADER_ROW,
      dataStartRow: CONFIG.TRAINING_DATA_START_ROW,
      startHeader: CONFIG.TRAINING_START,
      endHeader: CONFIG.TRAINING_END
    }
  ].filter(function(cfg) { return requestedTarget === 'Keduanya' || cfg.target === requestedTarget; });

  // Modul diperbarui hanya pada target yang dipilih, jika ditemukan kolomnya
  let matchingMatrixCount = 0;
  matrices.forEach(function(cfg) {
    const sh = ss.getSheetByName(cfg.sheetName);
    if (!sh || !sh.getLastColumn()) return;
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(cfg.headerRow, 1, 1, lastCol).getDisplayValues()[0];
    const normalized = headers.map(normalizeHeader_);
    const moduleIndex = normalized.indexOf(normalizeHeader_(moduleName));
    const startIndex = normalized.indexOf(normalizeHeader_(cfg.startHeader));
    const endIndex = normalized.indexOf(normalizeHeader_(cfg.endHeader));
    if (moduleIndex < 0 || startIndex < 0 || endIndex < 0 ||
        moduleIndex < startIndex || moduleIndex > endIndex) return;

    matchingMatrixCount++;
    participantNiks.forEach(function(nik) {
      const row = findRowByNIK_(sh, cfg.headerRow, cfg.dataStartRow, { NIK: nik });
      if (row) sh.getRange(row, moduleIndex + 1).setValue(completed);
    });
  });

  // Bila status SELESAI tetapi modul tidak ada di matrix, lemparkan error
  // Namun bila status TERJADWAL atau ON GOING, tetap simpan ke riwayat agenda training!
  if (!matchingMatrixCount && completed) {
    throw new Error('Modul "' + moduleName + '" tidak ditemukan pada matrix training MP maupun Training Staff.');
  }

  const history = getTrainingHistorySheet_();
  const mpSheet = ss.getSheetByName(CONFIG.MP_SHEET);
  const trSheet = ss.getSheetByName(CONFIG.TRAINING_SHEET);
  const saved = [];
  const notFound = [];

  participantNiks.forEach(function(nik) {
    let employeeName = '';
    [mpSheet, trSheet].forEach(function(sh) {
      if (!sh || employeeName) return;
      const row = findRowByNIK_(
        sh,
        sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_HEADER_ROW : CONFIG.TRAINING_HEADER_ROW,
        sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_DATA_START_ROW : CONFIG.TRAINING_DATA_START_ROW,
        { NIK: nik }
      );
      if (!row) return;
      const headers = sh.getRange(
        sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_HEADER_ROW : CONFIG.TRAINING_HEADER_ROW,
        1, 1, sh.getLastColumn()
      ).getDisplayValues()[0];
      const values = sh.getRange(row, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
      const nameIndex = headers.findIndex(function(h) {
        return ['NAMA', 'NAMA KARYAWAN', 'NAME'].includes(normalizeHeader_(h));
      });
      if (nameIndex >= 0) employeeName = values[nameIndex] || '';
    });

    if (!employeeName) {
      const altName = (payload.participantNames && payload.participantNames[nik]) || payload.name || '';
      if (altName) {
        employeeName = altName;
      } else {
        const foundInMP = mpSheet && findRowByNIK_(mpSheet, CONFIG.MP_HEADER_ROW, CONFIG.MP_DATA_START_ROW, { NIK: nik });
        const foundInTR = trSheet && findRowByNIK_(trSheet, CONFIG.TRAINING_HEADER_ROW, CONFIG.TRAINING_DATA_START_ROW, { NIK: nik });
        if (!foundInMP && !foundInTR) {
          notFound.push(nik);
          return;
        }
      }
    }
    const dateDisplay = startDateText && finishDateText && startDateText !== finishDateText
      ? (startDateText + ' s/d ' + finishDateText)
      : (finishDateText || startDateText || trainingDate);
    const sessTime = payload.sessionTime || '';
    const loc = payload.location || '';
    const train = payload.trainer || '';
    history.appendRow([nik, employeeName || nik, moduleName, dateDisplay, status, new Date(), sessTime, loc, train]);
    saved.push(nik);
  });

  if (!saved.length) {
    throw new Error('Tidak ada peserta dengan NIK yang cocok di database MP atau Training Staff.');
  }

  let message = 'Hasil training tersimpan untuk ' + saved.length + ' peserta. Status: ' + status + '.';
  if (completed) {
    message += ' Matrix checklist untuk modul "' + moduleName + '" telah diperbarui.';
  } else {
    message += ' Jadwal sesi tercatat di kalender & agenda.';
  }
  return { ok: true, saved: saved, notFound: notFound, message: message };
}

function saveBulkSchedule(payload) {
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
    throw new Error('Data jadwal tidak ditemukan atau kosong.');
  }

  const ss = getSS_();
  const history = getTrainingHistorySheet_();
  const mpSheet = ss.getSheetByName(CONFIG.MP_SHEET);
  const trSheet = ss.getSheetByName(CONFIG.TRAINING_SHEET);
  let savedCount = 0;

  payload.rows.forEach(function(row) {
    const nik = String(row.nik || row.NIK || '').trim().replace(/\.0+$/, '');
    let name = String(row.name || row.NAMA || row.nama || '').trim();
    const moduleName = String(row.moduleName || row.programTraining || row['PROGRAM TRAINING'] || row.modul || '').trim();
    const startDate = String(row.startDate || row.tanggalMulai || row['TANGGAL MULAI'] || '').trim();
    const finishDate = String(row.finishDate || row.tanggalSelesai || row['TANGGAL SELESAI'] || startDate).trim();
    const rawStatus = String(row.status || row.STATUS || 'TERJADWAL').trim();
    const status = normalizeTrainingStatus_(rawStatus);

    if (!nik && !name) return;
    if (!moduleName) return;

    if (!name) {
      [mpSheet, trSheet].forEach(function(sh) {
        if (!sh || name) return;
        const r = findRowByNIK_(
          sh,
          sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_HEADER_ROW : CONFIG.TRAINING_HEADER_ROW,
          sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_DATA_START_ROW : CONFIG.TRAINING_DATA_START_ROW,
          { NIK: nik }
        );
        if (!r) return;
        const headers = sh.getRange(
          sh.getName() === CONFIG.MP_SHEET ? CONFIG.MP_HEADER_ROW : CONFIG.TRAINING_HEADER_ROW,
          1, 1, sh.getLastColumn()
        ).getDisplayValues()[0];
        const values = sh.getRange(r, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
        const nameIdx = headers.findIndex(function(h) {
          return ['NAMA', 'NAMA KARYAWAN', 'NAME'].includes(normalizeHeader_(h));
        });
        if (nameIdx >= 0) name = values[nameIdx] || '';
      });
    }

    const dateDisplay = startDate && finishDate && startDate !== finishDate
      ? (startDate + ' s/d ' + finishDate)
      : (finishDate || startDate);

    const sessTime = String(row.sessionTime || row.sesi || row.waktu || row['SESI TRAINING'] || row['SESI'] || row['WAKTU'] || '').trim();
    const loc = String(row.location || row.ruangan || row.lokasi || row['LOKASI'] || row['RUANGAN'] || '').trim();
    const train = String(row.trainer || row.instruktur || row['TRAINER'] || row['INSTRUKTUR'] || '').trim();

    history.appendRow([nik, name || nik, moduleName, dateDisplay, status, new Date(), sessTime, loc, train]);
    savedCount++;
  });

  return {
    ok: true,
    savedCount: savedCount,
    message: 'Berhasil menyinkronkan ' + savedCount + ' baris jadwal training ke Google Sheets.'
  };
}

function updateTrainingSession(payload) {
  if (!payload) throw new Error('Data sesi training tidak ditemukan.');
  const origMod = String(payload.originalModuleName || '').trim();
  const origStart = String(payload.originalStartDate || '').trim();
  const origFinish = String(payload.originalFinishDate || origStart).trim();
  const origDateDisplay = origStart && origFinish && origStart !== origFinish
    ? (origStart + ' s/d ' + origFinish)
    : origStart;

  const newMod = String(payload.newModuleName || origMod).trim();
  const newStart = String(payload.newStartDate || origStart).trim();
  const newFinish = String(payload.newFinishDate || newStart).trim();
  const newDateDisplay = newStart && newFinish && newStart !== newFinish
    ? (newStart + ' s/d ' + newFinish)
    : newStart;
  const newStatus = normalizeTrainingStatus_(payload.newStatus || 'TERJADWAL');
  const participants = Array.isArray(payload.participants) ? payload.participants : [];

  const ss = getSS_();
  const history = getTrainingHistorySheet_();
  const lastRow = history.getLastRow();

  // Hapus baris riwayat lama yang cocok dengan sesi semula (dari bawah ke atas)
  if (lastRow >= 2) {
    const values = history.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--) {
      const r = values[i];
      const rMod = String(r[2] || '').trim();
      const rDate = String(r[3] || '').trim();
      const matchMod = normalizeHeader_(rMod) === normalizeHeader_(origMod);
      const matchDate = rDate === origDateDisplay || rDate === origStart || rDate.indexOf(origStart) > -1;
      if (matchMod && matchDate) {
        history.deleteRow(i + 2);
      }
    }
  }

  // Masukkan peserta sesi yang telah diperbarui
  const mpSheet = ss.getSheetByName(CONFIG.MP_SHEET);
  const trSheet = ss.getSheetByName(CONFIG.TRAINING_SHEET);
  const now = new Date();
  let savedCount = 0;

  participants.forEach(function(p) {
    const nik = String(p.nik || '').trim();
    if (!nik) return;
    let name = String(p.name || '').trim();
    if (!name) {
      const foundInMP = mpSheet && findRowByNIK_(mpSheet, CONFIG.MP_HEADER_ROW, CONFIG.MP_DATA_START_ROW, { NIK: nik });
      const foundInTR = trSheet && findRowByNIK_(trSheet, CONFIG.TRAINING_HEADER_ROW, CONFIG.TRAINING_DATA_START_ROW, { NIK: nik });
      if (foundInMP) name = String(mpSheet.getRange(foundInMP, 2).getValue() || '').trim();
      else if (foundInTR) name = String(trSheet.getRange(foundInTR, 2).getValue() || '').trim();
    }
    const partStatus = normalizeTrainingStatus_(p.status || newStatus);
    const sessTime = String(payload.newSessionTime || payload.sessionTime || '').trim();
    const loc = String(payload.newLocation || payload.location || '').trim();
    const train = String(payload.newTrainer || payload.trainer || '').trim();
    history.appendRow([nik, name || nik, newMod, newDateDisplay, partStatus, now, sessTime, loc, train]);
    savedCount++;
  });

  // Jika status SELESAI, perbarui checklist matrix modul
  if (newStatus === 'SELESAI') {
    const completedNiks = participants
      .filter(function(p) { return normalizeTrainingStatus_(p.status || newStatus) === 'SELESAI'; })
      .map(function(p) { return String(p.nik).trim(); });
    if (completedNiks.length) {
      [CONFIG.MP_SHEET, CONFIG.TRAINING_SHEET].forEach(function(shName) {
        const sh = ss.getSheetByName(shName);
        if (!sh || !sh.getLastColumn()) return;
        const lastCol = sh.getLastColumn();
        const headerRow = shName === CONFIG.MP_SHEET ? CONFIG.MP_HEADER_ROW : CONFIG.TRAINING_HEADER_ROW;
        const dataStartRow = shName === CONFIG.MP_SHEET ? CONFIG.MP_DATA_START_ROW : CONFIG.TRAINING_DATA_START_ROW;
        const headers = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
        const normalized = headers.map(normalizeHeader_);
        const modIdx = normalized.indexOf(normalizeHeader_(newMod));
        if (modIdx >= 0) {
          completedNiks.forEach(function(nik) {
            const r = findRowByNIK_(sh, headerRow, dataStartRow, { NIK: nik });
            if (r) sh.getRange(r, modIdx + 1).setValue(true);
          });
        }
      });
    }
  }

  return { ok: true, savedCount: savedCount, message: 'Sesi training berhasil diperbarui (' + savedCount + ' peserta).' };
}

function deleteTrainingSession(payload) {
  if (!payload) throw new Error('Data sesi training tidak ditemukan.');
  const mod = String(payload.moduleName || '').trim();
  const start = String(payload.startDate || '').trim();
  const finish = String(payload.finishDate || start).trim();
  const dateDisplay = start && finish && start !== finish ? (start + ' s/d ' + finish) : start;

  const history = getTrainingHistorySheet_();
  const lastRow = history.getLastRow();
  let deletedCount = 0;

  if (lastRow >= 2) {
    const values = history.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--) {
      const r = values[i];
      const rMod = String(r[2] || '').trim();
      const rDate = String(r[3] || '').trim();
      const matchMod = normalizeHeader_(rMod) === normalizeHeader_(mod);
      const matchDate = rDate === dateDisplay || rDate === start || rDate.indexOf(start) > -1;
      if (matchMod && matchDate) {
        history.deleteRow(i + 2);
        deletedCount++;
      }
    }
  }

  return { ok: true, deletedCount: deletedCount, message: 'Sesi training berhasil dihapus (' + deletedCount + ' baris).' };
}

function addTrainingModule(moduleName) {
  const name = String(moduleName || '').trim();
  if (!name) throw new Error('Nama modul training wajib diisi.');
  if (name.length > 80) throw new Error('Nama modul maksimal 80 karakter.');
  if (/[\r\n\t]/.test(name)) throw new Error('Nama modul tidak boleh berisi baris baru.');

  const targets = [
    {
      sheetName: CONFIG.MP_SHEET,
      headerRow: CONFIG.MP_HEADER_ROW,
      dataStartRow: CONFIG.MP_DATA_START_ROW,
      endHeader: CONFIG.MP_TRAINING_END
    },
    {
      sheetName: CONFIG.TRAINING_SHEET,
      headerRow: CONFIG.TRAINING_HEADER_ROW,
      dataStartRow: CONFIG.TRAINING_DATA_START_ROW,
      endHeader: CONFIG.TRAINING_END
    }
  ];
  const addedTo = [];

  targets.forEach(function(cfg) {
    const sh = getSS_().getSheetByName(cfg.sheetName);
    if (!sh) return;
    const lastCol = sh.getLastColumn();
    if (!lastCol) return;
    const headers = sh.getRange(cfg.headerRow, 1, 1, lastCol).getDisplayValues()[0];
    const normalizedHeaders = headers.map(normalizeHeader_);
    if (normalizedHeaders.includes(normalizeHeader_(name))) return;

    const endIndex = normalizedHeaders.indexOf(normalizeHeader_(cfg.endHeader));
    if (endIndex < 0) return;
    const targetColumn = endIndex + 1;
    sh.insertColumnBefore(targetColumn);
    sh.getRange(cfg.headerRow, targetColumn).setValue(name);

    const lastRow = sh.getLastRow();
    if (lastRow >= cfg.dataStartRow) {
      sh.getRange(cfg.dataStartRow, targetColumn, lastRow - cfg.dataStartRow + 1, 1).setValue(false);
    }
    addedTo.push(cfg.sheetName);
  });

  if (!addedTo.length) {
    throw new Error('Modul sudah ada di kedua matrix atau kolom akhir matrix tidak ditemukan.');
  }
  return {
    success: true,
    message: 'Modul "' + name + '" disinkronkan ke: ' + addedTo.join(' dan ') + '.'
  };
}


/**
 * Database khusus untuk hasil import Mandatory Training.
 * Satu record unik berdasarkan NIK + PROGRAM TRAINING.
 */

const MANDATORY_DB_SHEET = 'Mandatory Training Database';
const MANDATORY_DB_HEADERS = [
  'NIK', 'NAME', 'SECTION', 'JABATAN', 'GRADE',
  'PROGRAM TRAINING', 'Start Date', 'Finish Date',
  'Score', 'STATUS', 'ACH', 'Last Imported', 'TARGET DATABASE'
];

function normalizeNIK_(value) {
  let s = String(value == null ? '' : value)
    .replace(/\u00a0/g, '')
    .trim()
    .replace(/\.0+$/, '')
    .replace(/[\s-]+/g, '')
    .toUpperCase();
  if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, '');
  return s;
}

function getMandatoryDatabaseSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(MANDATORY_DB_SHEET);
  if (!sh) {
    sh = ss.insertSheet(MANDATORY_DB_SHEET);
    sh.getRange(1, 1, 1, MANDATORY_DB_HEADERS.length).setValues([MANDATORY_DB_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const targetIdx = headers.findIndex(h => normalizeHeader_(h) === normalizeHeader_('TARGET DATABASE'));
  if (targetIdx < 0) sh.getRange(1, lastCol + 1).setValue('TARGET DATABASE');
  return sh;
}

function getMandatoryAssignments_() {
  const sh = getMandatoryDatabaseSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sh.getLastColumn();
  const values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values.shift().map(h => String(h || '').trim());
  const index = {};
  headers.forEach((h, i) => index[normalizeHeader_(h)] = i);
  const nikIdx = index['nik'], moduleIdx = index['program training'], targetIdx = index['target database'], statusIdx = index['status'];
  if (nikIdx == null || moduleIdx == null) return [];
  return values.map(r => ({
    nik: r[nikIdx] || '',
    moduleName: r[moduleIdx] || '',
    target: targetIdx == null ? '' : String(r[targetIdx] || '').trim(),
    status: statusIdx == null ? '' : String(r[statusIdx] || '').trim()
  })).filter(r => normalizeNIK_(r.nik) && r.moduleName);
}

function normalizeMandatoryStatus_(value) {
  const s = String(value == null ? '' : value).trim().toUpperCase();
  if (['DONE', 'SELESAI', 'COMPLETED', 'COMPLETE', 'PASS', 'LULUS', '1', 'TRUE'].includes(s)) return true;
  if (['NOT YET', 'NOT YET TRAINING', 'BELUM', 'BELUM TRAINING', 'BELUM SELESAI', 'PENDING', 'INCOMPLETE', '0', 'FALSE', 'TERJADWAL', 'SCHEDULED', 'UPCOMING', 'PLANNED', 'DALAM PROSES', 'ON GOING', 'ONGOING'].includes(s)) return false;
  return false;
}

function ensureMandatoryModuleColumn_(cfg, moduleName) {
  const sh = getSS_().getSheetByName(cfg.sheetName);
  if (!sh || !sh.getLastColumn()) return null;
  const headers = sh.getRange(cfg.headerRow, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const normalized = headers.map(normalizeHeader_);
  const startIndex = normalized.indexOf(normalizeHeader_(cfg.startHeader));
  const endIndex = normalized.indexOf(normalizeHeader_(cfg.endHeader));
  if (startIndex < 0 || endIndex < 0) return null;
  const moduleIndex = normalized.indexOf(normalizeHeader_(moduleName));
  if (moduleIndex >= startIndex && moduleIndex <= endIndex) return moduleIndex + 1;
  const targetColumn = endIndex + 1;
  sh.insertColumnBefore(targetColumn);
  sh.getRange(cfg.headerRow, targetColumn).setValue(moduleName);
  const lastRow = sh.getLastRow();
  if (lastRow >= cfg.dataStartRow) {
    sh.getRange(cfg.dataStartRow, targetColumn, lastRow - cfg.dataStartRow + 1, 1).setValue(false);
  }
  return targetColumn;
}

/**
 * Each imported row is a mandatory assignment:
 * Done = completed; Not Yet = mandatory but not completed.
 * Only the selected target matrix is modified.
 */
function importMandatoryTraining(payload) {
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) throw new Error('Tidak ada baris data untuk diimpor.');
  if (payload.rows.length > 5000) throw new Error('Maksimal 5.000 baris per proses import.');
  const target = String(payload.target || '').trim();
  if (!['MP', 'Training Staff'].includes(target)) throw new Error('Pilih tujuan sinkronisasi: Manpower atau Training Staff.');
  const mode = String(payload.mode || 'smart_update').trim().toLowerCase();

  const cfgs = [
    {sheetName: CONFIG.MP_SHEET, target: 'MP', headerRow: CONFIG.MP_HEADER_ROW, dataStartRow: CONFIG.MP_DATA_START_ROW, startHeader: CONFIG.MP_TRAINING_START, endHeader: CONFIG.MP_TRAINING_END},
    {sheetName: CONFIG.TRAINING_SHEET, target: 'Training Staff', headerRow: CONFIG.TRAINING_HEADER_ROW, dataStartRow: CONFIG.TRAINING_DATA_START_ROW, startHeader: CONFIG.TRAINING_START, endHeader: CONFIG.TRAINING_END}
  ];
  const cfg = cfgs.find(c => c.target === target);
  const sh = getSS_().getSheetByName(cfg.sheetName);
  if (!sh) throw new Error('Sheet "' + cfg.sheetName + '" tidak ditemukan.');

  const report = {
    target: target,
    mode: mode,
    total: payload.rows.length,
    imported: 0,
    updated: 0,
    preserved: 0,
    synced: 0,
    unmatched: 0,
    invalid: 0,
    modulesAdded: [],
    unmatchedNiks: [],
    invalidRows: []
  };

  const valid = [];
  payload.rows.forEach((source, i) => {
    const nik = String(source.NIK ?? source.nik ?? '').trim().replace(/\.0+$/, '');
    const name = String(source.NAME ?? source.name ?? '').trim();
    const moduleName = String(source['PROGRAM TRAINING'] ?? source.programTraining ?? source.moduleName ?? '').trim();
    const done = normalizeMandatoryStatus_(source.STATUS ?? source.status ?? '');
    if (!normalizeNIK_(nik) || !moduleName || done === null) {
      report.invalid++;
      report.invalidRows.push(i + 1);
      return;
    }
    valid.push({
      nik: nik,
      name: name,
      moduleName: moduleName,
      done: done,
      rowData: [
        nik,
        name,
        String(source.SECTION ?? source.section ?? ''),
        String(source.JABATAN ?? source.jabatan ?? ''),
        String(source.GRADE ?? source.grade ?? ''),
        moduleName,
        String(source['Start Date'] ?? source.startDate ?? ''),
        String(source['Finish Date'] ?? source.finishDate ?? ''),
        String(source.Score ?? source.score ?? ''),
        done ? 'Done' : 'Not Yet',
        String(source.ACH ?? source.ach ?? (done ? 1 : 0)),
        new Date(),
        target
      ]
    });
  });
  if (!valid.length) throw new Error('Tidak ada baris valid. Pastikan NIK, PROGRAM TRAINING, dan STATUS terisi dengan benar.');

  // Baca database lama untuk identifikasi data yang sudah ada
  const db = getMandatoryDatabaseSheet_();
  const dbLast = db.getLastRow(), dbCols = db.getLastColumn();
  const dbHeaders = db.getRange(1, 1, 1, dbCols).getDisplayValues()[0].map(normalizeHeader_);
  const dIdx = {};
  dbHeaders.forEach((h, i) => dIdx[h] = i);
  const dbRows = dbLast >= 2 ? db.getRange(2, 1, dbLast - 1, dbCols).getDisplayValues() : [];
  const dbIndex = new Map();
  const dbExistingRecord = new Map();

  dbRows.forEach((r, i) => {
    const key = String(r[dIdx['target database']] || '').trim() + '|' + normalizeNIK_(r[dIdx['nik']]) + '|' + normalizeHeader_(r[dIdx['program training']]);
    if (!dbIndex.has(key)) {
      dbIndex.set(key, i + 2);
      dbExistingRecord.set(key, {
        statusText: String(r[dIdx['status']] || '').trim(),
        isDone: normalizeMandatoryStatus_(r[dIdx['status']]) === true,
        finishDate: String(r[dIdx['finish date']] || '').trim(),
        rowValues: r
      });
    }
  });

  const moduleColumns = {};
  [...new Set(valid.map(r => r.moduleName))].forEach(moduleName => {
    const before = sh.getLastColumn();
    const col = ensureMandatoryModuleColumn_(cfg, moduleName);
    moduleColumns[normalizeHeader_(moduleName)] = col;
    if (col && sh.getLastColumn() > before) report.modulesAdded.push(target + ': ' + moduleName);
  });

  const lastRow = sh.getLastRow();
  const headers = sh.getRange(cfg.headerRow, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const nikIndex = headers.findIndex(h => normalizeHeader_(h) === 'nik');
  if (nikIndex < 0) throw new Error('Kolom NIK tidak ditemukan pada sheet ' + cfg.sheetName + '.');
  const nikToRow = new Map();
  if (lastRow >= cfg.dataStartRow) {
    sh.getRange(cfg.dataStartRow, nikIndex + 1, lastRow - cfg.dataStartRow + 1, 1).getDisplayValues().forEach((r, i) => {
      const key = normalizeNIK_(r[0]);
      if (key && !nikToRow.has(key)) nikToRow.set(key, cfg.dataStartRow + i);
    });
  }

  // Pembaruan Matrix Checklist: Lindungi checklist yang sudah SELESAI agar tidak hilang/berubah
  const updatesByModule = {};
  valid.forEach(r => {
    const rowNum = nikToRow.get(normalizeNIK_(r.nik));
    const col = moduleColumns[normalizeHeader_(r.moduleName)];
    if (!rowNum || !col) {
      report.unmatched++;
      if (report.unmatchedNiks.length < 100) report.unmatchedNiks.push(r.nik + (r.name ? ' - ' + r.name : '') + ' [' + r.moduleName + ']');
      return;
    }

    const key = target + '|' + normalizeNIK_(r.nik) + '|' + normalizeHeader_(r.moduleName);
    const existing = dbExistingRecord.get(key);

    if (mode !== 'overwrite') {
      // Jika data lama sudah Done di database, jangan hilangkan centang (jangan ubah jadi false)
      if (existing && existing.isDone && !r.done) {
        return; // Data lama tetap dipertahankan utuh
      }
      if (mode === 'new_only' && existing) {
        return; // Mode tambah baru: jangan ubah checklist lama
      }
    }

    if (!updatesByModule[col]) updatesByModule[col] = new Map();
    updatesByModule[col].set(rowNum, r.done);
    report.synced++;
  });

  Object.keys(updatesByModule).forEach(colKey => {
    const col = Number(colKey);
    if (lastRow < cfg.dataStartRow) return;
    const range = sh.getRange(cfg.dataStartRow, col, lastRow - cfg.dataStartRow + 1, 1);
    const values = range.getValues();
    updatesByModule[col].forEach((done, rowNum) => { values[rowNum - cfg.dataStartRow][0] = done; });
    range.setValues(values);
  });

  // Pembaruan Mandatory Training Database:
  // Data lama ditetapkan, tidak hilang, dan tidak ditimpa oleh data yang lebih lama/downgrade.
  const toUpdate = new Map(), toAppend = [], newIndex = new Map();
  let preservedCount = 0;

  valid.forEach(r => {
    const key = target + '|' + normalizeNIK_(r.nik) + '|' + normalizeHeader_(r.moduleName);
    const existing = dbExistingRecord.get(key);

    if (existing) {
      const rowNumber = dbIndex.get(key);

      if (mode === 'new_only') {
        // Mode hanya tambah baru: data lama 100% dilewati dan tidak diubah
        preservedCount++;
        return;
      }

      if (mode === 'smart_update') {
        // ATURAN: Data lama ditetapkan dan tidak berubah secara merugikan
        // 1. Jika data lama sudah Done, dan import Not Yet: Lindungi data lama!
        if (existing.isDone && !r.done) {
          preservedCount++;
          return;
        }

        // 2. Jika data lama Not Yet, dan data Excel sekarang Done: Update ke status terbaru!
        if (!existing.isDone && r.done) {
          toUpdate.set(rowNumber, r.rowData);
          return;
        }

        // 3. Jika sama-sama Done: perbarui tanggal/skor bila ada data baru, tetap Done
        if (existing.isDone && r.done) {
          if (r.rowData[6] || r.rowData[7] || r.rowData[8]) {
            toUpdate.set(rowNumber, r.rowData);
          } else {
            preservedCount++;
          }
          return;
        }

        // 4. Jika sama-sama Not Yet: data lama ditetapkan
        preservedCount++;
        return;
      }

      // mode === 'overwrite'
      toUpdate.set(rowNumber, r.rowData);
    } else if (newIndex.has(key)) {
      toAppend[newIndex.get(key)] = r.rowData;
    } else {
      newIndex.set(key, toAppend.length);
      toAppend.push(r.rowData);
    }
  });

  toUpdate.forEach((values, rowNum) => db.getRange(rowNum, 1, 1, MANDATORY_DB_HEADERS.length).setValues([values]));
  if (toAppend.length) db.getRange(db.getLastRow() + 1, 1, toAppend.length, MANDATORY_DB_HEADERS.length).setValues(toAppend);

  report.updated = toUpdate.size;
  report.imported = toAppend.length;
  report.preserved = preservedCount;
  report.modulesAdded = [...new Set(report.modulesAdded)];
  return report;
}



/**
 * API bridge untuk aplikasi React yang dibangun di Google AI Studio.
 * Deploy sebagai Web App dan batasi akses ke akun/organisasi yang berwenang.
 * Menggunakan JSONP agar request lintas origin tidak terganjal CORS.
 */
function handleApiRequest_(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('/* Invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  try {
    const action = String(params.action || '');
    const payload = params.payload ? JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(params.payload)).getDataAsString('UTF-8')) : null;
    const data = dispatchApiAction_(action, payload);
    return jsonpResponse_(callback, { ok: true, data: data });
  } catch (err) {
    return jsonpResponse_(callback, { ok: false, message: err && err.message ? err.message : String(err) });
  }
}

function jsonpResponse_(callback, result) {
  const json = JSON.stringify(result).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function dispatchApiAction_(action, payload) {
  switch (action) {
    case 'ping':
    case 'testConnection':
      return {
        status: 'ok',
        message: 'Koneksi ke Google Sheets KAI GAM Berhasil',
        spreadsheetName: getSS_().getName(),
        spreadsheetId: getSS_().getId(),
        timestamp: new Date().toISOString()
      };
    case 'getInitialData': return getInitialData();
    case 'getDashboard': return getDashboard();
    case 'getTrainingHistory': return getTrainingHistory();
    case 'saveMP': return saveMP(payload && payload.record, payload && payload.rowNumber);
    case 'saveTraining': return saveTraining(payload && payload.record, payload && payload.rowNumber);
    case 'saveTrainingResult': return saveTrainingResult(payload);
    case 'saveBulkSchedule': return saveBulkSchedule(payload);
    case 'updateTrainingSession': return updateTrainingSession(payload);
    case 'deleteTrainingSession': return deleteTrainingSession(payload);
    case 'addTrainingModule': return addTrainingModule(payload && payload.moduleName);
    case 'importMandatoryTraining': return importMandatoryTraining(payload);
    default: throw new Error('Aksi API tidak diizinkan: ' + action);
  }
}
