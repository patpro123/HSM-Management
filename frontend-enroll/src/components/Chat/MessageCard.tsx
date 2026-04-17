import { QuickReplyChip } from './chatTypes';

interface MessageCardProps {
  title: string;
  subtitle?: string;
  fields?: Array<{ label: string; value: string | number; highlight?: boolean }>;
  actions?: QuickReplyChip[];
  onActionSelect?: (value: string) => void;
}

export function MessageCard({ title, subtitle, fields, actions, onActionSelect }: MessageCardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border, #e5e0d5)',
      borderRadius: 12,
      padding: '12px 14px',
      width: '100%',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #1b1307)', marginBottom: subtitle ? 2 : 6 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--muted, #8a7d65)', marginBottom: 8 }}>
          {subtitle}
        </div>
      )}
      {fields && fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: actions?.length ? 10 : 0 }}>
          {fields.map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: 'var(--muted, #8a7d65)' }}>{f.label}</div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: f.highlight ? 'var(--accent-strong, #ff904e)' : 'var(--text, #1b1307)',
              }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => onActionSelect?.(a.value)}
              type="button"
              style={{
                background: 'rgba(243,193,58,0.15)',
                border: '1px solid var(--accent, #f3c13a)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text, #1b1307)',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
