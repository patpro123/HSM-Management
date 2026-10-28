import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { AttendanceStatus, DailyAttendanceBatch, DailyAttendanceResponse } from '../types';

interface DailyAttendanceViewProps {
  mode: 'admin' | 'teacher';
  // Preselects the teacher filter (e.g. admin opening a teacher's 360 view)
  initialTeacherId?: string;
  onSaved?: () => void;
}

const ALL = 'all';

const STATUS_BUTTONS: { value: AttendanceStatus; short: string; label: string; active: string; idle: string }[] = [
  { value: 'present', short: 'P', label: 'Present', active: 'bg-emerald-500 text-white border-emerald-500', idle: 'hover:bg-emerald-50' },
  { value: 'absent',  short: 'A', label: 'Absent',  active: 'bg-red-500 text-white border-red-500',         idle: 'hover:bg-red-50' },
  { value: 'excused', short: 'E', label: 'Excused', active: 'bg-amber-500 text-white border-amber-500',     idle: 'hover:bg-amber-50' },
];

// Local calendar date (toISOString would shift to UTC and show yesterday before 05:30 IST)
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftDate = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toLocalDateStr(new Date(y, m - 1, d + days));
};

const formatDateLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};

const keyOf = (batchId: string, studentId: string) => `${batchId}::${studentId}`;

const DailyAttendanceView: React.FC<DailyAttendanceViewProps> = ({ mode, initialTeacherId, onSaved }) => {
  const today = toLocalDateStr(new Date());
  const [date, setDate] = useState(today);
  const [batches, setBatches] = useState<DailyAttendanceBatch[]>([]);
  const [viewerTeacherId, setViewerTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // null until the first load tells us who the viewer is
  const [teacherFilter, setTeacherFilter] = useState<string | null>(initialTeacherId ?? (mode === 'admin' ? ALL : null));
  const [search, setSearch] = useState('');
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Each tap saves immediately. Rows with a save in flight are locked so taps can't race.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const onSavedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = async (forDate: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const res: DailyAttendanceResponse = await apiGet(`/api/attendance/by-date?date=${forDate}`);
      setBatches(res.batches || []);
      setViewerTeacherId(res.viewer_teacher_id);
      setTeacherFilter(prev => prev ?? res.viewer_teacher_id ?? ALL);
    } catch (err: any) {
      setBatches([]);
      setLoadError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    load(date);
  }, [date]);

  useEffect(() => () => clearTimeout(onSavedTimer.current), []);

  const changeDate = (next: string) => {
    if (!next || next === date) return;
    setDate(next);
  };

  // Teachers who have batches on the loaded date, viewer first
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    batches.forEach(b => { if (b.teacher_id) map.set(b.teacher_id, b.teacher_name || 'Unassigned'); });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.id === viewerTeacherId ? -1 : b.id === viewerTeacherId ? 1 : a.name.localeCompare(b.name)));
  }, [batches, viewerTeacherId]);

  type Change = { batch_id: string; student_id: string; status: AttendanceStatus | null };

  const applyChanges = (changes: Change[]) => {
    const byKey = new Map(changes.map(c => [keyOf(c.batch_id, c.student_id), c.status]));
    setBatches(prev => prev.map(b => ({
      ...b,
      students: b.students.map(s => {
        const key = keyOf(b.batch_id, s.student_id);
        return byKey.has(key) ? { ...s, status: byKey.get(key)! } : s;
      }),
    })));
  };

  const markKeys = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, keys: string[], on: boolean) =>
    setter(prev => {
      const next = new Set(prev);
      keys.forEach(k => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  // Optimistically shows the new statuses, saves them, and rolls back on failure
  const saveStatuses = async (changes: (Change & { previous: AttendanceStatus | null; is_guest: boolean })[]) => {
    if (changes.length === 0) return;
    const keys = changes.map(c => keyOf(c.batch_id, c.student_id));
    setError('');
    applyChanges(changes);
    markKeys(setPending, keys, true);
    try {
      const marks = changes.filter(c => c.status);
      const clears = changes.filter(c => !c.status);
      if (marks.length > 0) {
        await apiPost('/api/attendance', {
          records: marks.map(c => ({
            batch_id: c.batch_id, student_id: c.student_id, date, status: c.status, is_extra: false, is_guest: c.is_guest,
          })),
        });
      }
      await Promise.all(clears.map(c =>
        apiDelete(`/api/attendance?batch_id=${c.batch_id}&student_id=${c.student_id}&date=${date}`)
      ));
      markKeys(setJustSaved, keys, true);
      setTimeout(() => markKeys(setJustSaved, keys, false), 1500);
      // Debounced so rapid taps don't each trigger a full parent refresh
      clearTimeout(onSavedTimer.current);
      onSavedTimer.current = setTimeout(() => onSaved?.(), 2000);
    } catch (err: any) {
      applyChanges(changes.map(c => ({ ...c, status: c.previous })));
      setError(`Not saved: ${err.message || 'failed to save attendance'}. Please tap again.`);
    } finally {
      markKeys(setPending, keys, false);
    }
  };

  // Tapping the active status again removes the saved record (back to "Not marked")
  const setStatus = (batchId: string, student: DailyAttendanceBatch['students'][number], status: AttendanceStatus) => {
    if (pending.has(keyOf(batchId, student.student_id))) return;
    const next = student.status === status ? null : status;
    saveStatuses([{ batch_id: batchId, student_id: student.student_id, status: next, previous: student.status, is_guest: student.is_guest }]);
  };

  const markBatch = (batch: DailyAttendanceBatch, status: AttendanceStatus) => {
    const targets = batch.students.filter(s => s.status !== status && !pending.has(keyOf(batch.batch_id, s.student_id)));
    if (targets.length === 0) return;
    if (!window.confirm(`Mark ${targets.length} student${targets.length === 1 ? '' : 's'} in ${batch.instrument_name} as ${status}?`)) return;
    saveStatuses(targets.map(s => ({ batch_id: batch.batch_id, student_id: s.student_id, status, previous: s.status, is_guest: s.is_guest })));
  };

  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (name: string) => !searchLower || name.toLowerCase().includes(searchLower);

  const applyFilters = (teacher: string | null) =>
    batches
      .filter(b => showUnscheduled || b.scheduled)
      .filter(b => !teacher || teacher === ALL || b.teacher_id === teacher)
      .map(b => ({ ...b, students: b.students.filter(s => matchesSearch(s.student_name)) }))
      .filter(b => b.students.length > 0);

  const visibleBatches = applyFilters(teacherFilter);

  // When a search finds nothing under the current teacher, hint at matches elsewhere
  const otherMatches = searchLower && teacherFilter !== ALL
    ? applyFilters(ALL).reduce((n, b) => n + b.students.length, 0) - visibleBatches.reduce((n, b) => n + b.students.length, 0)
    : 0;

  const counts = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  visibleBatches.forEach(b => b.students.forEach(s => {
    if (s.status) counts[s.status]++; else counts.unmarked++;
  }));

  const unscheduledCount = batches.filter(b => !b.scheduled).length;

  const isOwnBatch = (b: DailyAttendanceBatch) => mode === 'admin' || !viewerTeacherId || b.teacher_id === viewerTeacherId;

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(shiftDate(date, -1))}
            className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-lg"
            aria-label="Previous day"
          >‹</button>
          <input
            type="date"
            value={date}
            onChange={e => changeDate(e.target.value)}
            className="h-11 flex-1 min-w-0 px-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
          <button
            onClick={() => changeDate(shiftDate(date, 1))}
            className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-lg"
            aria-label="Next day"
          >›</button>
          {date !== today && (
            <button
              onClick={() => changeDate(today)}
              className="h-11 px-3 shrink-0 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100"
            >Today</button>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-700">{formatDateLabel(date)}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={teacherFilter ?? ALL}
            onChange={e => setTeacherFilter(e.target.value)}
            className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          >
            <option value={ALL}>All teachers</option>
            {teacherOptions.map(t => (
              <option key={t.id} value={t.id}>
                {t.id === viewerTeacherId ? `My students (${t.name})` : t.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student…"
            className="h-11 w-full px-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
        </div>

        {mode === 'teacher' && teacherFilter !== ALL && teacherFilter !== viewerTeacherId && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You're marking another teacher's students. Records will note that you marked them on their behalf.
          </p>
        )}

        {unscheduledCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showUnscheduled} onChange={e => setShowUnscheduled(e.target.checked)} className="h-4 w-4" />
            Include batches not scheduled on this day ({unscheduledCount})
          </label>
        )}
      </div>

      {/* ── Summary ── */}
      {!loading && visibleBatches.length > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {([
            ['Present', counts.present, 'bg-emerald-50 text-emerald-800 border-emerald-200'],
            ['Absent', counts.absent, 'bg-red-50 text-red-800 border-red-200'],
            ['Excused', counts.excused, 'bg-amber-50 text-amber-800 border-amber-200'],
            ['Unmarked', counts.unmarked, 'bg-slate-50 text-slate-700 border-slate-200'],
          ] as const).map(([label, n, cls]) => (
            <div key={label} className={`border rounded-lg py-2 ${cls}`}>
              <div className="text-xl font-bold leading-tight">{n}</div>
              <div className="text-[11px] font-medium uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Batches ── */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{loadError}</div>
      ) : visibleBatches.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <p className="text-slate-500 text-sm">
            {searchLower ? 'No students match your search.' : 'No classes scheduled for this selection.'}
          </p>
          {otherMatches > 0 && (
            <button onClick={() => setTeacherFilter(ALL)} className="text-sm font-semibold text-indigo-600 hover:underline">
              Show {otherMatches} match{otherMatches === 1 ? '' : 'es'} under other teachers
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {otherMatches > 0 && (
            <button onClick={() => setTeacherFilter(ALL)} className="text-sm font-semibold text-indigo-600 hover:underline">
              + {otherMatches} more match{otherMatches === 1 ? '' : 'es'} under other teachers
            </button>
          )}
          {visibleBatches.map(batch => (
            <div key={batch.batch_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className={`px-3 sm:px-4 py-3 border-b ${isOwnBatch(batch) ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {batch.time_slot && <span className="text-indigo-600 mr-1.5">{batch.time_slot}</span>}
                      {batch.instrument_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {batch.teacher_name || 'No teacher'}
                      {!batch.scheduled && ' · not scheduled today'}
                    </p>
                    {!isOwnBatch(batch) && (
                      <span className="inline-block mt-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Covering for {batch.teacher_name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => markBatch(batch, 'present')}
                    className="shrink-0 h-9 px-3 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
                  >✓ All present</button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {batch.students.map(s => {
                  const key = keyOf(batch.batch_id, s.student_id);
                  const isPending = pending.has(key);
                  return (
                    <li key={s.student_id} className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm sm:text-base truncate">{s.student_name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {s.is_guest && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Out of turn</span>}
                          {isPending ? (
                            <span className="text-[10px] text-indigo-600">Saving…</span>
                          ) : justSaved.has(key) ? (
                            <span className="text-[10px] text-emerald-600 font-medium">✓ Saved</span>
                          ) : !s.status && (
                            <span className="text-[10px] text-slate-400">Not marked</span>
                          )}
                        </div>
                      </div>
                      <div className={`flex gap-1.5 shrink-0 ${isPending ? 'opacity-60' : ''}`}>
                        {STATUS_BUTTONS.map(btn => (
                          <button
                            key={btn.value}
                            onClick={() => setStatus(batch.batch_id, s, btn.value)}
                            disabled={isPending}
                            title={btn.label}
                            aria-pressed={s.status === btn.value}
                            className={`h-11 min-w-[2.75rem] px-2 sm:px-3 rounded-lg border text-sm font-semibold transition ${
                              s.status === btn.value ? `${btn.active} shadow-sm` : `bg-white text-slate-600 border-slate-200 ${btn.idle}`
                            }`}
                          >
                            <span className="sm:hidden">{btn.short}</span>
                            <span className="hidden sm:inline">{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── Save error (sits above the admin mobile bottom nav so it's seen mid-list) ── */}
      {error && (
        <div className={`sticky ${mode === 'admin' ? 'bottom-20 md:bottom-4' : 'bottom-4'} z-40`}>
          <div className="flex items-start gap-2 bg-red-600 text-white rounded-xl shadow-lg px-4 py-3 text-sm">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="font-bold" aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyAttendanceView;
