import { useState } from 'react';

interface MessageConfirmProps {
  summary: string;
  fields: Array<{ label: string; value: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MessageConfirm({ summary, fields, onConfirm, onCancel }: MessageConfirmProps) {
  const [disabled, setDisabled] = useState(false);

  const handleConfirm = () => {
    setDisabled(true);
    onConfirm();
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border, #e5e0d5)',
      borderLeft: '3px solid var(--accent-strong, #ff904e)',
      borderRadius: 8,
      padding: 12,
      width: '100%',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{summary}</div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: 'var(--muted, #8a7d65)' }}>{f.label}:</span>
          <span style={{ fontWeight: 600 }}>{f.value}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={handleConfirm}
          disabled={disabled}
          type="button"
          style={{
            flex: 1,
            background: 'var(--accent-strong, #ff904e)',
            color: '#1b1307',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontWeight: 700,
            fontSize: 13,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          type="button"
          style={{
            flex: 1,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: '8px 12px',
            fontWeight: 600,
            fontSize: 13,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
