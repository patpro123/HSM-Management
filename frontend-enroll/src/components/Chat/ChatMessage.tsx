import { useEffect, useRef } from 'react';
import { ChatMessageUnion, AttendancePickerResult } from './chatTypes';
import { MessageCard } from './MessageCard';
import { MessageConfirm } from './MessageConfirm';
import { AttendancePicker } from './AttendancePicker';

interface ChatMessageProps {
  message: ChatMessageUnion;
  onChipSelect?: (value: string) => void;
  onAttendanceSave?: (result: AttendancePickerResult) => void;
}

export function ChatMessage({ message, onChipSelect, onAttendanceSave }: ChatMessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isUser = message.sender === 'user';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('chat-msg--enter');
    requestAnimationFrame(() => {
      el.classList.add('chat-msg--visible');
      el.classList.remove('chat-msg--enter');
    });
  }, []);

  const timestamp = new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const bubbleStyle: React.CSSProperties = isUser
    ? {
        background: '#1a6cf5',
        color: '#fff',
        border: 'none',
        borderRadius: '12px 0 12px 12px',
        padding: '10px 14px',
        maxWidth: '80%',
        fontSize: 14,
        lineHeight: 1.45,
        wordBreak: 'break-word',
      }
    : {
        background: '#fff',
        color: 'var(--text, #1b1307)',
        border: '1px solid var(--border, #e5e0d5)',
        borderRadius: '0 12px 12px 12px',
        padding: '10px 14px',
        maxWidth: '85%',
        fontSize: 14,
        lineHeight: 1.45,
        wordBreak: 'break-word',
      };

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return <div style={bubbleStyle}>{message.text}</div>;

      case 'card':
        return (
          <MessageCard
            title={message.title}
            subtitle={message.subtitle}
            fields={message.fields}
            actions={message.actions}
            onActionSelect={onChipSelect}
          />
        );

      case 'list':
        return (
          <div style={{ ...bubbleStyle, padding: 0, overflow: 'hidden' }}>
            {message.heading && (
              <div style={{ padding: '10px 14px 6px', fontWeight: 700, fontSize: 13 }}>{message.heading}</div>
            )}
            {message.items.map((item, i) => (
              <div
                key={i}
                onClick={() => onChipSelect?.(item.value)}
                style={{
                  padding: '8px 14px',
                  borderBottom: i < message.items.length - 1 ? '1px solid var(--border, #e5e0d5)' : 'none',
                  cursor: 'pointer',
                  background: '#fff',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg, #fffdf4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1b1307)' }}>{item.primary}</div>
                {item.secondary && <div style={{ fontSize: 11, color: 'var(--muted, #8a7d65)' }}>{item.secondary}</div>}
              </div>
            ))}
          </div>
        );

      case 'confirm':
        return (
          <MessageConfirm
            summary={message.summary}
            fields={message.fields}
            onConfirm={() => onChipSelect?.(`__confirm__:${message.actionId}`)}
            onCancel={() => onChipSelect?.('__cancel__')}
          />
        );

      case 'attendance-picker':
        return (
          <AttendancePicker
            batchId={message.batchId}
            batchLabel={message.batchLabel}
            sessionDate={message.sessionDate}
            students={message.students}
            onSave={result => onAttendanceSave?.(result)}
            onCancel={() => onChipSelect?.('Cancel attendance')}
          />
        );

      case 'nudge':
        return (
          <div style={{
            background: '#fff9e6',
            border: '1px solid var(--accent, #f3c13a)',
            borderRadius: 20,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}>
            <span>🔔</span>
            <span style={{ flex: 1 }}>{message.text}</span>
            <button
              onClick={() => onChipSelect?.(message.actionHint)}
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--accent-strong, #ff904e)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              View
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {renderContent()}
      <span style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{timestamp}</span>
    </div>
  );
}
