import { client } from './client';

export interface RtpMilestone {
  id: string;
  title: string;
  description: string;
  phase: string;
  order: number;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  passCriteria: string;
  measuredResult?: string;
}

export interface RtpProtocol {
  id: string;
  injuryId: string;
  patientId: string;
  patientName?: string;
  name: string;
  currentPhase: string;
  progressPercent: number;
  estimatedCompletion?: string;
  clearedDate?: string;
  clearedBy?: string;
  milestones: RtpMilestone[];
}

export const rtpApi = {
  getByPatient: async (patientId: string): Promise<RtpProtocol[]> => {
    const res = await client.get(`/api/rtp/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  getById: async (id: string): Promise<RtpProtocol> => {
    const res = await client.get(`/api/rtp/${id}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: { injuryId: string; patientId: string; name: string; estimatedCompletion?: string }): Promise<RtpProtocol> => {
    const res = await client.post('/api/rtp', data);
    return res.data?.value ?? res.data;
  },

  completeMilestone: async (protocolId: string, milestoneId: string, data: { completedBy?: string; measuredResult?: string; notes?: string }): Promise<RtpMilestone> => {
    const res = await client.put(`/api/rtp/${protocolId}/milestone/${milestoneId}`, data);
    return res.data?.value ?? res.data;
  },
};
