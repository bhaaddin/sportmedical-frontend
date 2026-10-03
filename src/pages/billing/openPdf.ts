/*
 * Shows an invoice's PDF. The server needs the bearer token for it, so the page
 * fetches the file and hands it over as a blob: a new tab when the browser
 * allows one, otherwise a download with a sensible file name.
 */
export function openPdfBlob(blob: Blob, fileName: string): void {
  const file = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(file);
  const tab = window.open(url, '_blank');
  if (tab === null || tab === undefined) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  /* Long enough for a slow viewer to read it, short enough not to pin the file. */
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

/** "faktura-2026-0418.pdf" - the number can hold a slash, which a file name cannot. */
export function pdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.trim().replace(/[^\w.-]+/g, '-');
  return `faktura-${safe === '' ? 'doklad' : safe}.pdf`;
}
