import { useState } from 'react';
import { apiPost } from '../../api';
import { WhatsAppMessage } from './chatTypes';

// A composed message waiting to be sent: shows the text and opens WhatsApp with it prefilled.
// Tapping Send also writes an audit row; the message itself is sent from the user's own WhatsApp.
export function MessageWhatsApp({ message }: { message: WhatsAppMessage }) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const onSend = () => {
    setSent(true);
    apiPost('/api/whatsapp/initiated', {
      student_id: message.studentId, kind: message.kind, text: message.text, phone: message.to,
    }).catch(() => { /* the audit row is best effort; WhatsApp still opens */ });
  };

  const copy = () => {
    navigator.clipboard?.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard blocked: the text is selectable above */ });
  };

  const btn: React.CSSProperties = {
    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none', textAlign: 'center', minHeight: 36, display: 'inline-flex', alignItems: 'center',
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderRadius: 12, padding: '12px 14px', width: '100%' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{message.heading}</div>
      <div style={{ fontSize: 12, color: 'var(--muted, #8a7d65)', marginBottom: 8 }}>
        {message.to ? `To +${message.to}` : 'No number on file: you choose the contact'}
      </div>
      <div style={{
        background: '#e7f7dc', borderRadius: '10px 10px 10px 2px', padding: '10px 12px', fontSize: 13,
        lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text',
      }}>{message.text}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <a href={message.link} target="_blank" rel="noopener noreferrer" onClick={onSend}
          style={{ ...btn, background: '#25D366', color: '#fff', border: 'none' }}>
          {sent ? 'Open WhatsApp again' : 'Send on WhatsApp'}
        </a>
        <button type="button" onClick={copy}
          style={{ ...btn, background: '#fff', color: 'var(--text, #1b1307)', border: '1px solid var(--border, #e5e0d5)' }}>
          {copied ? 'Copied' : 'Copy text'}
        </button>
      </div>
    </div>
  );
}
