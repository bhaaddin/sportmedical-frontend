import { useDevice } from '../../layout/useDevice';

/*
 * A finger needs 44 px (brief, rule 3). Phone and tablet are both touch
 * devices, so both get it; the desktop keeps the board's 40 px buttons.
 */
export const TOUCH_MIN = 44;

export function useTouchSx(): { minHeight?: number } {
  return useDevice() === 'desktop' ? {} : { minHeight: TOUCH_MIN };
}
