'use client';

import { EXERCISE_CHIPS } from '@/lib/types';

interface ChipSelectorProps {
  selected: string[];
  onChange: (chips: string[]) => void;
  chips?: readonly string[];
}

export function ChipSelector({
  selected,
  onChange,
  chips = EXERCISE_CHIPS,
}: ChipSelectorProps) {
  const toggle = (chip: string) => {
    if (selected.includes(chip)) {
      onChange(selected.filter((c) => c !== chip));
    } else {
      onChange([...selected, chip]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = selected.includes(chip);
        return (
          <button
            key={chip}
            type="button"
            onClick={() => toggle(chip)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium
              transition-colors border
              ${
                active
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-elevated text-fg-muted border-border hover:border-fg-subtle'
              }
            `}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
