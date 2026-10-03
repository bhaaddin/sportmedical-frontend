import { resolveSlot, useSiteContent } from '../api/siteContent';
import { DEFAULT_SITE_CONTENT } from './defaults';

/**
 * Several editable texts at once, one subscription: `const t = useSlotTexts(['formulare.a', 'formulare.b'])`,
 * then `t['formulare.a']`. The admin's wording, else the registry default (see src/site/slots/formulare.ts).
 */
export function useSlotTexts<K extends string>(keys: readonly K[]): Record<K, string> {
  const { data } = useSiteContent();
  const content = data ?? DEFAULT_SITE_CONTENT;
  const out = {} as Record<K, string>;
  for (const key of keys) out[key] = resolveSlot(content, key).text;
  return out;
}
