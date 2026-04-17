import { useEffect, useRef } from 'react';
import './chat.css';
import { ChatUserRole } from './chatTypes';
import { useChatSession } from './useChatSession';
import { MessageList } from './MessageList';
import { QuickReplyChips } from './QuickReplyChips';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  isOpen: boolean;
  userRole: ChatUserRole;
  onClose: () => void;
}

export function ChatPanel({ isOpen, userRole, onClose }: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { state, sendMessage, sendChip, saveAttendance, dismissError, setInputValue } = useChatSession(userRole);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (isOpen) {
      el.classList.add('chat-panel--open');
    } else {
      el.classList.remove('chat-panel--open');
    }
  }, [isOpen]);

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  return (
    <div
      ref={panelRef}
      className="chat-panel"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        width: 'min(380px, calc(100vw - 16px))',
        height: 'min(560px, calc(100vh - 100px))',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent, #f3c13a) 0%, var(--accent-strong, #ff904e) 100%)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}>
          🎵
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1b1307' }}>HSM Assistant</div>
          <div style={{ fontSize: 11, color: '#1b1307', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
            {roleLabel} mode
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1b1307', lineHeight: 1, padding: 4 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Error banner */}
      {state.error && (
        <div style={{
          background: '#fdf0f0',
          borderBottom: '1px solid #f5c6c6',
          padding: '8px 14px',
          fontSize: 12,
          color: '#721c24',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span>{state.error}</span>
          <button onClick={dismissError} type="button" style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#721c24' }}>×</button>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={state.messages}
        isTyping={state.isTyping}
        userRole={userRole}
        onChipSelect={(value) => sendMessage(value)}
        onAttendanceSave={saveAttendance}
        onDefaultChipSelect={(value) => sendMessage(value)}
      />

      {/* Quick-reply chips */}
      <QuickReplyChips
        chips={state.chips}
        onSelect={sendChip}
        disabled={state.isTyping}
      />

      {/* Input */}
      <ChatInput
        value={state.inputValue}
        onChange={setInputValue}
        onSend={() => {
          if (state.inputValue.trim()) sendMessage(state.inputValue);
        }}
        disabled={state.isTyping}
      />
    </div>
  );
}
