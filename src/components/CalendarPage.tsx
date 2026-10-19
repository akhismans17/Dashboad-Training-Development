import React, { useMemo, useState, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  Users,
  Search,
  Filter,
  Sparkles,
  Plus,
  ArrowRight,
  BookOpenCheck,
  X,
  Check,
  CalendarDays,
  ListFilter,
  ExternalLink,
  Layers,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  FileSpreadsheet,
  Upload,
  Download,
  FileUp,
  FileText,
  Pencil,
  Trash2,
  Save,
  UserPlus,
  UserMinus,
  Edit3,
  MapPin,
  UserCheck,
  Bookmark
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  normalizeDateToISO,
  extractItemDates,
  calculateDays,
  formatDateIndo,
  normalizeScheduleRow,
  MONTH_NAMES_ID,
  getTodayISO
} from '../dateUtils';

interface Row {
  [key: string]: any;
}

export const SESSION_TIME_PRESETS = [
  'Sesi 1 (Pagi · 08:00 - 12:00)',
  'Sesi 2 (Siang · 13:00 - 17:00)',
  'Sesi 3 (Malam · 19:00 - 22:00)',
  'Full Day (08:00 - 17:00)',
  'Kustom / Jam Tertentu...'
];

export const LOCATION_PRESETS = [
  'Ruang Training GAM (Lt. 2)',
  'Ruang Safety HSE',
  'Simulator Room',
  'Workshop / Lapangan Pit',
  'Online / Zoom Meeting',
  'Kustom / Ketik Ruangan Lain...'
];

interface CalendarPageProps {
  history: Row[];
  allPeople: Row[];
  allModules: string[];
  mandatoryAssignments: { nik: string; moduleName: string; target: string; status?: string }[];
  onNavigateToRecords: (moduleName?: string, startDate?: string, finishDate?: string, nik?: string) => void;
  onSaveSchedule?: (payload: {
    participantNiks: string[];
    moduleName: string;
    startDate: string;
    finishDate: string;
    status: string;
    target: 'MP' | 'Training Staff' | 'Keduanya';
    sessionTime?: string;
    location?: string;
    trainer?: string;
  }) => Promise<void> | void;
  onImportScheduleRows?: (rows: Row[], overwriteExisting?: boolean) => Promise<void> | void;
  onCompleteSession?: (session: TrainingSession) => Promise<void> | void;
  onUpdateSession?: (
    originalSession: TrainingSession,
    updatedData: {
      moduleName: string;
      startDate: string;
      finishDate: string;
      status: string;
      sessionTime?: string;
      location?: string;
      trainer?: string;
      participants: {
        nik: string;
        name: string;
        section: string;
        jabatan: string;
        status: string;
      }[];
    }
  ) => Promise<void> | void;
  onDeleteSession?: (session: TrainingSession) => Promise<void> | void;
  onClearAllSessions?: () => void;
  onAddModule?: (name: string) => Promise<void> | void;
}

export interface TrainingSession {
  id: string;
  moduleName: string;
  startDate: string; // YYYY-MM-DD
  finishDate: string; // YYYY-MM-DD
  dateDisplay: string;
  durationDays: number;
  status: string;
  statusCategory: 'completed' | 'ongoing' | 'upcoming' | 'pending';
  targetGroup?: string;
  sessionTime: string;
  location: string;
  trainer: string;
  trainingMethod?: string;
  deliveryMethod?: string;
  week?: string;
  duration?: string;
  sectionLD?: string;
  site?: string;
  participants: {
    nik: string;
    name: string;
    section: string;
    jabatan: string;
    status: string;
  }[];
  isMandatory: boolean;
}

const DAY_NAMES_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function parseDates(item: Row): { start: string; finish: string } {
  return extractItemDates(item);
}

function addDays(dateStr: string, days: number): string {
  const iso = normalizeDateToISO(dateStr);
  const parts = (iso || '').split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  history,
  allPeople,
  allModules,
  mandatoryAssignments,
  onNavigateToRecords,
  onSaveSchedule,
  onImportScheduleRows,
  onCompleteSession,
  onUpdateSession,
  onDeleteSession,
  onClearAllSessions,
  onAddModule
}) => {
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Set default view to the month of today or recent history
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const d = new Date();
    return d.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    const d = new Date();
    return d.getMonth(); // 0-11
  });

  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'PENDING'>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedDaySessions, setSelectedDaySessions] = useState<{ date: string; sessions: TrainingSession[] } | null>(null);

  // Session Edit & Participant Management State
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editModuleName, setEditModuleName] = useState('');
  const [isCustomEditModule, setIsCustomEditModule] = useState(false);
  const [customEditModuleInput, setCustomEditModuleInput] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editFinishDate, setEditFinishDate] = useState('');
  const [editStatus, setEditStatus] = useState('TERJADWAL');
  const [editSessionTime, setEditSessionTime] = useState(SESSION_TIME_PRESETS[0]);
  const [isCustomSessionTime, setIsCustomSessionTime] = useState(false);
  const [customSessionTimeInput, setCustomSessionTimeInput] = useState('');
  const [editLocation, setEditLocation] = useState(LOCATION_PRESETS[0]);
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [editTrainer, setEditTrainer] = useState('');
  const [editParticipants, setEditParticipants] = useState<Array<{
    nik: string;
    name: string;
    section: string;
    jabatan: string;
    status: string;
  }>>([]);
  const [addParticipantTab, setAddParticipantTab] = useState<'search' | 'manual'>('search');
  const [addParticipantSearch, setAddParticipantSearch] = useState('');
  const [manualAddNik, setManualAddNik] = useState('');
  const [manualAddName, setManualAddName] = useState('');
  const [manualAddSection, setManualAddSection] = useState('');
  const [manualAddJabatan, setManualAddJabatan] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Input Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalTab, setScheduleModalTab] = useState<'upload' | 'manual'>('upload');
  const [schedModule, setSchedModule] = useState('');
  const [schedStartDate, setSchedStartDate] = useState(todayStr);
  const [schedFinishDate, setSchedFinishDate] = useState(todayStr);
  const [schedTarget, setSchedTarget] = useState<'MP' | 'Training Staff' | 'Keduanya'>('MP');
  const [schedStatus, setSchedStatus] = useState<string>('TERJADWAL');
  const [schedSessionTime, setSchedSessionTime] = useState(SESSION_TIME_PRESETS[0]);
  const [isCustomSchedSession, setIsCustomSchedSession] = useState(false);
  const [customSchedSessionInput, setCustomSchedSessionInput] = useState('');
  const [schedLocation, setSchedLocation] = useState(LOCATION_PRESETS[0]);
  const [isCustomSchedLocation, setIsCustomSchedLocation] = useState(false);
  const [customSchedLocationInput, setCustomSchedLocationInput] = useState('');
  const [schedTrainer, setSchedTrainer] = useState('');
  const [schedNiks, setSchedNiks] = useState<string[]>([]);
  const [schedParticipantSearch, setSchedParticipantSearch] = useState('');
  const [schedSaving, setSchedSaving] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleNameInput, setNewModuleNameInput] = useState('');

  // Excel Schedule Upload state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [parsedScheduleRows, setParsedScheduleRows] = useState<Row[]>([]);
  const [excelPreviewSummary, setExcelPreviewSummary] = useState<{
    totalRows: number;
    sessionsCount: number;
    uniqueParticipants: number;
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [excelOverwriteMode, setExcelOverwriteMode] = useState(true);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // Map people for quick lookup
  const peopleMap = useMemo(() => {
    const map = new Map<string, Row>();
    allPeople.forEach(p => {
      const nik = String(p.NIK || p.nik || '').trim();
      if (nik) map.set(nik, p);
    });
    return map;
  }, [allPeople]);

  // Set of mandatory module names
  const mandatorySet = useMemo(() => {
    const set = new Set<string>();
    mandatoryAssignments.forEach(a => {
      if (a.moduleName) set.add(a.moduleName.trim());
    });
    return set;
  }, [mandatoryAssignments]);

  // Group history rows into unified sessions (by module + start + finish + status)
  const sessions = useMemo<TrainingSession[]>(() => {
    const grouped = new Map<string, {
      moduleName: string;
      startDate: string;
      finishDate: string;
      status: string;
      targetGroup?: string;
      sessionTime?: string;
      location?: string;
      trainer?: string;
      participants: { nik: string; name: string; section: string; jabatan: string; status: string }[];
    }>();

    history.forEach(item => {
      const moduleName = (item.moduleName || item.module || item.program || 'Modul Pelatihan').toString().trim();
      const { start, finish } = parseDates(item);
      if (!start || !finish) return;

      const nik = (item.nik || item.NIK || '').toString().trim();
      const person = peopleMap.get(nik);
      const name = (item.name || item.nama || person?.NAME || person?.Nama || `Personel (${nik})`).toString().trim();
      const section = (person?.SECTION || person?.Section || '-').toString().trim();
      const jabatan = (person?.JABATAN || person?.Jabatan || '-').toString().trim();
      const rawStatus = (item.status || 'SELESAI').toString().trim().toUpperCase();
      const targetGroup = item.target || person?.__target || 'MP';
      const sessionTime = (item.sessionTime || item.sesi || item.session || item.waktu || item['SESI TRAINING'] || item['SESI'] || 'Sesi 1 (Pagi · 08:00 - 12:00)').toString().trim();
      const location = (item.location || item.ruangan || item.lokasi || item['LOKASI'] || item['RUANGAN'] || 'Ruang Training GAM (Lt. 2)').toString().trim();
      const trainer = (item.trainer || item.instruktur || item.fasilitator || item['TRAINER'] || item['INSTRUKTUR'] || '').toString().trim();

      // Key to group same training batch together (by module, dates, session time, and status)
      const key = `${moduleName}__${start}__${finish}__${sessionTime}__${rawStatus}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          moduleName,
          startDate: start,
          finishDate: finish,
          status: rawStatus,
          targetGroup,
          sessionTime,
          location,
          trainer,
          participants: []
        });
      }

      const existing = grouped.get(key)!;
      if (!existing.participants.some(p => p.nik === nik)) {
        existing.participants.push({
          nik,
          name,
          section,
          jabatan,
          status: rawStatus
        });
      }
    });

    return Array.from(grouped.entries()).map(([key, data]) => {
      const days = calculateDays(data.startDate, data.finishDate);
      const isMandatory = mandatorySet.has(data.moduleName);

      // Determine category strictly aligned with actual execution dates
      const raw = String(data.status || '').toUpperCase().trim();
      let statusCategory: 'completed' | 'ongoing' | 'upcoming' | 'pending' = 'completed';

      if (raw === 'SELESAI' || raw === 'DONE' || raw === 'COMPLETED' || raw === 'PASS' || raw === 'LULUS') {
        statusCategory = 'completed';
      } else if (raw === 'DALAM PROSES' || raw === 'ON GOING' || raw === 'ONGOING' || raw === 'ON-GOING' || raw.includes('PROSES') || raw.includes('PROGRESS') || raw === 'BERJALAN') {
        statusCategory = 'ongoing';
      } else if (raw === 'BELUM SELESAI' || raw.includes('BELUM')) {
        statusCategory = 'pending';
      } else if (raw === 'TERJADWAL' || raw === 'UPCOMING' || raw === 'PLANNED' || raw.includes('JADWAL') || raw.includes('SCHEDULE')) {
        // Status upcoming diselaraskan tepat dengan tanggal pelaksanaannya (tidak sehari sebelumnya)
        if (data.finishDate < todayStr) {
          statusCategory = 'pending';
        } else if (data.startDate <= todayStr && data.finishDate >= todayStr) {
          statusCategory = 'ongoing';
        } else {
          statusCategory = 'upcoming';
        }
      } else {
        // Fallback by date relation to today
        if (data.startDate > todayStr) {
          statusCategory = 'upcoming';
        } else if (data.startDate <= todayStr && data.finishDate >= todayStr) {
          statusCategory = 'ongoing';
        } else {
          statusCategory = 'completed';
        }
      }

      const dateDisplay = data.startDate === data.finishDate
        ? formatDateIndo(data.startDate)
        : `${formatDateIndo(data.startDate)} s/d ${formatDateIndo(data.finishDate)}`;

      return {
        id: key,
        moduleName: data.moduleName,
        startDate: data.startDate,
        finishDate: data.finishDate,
        dateDisplay,
        durationDays: days,
        status: data.status,
        statusCategory,
        targetGroup: data.targetGroup,
        sessionTime: data.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)',
        location: data.location || 'Ruang Training GAM (Lt. 2)',
        trainer: data.trainer || '',
        participants: data.participants,
        isMandatory
      };
    });
  }, [history, peopleMap, mandatorySet, todayStr]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Status filter
      if (statusFilter === 'UPCOMING' && session.statusCategory !== 'upcoming') return false;
      if (statusFilter === 'ONGOING' && session.statusCategory !== 'ongoing') return false;
      if (statusFilter === 'COMPLETED' && session.statusCategory !== 'completed') return false;
      if (statusFilter === 'PENDING' && session.statusCategory !== 'pending') return false;

      // Module filter
      if (moduleFilter !== 'ALL' && session.moduleName !== moduleFilter) return false;

      // Session time filter
      if (sessionFilter !== 'ALL') {
        if (!session.sessionTime.toLowerCase().includes(sessionFilter.toLowerCase())) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchModule = session.moduleName.toLowerCase().includes(q);
        const matchLocation = session.location?.toLowerCase().includes(q);
        const matchTrainer = session.trainer?.toLowerCase().includes(q);
        const matchSession = session.sessionTime?.toLowerCase().includes(q);
        const matchParticipant = session.participants.some(
          p => p.name.toLowerCase().includes(q) || p.nik.toLowerCase().includes(q) || p.section.toLowerCase().includes(q)
        );
        if (!matchModule && !matchParticipant && !matchLocation && !matchTrainer && !matchSession) return false;
      }

      return true;
    });
  }, [sessions, statusFilter, moduleFilter, sessionFilter, searchQuery]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    let upcoming = 0;
    let ongoing = 0;
    let completed = 0;
    let pending = 0;
    const participantSet = new Set<string>();

    sessions.forEach(s => {
      if (s.statusCategory === 'upcoming') upcoming++;
      else if (s.statusCategory === 'ongoing') ongoing++;
      else if (s.statusCategory === 'completed') completed++;
      else if (s.statusCategory === 'pending') pending++;

      s.participants.forEach(p => participantSet.add(p.nik));
    });

    return {
      total: sessions.length,
      upcoming,
      ongoing,
      completed,
      pending,
      totalParticipants: participantSet.size
    };
  }, [sessions]);

  // Days in selected month for calendar grid
  const calendarDays = useMemo(() => {
    const year = currentYear;
    const month = currentMonth;

    const firstDate = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDate.getDate();

    let startDayOfWeek = firstDate.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const prevMonthLastDate = new Date(year, month, 0).getDate();
    const prevDays = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      prevDays.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isPrevMonth: true
      });
    }

    const currentDays = [];
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      currentDays.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    const combinedLength = prevDays.length + currentDays.length;
    const totalSlots = Math.ceil(combinedLength / 7) * 7;
    const nextDays = [];
    for (let d = 1; d <= totalSlots - combinedLength; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      nextDays.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isNextMonth: true
      });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [currentYear, currentMonth, todayStr]);

  // Index sessions by date string for quick calendar lookup (exact local dates, no timezone day shift)
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();

    filteredSessions.forEach(session => {
      const sIso = normalizeDateToISO(session.startDate);
      const fIso = normalizeDateToISO(session.finishDate || session.startDate) || sIso;
      if (!sIso || !fIso) return;

      const startParts = sIso.split('-').map(Number);
      const finishParts = fIso.split('-').map(Number);
      if (startParts.length !== 3 || finishParts.length !== 3) return;

      const cur = new Date(startParts[0], startParts[1] - 1, startParts[2], 12, 0, 0);
      const finish = new Date(finishParts[0], finishParts[1] - 1, finishParts[2], 12, 0, 0);
      if (isNaN(cur.getTime()) || isNaN(finish.getTime())) return;

      let count = 0;
      while (cur <= finish && count < 60) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;

        if (!map.has(dStr)) map.set(dStr, []);
        const list = map.get(dStr)!;
        if (!list.some(s => s.id === session.id)) {
          list.push(session);
        }
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    });

    return map;
  }, [filteredSessions]);

  // Navigate months
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const jumpToToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  // Distinct modules for filter
  const distinctModules = useMemo(() => {
    const set = new Set<string>();
    allModules.forEach(m => set.add(m));
    sessions.forEach(s => set.add(s.moduleName));
    return Array.from(set).sort();
  }, [allModules, sessions]);

  // Filtered persons for scheduling modal
  const eligiblePersonsForSched = useMemo(() => {
    return allPeople.filter(p => {
      if (schedTarget !== 'Keduanya' && p.__target && p.__target !== schedTarget) return false;
      if (!schedParticipantSearch.trim()) return true;
      const q = schedParticipantSearch.toLowerCase();
      const nik = String(p.NIK || p.nik || '').toLowerCase();
      const name = String(p.NAME || p.Nama || p.name || '').toLowerCase();
      const sec = String(p.SECTION || p.Section || '').toLowerCase();
      return nik.includes(q) || name.includes(q) || sec.includes(q);
    });
  }, [allPeople, schedTarget, schedParticipantSearch]);

  const toggleSchedNik = (nik: string) => {
    setSchedNiks(prev => prev.includes(nik) ? prev.filter(n => n !== nik) : [...prev, nik]);
  };

  const handleSelectAllSched = () => {
    const currentFilteredNiks = eligiblePersonsForSched.map(p => String(p.NIK || p.nik || '').trim()).filter(Boolean);
    const allSelected = currentFilteredNiks.every(n => schedNiks.includes(n));
    if (allSelected) {
      setSchedNiks(prev => prev.filter(n => !currentFilteredNiks.includes(n)));
    } else {
      setSchedNiks(prev => Array.from(new Set([...prev, ...currentFilteredNiks])));
    }
  };

  const parseExcelDateValue = (val: any): string => {
    return normalizeDateToISO(val);
  };

  const matchPersonInDatabase = (nik: string, name: string): Row | undefined => {
    const cleanNik = String(nik || '').trim().replace(/\.0+$/, '').toLowerCase();
    const cleanName = String(name || '').trim().toLowerCase();

    if (cleanNik) {
      const found = allPeople.find(p => {
        const pNik = String(p.NIK || p.nik || '').trim().replace(/\.0+$/, '').toLowerCase();
        return pNik === cleanNik;
      });
      if (found) return found;
    }

    if (cleanName) {
      const found = allPeople.find(p => {
        const pName = String(p.NAME || p.Nama || p.name || '').trim().toLowerCase();
        return pName === cleanName || (pName && cleanName && (pName.includes(cleanName) || cleanName.includes(pName)));
      });
      if (found) return found;
    }

    return undefined;
  };

  const handleExcelScheduleUpload = async (file: File) => {
    setExcelBusy(true);
    setExcelError(null);
    setExcelSuccess(null);
    setExcelFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error('File Excel tidak memiliki sheet yang dapat dibaca.');

      // Search up to the first 10 rows to find which row contains table headers
      let headerRange = 0;
      for (let rIdx = 0; rIdx < 10; rIdx++) {
        const testRows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false, range: rIdx });
        if (testRows.length > 0 && Object.keys(testRows[0]).some(k => /nik|nama|training|modul|tanggal|start|finish|peserta/i.test(k))) {
          headerRange = rIdx;
          break;
        }
      }
      const rows: Row[] = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false, range: headerRange });

      if (!rows.length) {
        throw new Error('Sheet Excel kosong atau tidak memiliki data.');
      }

      const processed: Row[] = [];
      let matchedCount = 0;
      let unmatchedCount = 0;
      const sessionKeys = new Set<string>();
      const uniqueParticipants = new Set<string>();

      rows.forEach((r, idx) => {
        // 1. NIK
        const rawNik = String(
          r['NIK'] ?? r['nik'] ?? r['Nik'] ?? r['Employee NIK'] ?? r['No Induk'] ?? r['Nomor Induk'] ?? r['NO INDUK'] ?? ''
        ).trim().replace(/\.0+$/, '');

        // 2. Name
        const rawName = String(
          r['Name'] ?? r['NAME'] ?? r['nama'] ?? r['Nama'] ?? r['name'] ?? r['Nama Karyawan'] ?? r['EMPLOYEE NAME'] ?? ''
        ).trim();

        // 3. Position
        const rawPosition = String(
          r['Position'] ?? r['position'] ?? r['POSITION'] ?? r['Jabatan'] ?? r['jabatan'] ?? r['JABATAN'] ?? r['Job Title'] ?? ''
        ).trim();

        // 4. Section (Site)
        const rawSectionSite = String(
          r['Section (Site)'] ?? r['section (site)'] ?? r['SECTION (SITE)'] ?? r['Section(Site)'] ?? r['Section'] ?? r['section'] ?? r['SECTION'] ?? ''
        ).trim();

        // 5. Training Tittle (also support Title / Program Training / Modul)
        const rawModule = String(
          r['Training Tittle'] ?? r['Training Title'] ?? r['TRAINING TITTLE'] ?? r['TRAINING TITLE'] ?? r['training tittle'] ?? r['training title'] ?? r['Program Training'] ?? r['PROGRAM TRAINING'] ?? r['program training'] ?? r['Modul'] ?? r['MODUL'] ?? r['modul'] ?? r['NAMA TRAINING'] ?? r['Nama Training'] ?? r['TRAINING'] ?? r['training'] ?? r['MODULE'] ?? ''
        ).trim();

        // 6. Training Method(In Class Training/Mentoring/OJI)
        const rawMethod1 = String(
          r['Training Method(In Class Training/Mentoring/OJI)'] ??
          r['Training Method (In Class Training/Mentoring/OJI)'] ??
          r['TRAINING METHOD(IN CLASS TRAINING/MENTORING/OJI)'] ??
          r['training method(in class training/mentoring/oji)'] ??
          r['Training Method'] ??
          r['training method'] ??
          r['Method'] ??
          ''
        ).trim();

        // 7. Start Date
        const rawStart = r['Start Date'] ?? r['START DATE'] ?? r['start date'] ?? r['StartDate'] ?? r['Tanggal Mulai'] ?? r['TANGGAL MULAI'] ?? r['tanggal mulai'] ?? r['START'] ?? r['start'] ?? r['TGL MULAI'] ?? r['TGL START'] ?? r['TANGGAL'] ?? r['tanggal'] ?? r['TGL'] ?? '';

        // 8. Finish Date
        const rawFinish = r['Finish Date'] ?? r['FINISH DATE'] ?? r['finish date'] ?? r['FinishDate'] ?? r['Tanggal Selesai'] ?? r['TANGGAL SELESAI'] ?? r['tanggal selesai'] ?? r['FINISH'] ?? r['finish'] ?? r['TGL SELESAI'] ?? r['TGL FINISH'] ?? r['END DATE'] ?? rawStart;

        // 9. Week
        const rawWeek = String(r['Week'] ?? r['WEEK'] ?? r['week'] ?? r['Minggu'] ?? '').trim();

        // 10. Duration
        const rawDuration = String(r['Duration'] ?? r['DURATION'] ?? r['duration'] ?? r['Durasi'] ?? '').trim();

        // 11. Training Method (Face to Face / Online Delievery Training)
        const rawMethod2 = String(
          r['Training Method  (Face to Face / Online Delievery Training)'] ??
          r['Training Method (Face to Face / Online Delievery Training)'] ??
          r['Training Method (Face to Face / Online Delivery Training)'] ??
          r['Training Method  (Face to Face / Online Delivery Training)'] ??
          r['TRAINING METHOD  (FACE TO FACE / ONLINE DELIEVERY TRAINING)'] ??
          r['Delivery Method'] ??
          r['delivery method'] ??
          r['Metode Delivery'] ??
          ''
        ).trim();

        // 12. Section(L&D)
        const rawSectionLD = String(
          r['Section(L&D)'] ??
          r['Section (L&D)'] ??
          r['SECTION(L&D)'] ??
          r['SECTION (L&D)'] ??
          r['Section L&D'] ??
          r['section l&d'] ??
          r['L&D'] ??
          ''
        ).trim();

        // 13. PIC (Trainer)
        const rawTrainer = String(
          r['PIC (Trainer)'] ??
          r['pic (trainer)'] ??
          r['PIC(Trainer)'] ??
          r['PIC (TRAINER)'] ??
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

        // 14. SITE
        const rawSite = String(
          r['SITE'] ?? r['Site'] ?? r['site'] ?? r['Lokasi'] ?? r['lokasi'] ?? r['LOKASI'] ?? ''
        ).trim();

        const startDate = normalizeDateToISO(rawStart) || todayStr;
        const finishDate = normalizeDateToISO(rawFinish) || startDate;

        const rawStatus = String(
          r['STATUS'] ?? r['status'] ?? r['Status'] ?? r['STATUS PELATIHAN'] ?? r['KETERANGAN'] ?? r['HASIL'] ?? 'TERJADWAL'
        ).trim();

        let status = 'TERJADWAL';
        const upperStatus = rawStatus.toUpperCase();
        if (['SELESAI', 'DONE', 'COMPLETED', 'PASS', 'LULUS', '1', 'TRUE'].includes(upperStatus)) {
          status = 'SELESAI';
        } else if (['DALAM PROSES', 'ON GOING', 'ONGOING', 'ON-GOING', 'IN PROGRESS', 'BERJALAN'].includes(upperStatus)) {
          status = 'DALAM PROSES';
        } else if (['BELUM SELESAI', 'BELUM', 'NOT YET', 'PENDING'].includes(upperStatus)) {
          status = 'BELUM SELESAI';
        } else {
          status = 'TERJADWAL';
        }

        const target = String(
          r['TARGET'] ?? r['target'] ?? r['TARGET DATABASE'] ?? r['Target Database'] ?? r['KELOMPOK'] ?? 'MP'
        ).trim() || 'MP';

        const rawSession = String(
          r['SESI TRAINING'] ?? r['sesi training'] ?? r['Sesi Training'] ?? r['SESI'] ?? r['sesi'] ?? r['Sesi'] ?? r['WAKTU'] ?? r['waktu'] ?? r['JAM'] ?? r['jam'] ?? ''
        ).trim();
        const rawLocation = String(
          r['LOKASI'] ?? r['lokasi'] ?? r['Lokasi'] ?? r['RUANGAN'] ?? r['ruangan'] ?? r['TEMPAT'] ?? r['tempat'] ?? ''
        ).trim();

        const sessionTime = rawSession || (rawMethod1 && rawMethod2 ? `${rawMethod1} · ${rawMethod2}` : (rawMethod1 || rawMethod2 || 'In Class Training (Face to Face)'));
        const location = rawLocation || (rawSite ? `Site ${rawSite}` : 'Ruang Training GAM (Lt. 2)');
        const trainer = rawTrainer || '';

        if (!rawNik && !rawName) return;
        if (!rawModule) return;

        const matchedPerson = matchPersonInDatabase(rawNik, rawName);
        const finalNik = rawNik || (matchedPerson ? String(matchedPerson.NIK || matchedPerson.nik || '') : `EXT-${idx + 1}`);
        const finalName = rawName || (matchedPerson ? String(matchedPerson.NAME || matchedPerson.Nama || matchedPerson.name || '') : `Peserta ${finalNik}`);
        const section = rawSectionSite || (matchedPerson ? String(matchedPerson.SECTION || matchedPerson.Section || '') : '-');
        const jabatan = rawPosition || (matchedPerson ? String(matchedPerson.JABATAN || matchedPerson.Jabatan || '') : '-');

        if (matchedPerson) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        uniqueParticipants.add(finalNik);
        sessionKeys.add(`${rawModule}__${startDate}__${finishDate}__${sessionTime}`);

        const dateDisplay = startDate === finishDate ? startDate : `${startDate} s/d ${finishDate}`;

        const normRow = normalizeScheduleRow({
          ...r,
          nik: finalNik,
          NIK: finalNik,
          name: finalName,
          NAME: finalName,
          nama: finalName,
          position: jabatan,
          Position: jabatan,
          jabatan: jabatan,
          JABATAN: jabatan,
          sectionSite: section,
          'Section (Site)': section,
          section: section,
          SECTION: section,
          moduleName: rawModule,
          'Training Tittle': rawModule,
          'Training Title': rawModule,
          'Training Method(In Class Training/Mentoring/OJI)': rawMethod1 || 'In Class Training',
          trainingMethod: rawMethod1 || 'In Class Training',
          startDate,
          finishDate,
          'Start Date': startDate,
          'Finish Date': finishDate,
          trainingDate: dateDisplay,
          dateDisplay,
          week: rawWeek,
          Week: rawWeek,
          duration: rawDuration || `${calculateDays(startDate, finishDate)} Hari`,
          Duration: rawDuration || `${calculateDays(startDate, finishDate)} Hari`,
          'Training Method  (Face to Face / Online Delievery Training)': rawMethod2 || 'Face to Face',
          deliveryMethod: rawMethod2 || 'Face to Face',
          'Section(L&D)': rawSectionLD || 'L&D',
          sectionLD: rawSectionLD || 'L&D',
          'PIC (Trainer)': trainer,
          picTrainer: trainer,
          trainer,
          SITE: rawSite || 'GAM',
          site: rawSite || 'GAM',
          status,
          target,
          sessionTime,
          location,
          isMatched: !!matchedPerson,
          inputTime: new Date().toLocaleString('id-ID')
        }, allPeople);

        processed.push(normRow);
      });

      if (!processed.length) {
        throw new Error('Tidak ada baris jadwal yang valid dengan NIK/Nama dan Program Training pada file Excel.');
      }

      setParsedScheduleRows(processed);
      setExcelPreviewSummary({
        totalRows: processed.length,
        sessionsCount: sessionKeys.size,
        uniqueParticipants: uniqueParticipants.size,
        matchedCount,
        unmatchedCount
      });
    } catch (err: any) {
      setExcelError(err?.message || 'Gagal membaca file Excel.');
      setParsedScheduleRows([]);
      setExcelPreviewSummary(null);
    } finally {
      setExcelBusy(false);
    }
  };

  const downloadScheduleTemplate = () => {
    const templateData = [
      {
        'NIK': '10001',
        'Name': 'Andi Pratama',
        'Position': 'Teknisi Pemeliharaan Sarana',
        'Section (Site)': 'Sarana & Lokomotif',
        'Training Tittle': 'Defensive Driving (DDC)',
        'Training Method(In Class Training/Mentoring/OJI)': 'In Class Training',
        'Start Date': todayStr,
        'Finish Date': todayStr,
        'Week': 'W42',
        'Duration': '1 Hari (8 Jam)',
        'Training Method  (Face to Face / Online Delievery Training)': 'Face to Face',
        'Section(L&D)': 'Technical L&D',
        'PIC (Trainer)': 'Bpk. Hendra Gunawan',
        'SITE': 'GAM'
      },
      {
        'NIK': '10002',
        'Name': 'Budi Santoso',
        'Position': 'Pelaksana Jalan Rel',
        'Section (Site)': 'Jalan Rel & Jembatan',
        'Training Tittle': 'Basic Railway Operation',
        'Training Method(In Class Training/Mentoring/OJI)': 'OJI',
        'Start Date': todayStr,
        'Finish Date': todayStr,
        'Week': 'W42',
        'Duration': '1 Hari (8 Jam)',
        'Training Method  (Face to Face / Online Delievery Training)': 'Face to Face',
        'Section(L&D)': 'Technical L&D',
        'PIC (Trainer)': 'Bpk. Hendra Gunawan',
        'SITE': 'GAM'
      },
      {
        'NIK': '20001',
        'Name': 'Citra Dewi',
        'Position': 'Staff Quality Assurance GAM',
        'Section (Site)': 'Quality & Safety GAM',
        'Training Tittle': 'Sistem Manajemen Mutu ISO 9001',
        'Training Method(In Class Training/Mentoring/OJI)': 'Mentoring',
        'Start Date': todayStr,
        'Finish Date': todayStr,
        'Week': 'W42',
        'Duration': '2 Hari (16 Jam)',
        'Training Method  (Face to Face / Online Delievery Training)': 'Online Delivery Training',
        'Section(L&D)': 'Quality L&D',
        'PIC (Trainer)': 'Dr. Sarah Amalia',
        'SITE': 'Balai Yasa'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 }, // NIK
      { wch: 22 }, // Name
      { wch: 28 }, // Position
      { wch: 25 }, // Section (Site)
      { wch: 32 }, // Training Tittle
      { wch: 42 }, // Training Method(In Class Training/Mentoring/OJI)
      { wch: 15 }, // Start Date
      { wch: 15 }, // Finish Date
      { wch: 10 }, // Week
      { wch: 18 }, // Duration
      { wch: 48 }, // Training Method  (Face to Face / Online Delievery Training)
      { wch: 20 }, // Section(L&D)
      { wch: 24 }, // PIC (Trainer)
      { wch: 14 }  // SITE
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jadwal Training');
    XLSX.writeFile(wb, 'Template_Jadwal_Training_Peserta.xlsx');
  };

  const handleConfirmExcelImport = async () => {
    if (!parsedScheduleRows.length) return;
    setSchedSaving(true);
    try {
      // Auto-navigate calendar view to the month of the imported training sessions
      const firstValidDate = parsedScheduleRows.find(r => r.startDate)?.startDate;
      if (firstValidDate) {
        const iso = normalizeDateToISO(firstValidDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          const [y, m] = iso.split('-').map(Number);
          if (y && m) {
            setCurrentYear(y);
            setCurrentMonth(m - 1);
          }
        }
      }

      if (onImportScheduleRows) {
        await onImportScheduleRows(parsedScheduleRows, excelOverwriteMode);
      } else if (onSaveSchedule) {
        if (excelOverwriteMode && onClearAllSessions) {
          onClearAllSessions();
        }
        const grouped = new Map<string, { niks: string[]; mod: string; start: string; finish: string; status: string; target: any; sessionTime: string; location: string; trainer: string }>();
        parsedScheduleRows.forEach(r => {
          const sess = r.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)';
          const loc = r.location || 'Ruang Training GAM (Lt. 2)';
          const trn = r.trainer || '';
          const k = `${r.moduleName}__${r.startDate}__${r.finishDate}__${sess}__${r.status}`;
          if (!grouped.has(k)) {
            grouped.set(k, {
              niks: [],
              mod: r.moduleName,
              start: r.startDate,
              finish: r.finishDate,
              status: r.status,
              target: r.target || 'MP',
              sessionTime: sess,
              location: loc,
              trainer: trn
            });
          }
          grouped.get(k)!.niks.push(r.nik);
        });
        for (const g of grouped.values()) {
          await onSaveSchedule({
            participantNiks: g.niks,
            moduleName: g.mod,
            startDate: g.start,
            finishDate: g.finish,
            status: g.status,
            target: g.target,
            sessionTime: g.sessionTime,
            location: g.location,
            trainer: g.trainer
          });
        }
      }
      setExcelSuccess(`Berhasil menyinkronkan ${parsedScheduleRows.length} baris jadwal training ke Kalender dan Daftar Agenda!`);
      setTimeout(() => {
        setIsScheduleModalOpen(false);
        setParsedScheduleRows([]);
        setExcelPreviewSummary(null);
        setExcelFile(null);
        setExcelSuccess(null);
      }, 1000);
    } catch (err: any) {
      setExcelError(err?.message || 'Gagal menyimpan jadwal training.');
    } finally {
      setSchedSaving(false);
    }
  };

  const handleSaveScheduleSubmit = async () => {
    if (!schedModule || !schedStartDate || !schedFinishDate || !schedNiks.length) {
      alert('Pilih program training, tanggal mulai & selesai, dan minimal satu peserta.');
      return;
    }
    if (schedFinishDate < schedStartDate) {
      alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    const effectiveSessionTime = isCustomSchedSession
      ? (customSchedSessionInput.trim() || SESSION_TIME_PRESETS[0])
      : schedSessionTime;
    const effectiveLocation = isCustomSchedLocation
      ? (customSchedLocationInput.trim() || LOCATION_PRESETS[0])
      : schedLocation;
    const effectiveTrainer = schedTrainer.trim();

    setSchedSaving(true);
    try {
      // Auto-navigate calendar view to the month of the scheduled training
      const iso = normalizeDateToISO(schedStartDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m] = iso.split('-').map(Number);
        if (y && m) {
          setCurrentYear(y);
          setCurrentMonth(m - 1);
        }
      }

      if (onSaveSchedule) {
        await onSaveSchedule({
          participantNiks: schedNiks,
          moduleName: schedModule,
          startDate: schedStartDate,
          finishDate: schedFinishDate,
          status: schedStatus,
          target: schedTarget,
          sessionTime: effectiveSessionTime,
          location: effectiveLocation,
          trainer: effectiveTrainer
        });
      } else {
        // Fallback to navigate
        onNavigateToRecords(schedModule, schedStartDate, schedFinishDate);
      }
      setIsScheduleModalOpen(false);
      setSchedNiks([]);
    } finally {
      setSchedSaving(false);
    }
  };

  // Helper to open Edit Mode for a session
  const openEditSessionMode = (session: TrainingSession) => {
    setIsEditingSession(true);
    setEditModuleName(session.moduleName);
    const isCustom = !allModules.includes(session.moduleName);
    setIsCustomEditModule(isCustom);
    setCustomEditModuleInput(isCustom ? session.moduleName : '');
    setEditStartDate(session.startDate);
    setEditFinishDate(session.finishDate);
    setEditStatus(session.status || 'TERJADWAL');

    const sTime = session.sessionTime || SESSION_TIME_PRESETS[0];
    const isCustomTime = !SESSION_TIME_PRESETS.includes(sTime);
    setEditSessionTime(isCustomTime ? SESSION_TIME_PRESETS[4] : sTime);
    setIsCustomSessionTime(isCustomTime);
    setCustomSessionTimeInput(isCustomTime ? sTime : '');

    const sLoc = session.location || LOCATION_PRESETS[0];
    const isCustomLoc = !LOCATION_PRESETS.includes(sLoc);
    setEditLocation(isCustomLoc ? LOCATION_PRESETS[5] : sLoc);
    setIsCustomLocation(isCustomLoc);
    setCustomLocationInput(isCustomLoc ? sLoc : '');

    setEditTrainer(session.trainer || '');

    setEditParticipants(session.participants.map(p => ({ ...p })));
    setAddParticipantTab('search');
    setAddParticipantSearch('');
    setManualAddNik('');
    setManualAddName('');
    setManualAddSection('');
    setManualAddJabatan('');
    setEditError(null);
    setShowDeleteConfirm(false);
  };

  const closeSessionModal = () => {
    setSelectedSession(null);
    setIsEditingSession(false);
    setEditError(null);
    setShowDeleteConfirm(false);
  };

  const handleAddPersonFromMaster = (person: Row) => {
    const nik = String(person.NIK || person.nik || '').trim();
    if (!nik) return;
    if (editParticipants.some(p => p.nik === nik)) {
      setEditError(`Peserta dengan NIK ${nik} sudah terdaftar pada sesi ini.`);
      return;
    }
    const name = String(person.NAMA || person.Nama || person.NAME || `Karyawan (${nik})`).trim();
    const section = String(person.SECTION || person.Section || '-').trim();
    const jabatan = String(person.JABATAN || person.Jabatan || '-').trim();

    setEditParticipants(prev => [
      ...prev,
      {
        nik,
        name,
        section,
        jabatan,
        status: editStatus || 'TERJADWAL'
      }
    ]);
    setAddParticipantSearch('');
    setEditError(null);
  };

  const handleAddManualParticipant = () => {
    const nik = manualAddNik.trim();
    const name = manualAddName.trim();
    if (!name && !nik) {
      setEditError('Mohon isi NIK atau Nama peserta baru.');
      return;
    }
    const effectiveNik = nik || `EMP-${Date.now().toString().slice(-4)}`;
    if (editParticipants.some(p => p.nik === effectiveNik)) {
      setEditError(`Peserta dengan NIK ${effectiveNik} sudah terdaftar pada sesi ini.`);
      return;
    }
    setEditParticipants(prev => [
      ...prev,
      {
        nik: effectiveNik,
        name: name || `Karyawan (${effectiveNik})`,
        section: manualAddSection.trim() || '-',
        jabatan: manualAddJabatan.trim() || '-',
        status: editStatus || 'TERJADWAL'
      }
    ]);
    setManualAddNik('');
    setManualAddName('');
    setManualAddSection('');
    setManualAddJabatan('');
    setEditError(null);
  };

  const handleRemoveParticipant = (nikToRemove: string) => {
    setEditParticipants(prev => prev.filter(p => p.nik !== nikToRemove));
  };

  const handleUpdateParticipantStatus = (nik: string, newStatus: string) => {
    setEditParticipants(prev => prev.map(p => p.nik === nik ? { ...p, status: newStatus } : p));
  };

  const handleSessionStatusChange = (newStatus: string, applyToAll = true) => {
    setEditStatus(newStatus);
    if (applyToAll) {
      setEditParticipants(prev => prev.map(p => ({ ...p, status: newStatus })));
    }
  };

  const handleSaveSessionEdit = async () => {
    if (!selectedSession) return;
    const finalModule = isCustomEditModule ? customEditModuleInput.trim() : editModuleName.trim();
    if (!finalModule) {
      setEditError('Nama modul training wajib diisi.');
      return;
    }
    if (!editStartDate) {
      setEditError('Tanggal mulai wajib diisi.');
      return;
    }
    const finalFinishDate = editFinishDate || editStartDate;
    if (finalFinishDate < editStartDate) {
      setEditError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    if (editParticipants.length === 0) {
      setEditError('Sesi training minimal harus memiliki 1 peserta.');
      return;
    }

    const effectiveSessionTime = isCustomSessionTime
      ? (customSessionTimeInput.trim() || SESSION_TIME_PRESETS[0])
      : editSessionTime;
    const effectiveLocation = isCustomLocation
      ? (customLocationInput.trim() || LOCATION_PRESETS[0])
      : editLocation;
    const effectiveTrainer = editTrainer.trim();

    setEditSaving(true);
    setEditError(null);

    try {
      if (onUpdateSession) {
        await onUpdateSession(selectedSession, {
          moduleName: finalModule,
          startDate: editStartDate,
          finishDate: finalFinishDate,
          status: editStatus,
          sessionTime: effectiveSessionTime,
          location: effectiveLocation,
          trainer: effectiveTrainer,
          participants: editParticipants
        });
      }
      closeSessionModal();
    } catch (err: any) {
      setEditError(err?.message || 'Gagal menyimpan perubahan sesi training.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteEntireSession = async () => {
    if (!selectedSession) return;
    setEditSaving(true);
    try {
      if (onDeleteSession) {
        await onDeleteSession(selectedSession);
      }
      closeSessionModal();
    } catch (err: any) {
      setEditError(err?.message || 'Gagal menghapus sesi training.');
    } finally {
      setEditSaving(false);
    }
  };

  // Filtered employees for adding to session in edit mode
  const matchingEmployeesForEdit = useMemo(() => {
    if (!addParticipantSearch.trim()) return [];
    const q = addParticipantSearch.toLowerCase().trim();
    const existingNiks = new Set(editParticipants.map(p => p.nik));
    return allPeople
      .filter(p => {
        const nik = String(p.NIK || p.nik || '').trim();
        if (existingNiks.has(nik)) return false;
        const name = String(p.NAME || p.Nama || p.name || '').toLowerCase();
        const sec = String(p.SECTION || p.Section || '').toLowerCase();
        return nik.toLowerCase().includes(q) || name.includes(q) || sec.includes(q);
      })
      .slice(0, 8);
  }, [allPeople, addParticipantSearch, editParticipants]);

  // Status badge config
  const getBadgeStyle = (cat: TrainingSession['statusCategory']) => {
    switch (cat) {
      case 'completed':
        return {
          bg: '#ecfdf5',
          border: '#a7f3d0',
          text: '#065f46',
          label: 'Selesai',
          dot: '#10b981',
          icon: <CheckCircle2 size={12} className="text-emerald-600" />
        };
      case 'ongoing':
        return {
          bg: '#eff6ff',
          border: '#bfdbfe',
          text: '#1e40af',
          label: 'Sedang Berjalan',
          dot: '#3b82f6',
          icon: <Clock size={12} className="text-blue-600" />
        };
      case 'upcoming':
        return {
          bg: '#f5f3ff',
          border: '#ddd6fe',
          text: '#5b21b6',
          label: 'Mendatang (Upcoming)',
          dot: '#8b5cf6',
          icon: <CalendarIcon size={12} className="text-purple-600" />
        };
      case 'pending':
      default:
        return {
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#92400e',
          label: 'Belum Selesai',
          dot: '#f59e0b',
          icon: <AlertCircle size={12} className="text-amber-600" />
        };
    }
  };

  return (
    <div className="calendar-page-container">
      {/* HEADER SECTION */}
      <div className="panel-heading" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarDays size={13} className="text-blue" /> TRAINING TIMELINE & CALENDAR
          </div>
          <h2>Kalender Pelaksanaan Training</h2>
          <p>
            Visualisasi jadwal pelatihan mendatang (upcoming), sesi yang sedang berlangsung, serta riwayat pelatihan yang telah selesai berdasarkan tanggal start dan finish.
          </p>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onClearAllSessions && history.length > 0 && (
            <button
              type="button"
              className="btn btn-light"
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                if (window.confirm(`Hapuskan seluruh ${history.length} sesi training yang ada sekarang? Kalender akan dikosongkan (0 sesi) sehingga Anda dapat mengunggah agenda murni dari Excel.`)) {
                  onClearAllSessions();
                }
              }}
              title="Hapus total seluruh sesi training yang ada sekarang"
            >
              <Trash2 size={15} /> Kosongkan Sesi ({history.length})
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ background: '#059669', borderColor: '#059669', color: '#ffffff' }}
            onClick={() => {
              setScheduleModalTab('upload');
              setExcelFile(null);
              setExcelError(null);
              setExcelSuccess(null);
              setParsedScheduleRows([]);
              setExcelPreviewSummary(null);
              setIsScheduleModalOpen(true);
            }}
            title="Upload data Excel jadwal training dan pesertanya berdasarkan NIK dan Nama"
          >
            <FileSpreadsheet size={16} /> Upload Schedule Training (Excel)
          </button>
          <button
            className="btn btn-light"
            onClick={() => {
              setScheduleModalTab('manual');
              setSchedStartDate(todayStr);
              setSchedFinishDate(todayStr);
              setIsScheduleModalOpen(true);
            }}
            title="Input jadwal training sesi baru secara manual"
          >
            <Plus size={15} /> + Input Manual
          </button>
          <button
            className="btn btn-light"
            onClick={() => onNavigateToRecords()}
            title="Buka form catatan training"
          >
            <GraduationCap size={15} /> Training Record
          </button>
        </div>
      </div>

      {/* ZERO SESSIONS NOTICE BANNER (WHEN SESSIONS HAVE BEEN CLEARED) */}
      {history.length === 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#14532d' }}>
                Total Sesi Training Saat Ini Kosong (0 Sesi)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '2px' }}>
                Seluruh sesi training lama telah berhasil dihapus. Agenda baru siap diimpor dari file Excel Anda menggunakan format 14 kolom.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                setScheduleModalTab('upload');
                setExcelFile(null);
                setExcelError(null);
                setExcelSuccess(null);
                setParsedScheduleRows([]);
                setExcelPreviewSummary(null);
                setIsScheduleModalOpen(true);
              }}
            >
              <FileSpreadsheet size={14} /> Upload Schedule (Excel)
            </button>
            <button
              type="button"
              className="btn btn-light btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={downloadScheduleTemplate}
              title="Unduh template Excel 14 kolom"
            >
              <Download size={14} /> Unduh Format Template (14 Kolom)
            </button>
          </div>
        </div>
      )}

      {/* KPI METRICS OVERVIEW */}
      <div className="calendar-kpi-grid">
        <div
          className={`calendar-kpi-card ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          title="Klik untuk menyaring semua sesi"
        >
          <div className="kpi-icon-wrap" style={{ background: '#f1f5f9', color: '#334155' }}>
            <Layers size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">TOTAL SESI TRAINING</span>
            <div className="kpi-val">{stats.total}</div>
            <span className="kpi-sub">{stats.totalParticipants} partisipan terlibat</span>
          </div>
        </div>

        <div
          className={`calendar-kpi-card kpi-upcoming ${statusFilter === 'UPCOMING' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'UPCOMING' ? 'ALL' : 'UPCOMING')}
          title="Klik untuk menyaring sesi mendatang"
        >
          <div className="kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <CalendarIcon size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">MENDATANG (UPCOMING)</span>
            <div className="kpi-val" style={{ color: '#7c3aed' }}>{stats.upcoming}</div>
            <span className="kpi-sub">Jadwal sesi berikutnya</span>
          </div>
        </div>

        <div
          className={`calendar-kpi-card kpi-ongoing ${statusFilter === 'ONGOING' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'ONGOING' ? 'ALL' : 'ONGOING')}
          title="Klik untuk menyaring sesi yang sedang berjalan"
        >
          <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">SEDANG BERJALAN</span>
            <div className="kpi-val" style={{ color: '#2563eb' }}>{stats.ongoing}</div>
            <span className="kpi-sub">Aktif saat ini (in-progress)</span>
          </div>
        </div>

        <div
          className={`calendar-kpi-card kpi-completed ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          title="Klik untuk menyaring sesi yang telah selesai"
        >
          <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">SELESAI (COMPLETED)</span>
            <div className="kpi-val" style={{ color: '#059669' }}>{stats.completed}</div>
            <span className="kpi-sub">Pelatihan lulus & tersimpan</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="calendar-toolbar panel">
        {/* Left: Month Navigation */}
        <div className="cal-nav-controls">
          <button className="cal-nav-btn" onClick={prevMonth} title="Bulan sebelumnya">
            <ChevronLeft size={18} />
          </button>
          <div className="cal-month-display">
            <span className="cal-month-name">{MONTH_NAMES_ID[currentMonth]}</span>
            <span className="cal-year-name">{currentYear}</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth} title="Bulan berikutnya">
            <ChevronRight size={18} />
          </button>
          <button className="btn btn-light cal-today-btn" onClick={jumpToToday}>
            Bulan Ini
          </button>
        </div>

        {/* Center: View Switcher */}
        <div className="cal-view-segmented">
          <button
            className={`seg-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays size={15} /> Grid Kalender
          </button>
          <button
            className={`seg-btn ${viewMode === 'agenda' ? 'active' : ''}`}
            onClick={() => setViewMode('agenda')}
          >
            <ListFilter size={15} /> Daftar Agenda
          </button>
        </div>

        {/* Right: Filters & Search */}
        <div className="cal-filters-group">
          {/* Search Box */}
          <div className="cal-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Cari modul atau peserta..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="cal-clear-search" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Module Select */}
          <select
            className="select-control cal-filter-select"
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
          >
            <option value="ALL">Semua Modul Training</option>
            {distinctModules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Status Pills */}
          <select
            className="select-control cal-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Semua Status</option>
            <option value="UPCOMING">🟣 Mendatang (Upcoming)</option>
            <option value="ONGOING">🔵 Sedang Berjalan</option>
            <option value="COMPLETED">🟢 Selesai (Completed)</option>
            <option value="PENDING">🟡 Belum Selesai</option>
          </select>

          {/* Sesi Training Select */}
          <select
            className="select-control cal-filter-select"
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
          >
            <option value="ALL">Semua Sesi Training</option>
            <option value="Sesi 1">🕒 Sesi 1 (Pagi · 08:00 - 12:00)</option>
            <option value="Sesi 2">🕒 Sesi 2 (Siang · 13:00 - 17:00)</option>
            <option value="Sesi 3">🌙 Sesi 3 (Malam · 19:00 - 22:00)</option>
            <option value="Full Day">☀️ Full Day (08:00 - 17:00)</option>
          </select>
        </div>
      </div>

      {/* ACTIVE FILTER INDICATORS */}
      {(statusFilter !== 'ALL' || moduleFilter !== 'ALL' || sessionFilter !== 'ALL' || searchQuery) && (
        <div className="cal-filter-tags">
          <span className="cal-filter-label">Filter aktif:</span>
          {statusFilter !== 'ALL' && (
            <span className="cal-filter-tag">
              Status: <b>{statusFilter}</b>
              <button onClick={() => setStatusFilter('ALL')}><X size={11} /></button>
            </span>
          )}
          {moduleFilter !== 'ALL' && (
            <span className="cal-filter-tag">
              Modul: <b>{moduleFilter}</b>
              <button onClick={() => setModuleFilter('ALL')}><X size={11} /></button>
            </span>
          )}
          {sessionFilter !== 'ALL' && (
            <span className="cal-filter-tag">
              Sesi: <b>{sessionFilter}</b>
              <button onClick={() => setSessionFilter('ALL')}><X size={11} /></button>
            </span>
          )}
          {searchQuery && (
            <span className="cal-filter-tag">
              Cari: <b>"{searchQuery}"</b>
              <button onClick={() => setSearchQuery('')}><X size={11} /></button>
            </span>
          )}
          <button
            className="cal-reset-filters-btn"
            onClick={() => {
              setStatusFilter('ALL');
              setModuleFilter('ALL');
              setSessionFilter('ALL');
              setSearchQuery('');
            }}
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* VIEW CONTENT */}
      {viewMode === 'calendar' ? (
        /* CALENDAR MONTH GRID VIEW */
        <div className="calendar-grid-card panel">
          {/* Weekday Labels */}
          <div className="calendar-weekdays-header">
            {DAY_NAMES_ID.map((name, idx) => (
              <div key={name} className={`weekday-col ${idx >= 5 ? 'weekend' : ''}`}>
                <span>{name.toUpperCase()}</span>
              </div>
            ))}
          </div>

          {/* Day Grid Cells */}
          <div className="calendar-cells-grid">
            {calendarDays.map((cell, idx) => {
              const daySessions = sessionsByDate.get(cell.dateStr) || [];
              const isWeekend = idx % 7 >= 5;

              return (
                <div
                  key={cell.dateStr}
                  className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today-cell' : ''} ${isWeekend ? 'weekend-cell' : ''}`}
                  onClick={() => {
                    if (daySessions.length > 0) {
                      setSelectedDaySessions({ date: cell.dateStr, sessions: daySessions });
                    } else if (cell.isCurrentMonth) {
                      // Schedule new session on this date
                      setSchedStartDate(cell.dateStr);
                      setSchedFinishDate(cell.dateStr);
                      setIsScheduleModalOpen(true);
                    }
                  }}
                >
                  {/* Cell Header: Day number & Badge */}
                  <div className="cell-top-bar">
                    <span className={`cell-day-num ${cell.isToday ? 'today-badge' : ''}`}>
                      {cell.dayNumber}
                    </span>
                    {cell.isToday && (
                      <span className="today-chip">Hari Ini</span>
                    )}
                    {daySessions.length > 0 && !cell.isToday && (
                      <span className="session-count-indicator">
                        {daySessions.length} sesi
                      </span>
                    )}
                  </div>

                  {/* Session Items in this cell */}
                  <div className="cell-sessions-stack">
                    {daySessions.slice(0, 3).map(session => {
                      const style = getBadgeStyle(session.statusCategory);
                      const isMultiDay = session.startDate !== session.finishDate;
                      const isStart = session.startDate === cell.dateStr;
                      const isFinish = session.finishDate === cell.dateStr;

                      return (
                        <div
                          key={session.id}
                          className="cell-session-pill"
                          style={{
                            backgroundColor: style.bg,
                            borderColor: style.border,
                            color: style.text
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedSession(session);
                          }}
                          title={`${session.moduleName} (${style.label})\n${session.dateDisplay}\n${session.participants.length} peserta`}
                        >
                          <span className="pill-dot" style={{ backgroundColor: style.dot }} />
                          <span className="pill-title">{session.moduleName}</span>
                          {session.sessionTime && (
                            <span
                              style={{
                                fontSize: '0.6rem',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                background: 'rgba(0,0,0,0.06)',
                                fontWeight: 700,
                                flexShrink: 0
                              }}
                              title={session.sessionTime}
                            >
                              {session.sessionTime.includes('Sesi 1') ? 'S1' : session.sessionTime.includes('Sesi 2') ? 'S2' : session.sessionTime.includes('Sesi 3') ? 'S3' : session.sessionTime.includes('Full') ? 'Full' : 'Sesi'}
                            </span>
                          )}
                          <span className="pill-count">
                            <Users size={9} style={{ display: 'inline', marginRight: '2px' }} />
                            {session.participants.length}
                          </span>
                          {isMultiDay && isStart && (
                            <span className="pill-multi-indicator" title="Mulai sesi hari ini">Mulai</span>
                          )}
                          {isMultiDay && isFinish && !isStart && (
                            <span className="pill-multi-indicator" title="Selesai sesi hari ini">Akhir</span>
                          )}
                        </div>
                      );
                    })}

                    {daySessions.length > 3 && (
                      <button
                        className="cell-more-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedDaySessions({ date: cell.dateStr, sessions: daySessions });
                        }}
                      >
                        +{daySessions.length - 3} sesi lainnya
                      </button>
                    )}

                    {daySessions.length === 0 && cell.isCurrentMonth && (
                      <div className="cell-empty-hover">
                        <span>+ Input Jadwal</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AGENDA & TIMELINE LIST VIEW */
        <div className="agenda-view-container">
          {filteredSessions.length === 0 ? (
            <div className="cal-empty-state panel">
              <CalendarIcon size={42} className="empty-icon" />
              <h3>Tidak Ada Sesi Training</h3>
              <p>Tidak ditemukan jadwal training yang cocok dengan filter atau kata kunci saat ini.</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSchedStartDate(todayStr);
                  setSchedFinishDate(todayStr);
                  setIsScheduleModalOpen(true);
                }}
              >
                <Plus size={16} /> + Input Schedule Training Baru
              </button>
            </div>
          ) : (
            <div className="agenda-sections-list">
              {/* Ongoing Sessions Section */}
              {filteredSessions.some(s => s.statusCategory === 'ongoing') && (
                <div className="agenda-group">
                  <div className="agenda-group-header ongoing-header">
                    <Clock size={16} /> SEDANG BERLANGSUNG HARI INI ({filteredSessions.filter(s => s.statusCategory === 'ongoing').length})
                  </div>
                  <div className="agenda-cards-grid">
                    {filteredSessions.filter(s => s.statusCategory === 'ongoing').map(session => (
                      <AgendaCard
                        key={session.id}
                        session={session}
                        onSelect={() => setSelectedSession(session)}
                        onEdit={() => openEditSessionMode(session)}
                        onNavigate={() => onNavigateToRecords(session.moduleName, session.startDate, session.finishDate)}
                        onComplete={onCompleteSession ? () => onCompleteSession(session) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Sessions Section */}
              {filteredSessions.some(s => s.statusCategory === 'upcoming') && (
                <div className="agenda-group">
                  <div className="agenda-group-header upcoming-header">
                    <CalendarIcon size={16} /> JADWAL MENDATANG / UPCOMING ({filteredSessions.filter(s => s.statusCategory === 'upcoming').length})
                  </div>
                  <div className="agenda-cards-grid">
                    {filteredSessions
                      .filter(s => s.statusCategory === 'upcoming')
                      .sort((a, b) => a.startDate.localeCompare(b.startDate))
                      .map(session => (
                        <AgendaCard
                          key={session.id}
                          session={session}
                          onSelect={() => setSelectedSession(session)}
                          onEdit={() => openEditSessionMode(session)}
                          onNavigate={() => onNavigateToRecords(session.moduleName, session.startDate, session.finishDate)}
                          onComplete={onCompleteSession ? () => onCompleteSession(session) : undefined}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Completed Sessions Section */}
              {filteredSessions.some(s => s.statusCategory === 'completed') && (
                <div className="agenda-group">
                  <div className="agenda-group-header completed-header">
                    <CheckCircle2 size={16} /> PELATIHAN SELESAI ({filteredSessions.filter(s => s.statusCategory === 'completed').length})
                  </div>
                  <div className="agenda-cards-grid">
                    {filteredSessions
                      .filter(s => s.statusCategory === 'completed')
                      .sort((a, b) => b.finishDate.localeCompare(a.finishDate))
                      .map(session => (
                        <AgendaCard
                          key={session.id}
                          session={session}
                          onSelect={() => setSelectedSession(session)}
                          onEdit={() => openEditSessionMode(session)}
                          onNavigate={() => onNavigateToRecords(session.moduleName, session.startDate, session.finishDate)}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Pending Sessions Section */}
              {filteredSessions.some(s => s.statusCategory === 'pending') && (
                <div className="agenda-group">
                  <div className="agenda-group-header pending-header">
                    <AlertCircle size={16} /> BELUM SELESAI / PERLU FOLLOW-UP ({filteredSessions.filter(s => s.statusCategory === 'pending').length})
                  </div>
                  <div className="agenda-cards-grid">
                    {filteredSessions.filter(s => s.statusCategory === 'pending').map(session => (
                      <AgendaCard
                        key={session.id}
                        session={session}
                        onSelect={() => setSelectedSession(session)}
                        onEdit={() => openEditSessionMode(session)}
                        onNavigate={() => onNavigateToRecords(session.moduleName, session.startDate, session.finishDate)}
                        onComplete={onCompleteSession ? () => onCompleteSession(session) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SESSION DETAIL MODAL DIALOG */}
      {selectedSession && (
        <div className="mini-data-modal-overlay" onClick={closeSessionModal}>
          <div
            className="mini-data-modal drilldown-modal cal-session-detail-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: isEditingSession ? '880px' : '720px',
              maxWidth: '96vw',
              height: isEditingSession ? '90vh' : 'auto',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'width 0.2s ease',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)'
            }}
          >
            {/* Modal Header */}
            <div className="mini-data-header" style={{ padding: '1.15rem 1.5rem', flexShrink: 0, borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div>
                <span className="mini-data-kicker" style={{ color: isEditingSession ? '#d97706' : '#2563eb' }}>
                  {isEditingSession ? 'MODE EDIT SESI & PESERTA' : 'DETAIL SESI TRAINING'}
                </span>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '4px 0 0 0' }}>
                  {isEditingSession ? (
                    <>
                      <Pencil size={18} className="text-amber" />
                      <span>Edit: {isCustomEditModule ? (customEditModuleInput || 'Modul Baru') : (editModuleName || selectedSession.moduleName)}</span>
                    </>
                  ) : (
                    <>
                      <span>{selectedSession.moduleName}</span>
                      {selectedSession.isMandatory && (
                        <span className="badge badge-mandatory" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          Mandatory
                        </span>
                      )}
                    </>
                  )}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isEditingSession && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveSessionEdit}
                      disabled={editSaving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
                      title="Simpan seluruh perubahan sesi ini"
                    >
                      <Save size={14} /> {editSaving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={editSaving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      title="Hapus sesi ini dari kalender dan database"
                    >
                      <Trash2 size={13} /> Hapus
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={() => {
                        setIsEditingSession(false);
                        setEditError(null);
                        setShowDeleteConfirm(false);
                      }}
                      disabled={editSaving}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Batal
                    </button>
                  </>
                )}
                {!isEditingSession && (
                  <button
                    className="btn btn-warning"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    onClick={() => openEditSessionMode(selectedSession)}
                    title="Ubah modul, status sesi, dan kelola peserta"
                  >
                    <Pencil size={13} /> Edit Sesi & Peserta
                  </button>
                )}
                <button className="mini-data-close-btn" onClick={closeSessionModal}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body with smooth scrolling */}
            <div
              className="cal-modal-content"
              style={{
                padding: isEditingSession ? '1.25rem 1.5rem 1.5rem' : '0',
                overflowY: 'auto',
                flex: '1 1 0%',
                minHeight: 0,
                maxHeight: isEditingSession ? 'calc(90vh - 135px)' : 'none'
              }}
            >
              {isEditingSession ? (
                /* ================= EDIT MODE ================= */
                <div>
                  {editError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      <AlertCircle size={16} />
                      <span>{editError}</span>
                    </div>
                  )}

                  {/* 1. Module & Status & Dates Setting */}
                  <div className="session-edit-card">
                    <div className="session-edit-card-title">
                      <Layers size={15} className="text-blue" />
                      <span>1. Parameter Modul, Status & Jadwal Sesi</span>
                    </div>
                    <div className="session-edit-grid">
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          PROGRAM / MODUL TRAINING
                        </label>
                        <select
                          className="form-control"
                          value={isCustomEditModule ? '__CUSTOM__' : editModuleName}
                          onChange={e => {
                            if (e.target.value === '__CUSTOM__') {
                              setIsCustomEditModule(true);
                              setCustomEditModuleInput('');
                            } else {
                              setIsCustomEditModule(false);
                              setEditModuleName(e.target.value);
                            }
                          }}
                          style={{ width: '100%' }}
                        >
                          {allModules.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          {!allModules.includes(selectedSession.moduleName) && (
                            <option value={selectedSession.moduleName}>{selectedSession.moduleName} (Modul Saat Ini)</option>
                          )}
                          <option value="__CUSTOM__">+ Ketik Modul Lain / Baru...</option>
                        </select>
                        {isCustomEditModule && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ketik nama modul training..."
                            value={customEditModuleInput}
                            onChange={e => setCustomEditModuleInput(e.target.value)}
                            style={{ marginTop: '6px' }}
                            autoFocus
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          STATUS TRAINING SESI
                        </label>
                        <select
                          className="form-control"
                          value={editStatus}
                          onChange={e => handleSessionStatusChange(e.target.value, true)}
                          style={{ width: '100%', fontWeight: 600 }}
                        >
                          <option value="TERJADWAL">TERJADWAL (Upcoming / Terjadwal)</option>
                          <option value="DALAM PROSES">DALAM PROSES (On Going / Sedang Berjalan)</option>
                          <option value="SELESAI">SELESAI (Completed / Selesai)</option>
                          <option value="BELUM SELESAI">BELUM SELESAI (Pending / Belum Selesai)</option>
                        </select>
                        <small style={{ color: '#64748b', fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
                          *Mengubah status di sini otomatis menyinkronkan seluruh peserta
                        </small>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          TANGGAL MULAI (START)
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={editStartDate}
                          onChange={e => {
                            setEditStartDate(e.target.value);
                            if (editFinishDate < e.target.value) setEditFinishDate(e.target.value);
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          TANGGAL SELESAI (FINISH)
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={editFinishDate}
                          min={editStartDate}
                          onChange={e => setEditFinishDate(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          SESI TRAINING (WAKTU / JAM)
                        </label>
                        <select
                          className="form-control"
                          value={isCustomSessionTime ? '__CUSTOM__' : editSessionTime}
                          onChange={e => {
                            if (e.target.value === '__CUSTOM__') {
                              setIsCustomSessionTime(true);
                              setCustomSessionTimeInput('');
                            } else {
                              setIsCustomSessionTime(false);
                              setEditSessionTime(e.target.value);
                            }
                          }}
                          style={{ width: '100%' }}
                        >
                          {SESSION_TIME_PRESETS.map(preset => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                        </select>
                        {isCustomSessionTime && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Contoh: 09:30 - 11:30 atau Sesi Khusus..."
                            value={customSessionTimeInput}
                            onChange={e => setCustomSessionTimeInput(e.target.value)}
                            style={{ marginTop: '6px' }}
                            autoFocus
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          RUANG / LOKASI TRAINING
                        </label>
                        <select
                          className="form-control"
                          value={isCustomLocation ? '__CUSTOM__' : editLocation}
                          onChange={e => {
                            if (e.target.value === '__CUSTOM__') {
                              setIsCustomLocation(true);
                              setCustomLocationInput('');
                            } else {
                              setIsCustomLocation(false);
                              setEditLocation(e.target.value);
                            }
                          }}
                          style={{ width: '100%' }}
                        >
                          {LOCATION_PRESETS.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                        {isCustomLocation && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ketik nama ruangan atau lokasi training..."
                            value={customLocationInput}
                            onChange={e => setCustomLocationInput(e.target.value)}
                            style={{ marginTop: '6px' }}
                            autoFocus
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>
                          TRAINER / INSTRUKTUR (OPSIONAL)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nama trainer / instruktur / pemateri..."
                          value={editTrainer}
                          onChange={e => setEditTrainer(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Participant Management (Add, Edit, Delete) */}
                  <div className="session-edit-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div className="session-edit-card-title" style={{ margin: 0 }}>
                        <Users size={15} className="text-blue" />
                        <span>2. Kelola Peserta Training ({editParticipants.length} Personel)</span>
                      </div>
                      <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${addParticipantTab === 'search' ? 'btn-primary' : 'btn-light'}`}
                          style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                          onClick={() => setAddParticipantTab('search')}
                        >
                          <Search size={13} /> Cari Database Karyawan
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${addParticipantTab === 'manual' ? 'btn-primary' : 'btn-light'}`}
                          style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                          onClick={() => setAddParticipantTab('manual')}
                        >
                          <Plus size={13} /> Input Manual
                        </button>
                      </div>
                    </div>

                    {/* Add Participant Controls */}
                    {addParticipantTab === 'search' ? (
                      <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.45rem 0.75rem' }}>
                          <Search size={15} style={{ color: '#94a3b8', marginRight: '8px' }} />
                          <input
                            type="text"
                            placeholder="Cari NIK, Nama, atau Section karyawan untuk ditambahkan ke sesi ini..."
                            value={addParticipantSearch}
                            onChange={e => setAddParticipantSearch(e.target.value)}
                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.82rem' }}
                          />
                          {addParticipantSearch && (
                            <button
                              type="button"
                              className="btn-icon-danger"
                              style={{ padding: '2px 4px' }}
                              onClick={() => setAddParticipantSearch('')}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Search Dropdown / Autocomplete Results */}
                        {matchingEmployeesForEdit.length > 0 && (
                          <div className="participant-search-dropdown">
                            <div style={{ padding: '0.35rem 0.75rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                              KLIK UNTUK MENAMBAHKAN PESERTA KE SESI INI:
                            </div>
                            {matchingEmployeesForEdit.map(p => {
                              const nik = String(p.NIK || p.nik || '').trim();
                              const name = String(p.NAMA || p.Nama || p.NAME || `Karyawan (${nik})`).trim();
                              const sec = String(p.SECTION || p.Section || '-').trim();
                              const jab = String(p.JABATAN || p.Jabatan || '-').trim();
                              return (
                                <div
                                  key={nik}
                                  className="participant-search-row"
                                  onClick={() => handleAddPersonFromMaster(p)}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>
                                      {name} <span style={{ fontFamily: 'monospace', color: '#2563eb', fontSize: '0.78rem' }}>({nik})</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      {sec} · {jab}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                  >
                                    <UserPlus size={12} /> + Tambah
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {addParticipantSearch.trim() && matchingEmployeesForEdit.length === 0 && (
                          <small style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                            Tidak ada karyawan database yang cocok atau karyawan sudah ada dalam sesi ini.
                          </small>
                        )}
                      </div>
                    ) : (
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          TAMBAH PESERTA SECARA MANUAL
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) auto', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="NIK"
                            value={manualAddNik}
                            onChange={e => setManualAddNik(e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Nama Karyawan *"
                            value={manualAddName}
                            onChange={e => setManualAddName(e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Section"
                            value={manualAddSection}
                            onChange={e => setManualAddSection(e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Jabatan"
                            value={manualAddJabatan}
                            onChange={e => setManualAddJabatan(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={handleAddManualParticipant}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <UserPlus size={14} /> + Tambah
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Participants Table in Edit Mode */}
                    <div className="cal-table-scroll" style={{ maxHeight: '280px', padding: 0 }}>
                      <table className="data-table cal-participants-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '45px' }}>No</th>
                            <th style={{ width: '90px' }}>NIK</th>
                            <th>Nama Karyawan</th>
                            <th>Section</th>
                            <th>Jabatan</th>
                            <th style={{ width: '150px' }}>Status Peserta</th>
                            <th style={{ width: '60px', textAlign: 'center' }}>Hapus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editParticipants.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                                Belum ada peserta pada sesi ini. Silakan cari atau tambahkan peserta di atas.
                              </td>
                            </tr>
                          ) : (
                            editParticipants.map((p, idx) => (
                              <tr key={p.nik}>
                                <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                                <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                                <td>{p.section}</td>
                                <td>{p.jabatan}</td>
                                <td>
                                  <select
                                    className="form-select-sm"
                                    value={p.status || editStatus}
                                    onChange={e => handleUpdateParticipantStatus(p.nik, e.target.value)}
                                    style={{ width: '100%' }}
                                  >
                                    <option value="TERJADWAL">TERJADWAL</option>
                                    <option value="DALAM PROSES">DALAM PROSES</option>
                                    <option value="SELESAI">SELESAI</option>
                                    <option value="BELUM SELESAI">BELUM SELESAI</option>
                                  </select>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn-icon-danger"
                                    onClick={() => handleRemoveParticipant(p.nik)}
                                    title={`Hapus ${p.name} (${p.nik}) dari sesi training ini`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Delete Confirmation Box */}
                  {showDeleteConfirm && (
                    <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '10px', padding: '1rem', marginTop: '1rem' }}>
                      <h4 style={{ color: '#991b1b', margin: '0 0 6px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={18} /> Konfirmasi Hapus Seluruh Sesi Training
                      </h4>
                      <p style={{ color: '#7f1d1d', fontSize: '0.82rem', margin: '0 0 12px 0' }}>
                        Yakin ingin menghapus seluruh sesi pelatihan &ldquo;{selectedSession.moduleName}&rdquo; ({editParticipants.length} peserta) dari kalender dan riwayat database? Tindakan ini tidak dapat dibatalkan.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={handleDeleteEntireSession}
                          disabled={editSaving}
                        >
                          <Trash2 size={14} /> {editSaving ? 'Menghapus...' : 'Ya, Hapus Sesi Ini'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-light"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ================= VIEW MODE ================= */
                <div>
                  {/* Date & Status Banner */}
                  {/* Date, Sesi & Status Banner */}
                  <div className="cal-detail-banner">
                    <div className="banner-item">
                      <span className="banner-label">TANGGAL MULAI</span>
                      <div className="banner-value">
                        <CalendarIcon size={14} className="text-blue" />
                        <b>{formatDateIndo(selectedSession.startDate)}</b>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">TANGGAL SELESAI</span>
                      <div className="banner-value">
                        <CalendarIcon size={14} className="text-blue" />
                        <b>{formatDateIndo(selectedSession.finishDate)}</b>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">DURASI</span>
                      <div className="banner-value">
                        <Clock size={14} className="text-teal" />
                        <b>{selectedSession.durationDays} Hari</b>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">SESI TRAINING</span>
                      <div className="banner-value">
                        <Clock size={14} style={{ color: '#2563eb' }} />
                        <b style={{ color: '#1e40af' }}>{selectedSession.sessionTime || 'Sesi 1 (Pagi · 08:00 - 12:00)'}</b>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">LOKASI / RUANG</span>
                      <div className="banner-value">
                        <MapPin size={14} style={{ color: '#d97706' }} />
                        <span>{selectedSession.location || 'Ruang Training GAM (Lt. 2)'}</span>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">TRAINER / PENGAJAR</span>
                      <div className="banner-value">
                        <UserCheck size={14} style={{ color: '#059669' }} />
                        <span>{selectedSession.trainer || 'Belum Ditentukan'}</span>
                      </div>
                    </div>
                    <div className="banner-item">
                      <span className="banner-label">STATUS SESI</span>
                      <div>
                        {(() => {
                          const st = getBadgeStyle(selectedSession.statusCategory);
                          return (
                            <span
                              className="status-pill-badge"
                              style={{
                                backgroundColor: st.bg,
                                borderColor: st.border,
                                color: st.text,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: '1px solid'
                              }}
                            >
                              {st.icon} {st.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Participants Header */}
                  <div className="cal-participants-header">
                    <div>
                      <h4>Daftar Peserta Pelatihan</h4>
                      <p>Tercatat {selectedSession.participants.length} personel pada sesi training ini</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="participants-count-tag">
                        <Users size={13} /> {selectedSession.participants.length} Orang
                      </span>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openEditSessionMode(selectedSession)}
                        title="Tambah, edit status, atau hapus peserta"
                      >
                        <UserPlus size={13} /> Kelola Peserta
                      </button>
                    </div>
                  </div>

                  {/* Participants Table */}
                  <div className="cal-table-scroll">
                    <table className="data-table cal-participants-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>No</th>
                          <th style={{ width: '90px' }}>NIK</th>
                          <th>Nama Karyawan</th>
                          <th>Section</th>
                          <th>Jabatan</th>
                          <th style={{ width: '120px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSession.participants.map((p, idx) => (
                          <tr key={p.nik}>
                            <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                            <td>{p.section}</td>
                            <td>{p.jabatan}</td>
                            <td>
                              <span
                                className={`badge ${p.status === 'SELESAI' ? 'badge-selesai' : p.status === 'TERJADWAL' ? 'badge-upcoming' : p.status === 'DALAM PROSES' ? 'badge-ongoing' : 'badge-belum'}`}
                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer - Sticky at bottom */}
            <div
              className="drilldown-modal-actions"
              style={{
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.5rem',
                flexShrink: 0,
                position: 'sticky',
                bottom: 0,
                zIndex: 25,
                boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.06)'
              }}
            >
              {isEditingSession ? (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => {
                        setIsEditingSession(false);
                        setEditError(null);
                        setShowDeleteConfirm(false);
                      }}
                      disabled={editSaving}
                    >
                      Batal Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={editSaving}
                    >
                      <Trash2 size={14} /> Hapus Sesi
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveSessionEdit}
                    disabled={editSaving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={16} /> {editSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Sesi'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-light"
                      onClick={closeSessionModal}
                    >
                      Tutup
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={() => openEditSessionMode(selectedSession)}
                    >
                      <Pencil size={14} /> Edit Sesi & Peserta
                    </button>
                    {selectedSession.statusCategory !== 'completed' && onCompleteSession && (
                      <button
                        className="btn btn-success"
                        onClick={async () => {
                          await onCompleteSession(selectedSession);
                          closeSessionModal();
                        }}
                        title="Tandai seluruh peserta pada sesi ini selesai dan sinkronkan checklist matrix"
                      >
                        <CheckCircle2 size={15} /> Selesaikan Sesi Ini
                      </button>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      closeSessionModal();
                      onNavigateToRecords(
                        selectedSession.moduleName,
                        selectedSession.startDate,
                        selectedSession.finishDate
                      );
                    }}
                  >
                    <GraduationCap size={15} /> Buka di Training Record
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DAY SESSIONS LIST MODAL (When clicking a day with multiple sessions) */}
      {selectedDaySessions && (
        <div className="mini-data-modal-overlay" onClick={() => setSelectedDaySessions(null)}>
          <div
            className="mini-data-modal drilldown-modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '640px', maxWidth: '95vw' }}
          >
            <div className="mini-data-header">
              <div>
                <span className="mini-data-kicker">AGENDA HARIAN</span>
                <h3>Jadwal Training · {formatDateIndo(selectedDaySessions.date)}</h3>
              </div>
              <button className="mini-data-close-btn" onClick={() => setSelectedDaySessions(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="cal-modal-content" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {selectedDaySessions.sessions.map(s => {
                  const st = getBadgeStyle(s.statusCategory);
                  return (
                    <div
                      key={s.id}
                      className="cal-day-session-card"
                      onClick={() => {
                        setSelectedDaySessions(null);
                        setSelectedSession(s);
                      }}
                    >
                      <div className="card-left">
                        <span className="pill-dot" style={{ backgroundColor: st.dot }} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <b style={{ fontSize: '0.95rem', color: '#0f172a' }}>{s.moduleName}</b>
                            {s.isMandatory && (
                              <span className="badge badge-mandatory" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                Mandatory
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px', fontSize: '0.73rem', color: '#64748b' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <CalendarDays size={12} /> {s.dateDisplay} ({s.durationDays} Hari)
                            </span>
                            {s.sessionTime && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#1e40af', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                                <Clock size={11} /> {s.sessionTime}
                              </span>
                            )}
                            {s.location && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <MapPin size={11} /> {s.location}
                              </span>
                            )}
                            {s.trainer && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <UserCheck size={11} /> {s.trainer}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="card-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={13} /> {s.participants.length} org
                        </span>
                        <span
                          style={{
                            backgroundColor: st.bg,
                            borderColor: st.border,
                            color: st.text,
                            border: '1px solid',
                            borderRadius: '10px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}
                        >
                          {st.label}
                        </span>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDaySessions(null);
                            setSelectedSession(s);
                            openEditSessionMode(s);
                          }}
                          title="Edit modul, status, dan peserta sesi ini"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <ArrowRight size={14} className="text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="drilldown-modal-actions" style={{ justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
              <button
                className="btn btn-light"
                onClick={() => setSelectedDaySessions(null)}
              >
                Tutup
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const d = selectedDaySessions.date;
                  setSelectedDaySessions(null);
                  setSchedStartDate(d);
                  setSchedFinishDate(d);
                  setIsScheduleModalOpen(true);
                }}
              >
                <Plus size={15} /> + Input Jadwal di Tanggal Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT SCHEDULE TRAINING MODAL (EXCEL UPLOAD & MANUAL) */}
      {isScheduleModalOpen && (
        <div className="mini-data-modal-overlay" onClick={() => !schedSaving && setIsScheduleModalOpen(false)}>
          <div
            className="mini-data-modal drilldown-modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '840px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div className="mini-data-header" style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <span className="mini-data-kicker">TRAINING SCHEDULER & SINKRONISASI AGENDA</span>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0 0' }}>
                  {scheduleModalTab === 'upload' ? (
                    <>
                      <FileSpreadsheet size={21} className="text-emerald-600" />
                      <span>Upload Data Excel Jadwal & Peserta Training</span>
                    </>
                  ) : (
                    <>
                      <CalendarDays size={21} className="text-purple-600" />
                      <span>Input Manual Jadwal Sesi Pelatihan</span>
                    </>
                  )}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Jadwal training dan peserta (NIK & Nama) yang dimasukkan akan otomatis tersinkronkan dan muncul di Kalender serta Daftar Agenda.
                </p>
              </div>
              <button className="mini-data-close-btn" onClick={() => !schedSaving && setIsScheduleModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Tab Switcher: Upload Excel vs Input Manual */}
            <div style={{ padding: '0.75rem 1.5rem 0' }}>
              <div className="cal-modal-tabs">
                <button
                  type="button"
                  className={`cal-modal-tab-btn ${scheduleModalTab === 'upload' ? 'active tab-excel' : ''}`}
                  onClick={() => setScheduleModalTab('upload')}
                >
                  <FileSpreadsheet size={16} />
                  <span>Upload File Excel (Jadwal & Peserta NIK-Nama)</span>
                </button>
                <button
                  type="button"
                  className={`cal-modal-tab-btn ${scheduleModalTab === 'manual' ? 'active tab-manual' : ''}`}
                  onClick={() => setScheduleModalTab('manual')}
                >
                  <Plus size={16} />
                  <span>Input Manual Sesi Training</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="cal-modal-content" style={{ padding: '0.5rem 1.5rem 1.25rem', overflowY: 'auto', flex: 1 }}>
              {/* TAB 1: UPLOAD DATA EXCEL */}
              {scheduleModalTab === 'upload' && (
                <div>
                  {/* Template Helper Banner */}
                  <div className="template-helper-banner">
                    <div className="template-helper-left">
                      <div className="template-helper-icon">
                        <FileText size={18} />
                      </div>
                      <div className="template-helper-text">
                        <h5>Format Kolom Template Excel (14 Kolom):</h5>
                        <p style={{ fontSize: '0.74rem', lineHeight: '1.45', color: '#475569' }}>
                          Gunakan kolom: <b>NIK</b>, <b>Name</b>, <b>Position</b>, <b>Section (Site)</b>, <b>Training Tittle</b>, <b>Training Method(In Class Training/Mentoring/OJI)</b>, <b>Start Date</b>, <b>Finish Date</b>, <b>Week</b>, <b>Duration</b>, <b>Training Method  (Face to Face / Online Delievery Training)</b>, <b>Section(L&D)</b>, <b>PIC (Trainer)</b>, <b>SITE</b>.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="template-download-btn"
                        onClick={downloadScheduleTemplate}
                        title="Unduh contoh file template Excel siap pakai (14 kolom)"
                      >
                        <Download size={14} /> Unduh Template Excel (14 Kolom)
                      </button>
                      {onClearAllSessions && history.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-light btn-sm"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
                          onClick={() => {
                            if (window.confirm(`Hapuskan seluruh ${history.length} sesi training yang ada sekarang? Kalender akan dikosongkan (0 sesi).`)) {
                              onClearAllSessions();
                            }
                          }}
                          title="Hapus total seluruh sesi training yang ada saat ini"
                        >
                          <Trash2 size={13} /> Kosongkan Sesi Lama ({history.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dropzone */}
                  {!parsedScheduleRows.length ? (
                    <div
                      className={`excel-upload-dropzone ${isDraggingFile ? 'dragover' : ''}`}
                      onDragOver={e => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDraggingFile(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleExcelScheduleUpload(file);
                      }}
                      onClick={() => {
                        if (excelFileInputRef.current) {
                          excelFileInputRef.current.value = '';
                          excelFileInputRef.current.click();
                        }
                      }}
                    >
                      <input
                        ref={excelFileInputRef}
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        style={{ display: 'none' }}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleExcelScheduleUpload(file);
                        }}
                      />
                      <div className="excel-drop-icon">
                        {excelBusy ? <Clock className="spin" size={24} /> : <FileUp size={24} />}
                      </div>
                      <div className="excel-drop-title">
                        {excelBusy ? 'Membaca & Memvalidasi File Excel...' : 'Tarik File Excel ke Sini atau Klik untuk Memilih'}
                      </div>
                      <div className="excel-drop-subtitle">
                        Mendukung format spreadsheet <b>.xlsx</b>, <b>.xls</b>, atau <b>.csv</b>. Peserta akan otomatis dicocokkan berdasarkan NIK dan Nama di database.
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669' }}
                        onClick={e => {
                          e.stopPropagation();
                          if (excelFileInputRef.current) {
                            excelFileInputRef.current.value = '';
                            excelFileInputRef.current.click();
                          }
                        }}
                      >
                        <FileSpreadsheet size={15} /> Pilih File Excel dari Komputer
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '1rem' }}>
                      {/* Summary Cards */}
                      {excelPreviewSummary && (
                        <div className="excel-summary-grid">
                          <div className="excel-summary-card">
                            <div className="excel-summary-val" style={{ color: '#047857' }}>
                              {excelPreviewSummary.totalRows}
                            </div>
                            <div className="excel-summary-lbl">Total Baris Jadwal</div>
                          </div>
                          <div className="excel-summary-card">
                            <div className="excel-summary-val" style={{ color: '#2563eb' }}>
                              {excelPreviewSummary.sessionsCount}
                            </div>
                            <div className="excel-summary-lbl">Sesi Training Terdeteksi</div>
                          </div>
                          <div className="excel-summary-card">
                            <div className="excel-summary-val" style={{ color: '#7c3aed' }}>
                              {excelPreviewSummary.uniqueParticipants}
                            </div>
                            <div className="excel-summary-lbl">Peserta Unik</div>
                          </div>
                          <div className="excel-summary-card">
                            <div className="excel-summary-val" style={{ color: '#0d9488' }}>
                              {excelPreviewSummary.matchedCount}
                            </div>
                            <div className="excel-summary-lbl">Cocok di Database MP</div>
                          </div>
                        </div>
                      )}

                      {/* Header bar of preview */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                          Preview Data Jadwal & Peserta ({parsedScheduleRows.length} baris):
                        </span>
                        <button
                          type="button"
                          className="text-link"
                          style={{ fontSize: '0.74rem', color: '#2563eb', cursor: 'pointer' }}
                          onClick={() => {
                            setParsedScheduleRows([]);
                            setExcelPreviewSummary(null);
                            setExcelFile(null);
                            setExcelError(null);
                            if (excelFileInputRef.current) excelFileInputRef.current.value = '';
                          }}
                        >
                          Ganti File Excel Lain
                        </button>
                      </div>

                      {/* Preview Table */}
                      <div className="excel-preview-wrap" style={{ maxHeight: '340px', overflowX: 'auto' }}>
                        <table className="excel-preview-table" style={{ minWidth: '1200px' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '38px', textAlign: 'center' }}>No</th>
                              <th>NIK</th>
                              <th>Name</th>
                              <th>Position</th>
                              <th>Section (Site)</th>
                              <th>Training Tittle</th>
                              <th>Training Method</th>
                              <th>Start - Finish Date</th>
                              <th>Week</th>
                              <th>Duration</th>
                              <th>Delivery Mode</th>
                              <th>Section(L&D)</th>
                              <th>PIC (Trainer)</th>
                              <th>SITE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedScheduleRows.map((r, i) => (
                              <tr key={i}>
                                <td style={{ color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                                <td>
                                  <code style={{ fontSize: '0.73rem', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{r.nik}</code>
                                </td>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td style={{ fontSize: '0.72rem', color: '#475569' }}>{r.position || r.jabatan || '-'}</td>
                                <td style={{ fontSize: '0.72rem', color: '#475569' }}>{r.sectionSite || r.section || '-'}</td>
                                <td>
                                  <b style={{ color: '#0f172a' }}>{r.moduleName}</b>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                    {r['Training Method(In Class Training/Mentoring/OJI)'] || r.trainingMethod || 'In Class Training'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.73rem' }}>
                                    {r.startDate}{r.startDate !== r.finishDate ? ` s/d ${r.finishDate}` : ''}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.week || r.Week || '-'}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.duration || r.Duration || '-'}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.7rem', color: '#334155' }}>
                                    {r['Training Method  (Face to Face / Online Delievery Training)'] || r.deliveryMethod || 'Face to Face'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.sectionLD || r['Section(L&D)'] || 'L&D'}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#047857' }}>
                                    {r.trainer || r['PIC (Trainer)'] || '-'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: '#f1f5f9', color: '#334155' }}>
                                    {r.site || r.SITE || 'GAM'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Feedback alerts */}
                  {excelError && (
                    <div className="notice error" style={{ margin: '0 0 1rem', fontSize: '0.78rem' }}>
                      <AlertCircle size={16} />
                      <div>
                        <b>Gagal membaca Excel:</b> {excelError}
                      </div>
                    </div>
                  )}

                  {excelSuccess && (
                    <div className="notice success" style={{ margin: '0 0 1rem', fontSize: '0.78rem' }}>
                      <CheckCircle size={16} />
                      <div>{excelSuccess}</div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INPUT MANUAL SESI */}
              {scheduleModalTab === 'manual' && (
                <div>
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    {/* Module */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                          Program Training <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        {onAddModule && (
                          <button
                            type="button"
                            onClick={() => setShowAddModuleModal(true)}
                            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                          >
                            + Tambah Modul Baru
                          </button>
                        )}
                      </div>
                      <select
                        value={schedModule}
                        onChange={e => {
                          if (e.target.value === '__NEW__') {
                            setShowAddModuleModal(true);
                          } else {
                            setSchedModule(e.target.value);
                          }
                        }}
                      >
                        <option value="">Pilih Program Training</option>
                        {allModules.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                        {onAddModule && <option value="__NEW__">➕ + Tambah Modul Baru...</option>}
                      </select>
                    </div>

                    {/* Target Database */}
                    <label>
                      Kelompok Database Peserta
                      <select
                        value={schedTarget}
                        onChange={e => {
                          setSchedTarget(e.target.value as any);
                          setSchedNiks([]);
                        }}
                      >
                        <option value="MP">Manpower (MP)</option>
                        <option value="Training Staff">Training Staff</option>
                        <option value="Keduanya">Keduanya (MP & Staff)</option>
                      </select>
                    </label>

                    {/* Start Date */}
                    <label>
                      Tanggal Mulai (Start) <span style={{ color: '#ef4444' }}>*</span>
                      <input
                        type="date"
                        value={schedStartDate}
                        onChange={e => {
                          const ns = e.target.value;
                          setSchedStartDate(ns);
                          if (schedFinishDate && ns > schedFinishDate) {
                            setSchedFinishDate(ns);
                          }
                        }}
                      />
                    </label>

                    {/* Finish Date */}
                    <label>
                      Tanggal Selesai (Finish) <span style={{ color: '#ef4444' }}>*</span>
                      <input
                        type="date"
                        value={schedFinishDate}
                        min={schedStartDate}
                        onChange={e => setSchedFinishDate(e.target.value)}
                      />
                    </label>

                    {/* Status */}
                    <label>
                      Status Sesi Pelatihan
                      <select value={schedStatus} onChange={e => setSchedStatus(e.target.value)}>
                        <option value="TERJADWAL">Terjadwal (Upcoming Schedule)</option>
                        <option value="DALAM PROSES">Dalam Proses / On Going</option>
                        <option value="SELESAI">Selesai (Completed Langsung)</option>
                        <option value="BELUM SELESAI">Belum Selesai</option>
                      </select>
                    </label>

                    {/* Sesi Training */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.8rem', color: '#334155' }}>
                        Sesi Training (Waktu Pelaksanaan)
                      </label>
                      <select
                        value={isCustomSchedSession ? '__CUSTOM__' : schedSessionTime}
                        onChange={e => {
                          if (e.target.value === '__CUSTOM__') {
                            setIsCustomSchedSession(true);
                            setCustomSchedSessionInput('');
                          } else {
                            setIsCustomSchedSession(false);
                            setSchedSessionTime(e.target.value);
                          }
                        }}
                      >
                        {SESSION_TIME_PRESETS.map(preset => (
                          <option key={preset} value={preset}>{preset}</option>
                        ))}
                      </select>
                      {isCustomSchedSession && (
                        <input
                          type="text"
                          placeholder="Ketik jam kustom (misal: 09:30 - 11:30)..."
                          value={customSchedSessionInput}
                          onChange={e => setCustomSchedSessionInput(e.target.value)}
                          style={{ marginTop: '5px' }}
                          autoFocus
                        />
                      )}
                    </div>

                    {/* Lokasi / Ruang */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.8rem', color: '#334155' }}>
                        Ruang / Lokasi Training
                      </label>
                      <select
                        value={isCustomSchedLocation ? '__CUSTOM__' : schedLocation}
                        onChange={e => {
                          if (e.target.value === '__CUSTOM__') {
                            setIsCustomSchedLocation(true);
                            setCustomSchedLocationInput('');
                          } else {
                            setIsCustomSchedLocation(false);
                            setSchedLocation(e.target.value);
                          }
                        }}
                      >
                        {LOCATION_PRESETS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      {isCustomSchedLocation && (
                        <input
                          type="text"
                          placeholder="Ketik nama ruangan atau lokasi..."
                          value={customSchedLocationInput}
                          onChange={e => setCustomSchedLocationInput(e.target.value)}
                          style={{ marginTop: '5px' }}
                          autoFocus
                        />
                      )}
                    </div>

                    {/* Trainer */}
                    <label>
                      Trainer / Instruktur (Opsional)
                      <input
                        type="text"
                        placeholder="Nama trainer / pengajar..."
                        value={schedTrainer}
                        onChange={e => setSchedTrainer(e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Date Duration & Quick Presets */}
                  <div className="training-date-helper-bar" style={{ marginBottom: '1.25rem' }}>
                    <div className="date-duration-info">
                      {schedStartDate && schedFinishDate && (
                        <span className="duration-badge single">
                          <CheckCircle2 size={13} /> Durasi: <b>{calculateDays(schedStartDate, schedFinishDate)} Hari Pelaksanaan</b> ({schedStartDate} s/d {schedFinishDate})
                        </span>
                      )}
                    </div>
                    <div className="date-presets">
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Set Durasi:</span>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => {
                          setSchedStartDate(todayStr);
                          setSchedFinishDate(todayStr);
                        }}
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => setSchedFinishDate(schedStartDate)}
                      >
                        1 Hari
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => setSchedFinishDate(addDays(schedStartDate || todayStr, 1))}
                      >
                        2 Hari (+1d)
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => setSchedFinishDate(addDays(schedStartDate || todayStr, 2))}
                      >
                        3 Hari (+2d)
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => setSchedFinishDate(addDays(schedStartDate || todayStr, 4))}
                      >
                        5 Hari (+4d)
                      </button>
                    </div>
                  </div>

                  {/* Participants Selection */}
                  <div className="participants-head" style={{ marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a' }}>Pilih Peserta Training</h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                        {schedNiks.length} peserta terpilih dari {eligiblePersonsForSched.length} personel
                      </p>
                    </div>
                    <div className="participant-actions">
                      <button type="button" className="text-link" onClick={handleSelectAllSched}>
                        {schedNiks.length === eligiblePersonsForSched.length && eligiblePersonsForSched.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </button>
                      <button type="button" className="text-link" onClick={() => setSchedNiks([])}>
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="search-box participant-search" style={{ marginBottom: '0.65rem' }}>
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Saring nama, NIK, atau section..."
                      value={schedParticipantSearch}
                      onChange={e => setSchedParticipantSearch(e.target.value)}
                    />
                  </div>

                  <div className="participants-list" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem' }}>
                    {eligiblePersonsForSched.map(p => {
                      const nik = String(p.NIK || p.nik || '').trim();
                      const name = String(p.NAME || p.Nama || p.name || 'Peserta').trim();
                      const sec = String(p.SECTION || p.Section || '-').trim();
                      const isChecked = schedNiks.includes(nik);

                      return (
                        <label key={nik} className={`participant-item ${isChecked ? 'selected' : ''}`} style={{ padding: '0.4rem 0.65rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSchedNik(nik)}
                          />
                          <span className="participant-avatar">{name.slice(0, 1).toUpperCase()}</span>
                          <span className="participant-info">
                            <b>{name}</b>
                            <small>{nik} · {sec} · {p.__target || schedTarget}</small>
                          </span>
                          {isChecked && <CheckCircle2 size={16} className="text-blue" />}
                        </label>
                      );
                    })}
                    {!eligiblePersonsForSched.length && (
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        Tidak ada peserta ditemukan.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="drilldown-modal-actions" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="btn btn-light"
                  disabled={schedSaving}
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Batal
                </button>
                {scheduleModalTab === 'upload' && parsedScheduleRows.length > 0 && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', color: '#1e293b', fontWeight: 600, userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={excelOverwriteMode}
                      onChange={e => setExcelOverwriteMode(e.target.checked)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <span>Gantikan total sesi sebelumnya (kosongkan data lama)</span>
                  </label>
                )}
              </div>

              {scheduleModalTab === 'upload' ? (
                <button
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', color: '#ffffff' }}
                  disabled={schedSaving || !parsedScheduleRows.length}
                  onClick={handleConfirmExcelImport}
                >
                  {schedSaving ? <Clock className="spin" size={15} /> : <CheckCircle size={15} />}
                  Sinkronkan {parsedScheduleRows.length ? `${parsedScheduleRows.length} ` : ''}Jadwal ke Kalender & Daftar Agenda
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={schedSaving || !schedModule || !schedNiks.length}
                  onClick={handleSaveScheduleSubmit}
                >
                  {schedSaving ? <Clock className="spin" size={15} /> : <CalendarIcon size={15} />}
                  Simpan Jadwal Training ({schedNiks.length} Peserta)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD MODULE MODAL INSIDE CALENDAR */}
      {showAddModuleModal && (
        <div className="mini-data-modal-overlay" onClick={() => setShowAddModuleModal(false)}>
          <div className="mini-data-modal" onClick={e => e.stopPropagation()} style={{ width: '440px' }}>
            <div className="mini-data-header">
              <div>
                <span className="mini-data-kicker">MODUL BARU</span>
                <h3>Tambah Program Training</h3>
              </div>
              <button className="mini-data-close-btn" onClick={() => setShowAddModuleModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
                Nama Program Training Baru:
              </label>
              <input
                type="text"
                className="input-text"
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                placeholder="Contoh: Defensive Driving, Rigging, dll."
                value={newModuleNameInput}
                onChange={e => setNewModuleNameInput(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && newModuleNameInput.trim()) {
                    if (onAddModule) onAddModule(newModuleNameInput.trim());
                    setSchedModule(newModuleNameInput.trim());
                    setNewModuleNameInput('');
                    setShowAddModuleModal(false);
                  }
                }}
              />
            </div>
            <div className="drilldown-modal-actions" style={{ padding: '0.85rem 1.25rem' }}>
              <button className="btn btn-light" onClick={() => setShowAddModuleModal(false)}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                disabled={!newModuleNameInput.trim()}
                onClick={() => {
                  if (onAddModule && newModuleNameInput.trim()) {
                    onAddModule(newModuleNameInput.trim());
                    setSchedModule(newModuleNameInput.trim());
                    setNewModuleNameInput('');
                    setShowAddModuleModal(false);
                  }
                }}
              >
                Simpan Modul
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: Agenda Card in Timeline view
const AgendaCard: React.FC<{
  session: TrainingSession;
  onSelect: () => void;
  onEdit?: () => void;
  onNavigate: () => void;
  onComplete?: () => void;
}> = ({ session, onSelect, onEdit, onNavigate, onComplete }) => {
  const [y, m, d] = session.startDate.split('-');
  const mIdx = parseInt(m, 10) - 1;
  const monthAbbr = MONTH_NAMES_ID[mIdx] ? MONTH_NAMES_ID[mIdx].slice(0, 3).toUpperCase() : m;

  let badgeClass = 'badge-selesai';
  let badgeText = 'Selesai';
  if (session.statusCategory === 'upcoming') {
    badgeClass = 'badge-upcoming';
    badgeText = 'Terjadwal (Upcoming)';
  } else if (session.statusCategory === 'ongoing') {
    badgeClass = 'badge-ongoing';
    badgeText = 'Sedang Berjalan';
  } else if (session.statusCategory === 'pending') {
    badgeClass = 'badge-belum';
    badgeText = 'Belum Selesai';
  }

  return (
    <div className="agenda-card panel">
      {/* Date Pill */}
      <div className="agenda-date-box">
        <span className="agenda-month">{monthAbbr}</span>
        <span className="agenda-day">{parseInt(d, 10)}</span>
        <span className="agenda-duration">{session.durationDays}H</span>
      </div>

      {/* Main Info */}
      <div className="agenda-card-body">
        <div className="agenda-title-row">
          <h4 onClick={onSelect} className="clickable-title">
            {session.moduleName}
          </h4>
          <div style={{ display: 'flex', gap: '6px' }}>
            {session.isMandatory && (
              <span className="badge badge-mandatory" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                Mandatory
              </span>
            )}
            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
              {badgeText}
            </span>
          </div>
        </div>

        <div className="agenda-dates-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <CalendarIcon size={12} className="text-blue" />
            <span>{session.dateDisplay}</span>
          </span>
          <span className="bullet-sep">·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={12} className="text-teal" />
            <span>{session.durationDays} Hari Pelaksanaan</span>
          </span>
          {session.sessionTime && (
            <>
              <span className="bullet-sep">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                <Clock size={11} /> {session.sessionTime}
              </span>
            </>
          )}
        </div>

        {(session.location || session.trainer) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.73rem', color: '#64748b', marginTop: '2px', flexWrap: 'wrap' }}>
            {session.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <MapPin size={11} style={{ color: '#d97706' }} />
                <span>{session.location}</span>
              </span>
            )}
            {session.location && session.trainer && <span className="bullet-sep">·</span>}
            {session.trainer && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <UserCheck size={11} style={{ color: '#059669' }} />
                <span>Trainer: <b>{session.trainer}</b></span>
              </span>
            )}
          </div>
        )}

        {/* Participants snippet */}
        <div className="agenda-participants-row">
          <div className="agenda-avatars">
            {session.participants.slice(0, 3).map(p => (
              <span key={p.nik} className="avatar-chip" title={`${p.name} (${p.section})`}>
                {p.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {session.participants.length > 3 && (
              <span className="avatar-more">+{session.participants.length - 3}</span>
            )}
          </div>
          <span className="agenda-participants-names">
            {session.participants.map(p => p.name).slice(0, 2).join(', ')}
            {session.participants.length > 2 && ` dan ${session.participants.length - 2} lainnya`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="agenda-card-actions">
        <button className="btn btn-light btn-sm" onClick={onSelect} title="Lihat detail sesi dan peserta">
          Detail
        </button>
        {onEdit && (
          <button
            className="btn btn-warning btn-sm"
            onClick={onEdit}
            title="Edit modul, status sesi, dan kelola peserta"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
        {session.statusCategory !== 'completed' && onComplete && (
          <button
            className="btn btn-outline-success btn-sm"
            onClick={onComplete}
            title="Tandai sesi ini sebagai selesai dan update status peserta"
          >
            <CheckCircle2 size={12} /> Selesai
          </button>
        )}
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={onNavigate}
          title="Buka form catatan training"
        >
          <GraduationCap size={13} /> Catat
        </button>
      </div>
    </div>
  );
};
