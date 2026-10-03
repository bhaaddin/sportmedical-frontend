import client from '../api/client';

/* The shared client already carries the API origin (VITE_API_BASE_URL); building the
   URL from the variable again sent these calls to `https://<api>/clubs` on Vercel. */
const API_BASE = '/api';

export interface CompanySettings {
  id: string;
  companyName: string;
  ico: string;
  dic?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  logoPath?: string;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AresLookupResponse {
  companyName: string;
  ico: string;
  dic?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  legalForm: string;
}

export const companySettingsApi = {
  get: async (): Promise<CompanySettings | null> => {
    const response = await client.get(`${API_BASE}/company-settings`);
    return response.data;
  },

  update: async (settings: Partial<CompanySettings>): Promise<CompanySettings> => {
    const response = await client.put(`${API_BASE}/company-settings`, settings);
    return response.data;
  },

  lookupAres: async (ico: string): Promise<AresLookupResponse> => {
    const response = await client.get(`${API_BASE}/company-settings/ares/${ico}`);
    return response.data;
  },
};
