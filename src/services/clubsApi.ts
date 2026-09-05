import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClubMember {
  id: string;
  clubId: string;
  patientId: string;
  memberNumber?: string;
  position?: string;
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
}

export interface ClubDashboard {
  clubId: string;
  clubName: string;
  activeMembers: number;
  totalMembers: number;
}

export const clubsApi = {
  getAll: async (activeOnly = false): Promise<Club[]> => {
    const response = await client.get(`${API_BASE}/clubs`, { params: { activeOnly } });
    return response.data;
  },

  getById: async (id: string): Promise<Club> => {
    const response = await client.get(`${API_BASE}/clubs/${id}`);
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

  getMembers: async (clubId: string, activeOnly = false): Promise<ClubMember[]> => {
    const response = await client.get(`${API_BASE}/clubs/${clubId}/members`, { params: { activeOnly } });
    return response.data;
  },

  addMember: async (clubId: string, patientId: string, memberNumber?: string, position?: string): Promise<ClubMember> => {
    const response = await client.post(`${API_BASE}/clubs/${clubId}/members`, { patientId, memberNumber, position });
    return response.data;
  },

  removeMember: async (memberId: string): Promise<void> => {
    await client.delete(`${API_BASE}/clubs/members/${memberId}`);
  },

  getDashboard: async (clubId: string): Promise<ClubDashboard> => {
    const response = await client.get(`${API_BASE}/clubs/${clubId}/dashboard`);
    return response.data;
  },
};

export const useClubs = (activeOnly = false) => {
  return useQuery({
    queryKey: ['clubs', activeOnly],
    queryFn: () => clubsApi.getAll(activeOnly),
  });
};

export const useClub = (id: string) => {
  return useQuery({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getById(id),
    enabled: !!id,
  });
};

export const useClubMembers = (clubId: string) => {
  return useQuery({
    queryKey: ['clubMembers', clubId],
    queryFn: () => clubsApi.getMembers(clubId),
    enabled: !!clubId,
  });
};

export const useClubDashboard = (clubId: string) => {
  return useQuery({
    queryKey: ['clubDashboard', clubId],
    queryFn: () => clubsApi.getDashboard(clubId),
    enabled: !!clubId,
  });
};

export const useCreateClub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clubsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
};

export const useUpdateClub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Club> }) => clubsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club', variables.id] });
    },
  });
};

export const useAddClubMember = (clubId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, memberNumber, position }: { patientId: string; memberNumber?: string; position?: string }) =>
      clubsApi.addMember(clubId, patientId, memberNumber, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubMembers', clubId] });
      queryClient.invalidateQueries({ queryKey: ['clubDashboard', clubId] });
    },
  });
};
