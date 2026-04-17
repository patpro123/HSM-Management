import { KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, disabled, placeholder = 'Type a message…' }: ChatInputProps) {
  const canSend = !disabled && value.trim().length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border, #e5e0d5)',
      padding: '10px 12px',
      display: 'flex',
      gap: 8,
      background: '#fff',
      flexShrink: 0,
    }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.slice(0, 500))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1,
          border: '1px solid var(--border, #e5e0d5)',
          borderRadius: 22,
          padding: '10px 16px',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 150ms',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #f3c13a)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e0d5)'; }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        type="button"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--accent-strong, #ff904e)',
          border: 'none',
          cursor: canSend ? 'pointer' : 'default',
          opacity: canSend ? 1 : 0.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'opacity 150ms',
        }}
        aria-label="Send"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
