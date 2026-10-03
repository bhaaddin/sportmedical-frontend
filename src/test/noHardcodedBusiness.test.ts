/*
 * Matko's rule: every value somebody might want to change lives in Nastavení, not in code.
 * This guard fails the build when the clinic's own data or a price is typed into a source file.
 *
 *   - clinic identifiers, phone, e-mail, address, building name, the portal's account id;
 *   - a price with "Kč" written as a literal ("1 600 Kč").
 *
 * Tests (they need example values) and the slot registry (src/site/slots/*, the editable DEFAULT
 * wording that the admin overrides) are not scanned. Lines that are only comments are skipped,
 * because they document history, not behaviour. Add to ALLOWED only with a comment saying why.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'src');

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'datová schránka id', pattern: /fdcgvvp/i },
  { name: 'IČO of the clinic', pattern: /23351632/ },
  { name: 'clinic phone', pattern: /606[\s ]?785[\s ]?271/ },
  { name: 'clinic e-mail', pattern: /recepce@sportmedical/i },
  { name: 'clinic street/building', pattern: /Jihlavsk|GreenLine/ },
  { name: 'a price with Kč', pattern: /\b\d[\d   ]{2,}\s?Kč/ },
];

/** `path-suffix` → reason. Empty on purpose: there is no unavoidable occurrence today. */
const ALLOWED: Record<string, string> = {};

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* files(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue;
    const rel = relative(ROOT, full).split(sep).join('/');
    if (rel.startsWith('site/slots/') || rel.startsWith('test/')) continue;
    yield full;
  }
}

const isCommentOnly = (line: string): boolean => /^\s*(\/\/|\/\*|\*)/.test(line);

describe('no business value is typed into the source', () => {
  it('finds none of the clinic data or prices outside the settings', () => {
    const hits: string[] = [];
    for (const file of files(ROOT)) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (Object.keys(ALLOWED).some((suffix) => rel.endsWith(suffix))) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (isCommentOnly(line)) return;
        for (const { name, pattern } of FORBIDDEN) {
          if (pattern.test(line)) hits.push(`src/${rel}:${index + 1}  ${name}  →  ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(hits, `Move these into Nastavení (settings / slots):\n${hits.join('\n')}`).toEqual([]);
  });
});
