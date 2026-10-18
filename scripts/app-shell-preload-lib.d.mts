export const APP_ENTRY: string;
export const STAFF_APP: string;
export const SCREENS: [string, string, boolean][];
export const APP_FONT_FACES: RegExp[];
export const BLOCK_START: string;
export const BLOCK_END: string;
export function buildPreloadBlock(
  manifest: Record<string, { file: string; css?: string[]; imports?: string[] }>,
  appCss: string,
): {
  html: string;
  report: { entryJs: number; entryCss: number; fonts: number; screens: number; skipped: string[] };
};
export function injectPreloadBlock(shellHtml: string, block: string): string;
