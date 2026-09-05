import { client } from './client';

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  priceCzk: number;
  isActive: boolean;
}

export const servicesApi = {
  getAll: async (): Promise<ServiceItem[]> => {
    const res = await client.get('/api/services');
    return res.data?.value ?? res.data ?? [];
  },

  getById: async (id: string): Promise<ServiceItem> => {
    const res = await client.get(`/api/services/${id}`);
    return res.data?.value ?? res.data;
  },
};
