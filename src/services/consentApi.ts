import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

const API_BASE = '/api';

export enum ConsentType {
  Treatment = 0,
  Marketing = 1,
  Communication = 2,
  ClubSharing = 3,
  DataExport = 4,
}

export interface Consent {
  id: string;
  patientId: string;
  type: ConsentType;
  isGranted: boolean;
  purpose?: string;
  version: number;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  grantedByUserId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  status: string;
}

export interface ConsentDataExport {
  patientId: string;
  consents: ConsentExportItem[];
  auditLogs: ConsentAuditLogItem[];
  exportedAt: string;
  exportFormat: string;
}

export interface ConsentExportItem {
  id: string;
  type: string;
  typeCode: number;
  isGranted: boolean;
  isValid: boolean;
  grantedAt: string;
  revokedAt?: string;
  expiresAt?: string;
  purpose?: string;
  version: number;
  status: string;
}

export interface ConsentAuditLogItem {
  id: string;
  consentId: string;
  action: string;
  consentType: string;
  previousValue?: boolean;
  newValue?: boolean;
  performedAt: string;
  notes?: string;
}

export const consentApi = {
  getByPatient: async (patientId: string): Promise<Consent[]> => {
    const response = await client.get(`${API_BASE}/patients/${patientId}/consents`);
    return response.data;
  },

  grant: async (
    patientId: string, 
    type: ConsentType, 
    purpose?: string, 
    expiresInDays?: number
  ): Promise<Consent> => {
    const response = await client.post(
      `${API_BASE}/patients/${patientId}/consents/grant`, 
      { type, purpose, expiresInDays }
    );
    return response.data;
  },

  revoke: async (
    patientId: string, 
    type: ConsentType, 
    notes?: string
  ): Promise<void> => {
    await client.post(
      `${API_BASE}/patients/${patientId}/consents/revoke`, 
      { type, notes }
    );
  },

  check: async (patientId: string, type: ConsentType): Promise<boolean> => {
    const response = await client.get(
      `${API_BASE}/patients/${patientId}/consents/check/${type}`
    );
    return response.data.hasConsent;
  },

  exportData: async (patientId: string): Promise<ConsentDataExport> => {
    const response = await client.get(
      `${API_BASE}/patients/${patientId}/consents/export`
    );
    return response.data;
  },

  deleteConsents: async (patientId: string, reason?: string): Promise<void> => {
    await client.delete(`${API_BASE}/patients/${patientId}/consents`, {
      params: { reason },
    });
  },
};

export const usePatientConsents = (patientId: string) => {
  return useQuery({
    queryKey: ['consents', patientId],
    queryFn: () => consentApi.getByPatient(patientId),
    enabled: !!patientId,
  });
};

export const useGrantConsent = (patientId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ type, purpose, expiresInDays }: { 
      type: ConsentType; 
      purpose?: string; 
      expiresInDays?: number;
    }) => consentApi.grant(patientId, type, purpose, expiresInDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
    },
  });
};

export const useRevokeConsent = (patientId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ type, notes }: { type: ConsentType; notes?: string }) => 
      consentApi.revoke(patientId, type, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
    },
  });
};
