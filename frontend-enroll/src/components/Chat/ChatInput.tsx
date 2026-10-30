import { KeyboardEvent, useEffect, useRef } from 'react';

interface ChatInputProps {
  /** Shows a menu button to the left of the field */
  onMenu?: () => void;
  /** Changing this to a new non-zero value focuses the field */
  focusSignal?: number;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** A reply is in flight: sending is blocked, but the field stays focused so the keyboard doesn't close */
  disabled?: boolean;
  /** The on-screen keyboard is up, so the home-indicator padding isn't needed */
  keyboardOpen?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, disabled, keyboardOpen, onMenu, focusSignal, placeholder = 'Type a message…' }: ChatInputProps) {
  const canSend = !disabled && value.trim().length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border, #e5e0d5)',
      padding: `8px 10px ${keyboardOpen ? '8px' : 'calc(8px + env(safe-area-inset-bottom))'}`,
      display: 'flex',
      gap: 8,
      background: '#fff',
      flexShrink: 0,
    }}>
      {onMenu && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onMenu}
          aria-label="Open menu"
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            background: '#fffbf0', border: '1.5px solid var(--accent, #f3c13a)', color: 'var(--text, #1b1307)',
          }}
        >
          ☰
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.slice(0, 500))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        enterKeyHint="send"
        autoComplete="off"
        aria-label="Message Cleff"
        style={{
          flex: 1,
          minWidth: 0,
          border: '1px solid var(--border, #e5e0d5)',
          borderRadius: 22,
          padding: '10px 16px',
          // 16px stops iOS Safari zooming the page when the field is focused
          fontSize: 16,
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 150ms',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #f3c13a)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e0d5)'; }}
      />
      <button
        // keep focus in the field when tapping Send so the keyboard stays open
        onMouseDown={e => e.preventDefault()}
        onClick={onSend}
        disabled={!canSend}
        type="button"
        style={{
          width: 44,
          height: 44,
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
