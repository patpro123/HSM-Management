import { useEffect, useRef } from 'react';
import './chat.css';
import { ChatUserRole } from './chatTypes';
import { useChatSession } from './useChatSession';
import { MessageList } from './MessageList';
import { QuickReplyChips } from './QuickReplyChips';
import { ChatInput } from './ChatInput';
import { CleffAvatar } from './CleffAvatar';

interface ChatPanelProps {
  isOpen: boolean;
  userRole: ChatUserRole;
  userName?: string;
  onClose: () => void;
}

const ROLE_TAGLINES: Record<ChatUserRole, string> = {
  admin:   'Maestro · Music school command centre',
  teacher: 'Your backstage pass to HSM',
  student: 'Your musical journey tracker',
  parent:  "Your child's musical diary",
};

export function ChatPanel({ isOpen, userRole, userName, onClose }: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { state, sendMessage, sendChip, saveAttendance, dismissError, setInputValue } = useChatSession(userRole, userName);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (isOpen) {
      el.classList.add('chat-panel--open');
    } else {
      el.classList.remove('chat-panel--open');
    }
  }, [isOpen]);

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
        background: 'linear-gradient(135deg, #1b1307 0%, #2d2110 100%)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <CleffAvatar size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f3c13a', letterSpacing: 0.5 }}>Cleff</div>
          <div style={{ fontSize: 11, color: '#f3c13a', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
            {ROLE_TAGLINES[userRole]}
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#f3c13a', lineHeight: 1, padding: 4 }}
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
