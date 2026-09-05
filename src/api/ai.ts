import { client } from './client';

export interface RiskAssessment {
  id: string;
  patientId: string;
  overallRiskScore: number;
  riskLevel: string;
  recommendation: string;
  requiresPractitionerReview: boolean;
  factors: { category: string; description: string; impact: number }[];
}

export interface RtpEstimation {
  injuryId: string;
  estimatedDaysOut: number;
  confidencePercent: number;
  keyMilestones: string[];
  aiReasoning: string;
}

export const aiApi = {
  getRisk: async (patientId: string): Promise<RiskAssessment> => {
    const res = await client.get(`/api/ai/risk/${patientId}`);
    return res.data?.value ?? res.data;
  },
  getRtpEstimation: async (injuryId: string): Promise<RtpEstimation> => {
    const res = await client.get(`/api/ai/rtp-estimation/${injuryId}`);
    return res.data?.value ?? res.data;
  },
};
