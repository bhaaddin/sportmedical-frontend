export interface PageStructure {
  prerendered: boolean;
  h1Count: number;
  headings: string[];
  totalWords: number;
  words: Record<string, number>;
  snapshot: boolean;
  bootScript: boolean;
  bootBeforeStyles: boolean;
  leaks: string[];
}
export interface BaselineEntry {
  headings: string[];
  totalWords: number;
  words: string[];
}
export function wordsOf(html: string): { total: number; bag: Record<string, number> };
export function structureOf(html: string): PageStructure;
export function baselineEntry(structure: PageStructure): BaselineEntry;
export function compareWithBaseline(path: string, structure: PageStructure, baseline: BaselineEntry): string[];
