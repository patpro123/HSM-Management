interface TypingIndicatorProps {
  visible: boolean;
}

export function TypingIndicator({ visible }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 4 }}>
      <div style={{
        background: '#fff',
        border: '1px solid var(--border, #e5e0d5)',
        borderRadius: '0 12px 12px 12px',
        padding: '12px 16px',
        display: 'flex',
        gap: 5,
        alignItems: 'center',
      }}>
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
