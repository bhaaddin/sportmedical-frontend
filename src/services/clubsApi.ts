import client from '../api/client';

/* The shared client already carries the API origin (VITE_API_BASE_URL); building the
   URL from the variable again sent these calls to `https://<api>/clubs` on Vercel. */
const API_BASE = '/api';

export interface Club {
  id: string;
  name: string;
  ico: string;
  dic?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  paymentTermsDays: number;
  /** The administrator's discount for this club, 0–100 with two decimals at most; null = bez slevy. */
  discountPercent?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const clubsApi = {
  getAll: async (activeOnly = false): Promise<Club[]> => {
    const response = await client.get(`${API_BASE}/clubs`, { params: { activeOnly } });
    return response.data;
  },

  create: async (data: Partial<Club>): Promise<Club> => {
    const response = await client.post(`${API_BASE}/clubs`, data);
    return response.data;
  },

  update: async (id: string, data: Partial<Club>): Promise<Club> => {
    const response = await client.put(`${API_BASE}/clubs/${id}`, data);
    return response.data;
  },

  deactivate: async (id: string): Promise<void> => {
    await client.delete(`${API_BASE}/clubs/${id}`);
  },
};
