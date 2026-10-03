/** 7 → "07:00": the grid hours of the clinic's day (Nastavení › Kalendář) written as a time field wants them. */
export function hourToTime(hour: number): string {
  const h = Math.min(24, Math.max(0, Math.trunc(hour)));
  return `${String(h).padStart(2, '0')}:00`;
}
