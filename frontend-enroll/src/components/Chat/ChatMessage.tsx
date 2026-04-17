import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessageUnion, AttendancePickerResult } from './chatTypes';
import { MessageCard } from './MessageCard';
import { MessageChart } from './MessageChart';
import { MessageConfirm } from './MessageConfirm';
import { AttendancePicker } from './AttendancePicker';
import { CleffAvatar } from './CleffAvatar';

interface ChatMessageProps {
  message: ChatMessageUnion;
  onChipSelect?: (value: string) => void;
  onAttendanceSave?: (result: AttendancePickerResult) => void;
}

function toWhatsAppText(message: ChatMessageUnion): string | null {
  switch (message.type) {
    case 'text':
      return message.text;

    case 'card':
      return [
        `*${message.title}*`,
        ...message.fields.map(f => `${f.label}: ${f.value}`),
      ].join('\n');

    case 'list':
      return [
        message.heading ? `*${message.heading}*` : '',
        ...message.items.map(item =>
          item.secondary ? `• ${item.primary} — ${item.secondary}` : `• ${item.primary}`
        ),
      ].filter(Boolean).join('\n');

    case 'chart':
      return [
        `*${message.title}*`,
        ...message.data.map(row => {
          const label = String(row[message.xKey] ?? '');
          const vals = message.series.map(s => `${s.label}: ${row[s.key]}`).join(', ');
          return `• ${label} — ${vals}`;
        }),
      ].join('\n');

    case 'nudge':
      return message.text;

    default:
      return null;
  }
}

export function ChatMessage({ message, onChipSelect, onAttendanceSave }: ChatMessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isUser = message.sender === 'user';
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('chat-msg--enter');
    requestAnimationFrame(() => {
      el.classList.add('chat-msg--visible');
      el.classList.remove('chat-msg--enter');
    });
  }, []);

  const handleCopy = useCallback(() => {
    const text = toWhatsAppText(message);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message]);

  const copyable = !isUser && toWhatsAppText(message) !== null &&
    !['confirm', 'attendance-picker'].includes(message.type);

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

      case 'chart':
        return (
          <MessageChart
            title={message.title}
            chartType={message.chartType}
            data={message.data}
            xKey={message.xKey}
            series={message.series}
          />
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

  const isStructured = ['list', 'card', 'chart'].includes(message.type);

  return (
    <div
      ref={ref}
      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: isStructured && !isUser ? '100%' : undefined }}>
        {/* Cleff avatar for bot messages */}
        {!isUser && <div style={{ flexShrink: 0, marginTop: 2 }}><CleffAvatar size={28} /></div>}

        <div style={{ position: 'relative', flex: isStructured ? 1 : undefined, maxWidth: isUser ? '80%' : isStructured ? undefined : '85%' }}>
          {renderContent()}
          {copyable && (hovered || copied) && (
            <button
              onClick={handleCopy}
              title="Copy for WhatsApp"
              type="button"
              style={{
                position: 'absolute',
                bottom: -22,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: copied ? '#e8f5e9' : '#fff',
                border: `1px solid ${copied ? '#4caf50' : 'var(--border, #e5e0d5)'}`,
                borderRadius: 10,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                color: copied ? '#388e3c' : 'var(--muted, #8a7d65)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'all 0.15s',
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          )}
        </div>
      </div>
      <span style={{ fontSize: 10, color: '#999', marginTop: copied || hovered ? 28 : 4, marginLeft: isUser ? 0 : 36, transition: 'margin-top 0.15s' }}>
        {timestamp}
      </span>
    </div>
  );
}
