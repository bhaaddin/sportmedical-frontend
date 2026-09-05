import client from '../api/client';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface NumberSeriesResponse {
  number: string;
  documentType: string;
  assignedAt: string;
}

export interface AuditEntry {
  id: string;
  documentType: string;
  assignedNumber: string;
  documentId?: string;
  assignedByUserId?: string;
  assignedAt: string;
}

export const numberSeriesApi = {
  getNextNumber: async (
    documentType: string, 
    documentId?: string, 
    userId?: string
  ): Promise<NumberSeriesResponse> => {
    const params = new URLSearchParams();
    if (documentId) params.append('documentId', documentId);
    if (userId) params.append('userId', userId);
    
    const response = await client.get(
      `${API_BASE}/number-series/next/${documentType}`,
      { params }
    );
    return response.data;
  },

  peekNextNumber: async (documentType: string): Promise<NumberSeriesResponse> => {
    const response = await client.get(`${API_BASE}/number-series/peek/${documentType}`);
    return response.data;
  },

  getAuditTrail: async (documentType: string): Promise<AuditEntry[]> => {
    const response = await client.get(`${API_BASE}/number-series/audit/${documentType}`);
    return response.data;
  },
};

// React Query hooks
export const useNextNumber = (documentType: string) => {
  return useQuery({
    queryKey: ['next-number', documentType],
    queryFn: () => numberSeriesApi.peekNextNumber(documentType),
    enabled: !!documentType,
    refetchInterval: false,
  });
};

export const useGenerateNumber = () => {
  return useMutation({
    mutationFn: ({ 
      documentType, 
      documentId, 
      userId 
    }: { 
      documentType: string; 
      documentId?: string; 
      userId?: string; 
    }) => numberSeriesApi.getNextNumber(documentType, documentId, userId),
  });
};

