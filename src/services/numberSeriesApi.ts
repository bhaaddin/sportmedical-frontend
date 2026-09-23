import client from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
