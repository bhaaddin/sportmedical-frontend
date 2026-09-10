import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const ExportFormat = {
  CSV: 0,
  PohodaXml: 1,
  MoneyS3Xml: 2,
  IdokladXml: 3,
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportType = {
  Invoices: 0,
  CreditNotes: 1,
  Payments: 2,
  All: 3,
} as const;

export type ExportType = (typeof ExportType)[keyof typeof ExportType];

export interface ExportResult {
  id: string;
  format: ExportFormat;
  type: ExportType;
  dateFrom: string;
  dateTo: string;
  recordCount: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  exportedAt: string;
  exportedBy?: string;
  notes?: string;
}

export interface ExportCommand {
  format: ExportFormat;
  type: ExportType;
  dateFrom: string;
  dateTo: string;
}

export interface ExportFormatInfo {
  format: ExportFormat;
  name: string;
  contentType: string;
}

export const accountingExportApi = {
  exportData: async (command: ExportCommand): Promise<ExportResult> => {
    const response = await client.post(`${API_BASE}/accounting/export`, command);
    return response.data;
  },

  download: async (id: string): Promise<Blob> => {
    const response = await client.get(
      `${API_BASE}/accounting/export/${id}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  getHistory: async (): Promise<ExportResult[]> => {
    const response = await client.get(`${API_BASE}/accounting/export/history`);
    return response.data;
  },

  getHistoryRange: async (from: string, to: string): Promise<ExportResult[]> => {
    const response = await client.get(`${API_BASE}/accounting/export/history/range`, {
      params: { from, to },
    });
    return response.data;
  },

  deleteExport: async (id: string): Promise<void> => {
    await client.delete(`${API_BASE}/accounting/export/${id}`);
  },

  getFormats: async (): Promise<ExportFormatInfo[]> => {
    const response = await client.get(`${API_BASE}/accounting/export/formats`);
    return response.data;
  },
};

export const useExportHistory = () => {
  return useQuery({
    queryKey: ['exportHistory'],
    queryFn: accountingExportApi.getHistory,
  });
};

export const useExportFormats = () => {
  return useQuery({
    queryKey: ['exportFormats'],
    queryFn: accountingExportApi.getFormats,
    staleTime: Infinity,
  });
};

export const useExportAccounting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountingExportApi.exportData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportHistory'] });
    },
  });
};

export const useDeleteExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountingExportApi.deleteExport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportHistory'] });
    },
  });
};

