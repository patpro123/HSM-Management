import { useEffect, useRef } from 'react';
import { ChatMessageUnion, ChatUserRole, AttendancePickerResult, getRoleDefaultChips } from './chatTypes';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessageUnion[];
  isTyping: boolean;
  userRole: ChatUserRole;
  onChipSelect: (value: string) => void;
  onAttendanceSave: (result: AttendancePickerResult) => void;
  onDefaultChipSelect: (value: string) => void;
}

export function MessageList({ messages, isTyping, userRole, onChipSelect, onAttendanceSave, onDefaultChipSelect }: MessageListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isTyping]);

  const isEmpty = messages.length === 0;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px 12px 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: '#f7f5ef',
    }}>
      {isEmpty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', gap: 16 }}>
          <div style={{ fontSize: 36 }}>🎵</div>
          <div style={{ fontSize: 14, color: 'var(--muted, #8a7d65)', textAlign: 'center' }}>
            How can I help you today?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {getRoleDefaultChips(userRole).map((chip, i) => (
              <button
                key={i}
                className="chat-chip"
                onClick={() => onDefaultChipSelect(chip.value)}
                type="button"
              >
                {chip.icon ? `${chip.icon} ` : ''}{chip.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onChipSelect={onChipSelect}
            onAttendanceSave={onAttendanceSave}
          />
        ))
      )}
      <TypingIndicator visible={isTyping} />
      <div ref={sentinelRef} />
    </div>
  );
}
