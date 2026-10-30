import { ReactNode, useEffect, useState } from 'react';
import { QuickReplyChip } from './chatTypes';

interface QuickReplyChipsProps {
  chips: QuickReplyChip[];
  onSelect: (chip: QuickReplyChip) => void;
  disabled?: boolean;
  /** Always shown first in the row, e.g. the area pill */
  leading?: ReactNode;
}

// A scrollable row; the bot may offer up to a handful of options (batches, days, students).
const MAX_CHIPS = 8;

export function QuickReplyChips({ chips, onSelect, disabled, leading }: QuickReplyChipsProps) {
  const [usedIndex, setUsedIndex] = useState<number | null>(null);

  // A new set of chips starts fresh; without this the previous tap would hide every later chip.
  useEffect(() => { setUsedIndex(null); }, [chips]);

  if (!chips.length && !leading) return null;

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
        flexShrink: 0,
        background: '#fff',
        // fade the right edge to hint that the row scrolls
        WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
        maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
      }}
    >
      {leading}
      {chips.slice(0, MAX_CHIPS).map((chip, i) => (
        <button
          key={i}
          className={[
            'chat-chip',
            disabled ? 'chat-chip--disabled' : '',
            usedIndex === i ? 'chat-chip--used' : '',
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
