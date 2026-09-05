/* ══════════════════════════════════════════════════════════════
   CZECH INSURANCE PROVIDERS
   Used by Billing, PatientDrawer, and Calendar.
   ══════════════════════════════════════════════════════════════ */

export interface InsuranceProvider {
  code: string;
  name: string;
  shortName: string;
  color: string;
}

export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  { code: '111', name: 'Všeobecná zdravotní pojišťovna', shortName: 'VZP', color: '#1565C0' },
  { code: '201', name: 'Vojenská zdravotní pojišťovna', shortName: 'VOZP', color: '#C62828' },
  { code: '205', name: 'Česká průmyslová zdravotní pojišťovna', shortName: 'ČPZP', color: '#F57F17' },
  { code: '207', name: 'Oborová zdravotní pojišťovna', shortName: 'OZP', color: '#2E7D32' },
  { code: '209', name: 'Zdravotní pojišťovna Ministerstva vnitra', shortName: 'ZP MV', color: '#6A1B9A' },
  { code: '211', name: 'Zdravotní pojišťovna Škoda', shortName: 'ZP Škoda', color: '#00838F' },
  { code: '213', name: 'Rumburská nemocnice', shortName: 'RBP', color: '#4E342E' },
];

export function getProviderByCode(code: string): InsuranceProvider | undefined {
  return INSURANCE_PROVIDERS.find(p => p.code === code);
}

export function getProviderColor(code: string): string {
  return getProviderByCode(code)?.color ?? '#757575';
}
