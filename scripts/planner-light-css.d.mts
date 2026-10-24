import type { Rgba } from '../src/accent';
export const SOURCES: string[];
export const OUT: string;
export const LIGHT: string;
export function toLight(rgba: Rgba, use: 'text' | 'shadow' | 'line' | 'surface' | 'var'): string;
export function translateValue(prop: string, value: string): string | null;
export function build(): string;
