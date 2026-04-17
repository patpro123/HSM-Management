import { useState } from 'react';
import { QuickReplyChip } from './chatTypes';

interface QuickReplyChipsProps {
  chips: QuickReplyChip[];
  onSelect: (chip: QuickReplyChip) => void;
  disabled?: boolean;
}

export function QuickReplyChips({ chips, onSelect, disabled }: QuickReplyChipsProps) {
  const [usedIndex, setUsedIndex] = useState<number | null>(null);

  if (!chips.length) return null;

  const handleSelect = (chip: QuickReplyChip, index: number) => {
    if (disabled || usedIndex !== null) return;
    setUsedIndex(index);
    setTimeout(() => onSelect(chip), 150);
  };

  return (
    <div
      className="chat-chips-row"
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        gap: 8,
        padding: '8px 12px',
      }}
    >
      {chips.slice(0, 4).map((chip, i) => (
        <button
          key={i}
          className={[
            'chat-chip',
            disabled ? 'chat-chip--disabled' : '',
            usedIndex !== null ? 'chat-chip--used' : '',
          ].join(' ')}
          onClick={() => handleSelect(chip, i)}
          type="button"
        >
          {chip.icon ? `${chip.icon} ` : ''}{chip.label}
        </button>
      ))}
    </div>
  );
}
