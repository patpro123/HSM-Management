import { apiPost } from '../../api';

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface AttendanceRecord {
  batch_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
}

export interface AttendanceSaveResult {
  saved: number;
  present: number;
  absent: number;
  excused: number;
}

// Tap order: Present -> Absent -> Excused -> Present
const NEXT: Record<AttendanceStatus, AttendanceStatus> = { present: 'absent', absent: 'excused', excused: 'present' };
export const nextStatus = (s: AttendanceStatus | null): AttendanceStatus => (s ? NEXT[s] : 'present');

const LOOK: Record<AttendanceStatus, { label: string; bg: string; fg: string }> = {
  present: { label: '✓ Present', bg: '#d4edda', fg: '#155724' },
  absent: { label: '✗ Absent', bg: '#f8d7da', fg: '#721c24' },
  excused: { label: '~ Excused', bg: '#fff3cd', fg: '#7a5b00' },
};

// One student/class per row. The whole row is the tap target (44px tall, full width); the pill
// on the right only shows the state.
export function StatusRow({ name, detail, status, disabled, onTap }: {
  name: string; detail?: string; status: AttendanceStatus | null; disabled?: boolean; onTap: () => void;
}) {
  const look = status ? LOOK[status] : { label: '—', bg: '#eee9dd', fg: '#8a7d65' };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
        onTap();
      }}
      aria-label={`${name}: ${status ?? 'not marked'}${disabled ? '' : '. Tap to change'}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
        minHeight: 44, padding: '0 12px', background: '#fff', border: 'none',
        borderBottom: '1px solid var(--border, #e5e0d5)', textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'rgba(243,193,58,0.25)',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15, fontWeight: 600, color: 'var(--text, #1b1307)' }}>
        {name}
        {detail && <span style={{ fontWeight: 400, color: 'var(--muted, #8a7d65)' }}> {detail}</span>}
      </span>
      <span style={{
        minWidth: 86, textAlign: 'center', padding: '5px 10px', borderRadius: 14, fontWeight: 700, fontSize: 12,
        background: look.bg, color: look.fg, flexShrink: 0, opacity: disabled ? 0.7 : 1,
      }}>
        {look.label}
      </span>
    </button>
  );
}

export function Counts({ present, absent, excused }: { present: number; absent: number; excused: number }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--muted, #8a7d65)' }}>
      ✓ {present} · ✗ {absent}{excused ? ` · ~ ${excused}` : ''}
    </span>
  );
}

// Sticky footer of the attendance layer: stays above the home indicator.
export function SubmitBar({ changes, saving, error, onSubmit }: {
  changes: number; saving: boolean; error: string | null; onSubmit: () => void;
}) {
  const off = saving || changes === 0;
  return (
    <div style={{ flexShrink: 0, padding: '8px 12px calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border, #e5e0d5)', background: '#fff' }}>
      {error && <div role="alert" style={{ fontSize: 12, color: '#721c24', marginBottom: 6 }}>{error}</div>}
      <button
        type="button"
        onClick={onSubmit}
        disabled={off}
        style={{
          width: '100%', height: 46, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15,
          background: 'var(--accent-strong, #ff904e)', color: '#1b1307',
          opacity: off ? 0.5 : 1, cursor: off ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : changes === 0 ? 'No changes to submit' : `Submit ${changes}`}
      </button>
    </div>
  );
}

export async function saveAttendanceRecords(records: AttendanceRecord[]): Promise<AttendanceSaveResult> {
  return apiPost('/api/chat/attendance', { records });
}

export const groupHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
  minHeight: 36, padding: '0 12px', background: '#faf7ef', border: 'none',
  borderBottom: '1px solid var(--border, #e5e0d5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
};

export const stripStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0,
  padding: '6px 12px', borderBottom: '1px solid var(--border, #e5e0d5)',
};

export const smallButtonStyle: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 15, border: '1px solid var(--accent, #f3c13a)',
  background: '#fffbf0', fontSize: 12, fontWeight: 700, color: 'var(--text, #1b1307)', cursor: 'pointer',
};

export const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderRadius: 12, padding: '8px 10px', width: '100%',
};
