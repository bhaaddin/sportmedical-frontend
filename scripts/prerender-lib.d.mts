export function safeJson(value: unknown): string;
export function escapeHtml(text: string): string;
export function assetsForEntry(
  manifest: Record<string, { file: string; css?: string[]; imports?: string[] }>,
  entryKey: string,
): { js: string[]; css: string[] };
export function pickFontPreloads(cssText: string): string[];
export interface PageParts {
  html: string;
  styles: string;
  title: string;
  description: string;
  data: unknown;
  inlineCss?: string;
  modulePreload?: string[];
  fontPreload?: string[];
  indexable?: boolean;
  canonical?: string;
}
export function buildPage(template: string, page: PageParts): string;
