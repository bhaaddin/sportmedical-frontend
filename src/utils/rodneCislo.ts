// Czech birth-number (rodné číslo) helpers:
// format YYMMDD/XXXX, month +50 = woman, +20 = foreigner variant, modulo-11 check.

export function formatRodneCislo(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}/${digits.slice(6)}`;
}

export interface ParsedRC {
  valid: boolean;
  dateOfBirth: string; // yyyy-MM-dd or ''
  sex: 'Male' | 'Female' | '';
  isFemale: boolean;
}

export function parseRodneCislo(raw: string): ParsedRC {
  const empty: ParsedRC = { valid: false, dateOfBirth: '', sex: '', isFemale: false };
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 9 && digits.length !== 10) return empty;

  const year = parseInt(digits.slice(0, 2), 10);
  let month = parseInt(digits.slice(2, 4), 10);
  const day = parseInt(digits.slice(4, 6), 10);

  const isFemale = month > 50;
  if (isFemale) month -= 50;
  if (month > 20) month -= 20; // foreigner variant
  if (month < 1 || month > 12 || day < 1 || day > 31) return empty;

  const fullYear = digits.length === 9
    ? (year < 54 ? 1900 + year : 1800 + year)
    : (parseInt(digits, 10) % 11 === 0 ? (year < 54 ? 2000 + year : 1900 + year) : NaN);
  if (digits.length === 10) {
    // modulo-11 (with the /1000 remainder-10 → 0 exception)
    const n = parseInt(digits.slice(0, 10), 10);
    const mod = n % 11;
    if (mod !== 0) {
      if (!(mod === 10 && digits[9] === '0')) return empty;
    }
  }
  if (isNaN(fullYear)) return empty;

  const dob = new Date(fullYear, month - 1, day);
  if (dob.getFullYear() !== fullYear || dob.getMonth() !== month - 1 || dob.getDate() !== day) return empty;
  if (dob.getTime() > Date.now()) return empty;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    valid: true,
    dateOfBirth: `${fullYear}-${mm}-${dd}`,
    sex: isFemale ? 'Female' : 'Male',
    isFemale,
  };
}

// Major Czech cities for fast address autocomplete (full RUIAN needs Postgres + state dataset)
export const CZECH_CITIES = [
  'Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice',
  'Hradec Králové', 'Ústí nad Labem', 'Pardubice', 'Zlín', 'Havířov', 'Kladno',
  'Most', 'Opava', 'Frýdek-Místek', 'Karvina', 'Jihlava', 'Teplice', 'Děčín',
  'Karlovy Vary', 'Chomutov', 'Jablonec nad Nisou', 'Mladá Boleslav', 'Prostějov',
  'Přerov', 'Česká Lípa', 'Třebíč', 'Třinec', 'Tábor', 'Znojmo', 'Příbram',
  'Cheb', 'Kolín', 'Trutnov', 'Písek', 'Kroměříž', 'Vsetín', 'Šumperk',
  'Uherské Hradiště', 'Hodonín', 'Břeclav', 'Vyškov', 'Blansko', 'Náchod',
  'Beroun', 'Kutná Hora', 'Chrudim', 'Strakonice', 'Klatovy', 'Jindřichův Hradec',
  'Litoměřice', 'Žďár nad Sázavou', 'Sokolov', 'Opava', 'Nový Jičín', 'Krnov',
  'Jeseník', 'Šumperk', 'Rakovník', 'Mělník', 'Nymburk', 'Brandýs nad Labem',
  'Říčany', 'Černošice', 'Hostivice', 'Jesenice', 'Vlašim', 'Benešov',
];
