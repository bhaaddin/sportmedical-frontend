/*
 * Lists every place a server answer is drawn, instead of hunting for them by eye.
 *
 * Written after a fix that was believed to be applied everywhere and had in fact
 * landed in three of four files: the edit matched on a line one file spells
 * differently, and nobody checked that it stuck.
 *
 * It asks one question per query: if this call fails, does anything on screen
 * say so? It accepts any spelling of that (`error`, `failureReason`, `isError`,
 * `isSuccess`), because the property matters and the wording does not.
 */
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry.name)) files.push(p);
  }
})('src');

/*
 * Which files this lane owns. It is a denylist on purpose: an allowlist of
 * component names went stale the first time a new screen was added - the audit
 * printed a clean run that had never looked at the new file. A list that has to
 * be extended before it can catch anything catches nothing.
 *
 * These three predate this lane and belong to other work.
 */
const NOT_MINE = [
  'src/components/booking/AddressPicker.tsx',
  'src/components/booking/BookingDocuments.tsx',
  'src/components/booking/WaitlistManager.tsx',
];

const MINE = /^src\/(pages|components)\/booking\//;
const mine = files.filter((f) => MINE.test(f) && !NOT_MINE.includes(f));

/* An exclusion for a file that no longer exists hides nothing and would quietly
   outlive the reason it was written. */
const stale = NOT_MINE.filter((f) => !files.includes(f));
if (stale.length > 0) {
  console.log('ZASTARALÁ VÝNIMKA (súbor neexistuje): ' + stale.join(', '));
}

let problems = 0;

console.log('=== <AsyncSection>: kreslí sa obsah až po odpovedi? ===');
for (const f of mine) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<AsyncSection[\s\S]*?>/g)) {
    const has = /isSettled=/.test(m[0]);
    if (!has) problems += 1;
    console.log((has ? 'OK    ' : 'CHÝBA ') + f.replace('src/', ''));
  }
}

console.log('');
console.log('=== useQuery: povie obrazovka, keď tento dotaz zlyhá? ===');
for (const f of mine) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/const (\w+)\s*=\s*useQuery\(/g)) {
    const name = m[1];
    const surfaced = new RegExp(name + '\\.(error|failureReason|isError|isSuccess)').test(src);
    if (!surfaced) problems += 1;
    console.log((surfaced ? 'OK    ' : 'TICHÝ ') + f.replace('src/', '') + ' :: ' + name);
  }
}

console.log('');
console.log('=== useMutation: úplná náhrada sa nesmie odoslať z nenačítaného stavu ===');
for (const f of mine) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/const (\w+)\s*=\s*useMutation\(/g)) {
    console.log('      ' + f.replace('src/', '') + ' :: ' + m[1]);
  }
}

console.log('');
console.log(problems === 0 ? 'NÁLEZ: žiadny' : 'NÁLEZ: ' + problems + ' miest bez zapojeného zlyhania');
process.exit(problems === 0 ? 0 : 1);
