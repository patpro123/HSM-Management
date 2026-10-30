interface AreaPillProps {
  icon: string;
  label: string;
  onSwitch: () => void;
  onClear: () => void;
}

// Shows the area the conversation is in. Tap to switch area; × leaves the area.
export function AreaPill({ icon, label, onSwitch, onClear }: AreaPillProps) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0, height: 34, borderRadius: 17,
        background: '#1b1307', color: '#f3c13a', fontSize: 13, fontWeight: 700,
      }}
    >
      <button
        type="button"
        onClick={onSwitch}
        aria-label={`Area: ${label}. Tap to switch`}
        style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', padding: '0 4px 0 12px', height: '100%', cursor: 'pointer' }}
      >
        {icon} {label} ▾
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Leave this area"
        style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', padding: '0 10px 0 4px', height: '100%', cursor: 'pointer', opacity: 0.8 }}
      >
        ×
      </button>
    </span>
  );
}
