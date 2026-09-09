/*
 * Compares `canChangeStatus` against the transition table in the booking
 * contract, cell by cell, all forty-nine of them.
 *
 * Why this exists. That table was transcribed by hand from a document into
 * TypeScript, and a transcription slip is exactly the mistake this lane has
 * already made twice: `isLate` compared a status to `'Booked'`, a value the
 * contract never had, and the check written to catch it used the same wrong
 * constant - it was verifying itself. So this script takes the expected answers
 * from the contract markdown and the actual answers from the shipped source,
 * and neither of them from whoever is running it.
 *
 * The repository rule applies to the script itself: a run that found no table,
 * or no function, has verified nothing and must fail rather than print a tick.
 *
 *   node eng/check-status-table.cjs [path-to-contract.md]
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_CONTRACT = path.join(
  'C:',
  'Users',
  'Matko',
  'SportMedical.Booking',
  'docs',
  'engineering',
  'booking-frontend-contract.md',
);

const contractPath = process.argv[2] || DEFAULT_CONTRACT;

if (!fs.existsSync(contractPath)) {
  console.error('NEOVERENÉ: kontrakt sa nenašiel: ' + contractPath);
  console.error('Táto kontrola bez neho nemá čo porovnávať, tak nekončí zelene.');
  process.exit(2);
}

const contract = fs.readFileSync(contractPath, 'utf8');

/* ── The expected answers, read out of the contract ── */

const STATUSES = [0, 1, 2, 3, 4, 5, 6];

/**
 * Rows look like one of:
 *   | `0` objednaný        | `1` potvrdený | potvrdenie |
 *   | `0` / `1`            | `2` prišiel   | príchod ... |
 *   | čokoľvek okrem `3` a `4` | `4` zrušený | zrušenie ... |
 */
function parseTable(text) {
  const marker = 'Ktoré prechody existujú';
  const start = text.indexOf(marker);
  if (start === -1) return null;

  const allowed = new Set();
  let rows = 0;

  for (const line of text.slice(start).split(/\r?\n/)) {
    if (line.startsWith('>') || line.startsWith('#')) break;
    if (!line.startsWith('|')) continue;

    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4) continue;

    const fromCell = cells[1];
    const toCell = cells[2];
    if (fromCell === 'z' || /^-+$/.test(fromCell)) continue;

    const toCodes = [...toCell.matchAll(/`(\d)`/g)].map((m) => Number(m[1]));
    if (toCodes.length !== 1) continue;
    const to = toCodes[0];

    const fromCodes = [...fromCell.matchAll(/`(\d)`/g)].map((m) => Number(m[1]));
    if (fromCodes.length === 0) continue;

    /* "čokoľvek okrem `3` a `4`" names the exceptions, not the sources. */
    const froms = /okrem/.test(fromCell)
      ? STATUSES.filter((s) => !fromCodes.includes(s))
      : fromCodes;

    for (const from of froms) allowed.add(from + '->' + to);
    rows += 1;
  }

  return { allowed, rows };
}

const table = parseTable(contract);

if (table === null) {
  console.error('NEOVERENÉ: v kontrakte sa nenašla tabuľka prechodov.');
  console.error('Buď sa presunula, alebo sa zmenil jej úvod. Neporovnal som nič.');
  process.exit(2);
}

if (table.rows < 5) {
  console.error(
    'NEOVERENÉ: z tabuľky sa prečítalo len ' +
      table.rows +
      ' riadkov. Toľko ich nie je — parser nesedí s tvarom tabuľky.',
  );
  process.exit(2);
}

/* ── The actual answers, taken from the shipped source ── */

const sourcePath = path.join('src', 'api', 'bookingContracts.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

const fnMatch = source.match(
  /export function canChangeStatus\(from: number, to: number\): boolean \{([\s\S]*?)\n\}/,
);

if (!fnMatch) {
  console.error('NEOVERENÉ: `canChangeStatus` sa v ' + sourcePath + ' nenašla.');
  console.error('Premenovali ju, alebo zmenili podpis. Neporovnal som nič.');
  process.exit(2);
}

/*
 * The function is plain arithmetic with no imports, so its body runs as it
 * stands once the two type annotations are gone. Reading it out of the file is
 * the point: a copy kept here would drift from the code it claims to check.
 */
const canChangeStatus = new Function('from', 'to', fnMatch[1]);

/* ── All forty-nine cells ── */

const wrong = [];
for (const from of STATUSES) {
  for (const to of STATUSES) {
    const expected = table.allowed.has(from + '->' + to);
    const actual = Boolean(canChangeStatus(from, to));
    if (expected !== actual) {
      wrong.push({ from, to, expected, actual });
    }
  }
}

console.log('Kontrakt: ' + contractPath);
console.log(
  'Z tabuľky prečítaných ' +
    table.rows +
    ' riadkov, ' +
    table.allowed.size +
    ' povolených prechodov.',
);
console.log('Porovnaných buniek: ' + STATUSES.length * STATUSES.length);

if (wrong.length === 0) {
  console.log('NÁLEZ: žiadny — mriežka sedí s kontraktom.');
  process.exit(0);
}

console.log('');
for (const w of wrong) {
  console.log(
    'NESEDÍ ' +
      w.from +
      ' → ' +
      w.to +
      ': kontrakt ' +
      (w.expected ? 'povoľuje' : 'nepovoľuje') +
      ', kód ' +
      (w.actual ? 'povoľuje' : 'nepovoľuje'),
  );
}
console.log('');
const n = wrong.length;
const cells = n === 1 ? 'bunka' : n < 5 ? 'bunky' : 'buniek';
const verb = n === 1 ? 'nesedí' : 'nesedia';
console.log('NÁLEZ: ' + n + ' ' + cells + ' ' + verb + ' s kontraktom.');
process.exit(1);
