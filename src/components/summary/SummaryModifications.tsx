'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompletedBlock } from '@/lib/types';

interface Modification {
  id: string;
  label: string;
  checked: boolean;
  blockId: string;
  type: 'update_duration' | 'remove';
  newDuration?: number;
}

interface SummaryModificationsProps {
  completedBlocks: CompletedBlock[];
  onSave: (modifications: { blockId: string; newDuration?: number; remove?: boolean }[]) => void;
  onKeepAsIs: () => void;
  saving: boolean;
}

export function SummaryModifications({
  completedBlocks,
  onSave,
  onKeepAsIs,
  saving,
}: SummaryModificationsProps) {
  // Build modification suggestions
  const initialMods: Modification[] = [];

  completedBlocks.forEach((block) => {
    if (block.type !== 'exercise') return;

    if (block.time_added_secs > 0) {
      initialMods.push({
        id: `update_${block.block_id}`,
        label: `Update ${block.exercise_name} to ${block.actual_duration_secs}s (+${block.time_added_secs}s)`,
        checked: true,
        blockId: block.block_id,
        type: 'update_duration',
        newDuration: block.actual_duration_secs,
      });
    }

    if (block.skipped) {
      initialMods.push({
        id: `remove_${block.block_id}`,
        label: `Remove ${block.exercise_name}`,
        checked: true,
        blockId: block.block_id,
        type: 'remove',
      });
    }
  });

  const [modifications, setModifications] = useState(initialMods);

  if (modifications.length === 0) return null;

  const toggleMod = (id: string) => {
    setModifications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const handleSave = () => {
    const selected = modifications
      .filter((m) => m.checked)
      .map((m) => ({
        blockId: m.blockId,
        newDuration: m.type === 'update_duration' ? m.newDuration : undefined,
        remove: m.type === 'remove' ? true : undefined,
      }));
    onSave(selected);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
        Save Changes to Routine?
      </h3>

      <div className="space-y-2">
        {modifications.map((mod) => (
          <label
            key={mod.id}
            className="flex items-start gap-3 py-1.5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={mod.checked}
              onChange={() => toggleMod(mod.id)}
              className="mt-0.5 rounded border-border bg-bg-elevated accent-accent"
            />
            <span className="text-sm text-fg-muted">{mod.label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          className="flex-1 !py-2.5 !text-xs"
        >
          Save Changes
        </Button>
        <Button
          variant="secondary"
          onClick={onKeepAsIs}
          className="flex-1 !py-2.5 !text-xs"
        >
          Keep As-Is
        </Button>
      </div>
    </div>
  );
}
