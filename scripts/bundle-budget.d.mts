export const GROUPS: [string, string[], string[]][];
export const FORBIDDEN: [string, RegExp, string][];
export function chunkName(file: string): string;
export function closure(manifest: Record<string, { file: string; imports?: string[] }>, keys: string[]): string[];
export function measure(manifest: Record<string, { file: string; imports?: string[] }>): {
  sizes: Record<string, number>;
  detail: Record<string, string[]>;
  closures: Map<string, string[]>;
};
