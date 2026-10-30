import { Counts, cardStyle } from './attendanceUi';

interface AttendanceSummaryProps {
  title: string;
  present: number;
  absent: number;
  excused: number;
  editable: boolean;
  onOpen: () => void;
}

// What stays in the chat for a roll-call or student history: one compact card that reopens
// the full-height attendance layer.
export function AttendanceSummary({ title, present, absent, excused, editable, onOpen }: AttendanceSummaryProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, minWidth: 0 }}>{title}</div>
        <Counts present={present} absent={absent} excused={excused} />
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{
          width: '100%', height: 40, marginTop: 8, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
          background: 'var(--accent-strong, #ff904e)', color: '#1b1307', cursor: 'pointer',
        }}
      >
        {editable ? 'Open to mark ›' : 'Open ›'}
      </button>
    </div>
  );
}
