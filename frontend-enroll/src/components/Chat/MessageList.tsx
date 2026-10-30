import { useCallback, useEffect, useRef, useState } from 'react';
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
  onOpenWork?: (messageId: string) => void;
  compact?: boolean;
  /** Changing this value scrolls to the latest message */
  bottomSignal?: number;
}

// Within this distance of the bottom counts as "reading the latest message"
const NEAR_BOTTOM_PX = 80;
// Replies this tall are read from their top, not their bottom
const TALL_TYPES = new Set(['list', 'card', 'chart', 'attendance_roll', 'attendance_history']);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function MessageList({ messages, isTyping, userRole, onChipSelect, onAttendanceSave, onDefaultChipSelect, onOpenWork, compact, bottomSignal }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastIdRef = useRef<string | null>(messages[messages.length - 1]?.id ?? null);
  const [showNew, setShowNew] = useState(false);

  const behavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: behavior() });
    stickRef.current = true;
    setShowNew(false);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    stickRef.current = near;
    if (near) setShowNew(false);
  };

  // New message: your own always goes to the bottom; a tall reply starts at its top; anything
  // else follows only if you were already at the bottom, otherwise "New" appears.
  useEffect(() => {
    const el = scrollRef.current;
    const last = messages[messages.length - 1];
    if (!el || !last || last.id === lastIdRef.current) return;
    lastIdRef.current = last.id;

    if (last.sender === 'user') { toBottom(); return; }
    if (TALL_TYPES.has(last.type)) {
      const node = el.querySelector<HTMLElement>(`[data-msg-id="${last.id}"]`);
      if (node) {
        el.scrollTo({ top: Math.max(0, node.offsetTop - 8), behavior: behavior() });
        stickRef.current = false;
        return;
      }
    }
    if (stickRef.current) toBottom(); else setShowNew(true);
  }, [messages, toBottom]);

  useEffect(() => {
    if (isTyping && stickRef.current) toBottom();
  }, [isTyping, toBottom]);

  useEffect(() => {
    if (bottomSignal) toBottom();
  }, [bottomSignal, toBottom]);

  // Mount with the latest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: compact ? '10px 8px 4px' : '12px 12px 4px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 8 : 10,
          background: '#f7f5ef',
        }}
      >
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
              onOpenWork={onOpenWork}
              compact={compact}
            />
          ))
        )}
        <TypingIndicator visible={isTyping} />
      </div>

      {showNew && (
        <button
          type="button"
          onClick={toBottom}
          style={{
            position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)',
            height: 32, padding: '0 14px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 700,
            background: '#1b1307', color: '#f3c13a', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', cursor: 'pointer',
          }}
        >
          ↓ New
        </button>
      )}
    </div>
  );
}
