/*
 * "Vyžaduje pozornost" on Činnosti: an active činnost with no price-list link has no price (a price is read through the link,
 * never stored here), so the desk quotes nothing for it. Each case opens Ceník, where the link is made. `null` when all are priced.
 */
import type { AttentionGroup } from '../../ui/shelf/attention';

export function activitiesAttention(
  activities: readonly { id: string; name: string; isActive: boolean; priceCzk: number | null }[],
): AttentionGroup | null {
  const unpriced = activities.filter((a) => a.isActive && a.priceCzk === null);
  if (unpriced.length === 0) return null;
  return {
    id: 'scheduleProblems',
    severity: 'medium',
    title: 'Činnost bez ceny',
    count: unpriced.length,
    items: unpriced.slice(0, 5).map((a) => ({
      id: a.id,
      title: `„${a.name}“`,
      detail: 'Nemá cenu v ceníku.',
      to: '/nastaveni/cenik',
    })),
    summary: unpriced.length === 1 ? 'Jedna činnost nemá cenu.' : `${unpriced.length} činností nemá cenu.`,
    action: { label: 'Doplnit ceny', to: '/nastaveni/cenik' },
  };
}
