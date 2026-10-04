/** Money and short dates for the order screens. The amounts always come from the server. */
const NBSP = ' ';

export const formatCzk = (amount: number): string => `${Math.round(amount).toLocaleString('cs-CZ')}${NBSP}Kč`;

/** "26. 10." — "27. 10." for a range, a single date when it is one day; with the daily window when present. */
export function rangeLine(r: { fromDate: string; toDate: string; dailyFrom?: string | null; dailyTo?: string | null }): string {
  const day = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return `${dd}. ${m}. ${y}`;
  };
  const days = r.fromDate === r.toDate ? day(r.fromDate) : `${day(r.fromDate)} – ${day(r.toDate)}`;
  const window = r.dailyFrom && r.dailyTo ? `, ${r.dailyFrom}–${r.dailyTo}` : '';
  return `${days}${window}`;
}
