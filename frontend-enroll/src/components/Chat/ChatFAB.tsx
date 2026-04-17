import { CleffAvatar } from './CleffAvatar';

interface ChatFABProps {
  isOpen: boolean;
  unreadNudgeCount: number;
  onClick: () => void;
}

export function ChatFAB({ isOpen, unreadNudgeCount, onClick }: ChatFABProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={unreadNudgeCount > 0 && !isOpen ? 'chat-fab--nudge' : ''}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--accent-strong, #ff904e)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(255,144,78,0.45)',
        zIndex: 1000,
        transition: 'transform 150ms ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <CleffAvatar size={36} />
      )}
      {unreadNudgeCount > 0 && !isOpen && (
        <div style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#e74c3c',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {unreadNudgeCount > 9 ? '9+' : unreadNudgeCount}
        </div>
      )}
    </button>
  );
}
