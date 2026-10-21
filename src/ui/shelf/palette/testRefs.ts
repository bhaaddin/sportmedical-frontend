/* Test helper: a patient ref as the palette's context holds it. */
import type { RecentEntry } from '../memory';

export const memoryRef = (id: string, label: string): RecentEntry => ({ kind: 'patient', id, label, at: 1 });
