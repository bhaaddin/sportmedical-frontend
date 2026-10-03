import client from '../api/client';

/* The shared client already carries the API origin (VITE_API_BASE_URL); building the
   URL from the variable again sent these calls to `https://<api>/clubs` on Vercel. */
const API_BASE = '/api';

export interface NumberSeriesResponse {
  number: string;
  documentType: string;
  assignedAt: string;
}

export const numberSeriesApi = {
  peekNextNumber: async (documentType: string): Promise<NumberSeriesResponse> => {
    const response = await client.get(`${API_BASE}/number-series/peek/${documentType}`);
    return response.data;
  },
};
