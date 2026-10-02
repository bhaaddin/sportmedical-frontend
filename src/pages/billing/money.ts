/*
 * Money the way the board writes it: "2 200 Kč". Whole crowns stay whole;
 * a payment with haléře keeps them ("2 200,50 Kč"). One formatter, so a
 * price on the Ceník, a KPI on Fakturace and a row on the Pokladna agree.
 */
export function czk(amount: number | null | undefined): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  return `${value.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kč`;
}

/** "26. 10. 2026" from an ISO instant; an unparseable value stays blank. */
export function czDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('cs-CZ');
}
