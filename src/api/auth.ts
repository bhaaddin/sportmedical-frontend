import client from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  clinicId?: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  account: {
    userId: string;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    createdAtUtc: string;
    lastLoginAtUtc: string | null;
  };
  permissions: string[];
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await client.post('/api/v1/session', { email, password });
    return res.data?.value ?? res.data;
  },

  logout: async (): Promise<void> => {
    await client.delete('/api/v1/session');
  },

  activate: async (data: { email: string; temporaryPassword: string; newPassword: string; newPasswordConfirmation: string }): Promise<void> => {
    await client.post('/api/v1/accounts/activate', data);
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await client.put('/api/v1/account/password', { currentPassword, newPassword, newPasswordConfirmation: newPassword });
  },
};
