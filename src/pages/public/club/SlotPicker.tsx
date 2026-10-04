/* Shared types and text-slot keys of the free-slot loading state (the term calendar renders the slots). */
export type SlotsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export const SLOT_PICKER_KEYS = [
  'formulare.club-reg.slots.nearest',
  'formulare.club-reg.slots.other',
  'formulare.club-reg.slots.empty',
  'formulare.club-reg.slots.failed',
] as const;
