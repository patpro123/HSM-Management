import { useEffect, useMemo, useState } from 'react';
import {
  AttendanceStatus, Counts, StatusRow, SubmitBar, stripStyle, nextStatus, saveAttendanceRecords,
} from './attendanceUi';

export interface HistoryRow {
  batch_id: string;
  date: string;
  day: string;
  label: string;
  status: AttendanceStatus | null;
  editable: boolean;
}

interface AttendanceHistoryProps {
  studentId: string;
  rows: HistoryRow[];
  onDirtyChange?: (changes: number) => void;
  onSaved: (rows: HistoryRow[], text: string) => void;
}

const keyOf = (r: HistoryRow) => `${r.batch_id}|${r.date}`;

// One student across several days: one line per class, tap a row to change it.
export function AttendanceHistory({ studentId, rows, onDirtyChange, onSaved }: AttendanceHistoryProps) {
  const [saved, setSaved] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(rows.map(r => [keyOf(r), r.status])));
  const [current, setCurrent] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(rows.map(r => [keyOf(r), r.status])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => rows
    .filter(r => current[keyOf(r)] && current[keyOf(r)] !== saved[keyOf(r)])
    .map(r => ({ batch_id: r.batch_id, student_id: studentId, date: r.date, status: current[keyOf(r)] as AttendanceStatus })),
  [rows, current, saved, studentId]);

  useEffect(() => { onDirtyChange?.(changed.length); }, [changed.length, onDirtyChange]);

  const counts = { present: 0, absent: 0, excused: 0 };
  rows.forEach(r => { const st = current[keyOf(r)]; if (st) counts[st]++; });
  const anyEditable = rows.some(r => r.editable);

  const tap = (r: HistoryRow) => {
    if (!r.editable) return;
    setCurrent(prev => ({ ...prev, [keyOf(r)]: nextStatus(prev[keyOf(r)]) }));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveAttendanceRecords(changed);
      const next = { ...saved };
      changed.forEach(c => { next[`${c.batch_id}|${c.date}`] = c.status; });
      setSaved(next);
      onSaved(rows.map(r => ({ ...r, status: next[keyOf(r)] ?? r.status })),
        `Saved ✓ ${changed.length} change${changed.length === 1 ? '' : 's'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={stripStyle}><Counts {...counts} /></div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {rows.map(r => (
          <StatusRow
            key={keyOf(r)}
            name={r.day}
            detail={r.label}
            status={current[keyOf(r)]}
            disabled={!r.editable}
            onTap={() => tap(r)}
          />
        ))}
      </div>

      {anyEditable
        ? <SubmitBar changes={changed.length} saving={saving} error={error} onSubmit={submit} />
        : <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', fontSize: 12, color: 'var(--muted, #8a7d65)', borderTop: '1px solid var(--border, #e5e0d5)' }}>
            View only — teachers can mark today's classes.
          </div>}
    </div>
  );
}
