/*
 * Every write-side shape, against the entity it writes.
 *
 * Contract 3.1 since v27: a `PUT` replaces the whole record, and a field left
 * out of the body - or sent as `null` - is **deleted**, not kept. So a form that
 * assembles its body field by field silently destroys whatever it does not know
 * about.
 *
 * This lane has now shipped that bug twice:
 *
 *   - `activityInputSchema` had no `serviceItemId`, so renaming an activity
 *     would have taken its price away;
 *   - `calendarInputSchema` had no `publicMinimumNoticeMinutes` or
 *     `publicHorizonDays`, so renaming a calendar would have deleted its
 *     public-booking limits - and nothing would have gone wrong until phase 2,
 *     by which time nobody could have said when they vanished.
 *
 * Both were found by reading. Reading does not scale and does not repeat, so
 * this compares the shapes instead.
 *
 * The exceptions below are the whole point of the file: each one is a field the
 * entity has and the write deliberately does not carry, with the reason. An
 * exception that no longer matches anything is itself a finding - it means the
 * shape moved and the reasoning was never revisited.
 *
 *   node eng/check-write-shapes.cjs
 */
const fs = require('fs');
const path = require('path');

const sourcePath = path.join('src', 'api', 'bookingContracts.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

/* ── Reading the shapes out of the file ── */

function objectFields(name) {
  const re = new RegExp(
    'export const ' + name + ' = z\\.object\\(\\{([\\s\\S]*?)\\n\\}\\)',
  );
  const m = source.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/^ {2}([a-zA-Z_]\w*):/gm)].map((x) => x[1]);
}

/** `workingHourInputSchema = workingHourSchema.omit({...})` and friends. */
function derivedFrom(name) {
  const re = new RegExp(
    'export const ' + name + ' = (\\w+Schema)\\.omit\\(\\{([\\s\\S]*?)\\}\\)',
  );
  const m = source.match(re);
  if (!m) return null;
  return {
    entity: m[1],
    omitted: [...m[2].matchAll(/([a-zA-Z_]\w*):\s*true/g)].map((x) => x[1]),
  };
}

/* ── What is checked, and what is deliberately left out ── */

/**
 * Every write-side schema in the file must appear here. A new one with no entry
 * is a finding, not a pass: that is how the first two got in.
 */
const PAIRS = [
  {
    input: 'calendarInputSchema',
    entity: 'calendarSchema',
    except: {
      id: 'server-owned, and the calendar is in the path (4.1)',
    },
  },
  {
    input: 'activityInputSchema',
    entity: 'activitySchema',
    except: {
      id: 'server-owned, and the activity is in the path (4.3)',
      slug: '4.3: read only when created; `PUT` ignores it rather than deleting it',
      priceCzk: '4.3 v25: read-only, taken through `serviceItemId` on every answer',
      isActive: '4.3: owned by `DELETE` and `POST .../restore`, never by `PUT`',
    },
  },
  {
    input: 'schedulePeriodInputSchema',
    entity: 'schedulePeriodSchema',
    except: {
      id: 'server-owned, and the period is in the path (4.2)',
    },
  },
  {
    input: 'workingHourInputSchema',
    entity: 'workingHourSchema',
    derived: true,
  },
  {
    input: 'scheduleExceptionInputSchema',
    entity: 'scheduleExceptionSchema',
    derived: true,
  },
  {
    /*
     * A `POST` body, not a `PUT`: it creates rather than replaces, so the v27
     * rule does not apply and the entity has fields no caller may set. Listed
     * anyway, so the file accounts for every write-side shape there is.
     */
    input: 'createAppointmentInputSchema',
    entity: null,
    reason: 'POST body (4.5); creates rather than replaces, so nothing to carry',
  },
];

/* ── Nothing declared may be missing, and nothing present may be undeclared ── */

const declared = new Set(PAIRS.map((p) => p.input));
const inFile = [
  ...source.matchAll(/export const (\w*Input\w*Schema) =/g),
].map((m) => m[1]);

let problems = 0;

for (const name of inFile) {
  if (!declared.has(name)) {
    console.log(
      'NEZARADENÉ ' +
        name +
        ' — nový zápisový tvar, ktorý táto kontrola nikdy nepozrela.',
    );
    problems += 1;
  }
}

if (inFile.length === 0) {
  console.error('NEOVERENÉ: v ' + sourcePath + ' sa nenašiel ani jeden zápisový tvar.');
  console.error('Buď sa premenovali, alebo sa zmenil ich tvar. Neporovnal som nič.');
  process.exit(2);
}

console.log('Porovnaných zápisových tvarov: ' + inFile.length);
console.log('');

for (const pair of PAIRS) {
  if (!inFile.includes(pair.input)) {
    console.log(
      'ZASTARALÝ ZÁZNAM ' +
        pair.input +
        ' — v súbore už nie je, ale kontrola s ním počíta.',
    );
    problems += 1;
    continue;
  }

  if (pair.entity === null) {
    console.log('MIMO  ' + pair.input + ' — ' + pair.reason);
    continue;
  }

  if (pair.derived) {
    const derived = derivedFrom(pair.input);
    if (!derived) {
      console.log(
        'ZMENA ' +
          pair.input +
          ' — mal byť odvodený z entity cez `omit`, už nie je. ' +
          'Ručne písaný tvar sa rozíde; skontrolovať a prepísať záznam.',
      );
      problems += 1;
      continue;
    }
    if (derived.entity !== pair.entity) {
      console.log(
        'ZMENA ' + pair.input + ' — odvodený z ' + derived.entity + ', čakal sa ' + pair.entity + '.',
      );
      problems += 1;
      continue;
    }
    console.log(
      'OK    ' +
        pair.input +
        ' — odvodený z ' +
        pair.entity +
        ' (vynecháva: ' +
        derived.omitted.join(', ') +
        '). Rozísť sa nemôže.',
    );
    continue;
  }

  const entityFields = objectFields(pair.entity);
  const inputFields = objectFields(pair.input);

  if (!entityFields || !inputFields) {
    console.log('NEOVERENÉ ' + pair.input + ' — tvar sa nedal prečítať.');
    problems += 1;
    continue;
  }

  const except = pair.except ?? {};
  const missing = entityFields.filter(
    (f) => !inputFields.includes(f) && !(f in except),
  );

  /* An exception for a field the entity no longer has explains nothing. */
  const staleExcept = Object.keys(except).filter(
    (f) => !entityFields.includes(f),
  );

  for (const f of missing) {
    console.log(
      'CHÝBA ' +
        pair.input +
        '.' +
        f +
        ' — entita ho má. Pri `PUT` (3.1) by sa **zmazal**.',
    );
    problems += 1;
  }

  for (const f of staleExcept) {
    console.log(
      'ZASTARALÁ VÝNIMKA ' +
        pair.input +
        '.' +
        f +
        ' — entita to pole už nemá, dôvod prežil pole.',
    );
    problems += 1;
  }

  if (missing.length === 0 && staleExcept.length === 0) {
    const n = Object.keys(except).length;
    const excused =
      n === 1 ? 'jednej odôvodnenej výnimky' : n + ' odôvodnených výnimiek';
    console.log(
      'OK    ' +
        pair.input +
        ' — nesie všetky polia entity (' +
        entityFields.length +
        ') okrem ' +
        excused +
        '.',
    );
  }
}

console.log('');
console.log(
  problems === 0
    ? 'NÁLEZ: žiadny'
    : 'NÁLEZ: ' + problems + ' — pozri riadky vyššie.',
);
process.exit(problems === 0 ? 0 : 1);
