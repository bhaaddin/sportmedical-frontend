/*
 * "Připnuté a nedávné" - the person's own shelf: what they pinned, then what they opened last. Kept in their browser
 * (memory.ts: ids and display labels only, per account, recents forgotten after 30 days) and drawn as entity cards, so a
 * click goes straight back to the patient, club or invoice they were working on.
 *
 * `PinButton` is the one control that pins: it sits on a card or in a page header and says what it does.
 */
import { useSyncExternalStore } from 'react';
import { Box, Button, IconButton } from '@mui/material';
import { PushPin, PushPinOutlined } from '@mui/icons-material';
import { usePermissions } from '../../auth/usePermission';
import { formatPragueTime, pragueDateKey } from '../../utils/time';
import { mayOpen, type EntityKind, type EntityRef } from './entities';
import {
  clearRecents, getMemory, getServerMemory, isPinned, recentsWithoutPins, subscribeMemory, togglePinned, MAX_PINNED,
} from './memory';
import { EntityCard } from './ShelfCard';
import { Shelf } from './Shelf';
import { TARGET_SX } from './shelfStyle';

/** "dnes 9:15", "včera", "před 3 dny", "14. 10." - how long ago, in words. */
export function whenWords(at: number, now: Date = new Date()): string {
  const day = pragueDateKey(new Date(at));
  const today = pragueDateKey(now);
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return `dnes ${formatPragueTime(new Date(at))}`;
  if (days === 1) return 'včera';
  if (days < 5) return `před ${days} dny`;
  const [, m, d] = day.split('-').map(Number);
  return `${d}. ${m}.`;
}

export function useShelfMemory() {
  return useSyncExternalStore(subscribeMemory, getMemory, getServerMemory);
}

/** Pins or unpins one entity. A full pin shelf says so instead of failing silently. */
export function PinButton({ entity, size = 40 }: { entity: EntityRef; size?: number }) {
  const memory = useShelfMemory();
  const pinned = isPinned(memory, entity);
  const full = !pinned && memory.pinned.length >= MAX_PINNED;
  const Icon = pinned ? PushPin : PushPinOutlined;
  const label = pinned ? `Odepnout: ${entity.label}` : full ? `Nelze připnout, už je připnuto ${MAX_PINNED}` : `Připnout: ${entity.label}`;
  return (
    <IconButton
      size="small"
      aria-label={label}
      aria-pressed={pinned}
      disabled={full}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePinned(entity); }}
      sx={{ width: Math.max(size, 44), height: Math.max(size, 44), color: pinned ? 'primary.main' : 'text.secondary', '@media (min-width: 1280px)': { width: size, height: size } }}
    >
      <Icon sx={{ fontSize: 18 }} />
    </IconButton>
  );
}

export function RecentAndPinned({
  limit = 8, emptyAction, kinds, dense = false, title = 'Připnuté a nedávné', hint = 'Co jste naposledy otevřeli',
}: {
  limit?: number;
  emptyAction?: { label: string; to: string };
  /** Show only these kinds (the register shows patients). */
  kinds?: readonly EntityKind[];
  /** One-line cards: for a page where this shelf is context, not content. */
  dense?: boolean;
  title?: string;
  hint?: string;
}) {
  const memory = useShelfMemory();
  const held = usePermissions();
  const open = (e: EntityRef) => mayOpen(e.kind, held) && (kinds === undefined || kinds.includes(e.kind));
  const pinned = memory.pinned.filter(open);
  const recent = recentsWithoutPins(memory).filter(open);
  const shown = [...pinned.map((e) => ({ e, pinned: true, at: e.at })), ...recent.map((e) => ({ e, pinned: false, at: e.at }))].slice(0, limit);

  return (
    <Shelf
      id="recents"
      title={title}
      hint={hint}
      count={pinned.length + recent.length}
      layout="row"
      minCardWidth={dense ? 204 : 236}
      cardHeight={dense ? 48 : 132}
      empty={shown.length === 0}
      emptyState={{ text: 'Zatím tu nic není. Otevřete pacienta nebo klub a najdete ho tady; připnout ho můžete špendlíkem.', action: emptyAction !== undefined ? { label: emptyAction.label, to: emptyAction.to } : undefined }}
      controls={recent.length > 0 ? <Button size="small" onClick={clearRecents} sx={{ ...TARGET_SX, fontSize: 13, color: 'text.secondary' }}>Vymazat historii</Button> : undefined}
    >
      {shown.map(({ e, pinned: isPin, at }) => (
        <EntityCard
          key={`${e.kind}:${e.id}`}
          entity={e}
          dense={dense}
          subtitle={isPin ? 'Připnuto' : `Otevřeno ${whenWords(at)}`}
          trailing={<Box sx={dense ? { mr: -0.5 } : { mt: -0.75, mr: -0.75 }}><PinButton entity={e} /></Box>}
        />
      ))}
    </Shelf>
  );
}

export default RecentAndPinned;
