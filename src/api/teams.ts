import { client } from './client';

export interface Team {
  id: string;
  name: string;
  sport: string;
  league: string;
  city: string;
  contactPerson: string;
  contactEmail?: string;
  contactPhone?: string;
  playerCount: number;
  isActive: boolean;
}

export interface TeamMember {
  id: string;
  patientId: string;
  playerName: string;
  position: string;
  jerseyNumber: number;
  dominantSide: string;
  isActive: boolean;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export const teamsApi = {
  getAll: async (): Promise<Team[]> => {
    const res = await client.get('/api/teams');
    return res.data?.value ?? res.data ?? [];
  },

  getById: async (id: string): Promise<TeamDetail> => {
    const res = await client.get(`/api/teams/${id}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: { name: string; sport: string; league: string; city: string; contactPerson: string; contactEmail?: string; contactPhone?: string }): Promise<Team> => {
    const res = await client.post('/api/teams', data);
    return res.data?.value ?? res.data;
  },

  addMember: async (teamId: string, data: { patientId: string; playerName: string; position: string; jerseyNumber: number; dominantSide: string }): Promise<TeamMember> => {
    const res = await client.post(`/api/teams/${teamId}/members`, data);
    return res.data?.value ?? res.data;
  },
};
