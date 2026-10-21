/*
 * Words the shelf pages share. Small and import-free (apart from a type), so a screen can use them without loading the
 * peek card's api modules.
 */
import type { ChipTone } from '../../components/ui';

/** The booking statuses in words (the names the day lists and the cards already use). */
export const APPOINTMENT_STATUS_WORD: Record<string, { label: string; tone: ChipTone }> = {
  Scheduled: { label: 'Naplánováno', tone: 'grey' },
  Confirmed: { label: 'Potvrzeno', tone: 'green' },
  CheckedIn: { label: 'Přišel', tone: 'green' },
  Completed: { label: 'Hotovo', tone: 'grey' },
  Cancelled: { label: 'Zrušeno', tone: 'red' },
  NoShow: { label: 'Nepřišel', tone: 'red' },
};
