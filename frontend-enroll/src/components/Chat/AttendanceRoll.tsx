import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AttendanceStatus, Counts, StatusRow, SubmitBar, groupHeaderStyle, stripStyle, smallButtonStyle,
  nextStatus, saveAttendanceRecords,
} from './attendanceUi';

export interface RollStudent {
  student_id: string;
  name: string;
  status: AttendanceStatus | null;
  is_guest?: boolean;
}

export interface RollGroup {
  batch_id: string;
  label: string;
  students: RollStudent[];
}

interface AttendanceRollProps {
  date: string;
  editable: boolean;
  groups: RollGroup[];
  onDirtyChange?: (changes: number) => void;
  onSaved: (groups: RollGroup[], text: string) => void;
}

// Past this many students the classes start collapsed so the list stays short.
const COLLAPSE_ABOVE = 14;

const keyOf = (batchId: string, studentId: string) => `${batchId}|${studentId}`;

// Full-height roll-call: strip with totals, scrolling list, sticky Submit. Unmarked students
// start as Present; only new or changed rows are sent (re-sending "present" would message
// parents again).
export function AttendanceRoll({ date, editable, groups, onDirtyChange, onSaved }: AttendanceRollProps) {
  const [saved, setSaved] = useState<Record<string, AttendanceStatus | null>>(() => {
    const map: Record<string, AttendanceStatus | null> = {};
    groups.forEach(g => g.students.forEach(s => { map[keyOf(g.batch_id, s.student_id)] = s.status; }));
    return map;
  });
  const [current, setCurrent] = useState<Record<string, AttendanceStatus | null>>(() => {
    const map: Record<string, AttendanceStatus | null> = {};
    groups.forEach(g => g.students.forEach(s => { map[keyOf(g.batch_id, s.student_id)] = s.status ?? (editable ? 'present' : null); }));
    return map;
  });
  // What the screen showed when it opened (defaults included): leaving is only "unsaved" if the
  // user changed something from here
  const initial = useRef(current);
  const total = groups.reduce((n, g) => n + g.students.length, 0);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.batch_id, total <= COLLAPSE_ABOVE])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => groups.flatMap(g => g.students
    .filter(s => {
      const k = keyOf(g.batch_id, s.student_id);
      return current[k] && current[k] !== saved[k];
    })
    .map(s => ({ batch_id: g.batch_id, student_id: s.student_id, date, status: current[keyOf(g.batch_id, s.student_id)] as AttendanceStatus }))),
  [groups, current, saved, date]);

  const touched = Object.keys(current).filter(k => current[k] !== initial.current[k]).length;
  useEffect(() => { onDirtyChange?.(touched); }, [touched, onDirtyChange]);

  const tally = (rows: RollStudent[], batchId: string) => {
    const t = { present: 0, absent: 0, excused: 0 };
    rows.forEach(s => { const st = current[keyOf(batchId, s.student_id)]; if (st) t[st]++; });
    return t;
  };
  const all = groups.reduce((acc, g) => {
    const t = tally(g.students, g.batch_id);
    return { present: acc.present + t.present, absent: acc.absent + t.absent, excused: acc.excused + t.excused };
  }, { present: 0, absent: 0, excused: 0 });

  const tap = (batchId: string, studentId: string) => {
    if (!editable) return;
    const k = keyOf(batchId, studentId);
    setCurrent(prev => ({ ...prev, [k]: nextStatus(prev[k]) }));
  };

  const allPresent = () => setCurrent(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 'present'])));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveAttendanceRecords(changed);
      const next = { ...saved };
      changed.forEach(c => { next[keyOf(c.batch_id, c.student_id)] = c.status; });
      setSaved(next);
      initial.current = current;
      const updated = groups.map(g => ({
        ...g,
        students: g.students.map(s => ({ ...s, status: next[keyOf(g.batch_id, s.student_id)] ?? s.status })),
      }));
      onSaved(updated, `Saved ✓ ${res.present} present · ${res.absent} absent${res.excused ? ` · ${res.excused} excused` : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={stripStyle}>
        <Counts {...all} />
        {editable && <button type="button" style={smallButtonStyle} onClick={allPresent}>All present</button>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {groups.map(g => {
          const isOpen = open[g.batch_id];
          return (
            <div key={g.batch_id}>
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOpen(prev => ({ ...prev, [g.batch_id]: !prev[g.batch_id] }))}
                  style={groupHeaderStyle}
                  aria-expanded={isOpen}
                >
                  <span>{isOpen ? '▾' : '▸'} {g.label}</span>
                  <Counts {...tally(g.students, g.batch_id)} />
                </button>
              )}
              {isOpen && g.students.map(s => (
                <StatusRow
                  key={s.student_id}
                  name={s.name}
                  detail={s.is_guest ? '· guest' : undefined}
                  status={current[keyOf(g.batch_id, s.student_id)]}
                  disabled={!editable}
                  onTap={() => tap(g.batch_id, s.student_id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {editable
        ? <SubmitBar changes={changed.length} saving={saving} error={error} onSubmit={submit} />
        : <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', fontSize: 12, color: 'var(--muted, #8a7d65)', borderTop: '1px solid var(--border, #e5e0d5)' }}>
            View only — teachers can mark today's classes.
          </div>}
    </div>
  );
}
