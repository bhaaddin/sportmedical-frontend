import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SmsTemplate {
  id: string;
  code: string;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RenderedEmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export interface RenderedSmsTemplate {
  body: string;
  smsCount: number;
}

export const templatesApi = {
  getEmailTemplates: async (): Promise<EmailTemplate[]> => {
    const response = await client.get(`${API_BASE}/templates/email`);
    return response.data;
  },

  getEmailTemplate: async (code: string): Promise<EmailTemplate> => {
    const response = await client.get(`${API_BASE}/templates/email/${code}`);
    return response.data;
  },

  createEmailTemplate: async (data: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const response = await client.post(`${API_BASE}/templates/email`, data);
    return response.data;
  },

  updateEmailTemplate: async (code: string, data: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const response = await client.put(`${API_BASE}/templates/email/${code}`, data);
    return response.data;
  },

  deleteEmailTemplate: async (code: string): Promise<void> => {
    await client.delete(`${API_BASE}/templates/email/${code}`);
  },

  renderEmail: async (code: string, variables: Record<string, string>): Promise<RenderedEmailTemplate> => {
    const response = await client.post(`${API_BASE}/templates/email/${code}/render`, variables);
    return response.data;
  },

  getSmsTemplates: async (): Promise<SmsTemplate[]> => {
    const response = await client.get(`${API_BASE}/templates/sms`);
    return response.data;
  },

  getSmsTemplate: async (code: string): Promise<SmsTemplate> => {
    const response = await client.get(`${API_BASE}/templates/sms/${code}`);
    return response.data;
  },

  createSmsTemplate: async (data: Partial<SmsTemplate>): Promise<SmsTemplate> => {
    const response = await client.post(`${API_BASE}/templates/sms`, data);
    return response.data;
  },

  updateSmsTemplate: async (code: string, data: Partial<SmsTemplate>): Promise<SmsTemplate> => {
    const response = await client.put(`${API_BASE}/templates/sms/${code}`, data);
    return response.data;
  },

  renderSms: async (code: string, variables: Record<string, string>): Promise<RenderedSmsTemplate> => {
    const response = await client.post(`${API_BASE}/templates/sms/${code}/render`, variables);
    return response.data;
  },
};

export const useEmailTemplates = () => {
  return useQuery({
    queryKey: ['emailTemplates'],
    queryFn: templatesApi.getEmailTemplates,
  });
};

export const useSmsTemplates = () => {
  return useQuery({
    queryKey: ['smsTemplates'],
    queryFn: templatesApi.getSmsTemplates,
  });
};

export const useCreateEmailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templatesApi.createEmailTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
    },
  });
};

export const useUpdateEmailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<EmailTemplate> }) =>
      templatesApi.updateEmailTemplate(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
    },
  });
};

export const useCreateSmsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templatesApi.createSmsTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsTemplates'] });
    },
  });
};

export const useUpdateSmsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<SmsTemplate> }) =>
      templatesApi.updateSmsTemplate(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsTemplates'] });
    },
  });
};
