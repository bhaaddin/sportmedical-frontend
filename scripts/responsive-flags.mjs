/* The failure codes of one audit row - shared by responsive-summary.mjs and responsive-report.mjs. */
export function flags(r) {
  const f = [];
  if (r.fatal || !r.hasMain) { f.push('ERR'); return f; }
  if (r.docOverflow > 1 || (r.regionOverflowX ?? 0) > 1 || (r.overflowEls?.length ?? 0) > 0) f.push('OVF');
  if (r.docHeight > r.H + 1) f.push('SCR');
  if (r.W >= 768 && (r.regionScroll ?? 0) > 1) f.push('REG');
  if (r.gapL !== undefined) {
    if (Math.abs(r.gapL - r.gapR) > 48 && Math.max(r.gapL, r.gapR) > 96) f.push('DEAD');
    else if (r.avail > 900 && Math.min(r.gapL, r.gapR) > Math.max(96, 0.12 * r.avail)) f.push('GUT');
    else if (r.W >= 1280 && r.avail > 900 && r.used < 0.85) f.push('NARROW');
  }
  if ((r.touchMain ?? 0) > 0) f.push('TCH');
  if (r.covered?.covered) f.push('COV');
  if ((r.clipped?.length ?? 0) > 0) f.push('CLP');
  if (r.W < 768 && (r.innerScroll ?? []).some((s) => s.table)) f.push('TBL');
  if ((r.overlap?.length ?? 0) > 0) f.push('OVL');
  if (r.intrude > 1) f.push('INT');
  return f;
}
