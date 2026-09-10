import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const AccountingDocumentType = {
  PPD: 0,
  Invoice: 1,
  CreditNote: 2,
  Proforma: 3,
} as const;

export type AccountingDocumentType = (typeof AccountingDocumentType)[keyof typeof AccountingDocumentType];

export const AccountingDocumentStatus = {
  Draft: 0,
  Sent: 1,
  Paid: 2,
  Overdue: 3,
  Cancelled: 4,
} as const;

export type AccountingDocumentStatus = (typeof AccountingDocumentStatus)[keyof typeof AccountingDocumentStatus];

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit?: string;
}

export interface AccountingDocument {
  id: string;
  type: AccountingDocumentType;
  number: string;
  issueDate: string;
  duZp: string;
  dueDate?: string;
  supplierName: string;
  supplierIco: string;
  supplierDic?: string;
  supplierAddress: string;
  customerName: string;
  customerIco?: string;
  customerDic?: string;
  customerAddress?: string;
  baseAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  variableSymbol?: string;
  patientId?: string;
  bookingId?: string;
  clubId?: string;
  status: AccountingDocumentStatus;
  pdfPath?: string;
  createdAt: string;
  sentAt?: string;
  lineItems?: AccountingDocumentLineItem[];
}

export interface AccountingDocumentLineItem {
  id: string;
  documentId: string;
  order: number;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface CreateInvoiceData {
  dueDate: string;
  customerName: string;
  customerIco?: string;
  customerDic?: string;
  customerAddress?: string;
  bankAccount?: string;
  bankCode?: string;
  iban?: string;
  variableSymbol?: string;
  items: LineItem[];
  patientId?: string;
  bookingId?: string;
  clubId?: string;
}

export interface CreatePPDData {
  patientName: string;
  description: string;
  amount: number;
  vatRate: number;
  paymentMethod?: string;
  patientId?: string;
  bookingId?: string;
}

export const accountingDocumentsApi = {
  createInvoice: async (data: CreateInvoiceData): Promise<AccountingDocument> => {
    const response = await client.post(`${API_BASE}/accounting/documents/invoices`, data);
    return response.data;
  },

  createPPD: async (data: CreatePPDData): Promise<AccountingDocument> => {
    const response = await client.post(`${API_BASE}/accounting/documents/ppd`, data);
    return response.data;
  },

  getById: async (id: string): Promise<AccountingDocument> => {
    const response = await client.get(`${API_BASE}/accounting/documents/${id}`);
    return response.data;
  },

  getByPatient: async (patientId: string): Promise<AccountingDocument[]> => {
    const response = await client.get(`${API_BASE}/accounting/documents`, {
      params: { patientId },
    });
    return response.data;
  },

  getByDateRange: async (startDate: string, endDate: string): Promise<AccountingDocument[]> => {
    const response = await client.get(`${API_BASE}/accounting/documents`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const response = await client.get(`${API_BASE}/accounting/documents/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  markAsPaid: async (id: string): Promise<void> => {
    await client.post(`${API_BASE}/accounting/documents/${id}/paid`);
  },

  cancel: async (id: string): Promise<void> => {
    await client.post(`${API_BASE}/accounting/documents/${id}/cancel`);
  },
};

// React Query hooks
export const useAccountingDocument = (id: string) => {
  return useQuery({
    queryKey: ['accountingDocument', id],
    queryFn: () => accountingDocumentsApi.getById(id),
    enabled: !!id,
  });
};

export const usePatientAccountingDocuments = (patientId: string) => {
  return useQuery({
    queryKey: ['accountingDocuments', 'patient', patientId],
    queryFn: () => accountingDocumentsApi.getByPatient(patientId),
    enabled: !!patientId,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: accountingDocumentsApi.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountingDocuments'] });
    },
  });
};

export const useCreatePPD = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: accountingDocumentsApi.createPPD,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountingDocuments'] });
    },
  });
};