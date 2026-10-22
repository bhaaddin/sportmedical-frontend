/*
 * The invoice PDF's file name. Showing or saving the file is `utils/download` (one helper for every download: gated by
 * `exports.download`, audited, the bytes untouched).
 */

/** "faktura-2026-0418.pdf" - the number can hold a slash, which a file name cannot. */
export function pdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.trim().replace(/[^\w.-]+/g, '-');
  return `faktura-${safe === '' ? 'doklad' : safe}.pdf`;
}
