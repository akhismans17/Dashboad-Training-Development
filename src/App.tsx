import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownToLine, BarChart3, BookOpenCheck, Calendar, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Cloud, Copy, Database, FileSpreadsheet, Filter, GraduationCap, LayoutDashboard,
  LoaderCircle, Menu, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, Upload, Users, UserRoundCog, X, RotateCcw, CalendarClock
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import {
  jsonp,
  ApiAction,
  testAppsScriptConnection,
  TestConnectionResult,
  getStoredAppsScriptUrl,
  saveStoredAppsScriptUrl,
  clearStoredAppsScriptUrl,
  normalizeAppsScriptUrl
} from './api';
import { CalendarPage } from './components/CalendarPage';
import {
  normalizeDateToISO,
  extractItemDates,
  normalizeScheduleRow,
  getTodayISO
} from './dateUtils';

type Row = Record<string, any>;
type InitialData = {
  mp: Row[];
  training: Row[];
  mpHeaders: string[];
  trainingHeaders: string[];
  mpTrainingHeaders: string[];
  trainingMatrixHeaders: string[];
  mandatoryAssignments: { nik: string; moduleName: string; target: string; status?: string }[];
};
type Tab = 'dashboard' | 'manpower' | 'matrix' | 'records' | 'calendar' | 'mandatory' | 'settings';

interface ImportPreviewData {
  fileName: string;
  totalRows: number;
  newCount: number;
  upgradeCount: number;
  preservedCount: number;
  unmatchedCount: number;
  sampleRows: Array<{
    nik: string;
    name: string;
    module: string;
    status: string;
    category: 'NEW' | 'UPGRADE' | 'PRESERVED' | 'UNMATCHED';
  }>;
  normalizedRows: Row[];
}

interface TestFeedback {
  status: 'success' | 'error' | 'loading' | 'idle';
  message: string;
  timestamp?: string;
  details?: string;
}

const COLORS = ['#4263eb', '#16a6a1', '#f59f0b', '#8b5cf6', '#f06595', '#0ea5e9', '#65a30d', '#f97316'];
const DEFAULT_URL = '';

const key = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const findKey = (row: Row, names: string[]) => {
  const wanted = names.map(key);
  const actual = Object.keys(row || {});
  const hit = actual.find(k => wanted.includes(key(k)));
  return hit ? row[hit] : '';
};
const nikOf = (r: Row) => String(findKey(r, ['NIK', 'Employee NIK', 'Nomor Induk Karyawan'])).trim().replace(/\.0+$/, '').replace(/[\s-]/g, '').replace(/^0+(?=\d)/, '');
const nameOf = (r: Row) => String(findKey(r, ['NAME', 'NAMA', 'Nama Karyawan'])).trim();
const sectionOf = (r: Row) => String(findKey(r, ['SECTION', 'Section'])).trim() || 'Belum diisi';
const subsectionOf = (r: Row) => String(findKey(r, ['SubSection', 'SUB SECTION', 'Sub Section'])).trim() || 'Belum diisi';
const gradeOf = (r: Row) => String(findKey(r, ['GRADE', 'Grade'])).trim() || 'Belum diisi';
const jobOf = (r: Row) => String(findKey(r, ['JABATAN', 'POSITION', 'Job Title'])).trim();
const isDone = (v: unknown) => v === true || v === 1 || ['true', '1', 'done', 'selesai', 'completed', 'complete', 'yes', '✓', '✔'].includes(String(v ?? '').trim().toLowerCase());
const isHistoryDone = (v: unknown) => {
  const s = String(v ?? '').trim().toUpperCase();
  return (s === 'SELESAI' || s === 'DONE' || s === 'COMPLETED') && !s.startsWith('BELUM');
};
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const percent = (n: number) => `${Number.isFinite(n) ? n.toFixed(1).replace('.', ',') : '0,0'}%`;
const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function demoHistory(): Row[] {
  // Total sesi training dihapus (0 sesi) sesuai permintaan user, agar agenda dapat diisi murni dari upload Excel
  return [];
}


function demoData(): InitialData {
  const mpModules = ['BMC', 'Electrical System', 'AC System', 'Engine Basic', 'Hydraulic'];
  const trModules = ['Avengers', 'QCC', 'Leadership', 'Safety Awareness'];
  const mp = [
    { NIK: '10001', NAME: 'Andi Pratama', SECTION: 'Maintenance', SubSection: 'Mechanical', GRADE: 'G7', JABATAN: 'Mechanic', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: true, 'Electrical System': true, 'AC System': false, 'Engine Basic': true, Hydraulic: false },
    { NIK: '10002', NAME: 'Budi Santoso', SECTION: 'Maintenance', SubSection: 'Electrical', GRADE: 'G6', JABATAN: 'Mechanic', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: true, 'Electrical System': false, 'AC System': true, 'Engine Basic': false, Hydraulic: false },
    { NIK: '10003', NAME: 'Citra Wulandari', SECTION: 'Planning', SubSection: 'Planning', GRADE: 'G8', JABATAN: 'Planner', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: false, 'Electrical System': true, 'AC System': true, 'Engine Basic': true, Hydraulic: true },
    { NIK: '10004', NAME: 'Dedi Saputra', SECTION: 'Maintenance', SubSection: 'Mechanical', GRADE: 'G5', JABATAN: 'Mechanic', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: true, 'Electrical System': false, 'AC System': false, 'Engine Basic': false, Hydraulic: false },
    { NIK: '10005', NAME: 'Eka Putri', SECTION: 'Reliability', SubSection: 'Reliability', GRADE: 'G8', JABATAN: 'Engineer', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: true, 'Electrical System': true, 'AC System': true, 'Engine Basic': true, Hydraulic: true },
    { NIK: '10006', NAME: 'Fajar Nugraha', SECTION: 'Maintenance', SubSection: 'Electrical', GRADE: 'G6', JABATAN: 'Mechanic', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: false, 'Electrical System': true, 'AC System': false, 'Engine Basic': true, Hydraulic: false },
    { NIK: '10007', NAME: 'Gilang Ramadhan', SECTION: 'Maintenance', SubSection: 'Mechanical', GRADE: 'G5', JABATAN: '', SITE: 'PT Karunia Armada Indonesia Site GAM', BMC: false, 'Electrical System': false, 'AC System': false, 'Engine Basic': false, Hydraulic: false }
  ];
  const training = [
    { NIK: '20001', NAME: 'Hana Lestari', SECTION: 'Training', SubSection: 'Training Staff', GRADE: 'G7', JABATAN: 'Training Specialist', SITE: 'PT Karunia Armada Indonesia Site GAM', Avengers: true, QCC: true, Leadership: false, 'Safety Awareness': true },
    { NIK: '20002', NAME: 'Indra Kurniawan', SECTION: 'Training', SubSection: 'Training Staff', GRADE: 'G6', JABATAN: 'Instructor', SITE: 'PT Karunia Armada Indonesia Site GAM', Avengers: true, QCC: false, Leadership: true, 'Safety Awareness': false }
  ];
  return {
    mp,
    training,
    mpHeaders: Object.keys(mp[0]),
    trainingHeaders: Object.keys(training[0]),
    mpTrainingHeaders: mpModules,
    trainingMatrixHeaders: trModules,
    mandatoryAssignments: [
      { nik: '10001', moduleName: 'BMC', target: 'MP' },
      { nik: '10001', moduleName: 'AC System', target: 'MP' },
      { nik: '10002', moduleName: 'BMC', target: 'MP' },
      { nik: '10002', moduleName: 'Electrical System', target: 'MP' },
      { nik: '10004', moduleName: 'BMC', target: 'MP' },
      { nik: '20001', moduleName: 'Avengers', target: 'Training Staff' },
      { nik: '20001', moduleName: 'QCC', target: 'Training Staff' },
      { nik: '20002', moduleName: 'Avengers', target: 'Training Staff' }
    ]
  };
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [apiUrl, setApiUrl] = useState(() => getStoredAppsScriptUrl() || DEFAULT_URL);
  const [draftUrl, setDraftUrl] = useState(() => getStoredAppsScriptUrl() || DEFAULT_URL);
  const [data, setData] = useState<InitialData>(demoData());
  const [history, setHistory] = useState<Row[]>(() => demoHistory());
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testFeedback, setTestFeedback] = useState<TestFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [target, setTarget] = useState<'MP' | 'Training Staff'>('MP');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('Semua Section');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [recordModule, setRecordModule] = useState('');
  const [recordStartDate, setRecordStartDate] = useState(today());
  const [recordFinishDate, setRecordFinishDate] = useState(today());
  const [recordStatus, setRecordStatus] = useState('SELESAI');
  const [recordTarget, setRecordTarget] = useState<'MP' | 'Training Staff' | 'Keduanya'>('MP');
  const [selectedNiks, setSelectedNiks] = useState<string[]>([]);
  const [importTarget, setImportTarget] = useState<'MP' | 'Training Staff'>('MP');
  const [importMode, setImportMode] = useState<'smart_update' | 'new_only' | 'overwrite'>('smart_update');
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const call = useCallback(<T,>(action: ApiAction, payload?: unknown) => jsonp<T>(apiUrl, action, payload), [apiUrl]);

  // Execute actual test connection and update app state
  const runTestConnection = useCallback(async (targetUrl: string, autoSaveOnSuccess = false): Promise<boolean> => {
    const raw = String(targetUrl || '').trim();
    if (!raw) {
      const emptyMsg = 'Masukkan URL Web App Google Apps Script terlebih dahulu.';
      setTestFeedback({
        status: 'error',
        message: emptyMsg,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        details: 'Buka Google Spreadsheet Anda > Extensions > Apps Script > Deploy > New deployment > Web App.'
      });
      setNotice({
        type: 'error',
        text: emptyMsg
      });
      return false;
    }

    const norm = normalizeAppsScriptUrl(raw);
    if (!norm.valid) {
      const formatMsg = norm.error || 'Format URL tidak valid.';
      setTestFeedback({
        status: 'error',
        message: formatMsg,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        details: 'Pastikan URL berakhiran /exec dan memiliki domain script.google.com/macros/s/...'
      });
      setNotice({
        type: 'error',
        text: formatMsg
      });
      return false;
    }

    const clean = norm.url;

    // Jika dipanggil dari tombol simpan, simpan langsung URL-nya
    if (autoSaveOnSuccess) {
      saveStoredAppsScriptUrl(clean);
      setApiUrl(clean);
      setDraftUrl(clean);
    }

    setTestingConnection(true);
    setTestFeedback({
      status: 'loading',
      message: 'Sedang menghubungi Google Apps Script & menguji action getInitialData (batas waktu 18 detik)...',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      details: 'Memverifikasi endpoint /exec, parameter api=1, callback JSONP, serta membaca sheet MP & Training Staff...'
    });

    try {
      const res: TestConnectionResult = await testAppsScriptConnection(clean, 18000);
      if (res.success && res.data) {
        setConnected(true);
        saveStoredAppsScriptUrl(clean);
        setApiUrl(clean);
        setDraftUrl(clean);

        // Muat data langsung dari Google Sheets ke dashboard & tabel
        setData({
          ...res.data,
          mandatoryAssignments: res.data.mandatoryAssignments || []
        });

        // Load training history if available and normalize each record
        try {
          const hist = await jsonp<Row[]>(clean, 'getTrainingHistory', null, 12000);
          if (Array.isArray(hist) && hist.length > 0) {
            const rawPeople = [...(res.data.mp || []), ...(res.data.training || [])];
            const normalizedHist = hist.map(r => normalizeScheduleRow(r, rawPeople));
            setHistory(prev => {
              // Preserve any newly added local records that might not yet exist in Google Sheets
              const histKeys = new Set(
                normalizedHist.map(h => `${h.nik}__${String(h.moduleName).toLowerCase()}__${h.startDate}__${h.finishDate}`)
              );
              const pendingLocal = prev.filter(p => {
                const pNik = String(p.nik || p.NIK || '').trim();
                const pMod = String(p.moduleName || p.program || p.module || '').trim().toLowerCase();
                const pStart = p.startDate || p.tanggalMulai || '';
                const pFinish = p.finishDate || p.tanggalSelesai || pStart;
                return !histKeys.has(`${pNik}__${pMod}__${pStart}__${pFinish}`);
              });
              return [...pendingLocal, ...normalizedHist];
            });
          }
        } catch {
          // Training history optional
        }

        const successMsg = `Koneksi berhasil! Terhubung ke Google Spreadsheet KAI GAM (${res.totalMP || 0} personel MP dimuat).`;
        setTestFeedback({
          status: 'success',
          message: successMsg,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          details: `Ditemukan ${res.totalMP || 0} baris manpower dan ${res.totalStaff || 0} data training staff.`
        });
        setNotice({ type: 'success', text: successMsg });
        return true;
      } else {
        setConnected(false);
        const errMsg = res.error || res.message || 'Gagal terhubung ke Google Apps Script.';
        setTestFeedback({
          status: 'error',
          message: errMsg,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          details: 'Periksa hak akses Web App di Apps Script (Who has access: Anyone) dan pastikan versi deployment sudah diperbarui.'
        });
        setNotice({ type: 'error', text: `Koneksi Google Sheets Gagal: ${errMsg}` });
        // Sesuai aturan: JANGAN menimpa data yang ada dengan data demo jika koneksi gagal!
        return false;
      }
    } catch (err: any) {
      setConnected(false);
      const errMsg = err?.message || 'Gagal terhubung ke Google Apps Script.';
      setTestFeedback({
        status: 'error',
        message: errMsg,
        timestamp: new Date().toLocaleTimeString('id-ID')
      });
      setNotice({ type: 'error', text: `Koneksi Gagal: ${errMsg}` });
      return false;
    } finally {
      setTestingConnection(false);
    }
  }, []);

  // Topbar refresh function
  const refresh = useCallback(async () => {
    if (!apiUrl.trim()) {
      setConnected(false);
      setNotice({
        type: 'info',
        text: 'Mode demo aktif. Hubungkan URL Apps Script pada menu Pengaturan untuk memuat data aktual dari Google Sheets.'
      });
      return;
    }
    setLoading(true);
    try {
      await runTestConnection(apiUrl, true);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, runTestConnection]);

  // Initial connection test on mount if stored URL exists
  useEffect(() => {
    const saved = getStoredAppsScriptUrl();
    if (saved && saved.trim()) {
      runTestConnection(saved.trim(), true);
    }
  }, [runTestConnection]);

  // Auto-dismiss notice after 8 seconds
  useEffect(() => {
    if (notice) {
      const t = window.setTimeout(() => setNotice(null), 8000);
      return () => clearTimeout(t);
    }
  }, [notice]);

  const rows = target === 'MP' ? data.mp : data.training;
  const headers = target === 'MP' ? data.mpHeaders : data.trainingHeaders;
  const modules = target === 'MP' ? data.mpTrainingHeaders : data.trainingMatrixHeaders;
  const allModules = useMemo(() => [...new Set([...data.mpTrainingHeaders, ...data.trainingMatrixHeaders])], [data.mpTrainingHeaders, data.trainingMatrixHeaders]);
  const allPeople = useMemo(() => [...data.mp.map(r => ({ ...r, __target: 'MP' })), ...data.training.map(r => ({ ...r, __target: 'Training Staff' }))].filter(r => nikOf(r)), [data]);
  const totalMP = data.mp.filter(r => nikOf(r)).length;
  const activeMP = data.mp.filter(r => nikOf(r) && jobOf(r)).length;
  const inactiveMP = Math.max(0, totalMP - activeMP);
  const totalAssigned = data.mandatoryAssignments.filter(a => !a.target || a.target === 'MP').length;
  const mandatoryStats = useMemo(() => modulesStats(data.mp, data.mpTrainingHeaders, 'MP', data.mandatoryAssignments), [data]);
  const staffMandatoryStats = useMemo(() => modulesStats(data.training, data.trainingMatrixHeaders, 'Training Staff', data.mandatoryAssignments), [data]);
  const nonMandatoryStats = useMemo(() => [
    ...modulesStats(data.mp, data.mpTrainingHeaders, 'MP', data.mandatoryAssignments, true).map(x => ({ ...x, name: `MP · ${x.name}` })),
    ...modulesStats(data.training, data.trainingMatrixHeaders, 'Training Staff', data.mandatoryAssignments, true).map(x => ({ ...x, name: `Staff · ${x.name}` }))
  ], [data]);
  const sectionData = useMemo(() => countBy(data.mp.filter(r => nikOf(r)), sectionOf), [data]);
  const gradeData = useMemo(() => {
    const valid = data.mp
      .filter(r => nikOf(r))
      .filter(r => {
        const raw = String(findKey(r, ['GRADE', 'Grade'])).trim();
        return Boolean(raw && raw !== '-' && !/belum/i.test(raw) && raw.toLowerCase() !== 'n/a');
      });
    return countBy(valid, gradeOf);
  }, [data]);
  const filteredRows = useMemo(() => rows.filter(r => {
    const q = search.toLowerCase();
    const fieldsToSearch = target === 'Training Staff'
      ? [nikOf(r), nameOf(r), sectionOf(r), jobOf(r)]
      : [nikOf(r), nameOf(r), sectionOf(r), subsectionOf(r), gradeOf(r), jobOf(r)];
    const match = !q || fieldsToSearch.some(v => String(v).toLowerCase().includes(q));
    const sectionMatch = sectionFilter === 'Semua Section' || sectionOf(r) === sectionFilter;
    const statusMatch = statusFilter === 'ALL'
      ? true
      : statusFilter === 'ACTIVE'
      ? Boolean(jobOf(r))
      : !jobOf(r);
    return match && sectionMatch && statusMatch;
  }), [rows, search, sectionFilter, statusFilter, target]);
  const sections = useMemo(() => [...new Set((target === 'MP' ? data.mp : data.training).filter(r => nikOf(r)).map(sectionOf))].sort(), [data, target]);

  const saveRecord = async (record: Row, mode: 'MP' | 'Training Staff', create: boolean) => {
    if (!apiUrl.trim() || !connected) {
      const setter = mode === 'MP' ? (r: Row[]) => setData(d => ({ ...d, mp: r })) : (r: Row[]) => setData(d => ({ ...d, training: r }));
      const source = mode === 'MP' ? data.mp : data.training;
      const next = create ? [...source, record] : source.map(r => nikOf(r) === nikOf(record) ? record : r);
      setter(next);
      setEditRow(null);
      setNotice({ type: 'info', text: 'Perubahan disimpan di sesi lokal (Mode Demo). Hubungkan Google Sheets agar tersimpan ke spreadsheet.' });
      return;
    }
    setSaving(true);
    try {
      await call(mode === 'MP' ? 'saveMP' : 'saveTraining', { record });
      setEditRow(null);
      await refresh();
      setNotice({ type: 'success', text: 'Data personel berhasil disimpan ke Google Sheets.' });
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Gagal menyimpan data ke Google Sheets.' });
    } finally {
      setSaving(false);
    }
  };

  const saveTrainingCheck = async (row: Row, moduleName: string, checked: boolean) => {
    const next = { ...row, [moduleName]: checked };
    if (!apiUrl.trim() || !connected) {
      const source = target === 'MP' ? data.mp : data.training;
      const updated = source.map(r => nikOf(r) === nikOf(row) ? next : r);
      setData(d => target === 'MP' ? ({ ...d, mp: updated }) : ({ ...d, training: updated }));
      setNotice({ type: 'info', text: 'Checklist berubah pada sesi lokal (Mode Demo).' });
      return;
    }
    setSaving(true);
    try {
      await call(target === 'MP' ? 'saveMP' : 'saveTraining', { record: next });
      await refresh();
      setNotice({ type: 'success', text: `${moduleName}: status checklist diperbarui di Google Sheets.` });
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Gagal memperbarui checklist di Google Sheets.' });
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async () => {
    if (!recordModule || !recordStartDate || !recordFinishDate || !selectedNiks.length) {
      setNotice({ type: 'error', text: 'Pilih modul training, tanggal mulai (start), tanggal selesai (finish), dan minimal satu peserta.' });
      return;
    }
    if (recordFinishDate < recordStartDate) {
      setNotice({ type: 'error', text: 'Tanggal selesai (finish) tidak boleh lebih awal dari tanggal mulai (start).' });
      return;
    }
    const dateDisplay = recordStartDate === recordFinishDate
      ? recordStartDate
      : `${recordStartDate} s/d ${recordFinishDate}`;

    let cleanStatus = String(recordStatus || 'SELESAI').trim().toUpperCase();
    if (cleanStatus === 'ON GOING' || cleanStatus === 'ONGOING' || cleanStatus === 'IN PROGRESS') {
      cleanStatus = 'DALAM PROSES';
    }
    if (cleanStatus === 'SCHEDULED' || cleanStatus === 'UPCOMING' || cleanStatus === 'PLANNED') {
      cleanStatus = 'TERJADWAL';
    }

    const payload = {
      participantNiks: selectedNiks,
      moduleName: recordModule,
      startDate: recordStartDate,
      finishDate: recordFinishDate,
      trainingDate: recordFinishDate,
      dateDisplay,
      status: cleanStatus,
      target: recordTarget
    };
    if (!apiUrl.trim() || !connected) {
      const newHist = [
        ...selectedNiks.map(nik => ({
          nik,
          name: nameOf(allPeople.find(p => nikOf(p) === nik) || {}),
          moduleName: recordModule,
          startDate: recordStartDate,
          finishDate: recordFinishDate,
          trainingDate: dateDisplay,
          status: cleanStatus,
          inputTime: new Date().toLocaleString('id-ID')
        })),
        ...history
      ];
      setHistory(newHist);
      setNotice({ type: 'info', text: 'Hasil training tersimpan pada sesi demo. Hubungkan Google Sheets untuk pencatatan aktual.' });
      setSelectedNiks([]);
      return;
    }
    setSaving(true);
    try {
      const result: any = await call('saveTrainingResult', payload);
      await refresh();
      setNotice({ type: 'success', text: result?.message || 'Riwayat training berhasil disimpan ke Google Sheets.' });
      setSelectedNiks([]);
    } catch (e: any) {
      const errMsg = String(e?.message || '');
      if (errMsg.includes('Status training tidak valid') || errMsg.includes('tidak valid')) {
        // Fallback: save to history locally so that user work is NEVER lost!
        const newHist = [
          ...selectedNiks.map(nik => ({
            nik,
            name: nameOf(allPeople.find(p => nikOf(p) === nik) || {}),
            moduleName: recordModule,
            startDate: recordStartDate,
            finishDate: recordFinishDate,
            trainingDate: dateDisplay,
            status: cleanStatus,
            inputTime: new Date().toLocaleString('id-ID')
          })),
          ...history
        ];
        setHistory(newHist);
        setSelectedNiks([]);
        setNotice({
          type: 'info',
          text: `Jadwal training tersimpan di Kalender & Agenda. Catatan: Web App Apps Script Anda belum diperbarui ke versi Code.gs terbaru yang mendukung status '${cleanStatus}'. Silakan salin Code.gs terbaru di tab Pengaturan.`
        });
        return;
      }
      setNotice({ type: 'error', text: e?.message || 'Gagal menyimpan riwayat training ke Google Sheets.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScheduleFromCalendar = async (payload: {
    participantNiks: string[];
    moduleName: string;
    startDate: string;
    finishDate: string;
    status: string;
    target: 'MP' | 'Training Staff' | 'Keduanya';
    sessionTime?: string;
    location?: string;
    trainer?: string;
  }) => {
    const sDate = normalizeDateToISO(payload.startDate) || today();
    const fDate = normalizeDateToISO(payload.finishDate) || sDate;
    const dateDisplay = sDate === fDate ? sDate : `${sDate} s/d ${fDate}`;

    let cleanStatus = String(payload.status || 'TERJADWAL').trim().toUpperCase();
    if (['ON GOING', 'ONGOING', 'IN PROGRESS', 'PROGRESS', 'BERJALAN'].includes(cleanStatus)) {
      cleanStatus = 'DALAM PROSES';
    } else if (['SELESAI', 'DONE', 'COMPLETED', 'PASS', 'LULUS', '1', 'TRUE'].includes(cleanStatus)) {
      cleanStatus = 'SELESAI';
    } else if (['BELUM SELESAI', 'BELUM', 'NOT YET', 'PENDING'].includes(cleanStatus)) {
      cleanStatus = 'BELUM SELESAI';
    } else {
      cleanStatus = 'TERJADWAL';
    }

    const sessionTime = payload.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)';
    const location = payload.location || 'Ruang Training GAM (Lt. 2)';
    const trainer = payload.trainer || '';

    const newRows: Row[] = payload.participantNiks.map(nik => {
      return normalizeScheduleRow({
        nik,
        moduleName: payload.moduleName,
        startDate: sDate,
        finishDate: fDate,
        trainingDate: dateDisplay,
        status: cleanStatus,
        target: payload.target,
        sessionTime,
        location,
        trainer,
        inputTime: new Date().toLocaleString('id-ID')
      }, allPeople);
    });

    // Update state immediately with guaranteed ISO date formats and complete fields
    setHistory(prev => {
      const newKeys = new Set(
        newRows.map(r => `${r.nik}__${String(r.moduleName).toLowerCase()}__${r.startDate}__${r.finishDate}__${r.sessionTime}`)
      );
      const filteredPrev = prev.filter(p => {
        const pKey = `${String(p.nik || p.NIK || '').trim()}__${String(p.moduleName || p.program || p.module || '').trim().toLowerCase()}__${p.startDate || p.tanggalMulai || ''}__${p.finishDate || p.tanggalSelesai || ''}__${p.sessionTime || ''}`;
        return !newKeys.has(pKey);
      });
      return [...newRows, ...filteredPrev];
    });

    if (!apiUrl.trim() || !connected) {
      setNotice({
        type: 'success',
        text: `Jadwal ${payload.moduleName} (${payload.participantNiks.length} peserta) berhasil ditambahkan ke Kalender & Agenda!`
      });
      return;
    }

    setSaving(true);
    try {
      await call('saveTrainingResult', {
        participantNiks: payload.participantNiks,
        moduleName: payload.moduleName,
        startDate: sDate,
        finishDate: fDate,
        trainingDate: dateDisplay,
        dateDisplay,
        status: cleanStatus,
        target: payload.target,
        sessionTime,
        location,
        trainer
      });
      await refresh();
      setNotice({
        type: 'success',
        text: `Jadwal ${payload.moduleName} berhasil disinkronkan ke Google Sheets dan Kalender.`
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('Status training tidak valid') || msg.includes('tidak valid')) {
        setNotice({
          type: 'info',
          text: `Jadwal tersimpan di Kalender & Agenda. Untuk sinkronisasi status '${cleanStatus}' ke Google Sheets, pastikan Code.gs pada Apps Script telah diperbarui.`
        });
      } else {
        setNotice({
          type: 'info',
          text: `Jadwal tersimpan di Kalender & Agenda lokal (${err?.message || 'Sinkronisasi tertunda'}).`
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllSessions = useCallback(() => {
    setHistory([]);
    setNotice({
      type: 'info',
      text: 'Total sesi training berhasil dihapus (0 sesi). Kalender siap menerima jadwal baru dari Excel.'
    });
  }, []);

  const handleImportScheduleRows = async (rows: Row[], overwriteExisting = false) => {
    if (!rows.length) return;

    // Normalize each imported row with clean ISO dates, names, modules, and sessions
    const cleanRows: Row[] = rows.map(r => normalizeScheduleRow(r, allPeople));

    // Update history state immediately
    if (overwriteExisting) {
      setHistory(cleanRows);
    } else {
      setHistory(prev => {
        const cleanKeys = new Set(
          cleanRows.map(r => `${r.nik}__${String(r.moduleName).toLowerCase()}__${r.startDate}__${r.finishDate}__${r.sessionTime}`)
        );
        const filteredPrev = prev.filter(p => {
          const pKey = `${String(p.nik || p.NIK || '').trim()}__${String(p.moduleName || p.program || p.module || '').trim().toLowerCase()}__${p.startDate || p.tanggalMulai || ''}__${p.finishDate || p.tanggalSelesai || ''}__${p.sessionTime || ''}`;
          return !cleanKeys.has(pKey);
        });
        return [...cleanRows, ...filteredPrev];
      });
    }

    setNotice({
      type: 'success',
      text: `Berhasil mengimpor ${cleanRows.length} jadwal training peserta ke Kalender & Daftar Agenda!`
    });

    if (apiUrl.trim() && connected) {
      setSaving(true);
      try {
        await call('saveBulkSchedule', { rows: cleanRows });
        await refresh();
        setNotice({
          type: 'success',
          text: `Berhasil menyinkronkan ${cleanRows.length} jadwal training dari Excel ke Google Sheets dan Kalender!`
        });
      } catch (err: any) {
        console.warn('saveBulkSchedule failed or older deployment, saved locally in state:', err);
        setNotice({
          type: 'info',
          text: `Jadwal ${cleanRows.length} peserta telah aktif di Kalender & Agenda lokal (${err?.message || 'Sinkronisasi Sheets tertunda'}).`
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCompleteSessionFromCalendar = async (session: any) => {
    const participantNiks = (session.participants || []).map((p: any) => String(p.nik || '').trim());
    const moduleName = session.moduleName;
    const sDate = session.startDate || today();
    const fDate = session.finishDate || sDate;
    const dateDisplay = sDate === fDate ? sDate : `${sDate} s/d ${fDate}`;

    setHistory(prev => {
      const updatedNiks = new Set<string>();
      const mapped = prev.map(r => {
        const matchMod = String(r.moduleName || r.module || r.program || '').trim().toLowerCase() === moduleName.toLowerCase();
        const rNik = String(r.nik || r.NIK || '').trim();
        const matchNik = participantNiks.includes(rNik);
        if (matchMod && matchNik) {
          updatedNiks.add(rNik);
          return {
            ...r,
            status: 'SELESAI',
            startDate: sDate,
            finishDate: fDate,
            trainingDate: dateDisplay,
            sessionTime: session.sessionTime || r.sessionTime,
            location: session.location || r.location,
            trainer: session.trainer || r.trainer
          };
        }
        return r;
      });

      // Insert any participants who don't already have an entry in history
      const missingNiks = participantNiks.filter((nik: string) => !updatedNiks.has(nik));
      const newEntries = missingNiks.map((nik: string) => {
        const pObj = (session.participants || []).find((p: any) => String(p.nik).trim() === nik);
        const personMaster = allPeople.find(ap => nikOf(ap) === nik);
        const name = pObj?.name || (personMaster ? nameOf(personMaster) : nik);
        return {
          nik,
          name,
          moduleName,
          trainingDate: dateDisplay,
          startDate: sDate,
          finishDate: fDate,
          status: 'SELESAI',
          sessionTime: session.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)',
          location: session.location || 'Ruang Training GAM',
          trainer: session.trainer || '',
          inputTime: new Date().toISOString()
        };
      });

      return [...newEntries, ...mapped];
    });

    const targetGroup = session.targetGroup || 'MP';
    if (targetGroup === 'MP' || targetGroup === 'Keduanya') {
      setData(d => ({
        ...d,
        mp: d.mp.map(r => participantNiks.includes(nikOf(r)) ? { ...r, [moduleName]: true } : r)
      }));
    }
    if (targetGroup === 'Training Staff' || targetGroup === 'Keduanya') {
      setData(d => ({
        ...d,
        training: d.training.map(r => participantNiks.includes(nikOf(r)) ? { ...r, [moduleName]: true } : r)
      }));
    }

    setNotice({
      type: 'success',
      text: `Sesi "${moduleName}" telah selesai! Hasil training (${participantNiks.length} peserta) langsung tersimpan di Training Record & Checklist Matrix.`
    });

    if (apiUrl.trim() && connected) {
      setSaving(true);
      try {
        await call('saveTrainingResult', {
          participantNiks,
          moduleName,
          startDate: session.startDate,
          finishDate: session.finishDate,
          trainingDate: session.finishDate,
          dateDisplay: session.dateDisplay || dateDisplay,
          status: 'SELESAI',
          sessionTime: session.sessionTime,
          location: session.location,
          trainer: session.trainer,
          target: targetGroup
        });
        await refresh();
      } catch (err: any) {
        console.warn('Sync complete session failed:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleUpdateSessionFromCalendar = async (
    originalSession: any,
    updatedData: {
      moduleName: string;
      startDate: string;
      finishDate: string;
      status: string;
      sessionTime?: string;
      location?: string;
      trainer?: string;
      participants: Array<{
        nik: string;
        name: string;
        section?: string;
        jabatan?: string;
        status?: string;
      }>;
    }
  ) => {
    const origMod = String(originalSession.moduleName || '').trim();
    const origStart = String(originalSession.startDate || '').trim();
    const origFinish = String(originalSession.finishDate || origStart).trim();
    const origNiks = (originalSession.participants || []).map((p: any) => String(p.nik || '').trim());

    const newMod = String(updatedData.moduleName || origMod).trim();
    const newStart = normalizeDateToISO(updatedData.startDate || origStart) || today();
    const newFinish = normalizeDateToISO(updatedData.finishDate || newStart) || newStart;
    const newStatus = updatedData.status || 'TERJADWAL';
    const newDateDisplay = newStart === newFinish ? newStart : `${newStart} s/d ${newFinish}`;
    const newSessionTime = updatedData.sessionTime || originalSession.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)';
    const newLocation = updatedData.location || originalSession.location || 'Ruang Training GAM (Lt. 2)';
    const newTrainer = updatedData.trainer !== undefined ? updatedData.trainer : (originalSession.trainer || '');

    const newRows = updatedData.participants.map(p => normalizeScheduleRow({
      nik: p.nik,
      name: p.name,
      moduleName: newMod,
      trainingDate: newDateDisplay,
      dateDisplay: newDateDisplay,
      startDate: newStart,
      finishDate: newFinish,
      status: p.status || newStatus,
      sessionTime: newSessionTime,
      location: newLocation,
      trainer: newTrainer,
      inputTime: new Date().toLocaleString('id-ID')
    }, allPeople));

    setHistory(prev => {
      const filtered = prev.filter(r => {
        const rMod = String(r.moduleName || r.module || r.program || '').trim();
        const rStart = String(r.startDate || '').trim();
        const rFinish = String(r.finishDate || rStart).trim();
        const rNik = String(r.nik || r.NIK || '').trim();
        const rDate = String(r.trainingDate || '').trim();

        const matchMod = rMod.toLowerCase() === origMod.toLowerCase();
        const matchDate = (rStart === origStart && rFinish === origFinish) ||
          rDate === (origStart === origFinish ? origStart : `${origStart} s/d ${origFinish}`) ||
          (rDate.includes(origStart) && rDate.includes(origFinish));
        const matchNik = origNiks.length === 0 || origNiks.includes(rNik);

        if (matchMod && matchDate && matchNik) {
          return false;
        }
        return true;
      });

      return [...newRows, ...filtered];
    });

    const isSessionDone = newStatus === 'SELESAI';
    const completedParticipants = updatedData.participants.filter(p =>
      isSessionDone ? (p.status !== 'BELUM SELESAI' && p.status !== 'TERJADWAL') : p.status === 'SELESAI'
    );
    const completedNiks = completedParticipants.map(p => p.nik);

    if (completedNiks.length) {
      setData(d => ({
        ...d,
        mp: d.mp.map(r => completedNiks.includes(nikOf(r)) ? { ...r, [newMod]: true } : r),
        training: d.training.map(r => completedNiks.includes(nikOf(r)) ? { ...r, [newMod]: true } : r)
      }));
    }

    setNotice({
      type: 'success',
      text: isSessionDone
        ? `Sesi training "${newMod}" selesai! Hasil pelatihan (${completedNiks.length} peserta) langsung tersimpan di Training Record & Checklist Matrix.`
        : `Sesi training "${newMod}" berhasil diperbarui dengan ${newRows.length} peserta.`
    });

    if (apiUrl.trim() && connected) {
      setSaving(true);
      try {
        if (completedNiks.length > 0) {
          try {
            await call('saveTrainingResult', {
              participantNiks: completedNiks,
              moduleName: newMod,
              startDate: newStart,
              finishDate: newFinish,
              trainingDate: newFinish,
              dateDisplay: newDateDisplay,
              status: 'SELESAI',
              sessionTime: newSessionTime,
              location: newLocation,
              trainer: newTrainer,
              target: originalSession?.targetGroup || 'Keduanya'
            });
          } catch (e) {
            console.warn('saveTrainingResult completion sync note:', e);
          }
        }

        await call('updateTrainingSession', {
          originalModuleName: origMod,
          originalStartDate: origStart,
          originalFinishDate: origFinish,
          newModuleName: newMod,
          newStartDate: newStart,
          newFinishDate: newFinish,
          newStatus: newStatus,
          newSessionTime: newSessionTime,
          newLocation: newLocation,
          newTrainer: newTrainer,
          participants: updatedData.participants
        });
        await refresh();
        setNotice({
          type: 'success',
          text: isSessionDone
            ? `Sesi training "${newMod}" selesai & tersinkronisasi ke Google Sheets (Training Database & Checklist Matrix)!`
            : `Sesi training "${newMod}" berhasil diperbarui dan disinkronkan ke Google Sheets!`
        });
      } catch (err: any) {
        console.warn('updateTrainingSession failed or older script deployment:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteSessionFromCalendar = async (session: any) => {
    const origMod = String(session.moduleName || '').trim();
    const origStart = String(session.startDate || '').trim();
    const origFinish = String(session.finishDate || origStart).trim();
    const origNiks = (session.participants || []).map((p: any) => String(p.nik || '').trim());

    setHistory(prev => prev.filter(r => {
      const rMod = String(r.moduleName || r.module || r.program || '').trim();
      const rStart = String(r.startDate || '').trim();
      const rFinish = String(r.finishDate || rStart).trim();
      const rNik = String(r.nik || r.NIK || '').trim();
      const rDate = String(r.trainingDate || '').trim();

      const matchMod = rMod.toLowerCase() === origMod.toLowerCase();
      const matchDate = (rStart === origStart && rFinish === origFinish) ||
        rDate === (origStart === origFinish ? origStart : `${origStart} s/d ${origFinish}`) ||
        (rDate.includes(origStart) && rDate.includes(origFinish));
      const matchNik = origNiks.length === 0 || origNiks.includes(rNik);

      return !(matchMod && matchDate && matchNik);
    }));

    setNotice({
      type: 'success',
      text: `Sesi training "${origMod}" berhasil dihapus dari kalender dan riwayat.`
    });

    if (apiUrl.trim() && connected) {
      setSaving(true);
      try {
        await call('deleteTrainingSession', {
          moduleName: origMod,
          startDate: origStart,
          finishDate: origFinish
        });
        await refresh();
      } catch (err: any) {
        console.warn('deleteTrainingSession failed or older script:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSelectFile = async (file: File) => {
    setImportBusy(true);
    setImportReport('Membaca & menganalisis file spreadsheet...');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const targetSheetName = workbook.SheetNames.find(n =>
        /mandatory|monitoring/i.test(n)
      ) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[targetSheetName];

      if (!sheet) {
        throw new Error('Sheet spreadsheet tidak dapat dibaca.');
      }

      // Deteksi baris header secara cerdas: uji baris 1 (range 0) atau baris 2 (range 1)
      let parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false, range: 0 });
      let hasNik = parsed.length > 0 && Object.keys(parsed[0]).some(k => /nik/i.test(k));
      if (!hasNik) {
        parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false, range: 1 });
      }

      const normalized = parsed.map(r => {
        const out: Row = {};
        Object.keys(r).forEach(k => out[String(k).trim()] = r[k]);
        return out;
      }).filter(r =>
        findKey(r, ['NIK', 'Employee NIK', 'Nomor Induk Karyawan', 'No Induk']) &&
        findKey(r, ['PROGRAM TRAINING', 'Program Training', 'MODUL', 'Modul', 'Nama Training', 'Training']) &&
        findKey(r, ['STATUS', 'Status', 'Keterangan', 'Hasil'])
      );

      if (!normalized.length) {
        throw new Error('Tidak menemukan baris dengan kolom NIK, PROGRAM TRAINING, dan STATUS. Pastikan header mencantumkan kolom-kolom tersebut.');
      }

      // Analisis data terhadap database saat ini
      const targetRows = importTarget === 'MP' ? data.mp : data.training;
      const targetMatrixModules = importTarget === 'MP' ? data.mpTrainingHeaders : data.trainingMatrixHeaders;
      const validNiks = new Set(targetRows.map(nikOf).filter(Boolean));

      // Indeks penugasan yang sudah ada di database saat ini
      const existingAssignMap = new Map<string, { target: string; status?: string }>();
      data.mandatoryAssignments.forEach(a => {
        const k = `${a.target || 'MP'}:${nikOf({ NIK: a.nik })}:${key(a.moduleName)}`;
        existingAssignMap.set(k, a);
      });

      let newCount = 0;
      let upgradeCount = 0;
      let preservedCount = 0;
      let unmatchedCount = 0;

      const sampleRows: ImportPreviewData['sampleRows'] = [];

      normalized.forEach((r, idx) => {
        const rowNik = nikOf(r);
        const rowName = nameOf(r) || String(findKey(r, ['NAME', 'NAMA', 'Nama Karyawan'])).trim();
        const rowModule = String(findKey(r, ['PROGRAM TRAINING', 'Program Training', 'MODUL', 'Modul', 'Nama Training', 'Training'])).trim();
        const rowStatus = String(findKey(r, ['STATUS', 'Status', 'Keterangan', 'Hasil'])).trim();
        const incomingDone = isDone(rowStatus);

        let category: 'NEW' | 'UPGRADE' | 'PRESERVED' | 'UNMATCHED';

        if (!validNiks.has(rowNik)) {
          unmatchedCount++;
          category = 'UNMATCHED';
        } else {
          const assignKey = `${importTarget}:${rowNik}:${key(rowModule)}`;
          const existing = existingAssignMap.get(assignKey);

          // Cek apakah di matrix orang tersebut sudah pernah Done (Selesai)
          const person = targetRows.find(p => nikOf(p) === rowNik);
          const matchedHeader = targetMatrixModules.find(m => key(m) === key(rowModule)) || rowModule;
          const wasAlreadyDoneInMatrix = person ? isDone(person[matchedHeader]) : false;
          const wasAlreadyDoneInAssign = existing ? isDone(existing.status) : false;
          const wasAlreadyDone = wasAlreadyDoneInMatrix || wasAlreadyDoneInAssign;

          if (!existing) {
            newCount++;
            category = 'NEW';
          } else if (wasAlreadyDone) {
            // Data lama sudah selesai! Harus ditetapkan & tidak boleh diubah/downgrade
            preservedCount++;
            category = 'PRESERVED';
          } else if (!wasAlreadyDone && incomingDone) {
            // Data lama belum selesai, dan Excel sekarang sudah selesai: UPDATE PROGRES TERBARU!
            upgradeCount++;
            category = 'UPGRADE';
          } else {
            // Sama-sama belum selesai: data lama ditetapkan
            preservedCount++;
            category = 'PRESERVED';
          }
        }

        if (idx < 10) {
          sampleRows.push({
            nik: rowNik,
            name: rowName,
            module: rowModule,
            status: rowStatus,
            category
          });
        }
      });

      setImportPreview({
        fileName: file.name,
        totalRows: normalized.length,
        newCount,
        upgradeCount,
        preservedCount,
        unmatchedCount,
        sampleRows,
        normalizedRows: normalized
      });

      setImportReport(`Pratinjau siap: ${normalized.length} baris dianalisis (${newCount} baru, ${upgradeCount} progres selesai terbaru, ${preservedCount} data lama ditetapkan). Periksa pratinjau di bawah.`);
    } catch (e: any) {
      setImportPreview(null);
      setImportReport(`Gagal menganalisis file: ${e?.message || 'File tidak dapat diproses.'}`);
      setNotice({ type: 'error', text: e?.message || 'File tidak valid.' });
    } finally {
      setImportBusy(false);
    }
  };

  const executeImport = async () => {
    if (!importPreview) return;
    const { normalizedRows, newCount, upgradeCount, preservedCount, totalRows } = importPreview;

    setImportBusy(true);
    setImportReport('Memulai proses sinkronisasi update terbaru...');

    try {
      if (!apiUrl.trim() || !connected) {
        // Mode Demo / Simulasi Lokal:
        // Lakukan penggabungan lokal yang aman! Data lama tidak hilang dan tidak berubah!
        const targetKey = importTarget;
        const currentAssigns = [...data.mandatoryAssignments];
        const updatedAssigns = [...currentAssigns];

        const updatedSource = (targetKey === 'MP' ? data.mp : data.training).map(person => ({ ...person }));

        normalizedRows.forEach(r => {
          const rowNik = nikOf(r);
          const rowModule = String(findKey(r, ['PROGRAM TRAINING', 'Program Training', 'MODUL', 'Modul', 'Nama Training', 'Training'])).trim();
          const incomingDone = isDone(findKey(r, ['STATUS', 'Status', 'Keterangan', 'Hasil']));

          const existingIdx = updatedAssigns.findIndex(a =>
            nikOf({ NIK: a.nik }) === rowNik &&
            key(a.moduleName) === key(rowModule) &&
            (!a.target || a.target === targetKey)
          );

          if (existingIdx === -1) {
            // Penugasan Baru
            updatedAssigns.push({
              nik: rowNik,
              moduleName: rowModule,
              target: targetKey,
              status: incomingDone ? 'Done' : 'Not Yet'
            });
            if (incomingDone) {
              const pIdx = updatedSource.findIndex(p => nikOf(p) === rowNik);
              if (pIdx >= 0) {
                updatedSource[pIdx][rowModule] = true;
              }
            }
          } else {
            // Data Lama: Jika mode smart_update, hanya update jika incomingDone dan status lama belum done
            const existing = updatedAssigns[existingIdx];
            const alreadyDone = isDone(existing.status);
            if (!alreadyDone && incomingDone && importMode !== 'new_only') {
              updatedAssigns[existingIdx] = {
                ...existing,
                status: 'Done'
              };
              const pIdx = updatedSource.findIndex(p => nikOf(p) === rowNik);
              if (pIdx >= 0) {
                updatedSource[pIdx][rowModule] = true;
              }
            }
          }
        });

        setData(d => ({
          ...d,
          [targetKey === 'MP' ? 'mp' : 'training']: updatedSource,
          mandatoryAssignments: updatedAssigns
        }));

        setImportPreview(null);
        const doneMsg = `Selesai (Mode Demo): ${totalRows} baris diproses (${newCount} baru, ${upgradeCount} progres selesai terbaru, ${preservedCount} data lama dipertahankan).`;
        setImportReport(doneMsg);
        setNotice({ type: 'success', text: doneMsg });
        return;
      }

      // Mode Terkoneksi Google Sheets:
      let totalImported = 0, totalUpdated = 0, totalPreserved = 0, totalSynced = 0, totalUnmatched = 0;
      for (let i = 0; i < normalizedRows.length; i += 4) {
        const batch = normalizedRows.slice(i, i + 4);
        const result: any = await call('importMandatoryTraining', {
          target: importTarget,
          rows: batch,
          mode: importMode
        });
        totalImported += Number(result?.imported || 0);
        totalUpdated += Number(result?.updated || 0);
        totalPreserved += Number(result?.preserved || 0);
        totalSynced += Number(result?.synced || 0);
        totalUnmatched += Number(result?.unmatched || 0);
        setImportReport(`Memproses ${Math.min(i + batch.length, normalizedRows.length)} dari ${normalizedRows.length} baris...`);
      }

      await refresh();
      setImportPreview(null);
      const successMsg = `Selesai! ${totalRows} baris diproses: ${totalImported} penugasan baru ditambahkan, ${totalUpdated} progres selesai diperbarui, ${totalPreserved} data lama tetap dipertahankan & aman.`;
      setImportReport(successMsg);
      setNotice({ type: 'success', text: successMsg });
    } catch (e: any) {
      setImportReport(`Gagal menyimpan import: ${e?.message || 'Proses terhenti.'}`);
      setNotice({ type: 'error', text: e?.message || 'Import gagal.' });
    } finally {
      setImportBusy(false);
    }
  };

  const addModule = async (nameInput?: string) => {
    let moduleName = typeof nameInput === 'string' ? nameInput : '';
    if (!moduleName.trim()) {
      moduleName = window.prompt('Nama program training baru:') || '';
    }
    if (!moduleName?.trim()) return;
    const cleanMod = moduleName.trim();
    if (!apiUrl.trim() || !connected) {
      // Local demo mode fallback: simpan ke state headers agar langsung muncul dan dapat dipilih
      setData(prev => ({
        ...prev,
        mpTrainingHeaders: prev.mpTrainingHeaders.includes(cleanMod) ? prev.mpTrainingHeaders : [...prev.mpTrainingHeaders, cleanMod],
        trainingMatrixHeaders: prev.trainingMatrixHeaders.includes(cleanMod) ? prev.trainingMatrixHeaders : [...prev.trainingMatrixHeaders, cleanMod]
      }));
      setRecordModule(cleanMod);
      setNotice({ type: 'success', text: `Modul "${cleanMod}" berhasil ditambahkan & langsung dipilih pada form Training Record.` });
      return;
    }
    setSaving(true);
    try {
      await call('addTrainingModule', { moduleName: cleanMod });
      await refresh();
      setRecordModule(cleanMod);
      setNotice({ type: 'success', text: `Modul "${cleanMod}" berhasil ditambahkan ke database & dipilih pada Training Record.` });
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Gagal menambah modul di Google Sheets.' });
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const isStaff = target === 'Training Staff';
      const statusFilterLabel = statusFilter === 'ACTIVE' ? 'Aktif' : statusFilter === 'INACTIVE' ? 'Non Aktif' : 'Semua Status';
      const activeModules = isStaff ? data.trainingMatrixHeaders : data.mpTrainingHeaders;

      // Metadata Banner
      const titleRow = ['PT KARUNIA ARMADA INDONESIA — SITE GAM'];
      const subTitleRow = [`DATA MANPOWER & TRAINING MATRIX (${target.toUpperCase()})`];
      const filterRow = [
        `Filter: Section: "${sectionFilter}" | Status: "${statusFilterLabel}" | Pencarian: "${search || 'Semua'}" | Jumlah Terfilter: ${filteredRows.length} Personel`
      ];
      const dateRow = [
        `Waktu Unduh: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${new Date().toLocaleTimeString('id-ID')}`
      ];
      const blankRow: any[] = [];

      // 1. SHEET: DATA MANPOWER
      const mpCols = isStaff
        ? ['No', 'NIK', 'Nama Personel', 'Section', 'Jabatan', 'Status', 'Kelengkapan Jabatan']
        : ['No', 'NIK', 'Nama Personel', 'Section', 'SubSection', 'Grade', 'Jabatan', 'Status', 'Kelengkapan Jabatan'];

      const mpDataRows = filteredRows.map((r, i) => {
        const hasJob = Boolean(jobOf(r));
        const statusText = hasJob ? 'Aktif' : 'Non Aktif';
        const kelengkapan = hasJob ? 'Jabatan Terisi' : 'Jabatan Kosong (Non Aktif)';
        if (isStaff) {
          return [
            i + 1,
            nikOf(r) || '-',
            nameOf(r) || 'Nama belum diisi',
            sectionOf(r),
            jobOf(r) || '-',
            statusText,
            kelengkapan
          ];
        }
        return [
          i + 1,
          nikOf(r) || '-',
          nameOf(r) || 'Nama belum diisi',
          sectionOf(r),
          subsectionOf(r),
          gradeOf(r),
          jobOf(r) || '-',
          statusText,
          kelengkapan
        ];
      });

      const mpSheetData = [titleRow, subTitleRow, filterRow, dateRow, blankRow, mpCols, ...mpDataRows];
      const wsMp = XLSX.utils.aoa_to_sheet(mpSheetData);

      const mpColWidths = isStaff
        ? [{ wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 26 }]
        : [{ wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 26 }];
      wsMp['!cols'] = mpColWidths;

      const lastColLetter = XLSX.utils.encode_col(mpCols.length - 1);
      wsMp['!autofilter'] = { ref: `A6:${lastColLetter}${mpDataRows.length + 6}` };
      XLSX.utils.book_append_sheet(wb, wsMp, isStaff ? 'Data Training Staff' : 'Data Manpower');

      // 2. SHEET: TRAINING MATRIX
      const matrixCols = isStaff
        ? ['No', 'NIK', 'Nama Personel', 'Section', 'Jabatan', 'Status', ...activeModules, 'Modul Selesai', 'Total Modul', '% Selesai']
        : ['No', 'NIK', 'Nama Personel', 'Section', 'SubSection', 'Grade', 'Jabatan', 'Status', ...activeModules, 'Modul Selesai', 'Total Modul', '% Selesai'];

      const matrixDataRows = filteredRows.map((r, i) => {
        const hasJob = Boolean(jobOf(r));
        const statusText = hasJob ? 'Aktif' : 'Non Aktif';
        const moduleVals = activeModules.map(m => isDone(r[m]) ? 'DONE' : 'BELUM');
        const doneCount = activeModules.filter(m => isDone(r[m])).length;
        const totalCount = activeModules.length;
        const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

        if (isStaff) {
          return [
            i + 1,
            nikOf(r) || '-',
            nameOf(r) || 'Nama belum diisi',
            sectionOf(r),
            jobOf(r) || '-',
            statusText,
            ...moduleVals,
            doneCount,
            totalCount,
            `${pct}%`
          ];
        }
        return [
          i + 1,
          nikOf(r) || '-',
          nameOf(r) || 'Nama belum diisi',
          sectionOf(r),
          subsectionOf(r),
          gradeOf(r),
          jobOf(r) || '-',
          statusText,
          ...moduleVals,
          doneCount,
          totalCount,
          `${pct}%`
        ];
      });

      const matrixSheetData = [
        [`KAI GAM — TRAINING MATRIX CHECKLIST (${target.toUpperCase()})`],
        [`Daftar pencapaian modul training riil per personel (Sinkron dengan filter aktif)`],
        filterRow,
        dateRow,
        blankRow,
        matrixCols,
        ...matrixDataRows
      ];
      const wsMatrix = XLSX.utils.aoa_to_sheet(matrixSheetData);

      const baseMatrixWidths = isStaff
        ? [{ wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 20 }, { wch: 22 }, { wch: 14 }]
        : [{ wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 14 }];
      const modWidths = activeModules.map(m => ({ wch: Math.max(14, m.length + 3) }));
      const sumWidths = [{ wch: 16 }, { wch: 14 }, { wch: 14 }];
      wsMatrix['!cols'] = [...baseMatrixWidths, ...modWidths, ...sumWidths];

      const lastMatrixColLetter = XLSX.utils.encode_col(matrixCols.length - 1);
      wsMatrix['!autofilter'] = { ref: `A6:${lastMatrixColLetter}${matrixDataRows.length + 6}` };
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Training Matrix');

      // 3. SHEET: RINGKASAN PROGRAM
      const targetStats = isStaff ? staffMandatoryStats : mandatoryStats;
      const summaryCols = ['No', 'Nama Program Training', 'Target Group', 'Target Ditugaskan (Peserta)', 'Selesai (Done)', 'Belum Selesai', '% Capaian (ACH)'];
      const summaryDataRows = targetStats.map((s, i) => [
        i + 1,
        s.name,
        target,
        s.total,
        s.done,
        s.notDone,
        percent(s.ach)
      ]);
      const summarySheetData = [
        [`KAI GAM — RINGKASAN CAPAIAN PROGRAM TRAINING (${target.toUpperCase()})`],
        [`Perhitungan persentase ACH resmi dari Mandatory Training Database`],
        dateRow,
        blankRow,
        summaryCols,
        ...summaryDataRows
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      wsSummary['!cols'] = [{ wch: 6 }, { wch: 34 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
      const lastSummaryCol = XLSX.utils.encode_col(summaryCols.length - 1);
      wsSummary['!autofilter'] = { ref: `A5:${lastSummaryCol}${summaryDataRows.length + 5}` };
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Program');

      // Unduh file menggunakan SheetJS
      const cleanTargetName = target.replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `KAI_GAM_${cleanTargetName}_Manpower_Matrix_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setNotice({
        type: 'success',
        text: `Export Excel berhasil! File "${fileName}" diunduh (${filteredRows.length} data personel + Training Matrix lengkap).`
      });
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      setNotice({
        type: 'error',
        text: `Gagal mengunduh file Excel: ${err?.message || 'Terjadi kesalahan sistem'}`
      });
    }
  };

  const exportCsv = () => {
    const isStaff = target === 'Training Staff';
    const csvHeaders = isStaff
      ? ['No', 'NIK', 'Nama Personel', 'Section', 'Jabatan', 'Status']
      : ['No', 'NIK', 'Nama Personel', 'Section', 'SubSection', 'Grade', 'Jabatan', 'Status'];

    const csvDataRows = filteredRows.map((r, i) => {
      const hasJob = Boolean(jobOf(r));
      const statusText = hasJob ? 'Aktif' : 'Non Aktif';
      if (isStaff) {
        return [
          i + 1,
          nikOf(r) || '-',
          nameOf(r) || 'Nama belum diisi',
          sectionOf(r),
          jobOf(r) || '-',
          statusText
        ];
      }
      return [
        i + 1,
        nikOf(r) || '-',
        nameOf(r) || 'Nama belum diisi',
        sectionOf(r),
        subsectionOf(r),
        gradeOf(r),
        jobOf(r) || '-',
        statusText
      ];
    });

    const csv = [csvHeaders.map(csvCell).join(','), ...csvDataRows.map(row => row.map(c => csvCell(c)).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target.replace(/ /g, '_')}_KAI_GAM.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: [Tab, string, React.ReactNode][] = [
    ['dashboard', 'Dashboard', <LayoutDashboard size={18} />],
    ['manpower', 'Data Manpower', <Users size={18} />],
    ['matrix', 'Training Matrix', <BookOpenCheck size={18} />],
    ['records', 'Training Records', <GraduationCap size={18} />],
    ['calendar', 'Kalender Training', <Calendar size={18} />],
    ['mandatory', 'Mandatory Import', <FileSpreadsheet size={18} />],
    ['settings', 'Pengaturan', <Settings size={18} />]
  ];
  const title = ({
    dashboard: 'Dashboard Overview',
    manpower: 'Manpower Management',
    matrix: 'Training Matrix',
    records: 'Training Development Records',
    calendar: 'Jadwal & Kalender Pelaksanaan Training',
    mandatory: 'Mandatory Training Import',
    settings: 'Pengaturan Integrasi Google Sheets'
  } as Record<Tab, string>)[tab];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">KA<span>I</span></div>
          <div>
            <b>PT Karunia Armada Indonesia</b>
            <small>SITE GAM · PEOPLE & DEV</small>
          </div>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => { setTab(id); setMobileNav(false); }}
            >
              {icon}
              <span>{label}</span>
              {id === 'mandatory' && <span className="nav-tag">MP</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-icon"><ShieldCheck size={17} /></div>
          <div>
            <b>Internal Workforce</b>
            <small>PT Karunia Armada Indonesia · GAM</small>
          </div>
        </div>
      </aside>

      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <div>
              <div className="eyebrow">PT KARUNIA ARMADA INDONESIA — SITE GAM / PEOPLE ANALYTICS</div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className={`connection-pill ${connected ? 'online' : 'offline'}`}>
              <span />
              {connected ? 'Google Sheets Connected' : 'Demo / Not Connected'}
            </div>
            <button
              className="icon-button"
              title="Refresh / Sinkronkan data"
              onClick={refresh}
              disabled={loading || testingConnection}
            >
              <RefreshCw size={17} className={loading || testingConnection ? 'spin' : ''} />
            </button>
            <button className="profile-button">
              <span className="profile-avatar">KAI</span>
              <span>
                <b>PT Karunia Armada Indonesia</b>
                <small>Site GAM Admin</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="content-area">
          {notice && (
            <div className={`notice ${notice.type}`}>
              <span>
                {notice.type === 'error' ? <AlertCircle size={17} /> : notice.type === 'success' ? <CheckCircle2 size={17} /> : <CircleHelp size={17} />}
              </span>
              <div style={{ flex: 1 }}>{notice.text}</div>
              <button onClick={() => setNotice(null)}>
                <X size={15} />
              </button>
            </div>
          )}

          {!connected && (
            <div className="demo-banner">
              <Sparkles size={18} />
              <div>
                <b>Mode Simulasi Demo Aktif</b>
                <span>Aplikasi saat ini menampilkan data simulasi contoh (bukan data aktual dari Google Sheets). Masuk ke menu Pengaturan untuk menghubungkan Web App Apps Script Anda.</span>
              </div>
              <button onClick={() => setTab('settings')}>
                Hubungkan database <ArrowDownToLine size={15} />
              </button>
            </div>
          )}

          {tab === 'dashboard' && (
            <Dashboard
              data={data}
              totalMP={totalMP}
              activeMP={activeMP}
              inactiveMP={inactiveMP}
              sectionData={sectionData}
              gradeData={gradeData}
              mandatoryStats={mandatoryStats}
              staffMandatoryStats={staffMandatoryStats}
              nonMandatoryStats={nonMandatoryStats}
              history={history}
              onGo={setTab}
              onRecordForModule={(moduleName, nik, targetGroup) => {
                setRecordModule(moduleName);
                if (targetGroup) setRecordTarget(targetGroup);
                if (nik) setSelectedNiks([nik]);
                setTab('records');
              }}
            />
          )}

          {tab === 'manpower' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">PEOPLE DIRECTORY</div>
                  <h2>Data Personel Manpower</h2>
                  <p>Data utama manpower dibaca dari sheet MP; Total MP dihitung dari seluruh baris dengan NIK yang terisi.</p>
                </div>
                <div className="heading-actions">
                  <button className="btn btn-excel" onClick={exportToExcel} title="Unduh data MP dan training matrix lengkap ke format Excel (.xlsx)">
                    <FileSpreadsheet size={16} /> Export to Excel (.xlsx)
                  </button>
                  <button className="btn btn-light" onClick={exportCsv} title="Unduh data MP ke format CSV">
                    <ArrowDownToLine size={16} /> Export CSV
                  </button>
                  <button className="btn btn-primary" onClick={() => { setTarget('MP'); setIsNew(true); setEditRow(blankRecord(data.mpHeaders)); }}>
                    <Plus size={16} /> Tambah Personel
                  </button>
                </div>
              </div>
              <DataTable
                rows={filteredRows}
                target={target}
                setTarget={setTarget}
                search={search}
                setSearch={setSearch}
                sections={sections}
                sectionFilter={sectionFilter}
                setSectionFilter={setSectionFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onExportExcel={exportToExcel}
                onEdit={r => { setIsNew(false); setEditRow({ ...r }); }}
              />
            </section>
          )}

          {tab === 'matrix' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">SKILL & COMPETENCY</div>
                  <h2>Checklist Training Matrix</h2>
                  <p>Checklist mencatat status training riil per personel. Status kewajiban ACH mandatory tetap dihitung dari Mandatory Training Database.</p>
                </div>
                <div className="heading-actions">
                  <button className="btn btn-excel" onClick={exportToExcel} title="Unduh checklist training matrix ke file Excel (.xlsx)">
                    <FileSpreadsheet size={16} /> Export Matrix (.xlsx)
                  </button>
                  <select className="select-control" value={target} onChange={e => setTarget(e.target.value as any)}>
                    <option value="MP">Database Manpower (MP)</option>
                    <option value="Training Staff">Database Training Staff</option>
                  </select>
                </div>
              </div>
              <MatrixTable
                rows={rows}
                modules={modules}
                search={search}
                setSearch={setSearch}
                saving={saving}
                onToggle={saveTrainingCheck}
              />
            </section>
          )}

          {tab === 'records' && (
            <RecordsPage
              allPeople={allPeople}
              allModules={allModules}
              recordModule={recordModule}
              setRecordModule={setRecordModule}
              recordStartDate={recordStartDate}
              setRecordStartDate={setRecordStartDate}
              recordFinishDate={recordFinishDate}
              setRecordFinishDate={setRecordFinishDate}
              recordStatus={recordStatus}
              setRecordStatus={setRecordStatus}
              recordTarget={recordTarget}
              setRecordTarget={setRecordTarget}
              selectedNiks={selectedNiks}
              setSelectedNiks={setSelectedNiks}
              history={history}
              saving={saving}
              onSave={saveResult}
              onAddModule={addModule}
            />
          )}

          {tab === 'calendar' && (
            <CalendarPage
              history={history}
              allPeople={allPeople}
              allModules={allModules}
              mandatoryAssignments={data.mandatoryAssignments}
              onNavigateToRecords={(moduleName, startDate, finishDate, nik) => {
                if (moduleName) setRecordModule(moduleName);
                if (startDate) setRecordStartDate(startDate);
                if (finishDate) setRecordFinishDate(finishDate);
                if (nik) setSelectedNiks([nik]);
                setTab('records');
              }}
              onSaveSchedule={handleSaveScheduleFromCalendar}
              onImportScheduleRows={handleImportScheduleRows}
              onCompleteSession={handleCompleteSessionFromCalendar}
              onUpdateSession={handleUpdateSessionFromCalendar}
              onDeleteSession={handleDeleteSessionFromCalendar}
              onClearAllSessions={handleClearAllSessions}
              onAddModule={addModule}
            />
          )}

          {tab === 'mandatory' && (
            <MandatoryPage
              target={importTarget}
              setTarget={setImportTarget}
              mode={importMode}
              setMode={setImportMode}
              busy={importBusy}
              report={importReport}
              preview={importPreview}
              onFileSelect={handleSelectFile}
              onConfirmImport={executeImport}
              onCancelPreview={() => {
                setImportPreview(null);
                setImportReport('');
              }}
              assignments={data.mandatoryAssignments}
            />
          )}

          {tab === 'settings' && (
            <SettingsPage
              draftUrl={draftUrl}
              setDraftUrl={setDraftUrl}
              activeUrl={apiUrl}
              connected={connected}
              loading={testingConnection || loading}
              testFeedback={testFeedback}
              onSaveAndConnect={async () => {
                await runTestConnection(draftUrl, true);
              }}
              onTestConnection={async () => {
                await runTestConnection(draftUrl, false);
              }}
              onDisconnect={() => {
                clearStoredAppsScriptUrl();
                setApiUrl('');
                setDraftUrl('');
                setConnected(false);
                setData(demoData());
                setHistory([]);
                setTestFeedback({
                  status: 'idle',
                  message: 'Koneksi diputuskan. Aplikasi beralih ke Mode Simulasi Demo.'
                });
                setNotice({
                  type: 'info',
                  text: 'Koneksi dinonaktifkan. Mode simulasi demo aktif.'
                });
              }}
            />
          )}
        </div>

        <footer className="footer">
          <span>© KAI GAM · Manpower & Training Development</span>
          <span>
            <span className="footer-dot" style={{ backgroundColor: connected ? '#10b981' : '#f59e0b' }} />
            {connected ? 'Source of truth: Google Sheets (Terkoneksi)' : 'Status: Mode Demo (Tidak Terkoneksi)'}
          </span>
        </footer>
      </main>

      {editRow && (
        <EditModal
          row={editRow}
          headers={headers.length ? headers : Object.keys(editRow)}
          target={target}
          isNew={isNew}
          saving={saving}
          onClose={() => setEditRow(null)}
          onSave={r => saveRecord(r, target, isNew)}
        />
      )}
    </div>
  );
}

function modulesStats(rows: Row[], modules: string[], target: string, assignments: { nik: string; moduleName: string; target: string }[], nonMandatory = false) {
  const people = rows.filter(r => nikOf(r));
  return modules.map(moduleName => {
    const assigned = new Set(assignments.filter(a => key(a.moduleName) === key(moduleName) && (!a.target || a.target === target)).map(a => nikOf({ NIK: a.nik })).filter(Boolean));
    const eligible = people.filter(r => nonMandatory ? !assigned.has(nikOf(r)) : assigned.has(nikOf(r)));
    const done = eligible.filter(r => isDone(r[moduleName])).length;
    return { name: moduleName, total: eligible.length, done, notDone: Math.max(0, eligible.length - done), ach: eligible.length ? done / eligible.length * 100 : 0 };
  }).filter(x => x.total > 0 || !nonMandatory);
}
function countBy(rows: Row[], fn: (r: Row) => string) {
  const map: Record<string, number> = {};
  rows.forEach(r => map[fn(r)] = (map[fn(r)] || 0) + 1);
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
function csvCell(value: any) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
function blankRecord(headers: string[]) {
  const o: Row = {};
  headers.forEach(h => o[h] = '');
  return o;
}

function StatCard({ label, value, sub, icon, tone, trend, onClick }: { label: string; value: string | number; sub: string; icon: React.ReactNode; tone: string; trend?: string; onClick?: () => void }) {
  return (
    <div
      className={`stat-card ${tone} ${onClick ? 'clickable-stat-card' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      title={onClick ? 'Klik untuk melihat rincian di Kalender Training' : undefined}
    >
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{trend && <b>{trend}</b>}{sub}</div>
    </div>
  );
}

function Dashboard({ data, totalMP, activeMP, inactiveMP, sectionData, gradeData, mandatoryStats, staffMandatoryStats, nonMandatoryStats, history, onGo, onRecordForModule }: {
  data: InitialData;
  totalMP: number;
  activeMP: number;
  inactiveMP: number;
  sectionData: any[];
  gradeData: any[];
  mandatoryStats: any[];
  staffMandatoryStats: any[];
  nonMandatoryStats: any[];
  history: Row[];
  onGo: (tab: Tab) => void;
  onRecordForModule?: (moduleName: string, nik?: string, targetGroup?: 'MP' | 'Training Staff') => void;
}) {
  // Perhitungan Sesi Training Terjadwal Bulan Berjalan (Current Month)
  const scheduledThisMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now);

    const scheduledRows = history.filter(r => {
      const status = String(r.status || '').trim().toUpperCase();
      const isSched = status === 'TERJADWAL' || status === 'SCHEDULED' || status === 'UPCOMING' || status === 'PLANNED';
      if (!isSched) return false;

      const start = String(r.startDate || '').trim();
      const finish = String(r.finishDate || '').trim();
      const tgl = String(r.trainingDate || '').trim();

      return (start && start.startsWith(currentMonthPrefix)) ||
             (finish && finish.startsWith(currentMonthPrefix)) ||
             (tgl && tgl.includes(currentMonthPrefix));
    });

    const sessionKeys = new Set<string>();
    const participantNiks = new Set<string>();

    scheduledRows.forEach(r => {
      const mod = String(r.moduleName || '').trim();
      const s = String(r.startDate || r.trainingDate || '').trim();
      const f = String(r.finishDate || s).trim();
      sessionKeys.add(`${mod}__${s}__${f}`);
      if (r.nik) participantNiks.add(String(r.nik).trim());
    });

    return {
      sessionCount: sessionKeys.size,
      participantCount: participantNiks.size,
      monthName,
      hasSessions: sessionKeys.size > 0
    };
  }, [history]);

  const mpAssign = data.mandatoryAssignments.filter(a => !a.target || a.target === 'MP');
  const staffAssign = data.mandatoryAssignments.filter(a => !a.target || a.target === 'Training Staff');
  const mpAssignedNiks = new Set(mpAssign.map(a => nikOf({ NIK: a.nik })));
  const staffAssignedNiks = new Set(staffAssign.map(a => nikOf({ NIK: a.nik })));
  const mpDonePeople = data.mp.filter(r => nikOf(r) && mpAssignedNiks.has(nikOf(r))).filter(r => {
    const as = mpAssign.filter(a => nikOf({ NIK: a.nik }) === nikOf(r));
    return as.length > 0 && as.every(a => isDone(r[data.mpTrainingHeaders.find(h => key(h) === key(a.moduleName)) || a.moduleName]));
  }).length;
  const staffDonePeople = data.training.filter(r => nikOf(r) && staffAssignedNiks.has(nikOf(r))).filter(r => {
    const as = staffAssign.filter(a => nikOf({ NIK: a.nik }) === nikOf(r));
    return as.length > 0 && as.every(a => isDone(r[data.trainingMatrixHeaders.find(h => key(h) === key(a.moduleName)) || a.moduleName]));
  }).length;
  const assignedPeople = new Set([...mpAssign, ...staffAssign].map(a => `${a.target || 'MP'}:${nikOf({ NIK: a.nik })}`)).size;
  const avgAch = (() => {
    const s = [...mandatoryStats, ...staffMandatoryStats].filter(x => x.total > 0);
    return s.length ? s.reduce((a, x) => a + x.ach, 0) / s.length : 0;
  })();
  const recent = history.slice(0, 5);

  // Data status kelengkapan data jabatan (Donut Chart)
  const jobCompletenessData = useMemo(() => [
    { name: 'Aktif', value: activeMP, color: '#10b981' },
    { name: 'Non Aktif', value: inactiveMP, color: '#f43f5e' }
  ], [activeMP, inactiveMP]);
  const completenessRate = totalMP ? (activeMP / totalMP) * 100 : 0;

  // Data kombinasi Section (Column: Terisi & Verifikasi, Line: % Kelengkapan)
  const sectionComboData = useMemo(() => {
    const map: Record<string, { total: number; active: number; inactive: number }> = {};
    data.mp.filter(r => nikOf(r)).forEach(r => {
      const sec = sectionOf(r);
      if (!map[sec]) map[sec] = { total: 0, active: 0, inactive: 0 };
      map[sec].total += 1;
      if (jobOf(r)) {
        map[sec].active += 1;
      } else {
        map[sec].inactive += 1;
      }
    });
    return Object.entries(map).map(([name, s]) => ({
      name,
      total: s.total,
      active: s.active,
      inactive: s.inactive,
      rate: s.total > 0 ? Math.round((s.active / s.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [data.mp]);

  // Filter Dropdown Modul & Status Training (dapat dipilih lebih dari satu)
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<('DONE' | 'NOT_YET')[]>(['DONE', 'NOT_YET']);
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [trainingCategoryFilter, setTrainingCategoryFilter] = useState<'ALL' | 'MANDATORY_ALL' | 'MANDATORY_MP' | 'MANDATORY_STAFF' | 'NON_MANDATORY'>('ALL');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [showChartLabels, setShowChartLabels] = useState(true);
  const [activeClickedModule, setActiveClickedModule] = useState<any | null>(null);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Click/tap outside listener: aman dan tidak menghalangi scroll/klik pada item
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setCategoryDropdownOpen(false);
      }
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(target)) {
        setModuleDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false);
      }
    }
    if (categoryDropdownOpen || moduleDropdownOpen || statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [categoryDropdownOpen, moduleDropdownOpen, statusDropdownOpen]);

  // Katalog lengkap seluruh modul training
  const allTrainingItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      cleanName: string;
      category: 'Mandatory MP' | 'Mandatory Staff' | 'Di Luar Mandatory';
      target: 'MP' | 'Training Staff';
      total: number;
      done: number;
      notDone: number;
      ach: number;
    }> = [];

    mandatoryStats.forEach(item => {
      list.push({
        id: `mp-${item.name}`,
        name: item.name,
        cleanName: item.name,
        category: 'Mandatory MP',
        target: 'MP',
        total: item.total,
        done: item.done,
        notDone: item.notDone,
        ach: item.ach
      });
    });

    staffMandatoryStats.forEach(item => {
      list.push({
        id: `staff-${item.name}`,
        name: item.name,
        cleanName: item.name,
        category: 'Mandatory Staff',
        target: 'Training Staff',
        total: item.total,
        done: item.done,
        notDone: item.notDone,
        ach: item.ach
      });
    });

    nonMandatoryStats.forEach(item => {
      const isStaff = item.name.startsWith('Staff · ');
      const clean = item.name.replace(/^(MP · |Staff · )/, '');
      list.push({
        id: `non-${item.name}`,
        name: item.name,
        cleanName: clean,
        category: 'Di Luar Mandatory',
        target: isStaff ? 'Training Staff' : 'MP',
        total: item.total,
        done: item.done,
        notDone: item.notDone,
        ach: item.ach
      });
    });

    return list;
  }, [mandatoryStats, staffMandatoryStats, nonMandatoryStats]);

  // Jumlah modul per kategori (Mandatory vs Di Luar Mandatory)
  const categoryCounts = useMemo(() => {
    let mandatory = 0;
    let mandatoryMP = 0;
    let mandatoryStaff = 0;
    let nonMandatory = 0;
    allTrainingItems.forEach(i => {
      if (i.category === 'Mandatory MP') {
        mandatory++;
        mandatoryMP++;
      } else if (i.category === 'Mandatory Staff') {
        mandatory++;
        mandatoryStaff++;
      } else {
        nonMandatory++;
      }
    });
    return {
      all: allTrainingItems.length,
      mandatory,
      mandatoryMP,
      mandatoryStaff,
      nonMandatory
    };
  }, [allTrainingItems]);

  const availableModuleNames = useMemo(() => {
    const set = new Set<string>();
    allTrainingItems.forEach(i => {
      if (trainingCategoryFilter === 'MANDATORY_ALL' && !i.category.startsWith('Mandatory')) return;
      if (trainingCategoryFilter === 'MANDATORY_MP' && i.category !== 'Mandatory MP') return;
      if (trainingCategoryFilter === 'MANDATORY_STAFF' && i.category !== 'Mandatory Staff') return;
      if (trainingCategoryFilter === 'NON_MANDATORY' && i.category !== 'Di Luar Mandatory') return;
      set.add(i.cleanName);
    });
    return Array.from(set).sort();
  }, [allTrainingItems, trainingCategoryFilter]);

  const toggleModuleSelection = (moduleName: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleName)
        ? prev.filter(m => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const toggleStatusSelection = (st: 'DONE' | 'NOT_YET') => {
    setSelectedStatus(prev =>
      prev.includes(st)
        ? prev.filter(s => s !== st)
        : [...prev, st]
    );
  };

  const filteredTrainingItems = useMemo(() => {
    return allTrainingItems.filter(item => {
      if (trainingCategoryFilter === 'MANDATORY_ALL' && !item.category.startsWith('Mandatory')) return false;
      if (trainingCategoryFilter === 'MANDATORY_MP' && item.category !== 'Mandatory MP') return false;
      if (trainingCategoryFilter === 'MANDATORY_STAFF' && item.category !== 'Mandatory Staff') return false;
      if (trainingCategoryFilter === 'NON_MANDATORY' && item.category !== 'Di Luar Mandatory') return false;

      // 1. Filter dropdown modul (multi-select)
      if (selectedModules.length > 0 && !selectedModules.includes(item.cleanName)) return false;

      // 2. Filter dropdown status training (multi-select: Done / Belum)
      if (selectedStatus.length === 1) {
        if (selectedStatus.includes('DONE') && item.done === 0) return false;
        if (selectedStatus.includes('NOT_YET') && item.notDone === 0) return false;
      } else if (selectedStatus.length === 0) {
        return false;
      }

      return true;
    }).sort((a, b) => b.total - a.total);
  }, [allTrainingItems, trainingCategoryFilter, selectedModules, selectedStatus]);

  // Data terformat untuk Chart Kombinasi Column and Line
  const trainingComboChartData = useMemo(() => {
    return filteredTrainingItems.map(item => ({
      name: item.cleanName,
      fullName: item.name,
      total: item.total,
      done: item.done,
      notDone: item.notDone,
      ach: Math.round(item.ach * 10) / 10,
      category: item.category,
      rawItem: item
    }));
  }, [filteredTrainingItems]);

  const [drilldownStatusFilter, setDrilldownStatusFilter] = useState<'PENDING' | 'DONE' | 'ALL'>('PENDING');
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  // Mini data & drilldown peserta untuk modul yang sedang diklik pada chart / ringkasan mandatory
  const activeModuleParticipants = useMemo(() => {
    if (!activeClickedModule) return [];
    const modClean = activeClickedModule.cleanName || activeClickedModule.name;
    const isStaff = activeClickedModule.target === 'Training Staff' || activeClickedModule.category === 'Mandatory Staff';
    const source = isStaff ? data.training : data.mp;
    const headerList = isStaff ? data.trainingMatrixHeaders : data.mpTrainingHeaders;
    const targetTag = isStaff ? 'Training Staff' : 'MP';
    const actualHeader = headerList.find(h => key(h) === key(modClean)) || modClean;

    const list: Array<{
      nik: string;
      name: string;
      section: string;
      subsection: string;
      job: string;
      grade: string;
      status: 'Done' | 'Belum';
      target: string;
    }> = [];

    source.filter(r => nikOf(r)).forEach(r => {
      const nik = nikOf(r);
      const isAssigned = data.mandatoryAssignments.some(
        a => nikOf({ NIK: a.nik }) === nik && key(a.moduleName) === key(modClean) && (!a.target || a.target === targetTag)
      );
      const done = isDone(r[actualHeader]);

      const isNonMandatory = activeClickedModule.category === 'Di Luar Mandatory';
      if (isAssigned || (isNonMandatory && (done || !isAssigned))) {
        list.push({
          nik,
          name: nameOf(r) || 'Nama belum diisi',
          section: sectionOf(r),
          subsection: subsectionOf(r),
          job: jobOf(r) || '—',
          grade: gradeOf(r) || '—',
          status: done ? 'Done' : 'Belum',
          target: targetTag
        });
      }
    });

    return list;
  }, [activeClickedModule, data]);

  const pendingParticipants = useMemo(() => {
    return activeModuleParticipants.filter(p => p.status === 'Belum');
  }, [activeModuleParticipants]);

  const doneParticipants = useMemo(() => {
    return activeModuleParticipants.filter(p => p.status === 'Done');
  }, [activeModuleParticipants]);

  const displayedParticipants = useMemo(() => {
    let result = activeModuleParticipants;
    if (drilldownStatusFilter === 'PENDING') {
      result = pendingParticipants;
    } else if (drilldownStatusFilter === 'DONE') {
      result = doneParticipants;
    }

    if (drilldownSearch.trim()) {
      const q = drilldownSearch.toLowerCase();
      result = result.filter(p =>
        p.nik.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.section.toLowerCase().includes(q) ||
        p.subsection.toLowerCase().includes(q) ||
        p.job.toLowerCase().includes(q) ||
        p.grade.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeModuleParticipants, pendingParticipants, doneParticipants, drilldownStatusFilter, drilldownSearch]);

  const copyPendingNiks = () => {
    const niks = pendingParticipants.map(p => p.nik).join(', ');
    if (niks) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(niks).catch(() => {});
      }
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const openDrilldown = (item: any, initialStatus: 'PENDING' | 'DONE' | 'ALL' = 'PENDING') => {
    setActiveClickedModule(item);
    setDrilldownStatusFilter(initialStatus);
    setDrilldownSearch('');
  };

  return (
    <div className="dashboard-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-label"><span /> PEOPLE & CAPABILITY INTELLIGENCE</div>
          <h2>Build capability.<br /><em>Move forward together.</em></h2>
          <p>Ringkasan manpower, kompetensi, dan progres pengembangan training PT Karunia Armada Indonesia Site GAM dalam satu tampilan.</p>
          <div className="hero-actions">
            <button className="btn btn-white" onClick={() => onGo('records')}>
              Input hasil training <GraduationCap size={16} />
            </button>
            <button className="btn btn-ghost-white" onClick={() => onGo('matrix')}>
              Lihat training matrix <Activity size={16} />
            </button>
          </div>
        </div>
        <div className="hero-art">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="hero-stat">
            <div className="hero-stat-icon"><Users size={20} /></div>
            <small>Total Manpower</small>
            <strong>{fmt(totalMP)}</strong>
            <span><i /> Personel tercatat</span>
          </div>
          <div className="hero-mini mini-one">
            <Target size={16} />
            <div>
              <b>{percent(avgAch)}</b>
              <small>Avg. ACH Mandatory</small>
            </div>
          </div>
          <div className="hero-mini mini-two">
            <ShieldCheck size={16} />
            <div>
              <b>{fmt(assignedPeople)}</b>
              <small>Personel assigned</small>
            </div>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <div className="section-kicker">MANPOWER SNAPSHOT</div>
          <h2>Workforce at a glance</h2>
        </div>
        <span className="muted-label">Berdasarkan data yang tersedia</span>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Manpower" value={fmt(totalMP)} sub="Seluruh baris dengan NIK terisi pada sheet MP" icon={<Users size={19} />} tone="blue" />
        <StatCard label="Manpower Aktif" value={fmt(activeMP)} sub="NIK terisi + Jabatan terisi" icon={<UserRoundCog size={19} />} tone="teal" />
        <StatCard label="Non Aktif" value={fmt(inactiveMP)} sub="Personel tanpa jabatan / belum aktif" icon={<AlertCircle size={19} />} tone="rose" />
        <StatCard label="ACH Mandatory" value={percent(avgAch)} sub="Rata-rata modul yang resmi ditugaskan" icon={<Target size={19} />} tone="purple" />
        <StatCard
          label="Training Terjadwal"
          value={`${scheduledThisMonthStats.sessionCount} Sesi`}
          sub={`${scheduledThisMonthStats.participantCount} peserta terjadwal di ${scheduledThisMonthStats.monthName}`}
          icon={<CalendarClock size={19} />}
          tone="amber"
          trend="Bulan Berjalan"
          onClick={() => onGo('calendar')}
        />
      </div>

      <div className="charts-grid-three">
        {/* 1. Chart Kombinasi Column & Line: Manpower by Section */}
        <div className="panel chart-panel">
          <div className="chart-title">
            <div>
              <div className="section-kicker">SECTION & KELENGKAPAN</div>
              <h3>Manpower by Section</h3>
              <p>Kombinasi Personel Aktif & Non Aktif (Column) & % Aktif (Line)</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="pill pill-blue" style={{ fontSize: '0.65rem' }}>Column + Line</span>
              <span className="chart-badge">{sectionComboData.length} section</span>
            </div>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={sectionComboData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77839b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#77839b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#10b981' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f3f6fc' }}
                  formatter={(val: any, name: any) => {
                    if (name === '% Aktif') return [`${val}%`, name];
                    return [`${val} personel`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '2px' }} iconSize={9} />
                <Bar yAxisId="left" dataKey="active" name="Aktif" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar yAxisId="left" dataKey="inactive" name="Non Aktif" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="% Aktif" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Donut Chart: Status Personel (Aktif / Non Aktif) */}
        <div className="panel chart-panel">
          <div className="chart-title">
            <div>
              <div className="section-kicker">DATA COMPLETENESS</div>
              <h3>Status Personel (Aktif / Non Aktif)</h3>
              <p>Distribusi Status Personel Aktif vs Non Aktif</p>
            </div>
            <span className={`pill ${completenessRate >= 90 ? 'pill-green' : 'pill-amber'}`} style={{ fontSize: '0.68rem' }}>
              {percent(completenessRate)} Aktif
            </span>
          </div>
          <div className="chart-body pie-layout">
            <ResponsiveContainer width="52%" height={240}>
              <PieChart>
                <Pie
                  data={jobCompletenessData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={4}
                  stroke="none"
                >
                  {jobCompletenessData.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${fmt(Number(val))} personel (${percent(totalMP ? (Number(val) / totalMP) * 100 : 0)})`,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-list">
              <div className="donut-center-insight">
                <small>Rasio Personel Aktif</small>
                <b>{percent(completenessRate)}</b>
              </div>
              <div>
                <i style={{ background: '#10b981' }} />
                <span>Aktif</span>
                <b>{fmt(activeMP)}</b>
              </div>
              <div>
                <i style={{ background: '#f43f5e' }} />
                <span>Non Aktif</span>
                <b>{fmt(inactiveMP)}</b>
              </div>
              <div style={{ paddingTop: '0.35rem', borderTop: '1px dashed var(--slate-200)', marginTop: '0.2rem' }}>
                <span style={{ color: '#64748b' }}>Total Data NIK</span>
                <b style={{ color: '#0f172a' }}>{fmt(totalMP)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Pie Chart: Grade Composition */}
        <div className="panel chart-panel">
          <div className="chart-title">
            <div>
              <div className="section-kicker">GRADE COMPOSITION</div>
              <h3>Grade Composition</h3>
              <p>Komposisi manpower berdasarkan grade</p>
            </div>
            <span className="chart-badge">{gradeData.length} grade</span>
          </div>
          <div className="chart-body pie-layout">
            <ResponsiveContainer width="52%" height={240}>
              <PieChart>
                <Pie data={gradeData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                  {gradeData.map((x, i) => <Cell key={x.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-list">
              {gradeData.slice(0, 6).map((x, i) => (
                <div key={x.name}>
                  <i style={{ background: COLORS[i % COLORS.length] }} />
                  <span>{x.name}</span>
                  <b>{x.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <div className="section-kicker">TRAINING DEVELOPMENT</div>
          <h2>Capability & training progress</h2>
        </div>
        <button className="text-link" onClick={() => onGo('matrix')}>
          Buka training matrix <span>→</span>
        </button>
      </div>

      {/* Summary Panels for MP and Staff with toggle expand & drilldown */}
      <div className="training-overview-grid">
        <TrainingSummary
          title="Mandatory Training · MP"
          subtitle="Pencapaian modul yang ditugaskan pada manpower · Klik bar untuk drilldown detail pending"
          stats={mandatoryStats}
          target="MP"
          onDrilldown={item => openDrilldown(item, 'PENDING')}
        />
        <TrainingSummary
          title="Mandatory Training · Staff"
          subtitle="Pencapaian modul yang ditugaskan pada training staff · Klik bar untuk drilldown detail pending"
          stats={staffMandatoryStats}
          target="Training Staff"
          onDrilldown={item => openDrilldown(item, 'PENDING')}
        />
      </div>

      {/* CHART ANALISIS PROGRES MODUL TRAINING (DENGAN FILTER MULTI-SELECT DROPDOWN & MINI DATA INTERAKTIF) */}
      <div className="panel training-chart-card" style={{ marginBottom: '1.5rem' }}>
        <div className="chart-header-filter-row">
          <div className="chart-header-titles">
            <div className="section-kicker minimal">TRAINING PROGRESS & ANALYTICS</div>
            <h3 className="chart-title-minimal">Progres Pencapaian Modul Training</h3>
            <p className="chart-subtitle-minimal">
              Target Peserta vs Selesai (Column) & % Capaian ACH (Line) · <span className="click-hint-minimal">💡 Klik grafik untuk mini data</span>
            </p>

            {/* Quick Segmented Filter: Semua / Mandatory / Di Luar Mandatory */}
            <div className="category-filter-segmented">
              <button
                type="button"
                className={`category-segment-btn ${trainingCategoryFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  setTrainingCategoryFilter('ALL');
                  setSelectedModules([]);
                }}
              >
                Semua ({categoryCounts.all})
              </button>
              <button
                type="button"
                className={`category-segment-btn ${trainingCategoryFilter === 'MANDATORY_ALL' ? 'active' : ''}`}
                onClick={() => {
                  setTrainingCategoryFilter('MANDATORY_ALL');
                  setSelectedModules([]);
                }}
              >
                <BookOpenCheck size={13} />
                Mandatory ({categoryCounts.mandatory})
              </button>
              <button
                type="button"
                className={`category-segment-btn ${trainingCategoryFilter === 'NON_MANDATORY' ? 'active' : ''}`}
                onClick={() => {
                  setTrainingCategoryFilter('NON_MANDATORY');
                  setSelectedModules([]);
                }}
              >
                <GraduationCap size={13} />
                Di Luar Mandatory ({categoryCounts.nonMandatory})
              </button>
            </div>
          </div>

          {/* Filter Dropdowns (Kategori, Modul, Status Training, Toggle Label Data) */}
          <div className="filter-dropdowns-group">
            {/* 0. Dropdown Filter Kategori Training */}
            <div
              ref={categoryDropdownRef}
              className={`dropdown-container ${categoryDropdownOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className={`dropdown-trigger-btn ${trainingCategoryFilter !== 'ALL' ? 'has-selection' : ''}`}
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                  setModuleDropdownOpen(false);
                  setStatusDropdownOpen(false);
                }}
              >
                <BookOpenCheck size={14} />
                <span>
                  {trainingCategoryFilter === 'ALL'
                    ? 'Kategori: Semua'
                    : trainingCategoryFilter === 'MANDATORY_ALL'
                    ? 'Kategori: Mandatory'
                    : trainingCategoryFilter === 'MANDATORY_MP'
                    ? 'Kategori: Mandatory MP'
                    : trainingCategoryFilter === 'MANDATORY_STAFF'
                    ? 'Kategori: Mandatory Staff'
                    : 'Kategori: Di Luar Mandatory'}
                </span>
                <ChevronDown size={14} className={categoryDropdownOpen ? 'rotate-180' : ''} />
              </button>

              {categoryDropdownOpen && (
                <div className="dropdown-popover category-dropdown-popover">
                  <div className="dropdown-popover-header">
                    <div className="dropdown-popover-title">
                      <BookOpenCheck size={13} />
                      <span>Kategori Training</span>
                    </div>
                    <button
                      type="button"
                      className="popover-close-btn"
                      onClick={() => setCategoryDropdownOpen(false)}
                      title="Tutup pilihan kategori"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="dropdown-items-list" style={{ marginTop: '0.4rem' }}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${trainingCategoryFilter === 'ALL' ? 'item-checked' : ''}`}
                      onClick={() => {
                        setTrainingCategoryFilter('ALL');
                        setSelectedModules([]);
                        setCategoryDropdownOpen(false);
                      }}
                    >
                      <span className="item-label">Semua Training ({categoryCounts.all})</span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${trainingCategoryFilter === 'MANDATORY_ALL' ? 'item-checked' : ''}`}
                      onClick={() => {
                        setTrainingCategoryFilter('MANDATORY_ALL');
                        setSelectedModules([]);
                        setCategoryDropdownOpen(false);
                      }}
                    >
                      <span className="status-badge-mini" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        ⭐ Training Mandatory ({categoryCounts.mandatory})
                      </span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${trainingCategoryFilter === 'MANDATORY_MP' ? 'item-checked' : ''}`}
                      onClick={() => {
                        setTrainingCategoryFilter('MANDATORY_MP');
                        setSelectedModules([]);
                        setCategoryDropdownOpen(false);
                      }}
                      style={{ paddingLeft: '1.25rem' }}
                    >
                      <span className="item-label" style={{ fontSize: '0.72rem', color: '#475569' }}>
                        ↳ Khusus Mandatory MP ({categoryCounts.mandatoryMP})
                      </span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${trainingCategoryFilter === 'MANDATORY_STAFF' ? 'item-checked' : ''}`}
                      onClick={() => {
                        setTrainingCategoryFilter('MANDATORY_STAFF');
                        setSelectedModules([]);
                        setCategoryDropdownOpen(false);
                      }}
                      style={{ paddingLeft: '1.25rem' }}
                    >
                      <span className="item-label" style={{ fontSize: '0.72rem', color: '#475569' }}>
                        ↳ Khusus Mandatory Staff ({categoryCounts.mandatoryStaff})
                      </span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${trainingCategoryFilter === 'NON_MANDATORY' ? 'item-checked' : ''}`}
                      onClick={() => {
                        setTrainingCategoryFilter('NON_MANDATORY');
                        setSelectedModules([]);
                        setCategoryDropdownOpen(false);
                      }}
                    >
                      <span className="status-badge-mini" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                        📋 Di Luar Mandatory ({categoryCounts.nonMandatory})
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 1. Dropdown Filter Modul (Multi-Select) */}
            <div
              ref={moduleDropdownRef}
              className={`dropdown-container ${moduleDropdownOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className={`dropdown-trigger-btn ${selectedModules.length > 0 ? 'has-selection' : ''}`}
                onClick={() => {
                  setModuleDropdownOpen(!moduleDropdownOpen);
                  setCategoryDropdownOpen(false);
                  setStatusDropdownOpen(false);
                }}
              >
                <Filter size={14} />
                <span>
                  {selectedModules.length === 0
                    ? `Semua Modul (${availableModuleNames.length})`
                    : `${selectedModules.length} Modul Terpilih`}
                </span>
                <ChevronDown size={14} className={moduleDropdownOpen ? 'rotate-180' : ''} />
              </button>

              {moduleDropdownOpen && (
                <div className="dropdown-popover module-dropdown-popover">
                  <div className="dropdown-popover-header">
                    <div className="dropdown-popover-title">
                      <Filter size={13} />
                      <span>Pilih Modul Training ({availableModuleNames.length})</span>
                    </div>
                    <button
                      type="button"
                      className="popover-close-btn"
                      onClick={() => setModuleDropdownOpen(false)}
                      title="Tutup pilihan modul"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="dropdown-search-box">
                    <Search size={14} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Cari modul..."
                      value={moduleSearchQuery}
                      onChange={e => setModuleSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {moduleSearchQuery && (
                      <button type="button" className="clear-btn" onClick={() => setModuleSearchQuery('')}>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="dropdown-quick-actions">
                    <button
                      type="button"
                      className="quick-action-link"
                      onClick={() => setSelectedModules([...availableModuleNames])}
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="quick-action-link text-danger"
                      onClick={() => setSelectedModules([])}
                    >
                      Hapus Pilihan
                    </button>
                  </div>

                  <div className="dropdown-items-list">
                    {availableModuleNames
                      .filter(m => !moduleSearchQuery || m.toLowerCase().includes(moduleSearchQuery.toLowerCase()))
                      .map(m => {
                        const isChecked = selectedModules.includes(m);
                        return (
                          <div
                            key={m}
                            role="button"
                            tabIndex={0}
                            className={`dropdown-item-row ${isChecked ? 'item-checked' : ''}`}
                            onClick={() => toggleModuleSelection(m)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleModuleSelection(m);
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleModuleSelection(m)}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className="item-label">{m}</span>
                          </div>
                        );
                      })}
                    {availableModuleNames.filter(m => !moduleSearchQuery || m.toLowerCase().includes(moduleSearchQuery.toLowerCase())).length === 0 && (
                      <div className="dropdown-empty">Tidak ada modul ditemukan</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dropdown Filter Status Training (Multi-Select: Done / Belum) */}
            <div
              ref={statusDropdownRef}
              className={`dropdown-container ${statusDropdownOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className={`dropdown-trigger-btn ${selectedStatus.length !== 2 ? 'has-selection' : ''}`}
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setCategoryDropdownOpen(false);
                  setModuleDropdownOpen(false);
                }}
              >
                <CheckCircle2 size={14} />
                <span>
                  {selectedStatus.length === 2
                    ? 'Status: Semua (Done & Belum)'
                    : selectedStatus.includes('DONE')
                    ? 'Status: Hanya Selesai (Done)'
                    : selectedStatus.includes('NOT_YET')
                    ? 'Status: Hanya Belum Selesai'
                    : 'Status: Belum dipilih'}
                </span>
                <ChevronDown size={14} className={statusDropdownOpen ? 'rotate-180' : ''} />
              </button>

              {statusDropdownOpen && (
                <div className="dropdown-popover status-dropdown-popover">
                  <div className="dropdown-popover-header">
                    <div className="dropdown-popover-title">
                      <CheckCircle2 size={13} />
                      <span>Status Training</span>
                    </div>
                    <button
                      type="button"
                      className="popover-close-btn"
                      onClick={() => setStatusDropdownOpen(false)}
                      title="Tutup pilihan status"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="dropdown-items-list" style={{ marginTop: '0.4rem' }}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${selectedStatus.includes('DONE') ? 'item-checked' : ''}`}
                      onClick={() => toggleStatusSelection('DONE')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleStatusSelection('DONE');
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatus.includes('DONE')}
                        onChange={() => toggleStatusSelection('DONE')}
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="status-badge-mini status-done">✓ Selesai (Done)</span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      className={`dropdown-item-row ${selectedStatus.includes('NOT_YET') ? 'item-checked' : ''}`}
                      onClick={() => toggleStatusSelection('NOT_YET')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleStatusSelection('NOT_YET');
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatus.includes('NOT_YET')}
                        onChange={() => toggleStatusSelection('NOT_YET')}
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="status-badge-mini status-pending">⏳ Belum Selesai</span>
                    </div>
                  </div>
                  <div className="dropdown-quick-actions" style={{ borderTop: '1px solid #f1f5f9', marginTop: '6px', paddingTop: '6px' }}>
                    <button
                      type="button"
                      className="quick-action-link"
                      onClick={() => setSelectedStatus(['DONE', 'NOT_YET'])}
                    >
                      Pilih Keduanya
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Toggle Label Data pada Chart */}
            <button
              type="button"
              className={`dropdown-trigger-btn ${showChartLabels ? 'has-selection' : ''}`}
              onClick={() => setShowChartLabels(!showChartLabels)}
              title="Tampilkan / Sembunyikan label angka & persentase pada grafik"
            >
              <SlidersHorizontal size={13} />
              <span>Label Data: {showChartLabels ? 'ON' : 'OFF'}</span>
            </button>

            {/* Tombol Reset Filter jika aktif */}
            {(selectedModules.length > 0 || selectedStatus.length !== 2 || trainingCategoryFilter !== 'ALL') && (
              <button
                type="button"
                className="btn btn-light btn-reset-filters"
                onClick={() => {
                  setSelectedModules([]);
                  setSelectedStatus(['DONE', 'NOT_YET']);
                  setTrainingCategoryFilter('ALL');
                  setModuleSearchQuery('');
                }}
                title="Kembalikan semua filter ke awal"
              >
                <RotateCcw size={13} /> Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Ringkasan Filter Terpilih */}
        {(selectedModules.length > 0 || selectedStatus.length !== 2 || trainingCategoryFilter !== 'ALL') && (
          <div className="active-filters-bar">
            <span>Filter Aktif:</span>
            {trainingCategoryFilter !== 'ALL' && (
              <span className="filter-pill-active">
                {trainingCategoryFilter === 'MANDATORY_ALL'
                  ? 'Kategori: Training Mandatory'
                  : trainingCategoryFilter === 'MANDATORY_MP'
                  ? 'Kategori: Mandatory MP'
                  : trainingCategoryFilter === 'MANDATORY_STAFF'
                  ? 'Kategori: Mandatory Staff'
                  : 'Kategori: Di Luar Mandatory'}
                <button
                  type="button"
                  onClick={() => {
                    setTrainingCategoryFilter('ALL');
                    setSelectedModules([]);
                  }}
                >
                  ×
                </button>
              </span>
            )}
            {selectedModules.length > 0 && (
              <span className="filter-pill-active">
                {selectedModules.length} Modul Dipilih
                <button type="button" onClick={() => setSelectedModules([])}>×</button>
              </span>
            )}
            {selectedStatus.length === 1 && (
              <span className="filter-pill-active">
                {selectedStatus.includes('DONE') ? 'Hanya Selesai (Done)' : 'Hanya Belum Selesai'}
                <button type="button" onClick={() => setSelectedStatus(['DONE', 'NOT_YET'])}>×</button>
              </span>
            )}
            <span className="filter-result-count">({filteredTrainingItems.length} modul ditampilkan pada grafik)</span>
          </div>
        )}

        {/* COMBINATION COLUMN & LINE CHART FOR TRAINING PROGRESS */}
        <div className="training-combo-chart-container vibrant-chart">
          {trainingComboChartData.length > 0 ? (
            <div className="training-combo-chart-scroll">
              <div style={{ minWidth: `${Math.max(680, trainingComboChartData.length * 68)}px`, height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trainingComboChartData}
                    margin={{ top: 28, right: 30, left: -6, bottom: 44 }}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length) {
                        const it = e.activePayload[0].payload;
                        openDrilldown(it?.rawItem || it, 'PENDING');
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="doneGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      angle={-22}
                      textAnchor="end"
                      interval={0}
                      height={48}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.18))]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 115]}
                      unit="%"
                      tick={{ fontSize: 11, fill: '#059669', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="combo-tooltip vibrant-tooltip">
                              <div className="combo-tooltip-title">{item.name}</div>
                              <span className="combo-tooltip-cat">{item.category}</span>
                              <div className="combo-tooltip-body">
                                <div className="combo-tooltip-row">
                                  <span className="dot dot-indigo" style={{ background: '#6366f1' }} />
                                  <span>Target Ditugaskan:</span>
                                  <b>{fmt(item.total)} orang</b>
                                </div>
                                <div className="combo-tooltip-row">
                                  <span className="dot dot-green" style={{ background: '#10b981' }} />
                                  <span>Peserta Selesai:</span>
                                  <b style={{ color: '#059669' }}>{fmt(item.done)} orang</b>
                                </div>
                                {item.notDone > 0 && (
                                  <div className="combo-tooltip-row">
                                    <span className="dot dot-amber" style={{ background: '#f59e0b' }} />
                                    <span>Belum Selesai:</span>
                                    <b style={{ color: '#d97706' }}>{fmt(item.notDone)} orang</b>
                                  </div>
                                )}
                                <div className="combo-tooltip-row highlight">
                                  <span className="dot dot-cyan" style={{ background: '#06b6d4' }} />
                                  <span>Pencapaian % ACH:</span>
                                  <b style={{ color: '#0284c7', fontSize: '0.9rem' }}>{percent(item.ach)}</b>
                                </div>
                              </div>
                              <div className="tooltip-action-prompt">
                                👆 Klik untuk melihat rincian mini data peserta
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      iconSize={10}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="total"
                      name="Target Ditugaskan (Column)"
                      fill="url(#totalGrad)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const raw = data?.rawItem || data?.payload?.rawItem || data?.payload;
                        if (raw) openDrilldown(raw, 'ALL');
                      }}
                    >
                      {showChartLabels && (
                        <LabelList
                          dataKey="total"
                          position="top"
                          offset={4}
                          fill="#4338ca"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')}
                        />
                      )}
                    </Bar>
                    <Bar
                      yAxisId="left"
                      dataKey="done"
                      name="Peserta Selesai (Column)"
                      fill="url(#doneGrad)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const raw = data?.rawItem || data?.payload?.rawItem || data?.payload;
                        if (raw) openDrilldown(raw, 'DONE');
                      }}
                    >
                      {showChartLabels && (
                        <LabelList
                          dataKey="done"
                          position="top"
                          offset={4}
                          fill="#059669"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')}
                        />
                      )}
                    </Bar>
                    <Bar
                      yAxisId="left"
                      dataKey="notDone"
                      name="Belum Selesai (Column)"
                      fill="url(#pendingGrad)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                      cursor="pointer"
                      onClick={(data: any) => {
                        const raw = data?.rawItem || data?.payload?.rawItem || data?.payload;
                        if (raw) openDrilldown(raw, 'PENDING');
                      }}
                    >
                      {showChartLabels && (
                        <LabelList
                          dataKey="notDone"
                          position="top"
                          offset={4}
                          fill="#d97706"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')}
                        />
                      )}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ach"
                      name="Capaian % ACH (Line)"
                      stroke="#06b6d4"
                      strokeWidth={3.5}
                      dot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                      cursor="pointer"
                    >
                      {showChartLabels && (
                        <LabelList
                          dataKey="ach"
                          position="top"
                          offset={8}
                          fill="#0284c7"
                          fontSize={10}
                          fontWeight={800}
                          formatter={(val: any) => `${val}%`}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
              Tidak ada data modul training yang cocok dengan filter saat ini. Silakan ubah filter modul atau status.
            </div>
          )}
        </div>

        {/* MODAL / DRILLDOWN DETAIL POPUP (FOKUS PESERTA PENDING / BELUM SELESAI) */}
        {activeClickedModule && (
          <div className="mini-data-modal-overlay" onClick={() => setActiveClickedModule(null)}>
            <div className="mini-data-modal drilldown-modal" onClick={e => e.stopPropagation()}>
              <div className="mini-data-header">
                <div>
                  <span className="mini-data-kicker">
                    DRILLDOWN DETAIL MODUL · {activeClickedModule.category || 'Mandatory Training'}
                  </span>
                  <h3>{activeClickedModule.cleanName || activeClickedModule.name}</h3>
                </div>
                <button
                  type="button"
                  className="mini-data-close-btn"
                  onClick={() => setActiveClickedModule(null)}
                  title="Tutup drilldown"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Alert / Highlight Callout: Fokus Peserta Belum Selesai (Pending) */}
              <div className="drilldown-pending-banner">
                <div className="drilldown-banner-content">
                  <div className="banner-icon-box">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <b>
                      {pendingParticipants.length > 0
                        ? `${pendingParticipants.length} Personel Belum Selesai (Pending)`
                        : 'Seluruh Personel Telah Menyelesaikan Modul Ini!'}
                    </b>
                    <p>
                      {pendingParticipants.length > 0
                        ? `Daftar personel yang ditugaskan namun belum tercatat selesai pada modul ${activeClickedModule.cleanName || activeClickedModule.name}.`
                        : `Target capaian mandatory 100% tuntas untuk modul ini (${doneParticipants.length} personel lulus).`}
                    </p>
                  </div>
                </div>
                {pendingParticipants.length > 0 && (
                  <button
                    type="button"
                    className="btn-copy-niks"
                    onClick={copyPendingNiks}
                    title="Salin seluruh NIK peserta pending ke clipboard"
                  >
                    {copiedToast ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedToast ? 'NIK Tersalin!' : 'Salin NIK Pending'}</span>
                  </button>
                )}
              </div>

              {/* Stat badges & Interactive Filter Tabs */}
              <div className="drilldown-tabs-bar">
                <button
                  type="button"
                  className={`drilldown-tab-btn pending ${drilldownStatusFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setDrilldownStatusFilter('PENDING')}
                >
                  <span className="tab-dot dot-amber" />
                  <span className="tab-label">Belum Selesai (Pending)</span>
                  <span className="tab-count badge-pending">{pendingParticipants.length}</span>
                </button>

                <button
                  type="button"
                  className={`drilldown-tab-btn done ${drilldownStatusFilter === 'DONE' ? 'active' : ''}`}
                  onClick={() => setDrilldownStatusFilter('DONE')}
                >
                  <span className="tab-dot dot-green" />
                  <span className="tab-label">Sudah Selesai (Done)</span>
                  <span className="tab-count badge-done">{doneParticipants.length}</span>
                </button>

                <button
                  type="button"
                  className={`drilldown-tab-btn all ${drilldownStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setDrilldownStatusFilter('ALL')}
                >
                  <span className="tab-dot dot-indigo" />
                  <span className="tab-label">Semua Ditugaskan</span>
                  <span className="tab-count badge-all">{activeModuleParticipants.length}</span>
                </button>

                <div className="drilldown-ach-chip">
                  <small>Capaian ACH</small>
                  <strong>{percent(activeClickedModule.ach)}</strong>
                </div>
              </div>

              {/* Table search & count summary */}
              <div className="drilldown-toolbar">
                <div className="drilldown-search-input">
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Saring NIK, nama personel, section, atau jabatan..."
                    value={drilldownSearch}
                    onChange={e => setDrilldownSearch(e.target.value)}
                  />
                  {drilldownSearch && (
                    <button type="button" onClick={() => setDrilldownSearch('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                <span className="drilldown-count-info">
                  Menampilkan {displayedParticipants.length} dari {activeModuleParticipants.length} peserta
                </span>
              </div>

              {/* Drilldown Participants Table */}
              <div className="mini-data-table-container">
                {displayedParticipants.length > 0 ? (
                  <div className="mini-data-table-wrap drilldown-table-wrap">
                    <table className="mini-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '85px' }}>NIK</th>
                          <th>Nama Personel</th>
                          <th>Section / SubSection</th>
                          <th>Jabatan</th>
                          <th style={{ width: '135px', textAlign: 'center' }}>Status Pelatihan</th>
                          {onRecordForModule && <th style={{ width: '95px', textAlign: 'center' }}>Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedParticipants.map((p, idx) => (
                          <tr key={idx} className={p.status === 'Belum' ? 'row-pending-highlight' : ''}>
                            <td className="cell-nik">{p.nik}</td>
                            <td>
                              <b>{p.name}</b>
                            </td>
                            <td>
                              <span style={{ color: '#334155' }}>{p.section}</span>
                              {p.subsection && p.subsection !== p.section && p.subsection !== 'Belum diisi' && (
                                <small style={{ display: 'block', color: '#64748b', fontSize: '0.67rem' }}>
                                  {p.subsection}
                                </small>
                              )}
                            </td>
                            <td>
                              <span className="job-tag">{p.job}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-tag ${p.status === 'Done' ? 'status-done' : 'status-pending'}`}>
                                {p.status === 'Done' ? '✓ SELESAI' : '⏳ BELUM SELESAI'}
                              </span>
                            </td>
                            {onRecordForModule && (
                              <td style={{ textAlign: 'center' }}>
                                {p.status === 'Belum' ? (
                                  <button
                                    type="button"
                                    className="btn-table-action"
                                    title="Catat hasil training untuk personel ini"
                                    onClick={() => {
                                      const modName = activeClickedModule.cleanName || activeClickedModule.name;
                                      const grp = activeClickedModule.target || (activeClickedModule.category === 'Mandatory Staff' ? 'Training Staff' : 'MP');
                                      setActiveClickedModule(null);
                                      onRecordForModule(modName, p.nik, grp);
                                    }}
                                  >
                                    <GraduationCap size={12} /> Catat
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mini-data-empty">
                    {drilldownStatusFilter === 'PENDING' && pendingParticipants.length === 0 ? (
                      <div className="all-done-celebrate">
                        <CheckCircle2 size={32} color="#10b981" />
                        <b>Luar biasa! Tidak ada peserta yang berstatus pending.</b>
                        <p>Seluruh {doneParticipants.length} personel yang ditugaskan telah menyelesaikan modul ini.</p>
                      </div>
                    ) : (
                      'Tidak ada peserta yang sesuai dengan pencarian atau filter saat ini.'
                    )}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mini-data-actions">
                {pendingParticipants.length > 0 && onRecordForModule && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => {
                      const modName = activeClickedModule.cleanName || activeClickedModule.name;
                      const grp = activeClickedModule.target || (activeClickedModule.category === 'Mandatory Staff' ? 'Training Staff' : 'MP');
                      setActiveClickedModule(null);
                      onRecordForModule(modName, undefined, grp);
                    }}
                  >
                    <GraduationCap size={15} /> Catat Hasil Training Modul Ini ({pendingParticipants.length} Pending)
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setActiveClickedModule(null);
                    onGo('matrix');
                  }}
                >
                  <BookOpenCheck size={15} /> Buka Checklist Training Matrix
                </button>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setActiveClickedModule(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Non-mandatory highlight panel */}
      <div className="panel nonmandatory-panel">
        <div className="chart-title">
          <div>
            <div className="section-kicker">ADDITIONAL DEVELOPMENT</div>
            <h3>ACH Training di Luar Mandatory</h3>
            <p>Training tambahan dicatat terpisah dan tidak mendistorsi persentase ACH mandatory.</p>
          </div>
          <span className="pill pill-purple"><Sparkles size={13} /> Non-Mandatory</span>
        </div>
        <div className="nonmandatory-grid">
          {nonMandatoryStats.slice(0, 8).map((x: any, i: number) => (
            <div className="nonmandatory-item" key={x.name}>
              <div className="nonmandatory-top">
                <span>{x.name}</span>
                <b>{percent(x.ach)}</b>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(0, Math.min(100, x.ach))}%`, background: COLORS[(i + 2) % COLORS.length] }} />
              </div>
              <small>{x.done} selesai dari {x.total} eligible</small>
            </div>
          ))}
          {!nonMandatoryStats.length && <div className="empty-state">Belum ada modul non-mandatory yang dapat dihitung.</div>}
        </div>
      </div>

      <div className="bottom-grid">
        <div className="panel">
          <div className="chart-title">
            <div>
              <h3>Training completion overview</h3>
              <p>Ringkasan peserta dengan seluruh penugasan mandatory terselesaikan</p>
            </div>
            <button className="icon-button" onClick={() => onGo('mandatory')}>
              <SlidersHorizontal size={16} />
            </button>
          </div>
          <div className="completion-cards">
            <div className="completion-box complete">
              <span className="completion-icon"><CheckCircle2 size={18} /></span>
              <div>
                <small>MP — All assigned done</small>
                <b>{mpDonePeople} personel</b>
              </div>
            </div>
            <div className="completion-box progress">
              <span className="completion-icon"><Activity size={18} /></span>
              <div>
                <small>Training Staff — All assigned done</small>
                <b>{staffDonePeople} personel</b>
              </div>
            </div>
          </div>
          <div className="small-note">
            <CircleHelp size={14} /> ACH Mandatory dihitung murni dari penugasan di Mandatory Training Database.
          </div>
        </div>

        <div className="panel recent-records-panel">
          <div className="chart-title">
            <div>
              <div className="section-kicker">TRAINING AUDIT LOG</div>
              <h3>Recent training records</h3>
              <p>Riwayat training terkini</p>
            </div>
            <button className="text-link" onClick={() => onGo('records')}>
              Lihat semua ({history.length}) →
            </button>
          </div>
          {recent.length ? (
            <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
              <table className="data-table" style={{ fontSize: '0.76rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>NIK</th>
                    <th>Nama</th>
                    <th>Nama Training</th>
                    <th style={{ width: '115px' }}>Tanggal Training</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Status Training</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => {
                    const done = isHistoryDone(r.status);
                    return (
                      <tr key={i}>
                        <td className="cell-nik">{r.nik || r.NIK || '—'}</td>
                        <td>
                          <b>{r.name || r.NAME || 'Peserta'}</b>
                        </td>
                        <td>
                          <span className="training-name-badge">
                            {r.moduleName || r['PROGRAM TRAINING'] || r.training || 'Training'}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.trainingDate || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-tag ${done ? 'status-done' : 'status-pending'}`}>
                            {r.status || (done ? 'SELESAI' : 'BELUM SELESAI')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">Belum ada riwayat training.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrainingSummary({
  title,
  subtitle,
  stats,
  target,
  onDrilldown
}: {
  title: string;
  subtitle: string;
  stats: any[];
  target: 'MP' | 'Training Staff';
  onDrilldown?: (item: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = stats.reduce((a, x) => a + x.total, 0);
  const done = stats.reduce((a, x) => a + x.done, 0);
  const ach = total ? (done / total) * 100 : 0;
  const displayed = expanded ? stats : stats.slice(0, 6);

  return (
    <div className="panel training-summary">
      <div className="chart-title">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="summary-donut">
          <b>{percent(ach)}</b>
        </span>
      </div>
      <div className="summary-metrics">
        <div>
          <small>Assignment</small>
          <b>{fmt(total)}</b>
        </div>
        <div>
          <small>Done</small>
          <b className="text-green">{fmt(done)}</b>
        </div>
        <div>
          <small>Belum (Pending)</small>
          <b className="text-amber">{fmt(Math.max(0, total - done))}</b>
        </div>
      </div>
      <div className={`module-bars ${expanded ? 'module-bars-scrollable' : ''}`}>
        {displayed.map((x, i) => (
          <div
            key={x.name}
            className="module-bar-row clickable-module-row"
            onClick={() => {
              if (onDrilldown) {
                onDrilldown({
                  name: x.name,
                  cleanName: x.name,
                  category: target === 'MP' ? 'Mandatory MP' : 'Mandatory Staff',
                  target,
                  total: x.total,
                  done: x.done,
                  notDone: x.notDone,
                  ach: x.ach
                });
              }
            }}
            title={`Klik untuk drilldown detail ${x.notDone} peserta pending pada modul ${x.name}`}
          >
            <div className="module-bar-name-wrap">
              <span className="module-bar-name" title={x.name}>{x.name}</span>
              <span className={`pending-badge-pill ${x.notDone === 0 ? 'zero' : ''}`}>
                {x.notDone === 0 ? '✓ Tuntas' : `${x.notDone} Pending`}
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.max(0, Math.min(100, x.ach))}%`, background: COLORS[i % COLORS.length] }} />
            </div>
            <div className="module-bar-stat-wrap">
              <b>{percent(x.ach)}</b>
              <ChevronRight size={13} className="module-row-arrow" />
            </div>
          </div>
        ))}
        {!stats.length && <div className="empty-state">Belum ada modul terdaftar.</div>}
      </div>
      {stats.length > 6 && (
        <button className="show-more-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Tampilkan Ringkas (6 Teratas)' : `Tampilkan Seluruh ${stats.length} Modul (+${stats.length - 6} lainnya)`}
        </button>
      )}
    </div>
  );
}

function DataTable({
  rows,
  target,
  setTarget,
  search,
  setSearch,
  sections,
  sectionFilter,
  setSectionFilter,
  statusFilter,
  setStatusFilter,
  onExportExcel,
  onEdit
}: {
  rows: Row[];
  target: 'MP' | 'Training Staff';
  setTarget: (v: any) => void;
  search: string;
  setSearch: (v: string) => void;
  sections: string[];
  sectionFilter: string;
  setSectionFilter: (v: string) => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE';
  setStatusFilter: (v: 'ALL' | 'ACTIVE' | 'INACTIVE') => void;
  onExportExcel?: () => void;
  onEdit: (r: Row) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <div className="segmented">
          <button className={target === 'MP' ? 'selected' : ''} onClick={() => setTarget('MP')}>Manpower (MP)</button>
          <button className={target === 'Training Staff' ? 'selected' : ''} onClick={() => setTarget('Training Staff')}>Training Staff</button>
        </div>
        <div className="table-filters">
          <div className="search-box">
            <Search size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari NIK, nama, section, jabatan..." />
            {search && (
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                onClick={() => setSearch('')}
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-box">
            <Filter size={15} />
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
              <option value="Semua Section">Semua Section</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-box">
            <UserRoundCog size={15} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Status: Aktif</option>
              <option value="INACTIVE">Status: Non Aktif</option>
            </select>
          </div>
          {(search || sectionFilter !== 'Semua Section' || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-light"
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setSearch('');
                setSectionFilter('Semua Section');
                setStatusFilter('ALL');
              }}
              title="Reset semua filter pencarian"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              className="btn btn-excel"
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem' }}
              onClick={onExportExcel}
              title="Ekspor data terfilter ke format Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
        </div>
      </div>
      <div className="table-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>Menampilkan <b>{rows.length}</b> record terfilter</span>
          {target === 'Training Staff' && (
            <span className="pill pill-blue" style={{ fontSize: '0.66rem' }}>
              SubSection & Grade Dikecualikan untuk Training Staff
            </span>
          )}
        </div>
        <span className="table-hint"><Pencil size={13} /> Klik edit untuk memperbarui data personel</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>No</th>
              <th>NIK</th>
              <th>Nama</th>
              <th>Section</th>
              {target !== 'Training Staff' && <th>SubSection</th>}
              {target !== 'Training Staff' && <th>Grade</th>}
              <th>Jabatan</th>
              <th>Status</th>
              <th style={{ width: '85px' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const hasJob = Boolean(jobOf(r));
              return (
                <tr key={nikOf(r) || i}>
                  <td>{i + 1}</td>
                  <td className="cell-nik">{nikOf(r) || '—'}</td>
                  <td><b>{nameOf(r) || 'Nama belum diisi'}</b></td>
                  <td>{sectionOf(r)}</td>
                  {target !== 'Training Staff' && <td>{subsectionOf(r)}</td>}
                  {target !== 'Training Staff' && <td><span className="grade-pill">{gradeOf(r)}</span></td>}
                  <td>{jobOf(r) || <span className="empty-value">Kosong (Non Aktif)</span>}</td>
                  <td>
                    <span className={`status-tag ${hasJob ? 'status-done' : 'status-inactive'}`}>
                      {hasJob ? 'Aktif' : 'Non Aktif'}
                    </span>
                  </td>
                  <td>
                    <button className="edit-button" onClick={() => onEdit(r)}>
                      <Pencil size={14} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={target === 'Training Staff' ? 7 : 9}>
                  <div className="empty-state">Tidak ada data yang cocok dengan filter pencarian.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MatrixTable({ rows, modules, search, setSearch, saving, onToggle }: {
  rows: Row[];
  modules: string[];
  search: string;
  setSearch: (v: string) => void;
  saving: boolean;
  onToggle: (r: Row, m: string, v: boolean) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = rows.filter(r => (
    !search || [nikOf(r), nameOf(r), sectionOf(r)].some(x => x.toLowerCase().includes(search.toLowerCase()))
  ) && (statusFilter === 'all' || modules.some(m => isDone(r[m]) === (statusFilter === 'done'))));

  return (
    <>
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari NIK atau nama di matrix..." />
        </div>
        <div className="table-filters">
          <select className="select-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Semua status</option>
            <option value="done">Memiliki modul selesai</option>
            <option value="pending">Belum semua selesai</option>
          </select>
          <span className="table-hint">
            {saving && <LoaderCircle size={14} className="spin" />} Klik kotak untuk update status ke Google Sheets
          </span>
        </div>
      </div>
      <div className="matrix-note">
        <AlertCircle size={16} />
        <span>Checklist menandai status modul selesai. Assignment resmi dihitung dari <b>Mandatory Training Database</b>, bukan dari seluruh kolom matrix.</span>
      </div>
      <div className="table-wrap matrix-wrap">
        <table className="data-table matrix-table">
          <thead>
            <tr>
              <th className="sticky-name">Personel</th>
              {modules.map(m => <th key={m} className="module-head">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={nikOf(r) || i}>
                <td className="sticky-name person-cell">
                  <b>{nameOf(r) || 'Nama belum diisi'}</b>
                  <small>{nikOf(r)} · {sectionOf(r)}</small>
                </td>
                {modules.map(m => (
                  <td key={m} className="check-cell">
                    <label className={`matrix-check ${isDone(r[m]) ? 'checked' : ''}`} title={`${m}: ${isDone(r[m]) ? 'Done' : 'Belum selesai'}`}>
                      <input type="checkbox" checked={isDone(r[m])} onChange={e => onToggle(r, m, e.target.checked)} />
                      <span>{isDone(r[m]) ? <Check size={13} /> : ''}</span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={modules.length + 1}><div className="empty-state">Tidak ada data yang cocok.</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RecordsPage({
  allPeople,
  allModules,
  recordModule,
  setRecordModule,
  recordStartDate,
  setRecordStartDate,
  recordFinishDate,
  setRecordFinishDate,
  recordStatus,
  setRecordStatus,
  recordTarget,
  setRecordTarget,
  selectedNiks,
  setSelectedNiks,
  history,
  saving,
  onSave,
  onAddModule
}: {
  allPeople: Row[];
  allModules: string[];
  recordModule: string;
  setRecordModule: (v: string) => void;
  recordStartDate: string;
  setRecordStartDate: (v: string) => void;
  recordFinishDate: string;
  setRecordFinishDate: (v: string) => void;
  recordStatus: string;
  setRecordStatus: (v: string) => void;
  recordTarget: string;
  setRecordTarget: (v: any) => void;
  selectedNiks: string[];
  setSelectedNiks: (v: string[]) => void;
  history: Row[];
  saving: boolean;
  onSave: () => void;
  onAddModule?: (name: string) => Promise<void> | void;
}) {
  const [q, setQ] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [submittingModule, setSubmittingModule] = useState(false);

  // Helper untuk menghitung jumlah hari pelaksanaan training
  const calculateDays = (start: string, finish: string): number => {
    if (!start || !finish) return 1;
    const d1 = new Date(start);
    const d2 = new Date(finish);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  const addDaysToFinish = (daysToAdd: number) => {
    const base = recordStartDate || today();
    const d = new Date(base);
    d.setDate(d.getDate() + daysToAdd);
    const result = d.toISOString().slice(0, 10);
    setRecordFinishDate(result);
  };

  const people = allPeople.filter(p => (recordTarget === 'Keduanya' || p.__target === recordTarget) && (!q || [nikOf(p), nameOf(p), sectionOf(p)].some(v => v.toLowerCase().includes(q.toLowerCase()))));
  const toggle = (nik: string) => setSelectedNiks(selectedNiks.includes(nik) ? selectedNiks.filter(n => n !== nik) : [...selectedNiks, nik]);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  const filteredHistory = history.filter(r => {
    const rStatus = String(r.status || r.STATUS || 'SELESAI').trim().toUpperCase();
    if (historyStatusFilter === 'selesai' && !(rStatus === 'SELESAI' || rStatus === 'DONE')) return false;
    if (historyStatusFilter === 'belum' && (rStatus === 'SELESAI' || rStatus === 'DONE')) return false;

    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return [r.nik, r.NIK, r.name, r.NAME, r.moduleName, r['PROGRAM TRAINING'], r.training, r.status, r.trainingDate, r.startDate, r.finishDate]
      .some(val => String(val || '').toLowerCase().includes(term));
  });

  const handleExportHistoryExcel = () => {
    const exportData = filteredHistory.map((r, idx) => {
      const rNik = String(r.nik || r.NIK || r['Nomor Induk Karyawan'] || '—').trim();
      const rName = String(r.name || r.NAME || r.Nama || r['Nama Karyawan'] || '—').trim();
      const rMod = String(r.moduleName || r.module || r.program || r['PROGRAM TRAINING'] || r.training || '—').trim();
      const rStart = String(r.startDate || r.tanggalMulai || (r.trainingDate && r.trainingDate.includes(' s/d ') ? r.trainingDate.split(' s/d ')[0] : r.trainingDate) || '—').trim();
      const rFinish = String(r.finishDate || r.tanggalSelesai || (r.trainingDate && r.trainingDate.includes(' s/d ') ? r.trainingDate.split(' s/d ')[1] : r.trainingDate) || rStart).trim();
      const rStatus = String(r.status || r.STATUS || 'SELESAI').trim();
      return {
        'No': idx + 1,
        'NIK': rNik,
        'Nama': rName,
        'Tanggal Mulai Training': rStart,
        'Tanggal Selesai Training': rFinish,
        'Program Training': rMod,
        'Status Training': rStatus
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Training Database');
    XLSX.writeFile(wb, `Training_Database_GAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim() || !onAddModule || submittingModule) return;
    setSubmittingModule(true);
    try {
      await onAddModule(newModuleName.trim());
      setNewModuleName('');
      setShowAddModal(false);
    } finally {
      setSubmittingModule(false);
    }
  };

  return (
    <div className="records-layout">
      <section className="panel records-form">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">TRAINING LOG</div>
            <h2>Catat Hasil Pelatihan</h2>
            <p>Simpan riwayat ke sheet Training Database dan sinkronkan status ke checklist matrix bila modul cocok.</p>
          </div>
          <div className="heading-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onAddModule && (
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setShowAddModal(true)}
                title="Tambah program / modul training baru"
              >
                <Plus size={16} /> Tambah Modul
              </button>
            )}
            <span className="pill pill-blue"><BookOpenCheck size={14} /> Training Record</span>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>Program Training</label>
              {onAddModule && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.74rem',
                    color: '#2563eb',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Tambah modul baru ke sistem"
                >
                  <Plus size={12} /> Tambah Modul Baru
                </button>
              )}
            </div>
            <select
              value={recordModule}
              onChange={e => {
                if (e.target.value === '__ADD_NEW__') {
                  setShowAddModal(true);
                } else {
                  setRecordModule(e.target.value);
                }
              }}
            >
              <option value="">Pilih program training</option>
              {allModules.map(m => <option key={m} value={m}>{m}</option>)}
              {onAddModule && <option value="__ADD_NEW__">➕ + Tambah Modul Baru...</option>}
            </select>
          </div>

          <label>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} className="text-blue" /> Tanggal Mulai (Start) <span style={{ color: '#ef4444' }}>*</span>
            </span>
            <input
              type="date"
              value={recordStartDate}
              onChange={e => {
                const newStart = e.target.value;
                setRecordStartDate(newStart);
                if (recordFinishDate && newStart > recordFinishDate) {
                  setRecordFinishDate(newStart);
                }
              }}
            />
          </label>

          <label>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} className="text-blue" /> Tanggal Selesai (Finish) <span style={{ color: '#ef4444' }}>*</span>
            </span>
            <input
              type="date"
              value={recordFinishDate}
              min={recordStartDate}
              onChange={e => setRecordFinishDate(e.target.value)}
            />
          </label>

          <label>
            Status Pelatihan
            <select value={recordStatus} onChange={e => setRecordStatus(e.target.value)}>
              <option value="SELESAI">Selesai (Completed)</option>
              <option value="TERJADWAL">Terjadwal (Upcoming)</option>
              <option value="DALAM PROSES">Dalam Proses (Ongoing)</option>
              <option value="BELUM SELESAI">Belum selesai</option>
            </select>
          </label>

          <label>
            Kelompok Database
            <select value={recordTarget} onChange={e => { setRecordTarget(e.target.value); setSelectedNiks([]); }}>
              <option value="MP">Manpower (MP)</option>
              <option value="Training Staff">Training Staff</option>
              <option value="Keduanya">Keduanya</option>
            </select>
          </label>
        </div>

        {/* Quick Date Duration Helper & Presets Bar */}
        <div className="training-date-helper-bar">
          <div className="date-duration-info">
            {recordStartDate && recordFinishDate ? (
              recordFinishDate < recordStartDate ? (
                <span className="duration-warning">
                  <AlertCircle size={13} /> Tanggal finish tidak boleh lebih awal dari start!
                </span>
              ) : recordStartDate === recordFinishDate ? (
                <span className="duration-badge single">
                  <CheckCircle2 size={13} /> Durasi Pelaksanaan: <b>1 Hari (Hari yang Sama)</b> · {recordStartDate}
                </span>
              ) : (
                <span className="duration-badge multi">
                  <CheckCircle2 size={13} /> Durasi Pelaksanaan: <b>{calculateDays(recordStartDate, recordFinishDate)} Hari</b> · {recordStartDate} s/d {recordFinishDate}
                </span>
              )
            ) : null}
          </div>

          <div className="date-presets">
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Shortcut Durasi:</span>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const t = today();
                setRecordStartDate(t);
                setRecordFinishDate(t);
              }}
              title="Set tanggal start dan finish hari ini"
            >
              Hari Ini
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => setRecordFinishDate(recordStartDate)}
              title="Set finish sama dengan start (1 hari)"
            >
              1 Hari (Sama)
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => addDaysToFinish(1)}
              title="Set 2 hari pelaksanaan (finish = start + 1 hari)"
            >
              2 Hari (+1d)
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => addDaysToFinish(2)}
              title="Set 3 hari pelaksanaan (finish = start + 2 hari)"
            >
              3 Hari (+2d)
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => addDaysToFinish(4)}
              title="Set 5 hari pelaksanaan (finish = start + 4 hari)"
            >
              5 Hari (+4d)
            </button>
          </div>
        </div>
        <div className="participants-head">
          <div>
            <h3>Pilih Peserta Pelatihan</h3>
            <p>{selectedNiks.length} peserta dipilih</p>
          </div>
          <div className="participant-actions">
            <button className="text-link" onClick={() => setSelectedNiks([...new Set([...selectedNiks, ...people.map(nikOf)])])}>Pilih semua</button>
            <button className="text-link" onClick={() => setSelectedNiks([])}>Reset</button>
          </div>
        </div>
        <div className="search-box participant-search">
          <Search size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Saring NIK atau nama peserta..." />
        </div>
        <div className="participant-list">
          {people.map(p => (
            <label key={`${p.__target}-${nikOf(p)}`} className={`participant-row ${selectedNiks.includes(nikOf(p)) ? 'participant-selected' : ''}`}>
              <input type="checkbox" checked={selectedNiks.includes(nikOf(p))} onChange={() => toggle(nikOf(p))} />
              <span className="participant-avatar">{nameOf(p).slice(0, 1).toUpperCase() || '?'}</span>
              <span className="participant-info">
                <b>{nameOf(p) || 'Nama belum diisi'}</b>
                <small>{nikOf(p)} · {sectionOf(p)} · {p.__target}</small>
              </span>
              {selectedNiks.includes(nikOf(p)) && <CheckCircle2 size={17} className="text-blue" />}
            </label>
          ))}
          {!people.length && <div className="empty-state">Tidak ada peserta ditemukan.</div>}
        </div>
        <button className="btn btn-primary btn-wide" disabled={saving} onClick={onSave}>
          {saving ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Simpan Hasil Training ({selectedNiks.length} Peserta)
        </button>
        <div className="small-note">
          <ShieldCheck size={14} /> Training non-mandatory tetap dicatat di Training Database tanpa mengubah ACH mandatory.
        </div>
      </section>

      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">AUDIT TRAIL & HISTORY</div>
            <h2>Riwayat Training Terkini</h2>
            <p>Data tersimpan di sheet Training Database (No, NIK, Nama, Tanggal Mulai, Tanggal Selesai, Program, dan Status).</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="history-count">{history.length} record</span>
            {filteredHistory.length > 0 && (
              <button
                type="button"
                className="btn btn-light"
                onClick={handleExportHistoryExcel}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '0.4rem 0.75rem', fontWeight: 600 }}
                title="Ekspor riwayat training ke format file Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} color="#059669" />
                <span>Unduh Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Status Filter for History */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: '1 1 260px' }}>
            <Search size={15} color="#94a3b8" />
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Cari riwayat training berdasarkan NIK, Nama, atau Modul..."
            />
            {historySearch && (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                onClick={() => setHistorySearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            className="select-control"
            value={historyStatusFilter}
            onChange={e => setHistoryStatusFilter(e.target.value)}
            style={{ minWidth: '170px', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
          >
            <option value="all">Semua Status</option>
            <option value="selesai">Selesai (Done)</option>
            <option value="belum">Belum Selesai / Terjadwal</option>
          </select>
        </div>

        {/* Training Database Table */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                <th style={{ width: '120px' }}>NIK</th>
                <th>Nama</th>
                <th style={{ width: '160px' }}>Tanggal Mulai training</th>
                <th style={{ width: '160px' }}>Tanggal selesai training</th>
                <th>Program Training</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Status Training</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((r, i) => {
                const rNik = String(r.nik || r.NIK || r['Nomor Induk Karyawan'] || '—').trim();
                const rName = String(r.name || r.NAME || r.Nama || r['Nama Karyawan'] || '—').trim();
                const rMod = String(r.moduleName || r.module || r.program || r['PROGRAM TRAINING'] || r.training || '—').trim();
                const rStart = String(r.startDate || r.tanggalMulai || (r.trainingDate && r.trainingDate.includes(' s/d ') ? r.trainingDate.split(' s/d ')[0] : r.trainingDate) || '—').trim();
                const rFinish = String(r.finishDate || r.tanggalSelesai || (r.trainingDate && r.trainingDate.includes(' s/d ') ? r.trainingDate.split(' s/d ')[1] : r.trainingDate) || rStart).trim();
                const rStatus = String(r.status || r.STATUS || 'SELESAI').trim();
                const isSel = rStatus.toUpperCase() === 'SELESAI' || rStatus.toUpperCase() === 'DONE';

                return (
                  <tr key={`${rNik}-${rMod}-${i}`}>
                    <td style={{ color: '#94a3b8', textAlign: 'center', fontFamily: 'monospace' }}>{i + 1}</td>
                    <td className="cell-nik">{rNik}</td>
                    <td><b>{rName}</b></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#334155' }}>
                        <Calendar size={13} className="text-blue" />
                        {rStart}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#334155' }}>
                        <Calendar size={13} className="text-teal" />
                        {rFinish}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {rMod}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-tag ${isSel ? 'status-done' : 'status-pending'}`}>
                        {rStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filteredHistory.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      {historySearch ? 'Tidak ada riwayat training yang cocok dengan filter pencarian.' : 'Belum ada data riwayat training tersimpan.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL DIALOG TAMBAH MODUL TRAINING BARU */}
      {showAddModal && (
        <div className="mini-data-modal-overlay" onClick={() => !submittingModule && setShowAddModal(false)}>
          <div
            className="mini-data-modal"
            style={{ maxWidth: '460px', padding: '1.35rem', borderRadius: '12px', background: '#fff' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mini-data-header" style={{ marginBottom: '0.85rem' }}>
              <div>
                <span className="mini-data-kicker">TRAINING MASTER · TAMBAH MODUL</span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem' }}>Tambah Program Training</h3>
              </div>
              <button
                type="button"
                className="mini-data-close-btn"
                onClick={() => setShowAddModal(false)}
                disabled={submittingModule}
                title="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, marginBottom: '1.1rem' }}>
              Modul yang ditambahkan akan langsung tersedia pada pilihan <b>Program Training</b> di form pencatatan ini dan otomatis tersinkronisasi ke sheet database matrix.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                Nama Program / Modul Training <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Defensive Driving Training (DDT)"
                value={newModuleName}
                onChange={e => setNewModuleName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && newModuleName.trim() && !submittingModule) {
                    e.preventDefault();
                    handleCreateModule();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setNewModuleName('');
                  setShowAddModal(false);
                }}
                disabled={submittingModule}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newModuleName.trim() || submittingModule}
                onClick={handleCreateModule}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {submittingModule ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
                <span>{submittingModule ? 'Menyimpan...' : 'Tambah Modul'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MandatoryPage({
  target,
  setTarget,
  mode,
  setMode,
  busy,
  report,
  preview,
  onFileSelect,
  onConfirmImport,
  onCancelPreview,
  assignments
}: {
  target: 'MP' | 'Training Staff';
  setTarget: (v: any) => void;
  mode: 'smart_update' | 'new_only' | 'overwrite';
  setMode: (v: any) => void;
  busy: boolean;
  report: string;
  preview: ImportPreviewData | null;
  onFileSelect: (f: File) => void;
  onConfirmImport: () => Promise<void>;
  onCancelPreview: () => void;
  assignments: any[];
}) {
  const [drag, setDrag] = useState(false);

  return (
    <div className="mandatory-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">MANDATORY DATA SYNC</div>
            <h2>Import Program Mandatory</h2>
            <p>Sinkronkan pembaruan penugasan training dari file Excel dengan proteksi penuh: data lama ditetapkan, tidak hilang, dan tidak tertimpa.</p>
          </div>
          <span className="pill pill-green">
            <ShieldCheck size={14} /> Proteksi Data Lama Aktif
          </span>
        </div>

        {/* 1. Target Database & Mode Pilihan */}
        <div className="target-choice" style={{ marginBottom: '1.25rem' }}>
          <label>
            Target Database
            <select value={target} onChange={e => { setTarget(e.target.value as any); onCancelPreview(); }}>
              <option value="MP">Database Manpower (MP)</option>
              <option value="Training Staff">Database Training Staff</option>
            </select>
          </label>
          <div className="target-info">
            <Database size={19} />
            <div>
              <b>{target === 'MP' ? 'Database Manpower (MP)' : 'Database Training Staff'}</b>
              <small>Hanya memproses penugasan untuk target {target}.</small>
            </div>
          </div>
        </div>

        {/* 2. Pilihan Kebijakan Update (Import Mode) */}
        <div className="import-mode-selector">
          <div className="section-kicker" style={{ marginBottom: '0.35rem' }}>KEBIJAKAN PEMBARUAN DATA</div>
          <div className="import-mode-cards">
            <label className={`import-mode-card ${mode === 'smart_update' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="importMode"
                value="smart_update"
                checked={mode === 'smart_update'}
                onChange={() => setMode('smart_update')}
              />
              <div className="mode-content">
                <div className="mode-header">
                  <b>Update Progres Terbaru Saja</b>
                  <span className="pill pill-green" style={{ fontSize: '0.65rem' }}>Direkomendasikan</span>
                </div>
                <p>Data lama ditetapkan utuh, tidak hilang, dan tidak akan ditimpa jika sudah selesai. Hanya memasukkan penugasan baru dari Excel dan memperbarui peserta yang baru lulus (Done).</p>
              </div>
            </label>

            <label className={`import-mode-card ${mode === 'new_only' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="importMode"
                value="new_only"
                checked={mode === 'new_only'}
                onChange={() => setMode('new_only')}
              />
              <div className="mode-content">
                <div className="mode-header">
                  <b>Hanya Tambah Penugasan Baru</b>
                  <span className="pill pill-blue" style={{ fontSize: '0.65rem' }}>Strict Append</span>
                </div>
                <p>Hanya mengimpor penugasan yang sama sekali belum pernah ada di database. Seluruh data lama 100% dikunci dan tidak disentuh.</p>
              </div>
            </label>

            <label className={`import-mode-card ${mode === 'overwrite' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="importMode"
                value="overwrite"
                checked={mode === 'overwrite'}
                onChange={() => setMode('overwrite')}
              />
              <div className="mode-content">
                <div className="mode-header">
                  <b>Sinkronisasi Penuh (Timpa Status)</b>
                  <span className="pill pill-amber" style={{ fontSize: '0.65rem' }}>Full Sync</span>
                </div>
                <p>Perbarui status seluruh record sesuai dengan isi file Excel.</p>
              </div>
            </label>
          </div>
        </div>

        {/* 3. Upload Zone (ketika belum ada file yang dipratinjau) */}
        {!preview && (
          <label
            className={`upload-zone ${drag ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFileSelect(f);
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
                e.currentTarget.value = '';
              }}
            />
            <span className="upload-icon"><Upload size={25} /></span>
            <b>Tarik file Excel/CSV ke sini atau klik untuk memilih</b>
            <span>Format .xlsx, .xls, atau .csv (Sheet disarankan: Monitoring Program Mandatory)</span>
            <span className="upload-button"><FileSpreadsheet size={15} /> Pilih File Excel</span>
          </label>
        )}

        {/* 4. PRATINJAU INTERAKTIF (PREVIEW SEBELUM DISIMPAN) */}
        {preview && (
          <div className="import-preview-box">
            <div className="preview-header">
              <div>
                <span className="section-kicker">PRATINJAU & ANALISIS FILE</span>
                <h3>{preview.fileName}</h3>
                <p>Ditemukan total <b>{fmt(preview.totalRows)}</b> baris valid. Data telah dianalisis terhadap database saat ini:</p>
              </div>
              <span className="pill pill-purple">
                <FileSpreadsheet size={13} /> {fmt(preview.totalRows)} Baris Excel
              </span>
            </div>

            {/* Badges Analisis Status */}
            <div className="preview-metrics-grid">
              <div className="preview-metric-card blue">
                <small>Penugasan Baru</small>
                <b>+{fmt(preview.newCount)}</b>
                <span>Akan ditambahkan ke database</span>
              </div>
              <div className="preview-metric-card green">
                <small>Progres Terbaru (Done)</small>
                <b>{fmt(preview.upgradeCount)}</b>
                <span>Diperbarui ke status selesai</span>
              </div>
              <div className="preview-metric-card purple">
                <small>Data Lama Ditetapkan</small>
                <b>{fmt(preview.preservedCount)}</b>
                <span>Tetap aman & tidak berubah</span>
              </div>
              <div className="preview-metric-card amber">
                <small>NIK Tidak Cocok</small>
                <b>{fmt(preview.unmatchedCount)}</b>
                <span>Tidak ada di database {target}</span>
              </div>
            </div>

            {/* Cuplikan Baris Terbaca */}
            <div className="preview-table-container">
              <div className="preview-table-title">
                <span>Cuplikan Data yang Terdeteksi ({Math.min(preview.sampleRows.length, 10)} baris pertama):</span>
              </div>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th>Program Training</th>
                    <th>Status di Excel</th>
                    <th>Rencana Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((r, i) => (
                    <tr key={i}>
                      <td><span className="cell-nik">{r.nik}</span></td>
                      <td><b>{r.name || '—'}</b></td>
                      <td>{r.module}</td>
                      <td>
                        <span className={`status-tag ${isDone(r.status) ? 'status-done' : 'status-pending'}`}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td>
                        {r.category === 'NEW' && (
                          <span className="pill pill-blue" style={{ fontSize: '0.68rem' }}>
                            <Plus size={11} /> Penugasan Baru
                          </span>
                        )}
                        {r.category === 'UPGRADE' && (
                          <span className="pill pill-green" style={{ fontSize: '0.68rem' }}>
                            <Check size={11} /> Update Selesai
                          </span>
                        )}
                        {r.category === 'PRESERVED' && (
                          <span className="pill pill-purple" style={{ fontSize: '0.68rem' }}>
                            <ShieldCheck size={11} /> Tetap & Tidak Berubah
                          </span>
                        )}
                        {r.category === 'UNMATCHED' && (
                          <span className="pill pill-amber" style={{ fontSize: '0.68rem' }}>
                            <AlertCircle size={11} /> NIK Tak Cocok
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tombol Konfirmasi & Eksekusi */}
            <div className="preview-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onConfirmImport}
                disabled={busy}
              >
                {busy ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
                <span>{busy ? 'Menyinkronkan ke Database...' : 'Konfirmasi & Simpan Update Terbaru'}</span>
              </button>

              <button
                type="button"
                className="btn btn-light"
                onClick={onCancelPreview}
                disabled={busy}
              >
                <RotateCcw size={15} />
                <span>Batal / Ganti File</span>
              </button>
            </div>
          </div>
        )}

        {/* Indikator Loading & Laporan Selesai */}
        {busy && (
          <div className="import-progress" style={{ marginTop: '1rem' }}>
            <LoaderCircle className="spin" size={18} />
            <span>{report || 'Sedang memproses dan menyinkronkan data...'}</span>
          </div>
        )}
        {report && !busy && !preview && (
          <div className={`import-report ${report.startsWith('Gagal') ? 'error' : 'success'}`} style={{ marginTop: '1rem' }}>
            <CheckCircle2 size={18} />
            <span>{report}</span>
          </div>
        )}

        {/* Panduan Ketentuan & Jaminan Keamanan */}
        <div className="import-rules" style={{ marginTop: '1.25rem' }}>
          <h3><ShieldCheck size={17} /> Ketentuan & Jaminan Proteksi Data</h3>
          <div className="rule-row">
            <span className="rule-check"><Check size={14} /></span>
            <div>
              <b>Data Lama Tetap Aman & Tidak Hilang</b>
              <p>Meskipun file Excel hanya mencakup data bulan berjalan, seluruh riwayat penugasan terdahulu di Google Sheets tetap dipertahankan utuh.</p>
            </div>
          </div>
          <div className="rule-row">
            <span className="rule-check"><Check size={14} /></span>
            <div>
              <b>Proteksi Status Selesai (Anti-Downgrade)</b>
              <p>Personel yang sudah berstatus <em>Done</em> sebelumnya tidak akan pernah diturunkan menjadi <em>Not Yet</em> secara tidak sengaja.</p>
            </div>
          </div>
          <div className="rule-row">
            <span className="rule-check"><Check size={14} /></span>
            <div>
              <b>Sinkronisasi Checklist Otomatis</b>
              <p>Penugasan baru dan pembaruan progres yang telah selesai langsung mencentang matriks kualifikasi {target}.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel import-summary">
        <div className="chart-title">
          <div>
            <h3>Assignment Snapshot</h3>
            <p>Daftar penugasan mandatory terdaftar</p>
          </div>
          <span className="summary-icon"><Target size={19} /></span>
        </div>
        <div className="assignment-metric">
          <b>{fmt(assignments.filter(a => !a.target || a.target === target).length)}</b>
          <span>penugasan {target} aktif</span>
        </div>
        <div className="small-note">
          <CircleHelp size={14} /> Penugasan tersimpan aman di sheet Mandatory Training Database.
        </div>

        <div className="import-tip">
          <Sparkles size={17} />
          <div>
            <b>Tips File Excel:</b>
            <p>Pastikan sheet memiliki kolom <b>NIK</b>, <b>PROGRAM TRAINING</b>, dan <b>STATUS</b> (Done / Not Yet). Kolom tanggal dan skor opsional akan disimpan otomatis.</p>
          </div>
        </div>

        <div className="data-protection-card">
          <div className="protection-title">
            <ShieldCheck size={16} color="#10b981" />
            <b>Kebijakan Integritas Data PT Karunia Armada Indonesia Site GAM</b>
          </div>
          <p>Sistem dirancang dengan metode <em>Append & Progressive Update</em>. Data historis dipertahankan sebagai bukti kompetensi internal dan kepatuhan audit.</p>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({
  draftUrl,
  setDraftUrl,
  activeUrl,
  connected,
  loading,
  testFeedback,
  onSaveAndConnect,
  onTestConnection,
  onDisconnect
}: {
  draftUrl: string;
  setDraftUrl: (v: string) => void;
  activeUrl: string;
  connected: boolean;
  loading: boolean;
  testFeedback: TestFeedback | null;
  onSaveAndConnect: () => Promise<void>;
  onTestConnection: () => Promise<void>;
  onDisconnect: () => void;
}) {
  return (
    <div className="settings-layout">
      <section className="panel settings-main">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">DATA CONNECTION</div>
            <h2>Hubungkan Google Sheets</h2>
            <p>Frontend berkomunikasi dengan Google Apps Script Web App (JSONP) untuk membaca dan memperbarui data spreadsheet.</p>
          </div>
          <span className={`connection-pill ${connected ? 'online' : 'offline'}`}>
            <span />
            {connected ? 'Terhubung (Connected)' : 'Mode Demo (Disconnected)'}
          </span>
        </div>

        <label className="settings-label">
          URL Web App Google Apps Script (/exec)
          <input
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            spellCheck={false}
          />
        </label>

        {activeUrl && activeUrl !== draftUrl && (
          <div className="small-note" style={{ color: '#d97706', marginTop: '0.25rem' }}>
            <AlertCircle size={13} /> URL di atas telah diubah namun belum disimpan. Klik "Simpan URL & Hubungkan" untuk menerapkan.
          </div>
        )}

        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={onSaveAndConnect}
            disabled={loading}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <Database size={16} />}
            <span>{loading ? 'Menghubungkan...' : 'Simpan URL & Hubungkan'}</span>
          </button>

          <button
            className="btn btn-light"
            onClick={onTestConnection}
            disabled={loading}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            <span>{loading ? 'Menguji...' : 'Uji Koneksi'}</span>
          </button>

          {connected && (
            <button
              className="btn btn-light"
              style={{ color: '#dc2626', borderColor: '#fca5a5', marginLeft: 'auto' }}
              onClick={onDisconnect}
              title="Putuskan koneksi dan kembali ke data simulasi demo"
            >
              <RotateCcw size={15} />
              <span>Putuskan</span>
            </button>
          )}
        </div>

        {/* Live Feedback Card for Connection Test */}
        {testFeedback ? (
          <div
            className={`settings-test-card ${testFeedback.status}`}
            style={{
              padding: '1rem',
              borderRadius: '10px',
              marginTop: '1rem',
              border: testFeedback.status === 'success' ? '1px solid #a7f3d0' : testFeedback.status === 'error' ? '1px solid #fecaca' : '1px solid #bfdbfe',
              backgroundColor: testFeedback.status === 'success' ? '#ecfdf5' : testFeedback.status === 'error' ? '#fef2f2' : '#eff6ff',
              color: testFeedback.status === 'success' ? '#065f46' : testFeedback.status === 'error' ? '#991b1b' : '#1e40af'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
              {testFeedback.status === 'loading' && <LoaderCircle className="spin" size={16} />}
              {testFeedback.status === 'success' && <CheckCircle2 size={16} color="#059669" />}
              {testFeedback.status === 'error' && <AlertCircle size={16} color="#dc2626" />}
              {testFeedback.status === 'idle' && <CircleHelp size={16} />}
              <span>
                {testFeedback.status === 'loading' && 'Sedang Menguji Koneksi...'}
                {testFeedback.status === 'success' && 'Hasil Tes: Koneksi Berhasil!'}
                {testFeedback.status === 'error' && 'Hasil Tes: Koneksi Gagal'}
                {testFeedback.status === 'idle' && 'Status'}
              </span>
              {testFeedback.timestamp && (
                <small style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.7rem', opacity: 0.8 }}>
                  {testFeedback.timestamp}
                </small>
              )}
            </div>

            <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', lineHeight: 1.5 }}>
              {testFeedback.message}
            </div>

            {testFeedback.details && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', opacity: 0.9 }}>
                {testFeedback.details}
              </div>
            )}

            {testFeedback.status === 'error' && (
              <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(220, 38, 38, 0.2)', fontSize: '0.73rem', lineHeight: 1.5 }}>
                <b>Langkah Pengecekan & Perbaikan:</b>
                <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                  <li>Buka Apps Script (Ekstensi &gt; Apps Script), pastikan kode <code>Code.gs</code> bebas syntax error dan sudah disimpan (Ctrl+S / Cmd+S).</li>
                  <li>Klik tombol biru <b>Deploy &gt; Manage deployments</b> &gt; Klik ikon Pensil (Edit) &gt; Pilih Version: <b>New version</b>.</li>
                  <li>Pastikan pengaturan <i>Who has access</i> diset ke <b>Anyone</b> (Siapa saja), bukan "Only myself".</li>
                  <li>Salin URL Web App yang berakhiran <code>/exec</code> lalu tempelkan kembali ke form di atas.</li>
                  <li>Pastikan Google Spreadsheet Anda memiliki sheet bernama <code>MP</code> dan <code>Training Staff</code>.</li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              marginTop: '1rem',
              border: '1px solid var(--slate-200)',
              backgroundColor: 'var(--slate-50)',
              color: 'var(--slate-600)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}
          >
            <CircleHelp size={16} />
            <span>
              {activeUrl
                ? `URL tersimpan: ${activeUrl.slice(0, 48)}... Klik "Uji Koneksi" untuk menguji status respons live.`
                : 'Belum ada URL tersimpan. Masukkan URL Web App Apps Script (/exec) dan klik "Simpan URL & Hubungkan" atau "Uji Koneksi".'}
            </span>
          </div>
        )}

        <div className="settings-warning" style={{ marginTop: '1rem' }}>
          <ShieldCheck size={18} />
          <div>
            <b>Petunjuk Deployment Web App</b>
            <p>Pilih "Who has access: Anyone" saat deploy Web App di Google Apps Script agar SPA client dapat memuat data via callback JSONP tanpa terhalang otorisasi browser.</p>
          </div>
        </div>
      </section>

      <section className="panel setup-steps">
        <div className="section-kicker">SETUP GUIDE</div>
        <h2>Langkah Pemasangan Code.gs</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <b>Buka Google Apps Script</b>
              <p>Buka spreadsheet PT Karunia Armada Indonesia Site GAM Anda, pilih menu <b>Ekstensi &gt; Apps Script</b>.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <b>Salin Kode Code.gs</b>
              <p>Salin seluruh isi file <code>Code.gs</code> dari paket proyek ini ke editor script, lalu klik Simpan (ikon disket).</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <b>Deploy sebagai Web App</b>
              <p>Klik <b>Deploy &gt; New deployment &gt; Select type: Web app</b>. Atur <i>Execute as: Me</i> dan <i>Who has access: Anyone</i>.</p>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <b>Tempel URL /exec di Form</b>
              <p>Salin Web App URL (berakhiran <code>/exec</code>), tempel di form ini, lalu klik <b>Simpan URL & Hubungkan</b>.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="panel field-guide">
        <h3><Cloud size={18} /> Lembar Kerja yang Digunakan</h3>
        <div className="guide-grid">
          <div>
            <b>Sheet MP</b>
            <span>Total MP dihitung dari seluruh baris dengan NIK terisi. Status aktif memerlukan NIK dan Jabatan.</span>
          </div>
          <div>
            <b>Sheet Training Staff</b>
            <span>Menampung checklist training matrix untuk kelompok database staf.</span>
          </div>
          <div>
            <b>Training Database</b>
            <span>Pencatatan riwayat sesi training selesai maupun belum selesai beserta tanggal dan evaluasi.</span>
          </div>
          <div>
            <b>Mandatory Training Database</b>
            <span>Basis data penugasan resmi untuk penghitungan persentase ACH Mandatory.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function EditModal({ row, headers, target, isNew, saving, onClose, onSave }: {
  row: Row;
  headers: string[];
  target: 'MP' | 'Training Staff';
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (r: Row) => void;
}) {
  const [form, setForm] = useState<Row>({ ...row });
  const fields = useMemo(() => {
    const preferred = ['NIK', 'NAME', 'NAMA', 'SECTION', 'SubSection', 'SUBSECTION', 'GRADE', 'JABATAN', 'SITE', 'DEPARTMENT', 'EMAIL', 'PHONE'];
    const actual = headers.filter(h => !['COL_1', 'Send WA', 'Column 28'].includes(h));
    const selected = preferred.map(p => actual.find(h => key(h) === key(p))).filter((x): x is string => !!x);
    return [...new Set(selected.length ? selected : actual)].filter(h => !Object.keys(row).length || Object.prototype.hasOwnProperty.call(row, h) || headers.includes(h)).slice(0, 18);
  }, [headers, row]);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-modal">
        <div className="modal-heading">
          <div>
            <div className="section-kicker">{isNew ? 'NEW PERSONNEL' : 'EDIT PERSONNEL'}</div>
            <h2>{isNew ? 'Tambah Personel' : 'Edit Data Personel'}</h2>
            <p>{target === 'MP' ? 'Database Manpower' : 'Database Training Staff'}</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-form">
          {fields.map(h => (
            <label key={h}>
              {h}
              <input
                value={String(form[h] ?? '')}
                onChange={e => setForm((f: Row) => ({ ...f, [h]: e.target.value }))}
                required={key(h) === 'nik'}
              />
            </label>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-light" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={() => {
              if (!nikOf(form)) {
                alert('NIK wajib diisi.');
                return;
              }
              onSave(form);
            }}
          >
            {saving ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />} Simpan Perubahan
          </button>
        </div>
        <p className="modal-note"><AlertCircle size={14} /> Matrix training tidak diedit melalui form ini. Gunakan menu Training Matrix.</p>
      </div>
    </div>
  );
}
