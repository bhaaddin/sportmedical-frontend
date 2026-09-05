import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

// React Query hooks
export const useCompanySettings = () => {
  return useQuery({
    queryKey: ['companySettings'],
    queryFn: companySettingsApi.get,
  });
};

export const useUpdateCompanySettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: companySettingsApi.update,
    onSuccess: (data) => {
      queryClient.setQueryData(['companySettings'], data);
    },
  });
};

