/* ══════════════════════════════════════════════════════════════
   Company and invoice data (Etapa 2, contract C3).

     GET/PUT /api/v1/settings/company
       { legalName, ico, dic?, address, city, postalCode, bankAccount?, iban?,
         dataBox?, phone, email, invoiceDueDays }

   Printed on every invoice PDF; the QR payment appears only when the bank
   account is set. The server pre-fills it from the clinic's website, and
   anything it could not find stays empty - this module invents nothing.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface CompanySettings {
  legalName: string;
  ico: string;
  dic: string;
  address: string;
  city: string;
  postalCode: string;
  bankAccount: string;
  iban: string;
  dataBox: string;
  phone: string;
  email: string;
  invoiceDueDays: number;
}

export const COMPANY_SETTINGS_QUERY_KEY = ['settings', 'company'] as const;

export function normalizeCompanySettings(raw: unknown): CompanySettings {
  const b = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    legalName: s(b.legalName),
    ico: s(b.ico),
    dic: s(b.dic),
    address: s(b.address),
    city: s(b.city),
    postalCode: s(b.postalCode),
    bankAccount: s(b.bankAccount),
    iban: s(b.iban),
    dataBox: s(b.dataBox),
    phone: s(b.phone),
    email: s(b.email),
    invoiceDueDays: typeof b.invoiceDueDays === 'number' && Number.isFinite(b.invoiceDueDays) ? b.invoiceDueDays : 0,
  };
}

export const companySettingsApi = {
  get: async (): Promise<CompanySettings> => {
    const { data } = await client.get('/api/v1/settings/company');
    return normalizeCompanySettings(data);
  },
  put: async (settings: CompanySettings): Promise<CompanySettings> => {
    const { data } = await client.put('/api/v1/settings/company', settings);
    return normalizeCompanySettings(data);
  },
};
