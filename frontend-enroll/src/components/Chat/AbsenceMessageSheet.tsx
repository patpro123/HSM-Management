import { useEffect, useState } from 'react';
import { apiPost } from '../../api';
import { MessageWhatsApp } from './MessageWhatsApp';

type Prepared = React.ComponentProps<typeof MessageWhatsApp>['message'];

export interface AbsenceTarget { studentId: string; studentName: string; batchId: string; date: string }

// Bottom sheet that writes the "we missed you" WhatsApp message for one absent student and shows
// it to send. Shared by the Attendance tab and the chat's roll-call and history cards.
export function AbsenceMessageSheet({ target, onClose }: { target: AbsenceTarget; onClose: () => void }) {
  const [message, setMessage] = useState<Prepared | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    apiPost('/api/attendance/absence-message', { student_id: target.studentId, batch_id: target.batchId, date: target.date })
      .then(res => {
        const m = res.message;
        if (live) setMessage({ heading: `Message for ${target.studentName}'s family`, studentId: m.student_id, kind: m.kind, to: m.to || '', text: m.text, link: m.link });
      })
      .catch((err: Error) => { if (live) setError(err.message || 'Could not prepare the message'); });
    return () => { live = false; };
  }, [target.studentId, target.batchId, target.date, target.studentName]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 12 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', background: '#faf7ef', borderRadius: 16, padding: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {message ? <MessageWhatsApp message={message} />
          : error ? <p role="alert" style={{ fontSize: 13, color: '#721c24', background: '#f8d7da', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{error}</p>
          : <p style={{ fontSize: 13, color: 'var(--muted, #8a7d65)', textAlign: 'center', padding: '20px 0', margin: 0 }}>Writing the message for {target.studentName}…</p>}
        <button type="button" onClick={onClose}
          style={{ width: '100%', height: 40, marginTop: 8, border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--muted, #8a7d65)', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  );
}
