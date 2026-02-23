'use client';

import { useState, useRef, useEffect } from 'react';
import { EXERCISE_CHIPS } from '@/lib/types';

interface ChipSelectorProps {
  selected: string[];
  onChange: (chips: string[]) => void;
  chips?: readonly string[];
  onAddTag?: (tag: string) => Promise<void>;
}

export function ChipSelector({
  selected,
  onChange,
  chips = EXERCISE_CHIPS,
  onAddTag,
}: ChipSelectorProps) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const toggle = (chip: string) => {
    if (selected.includes(chip)) {
      onChange(selected.filter((c) => c !== chip));
    } else {
      onChange([...selected, chip]);
    }
  };

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!onAddTag) {
      setAdding(false);
      return;
    }
    if (!tag) {
      setNewTag('');
      setAdding(false);
      return;
    }
    if (chips.includes(tag)) {
      setNewTag('');
      setAdding(false);
      return;
    }
    try {
      await onAddTag(tag);
      onChange([...selected, tag]);
      setNewTag('');
      setAdding(false);
    } catch {
      setAdding(false);
    }
  };

  const displayChips = [...new Set([...chips, ...selected])];

  return (
    <div className="flex flex-wrap gap-2">
      {displayChips.map((chip) => {
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
      {onAddTag && (
        <>
          {adding ? (
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') {
                  setNewTag('');
                  setAdding(false);
                }
              }}
              onBlur={handleAddTag}
              placeholder="New tag"
              className="w-20 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-elevated text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-elevated text-fg-muted border border-dashed border-border hover:border-fg-subtle hover:text-foreground transition-colors"
            >
              + tag
            </button>
          )}
        </>
      )}
    </div>
  );
}
