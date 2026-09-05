import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/* ── Types ── */
export interface ServiceMetrics {
  serviceId: string;
  serviceName: string;
  category: string;
  count: number;
  revenue: number;
  percentage: number;
  averagePrice: number;
}

export interface HourlyMetric {
  hour: number;
  appointments: number;
  completed: number;
  cancelled: number;
  revenue: number;
  occupancyRate: number;
}

export interface DailyMetric {
  date: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShows: number;
  revenue: number;
  newPatients: number;
  returningPatients: number;
}

export interface PatientDemographics {
  ageGroup: string;
  count: number;
  percentage: number;
}

export interface DashboardMetrics {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  averageTransaction: number;
  totalDiscounts: number;
  todayAppointments: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
  pendingToday: number;
  occupancyRate: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  totalPatients: number;
  newPatientsToday: number;
  newPatientsWeek: number;
  newPatientsMonth: number;
  topServices: ServiceMetrics[];
  hourlyDistribution: HourlyMetric[];
  dailyTrend: DailyMetric[];
  activeClubs: number;
  clubRevenue: number;
}

export interface AnalyticsReport {
  dateFrom: string;
  dateTo: string;
  dailyTrend: DailyMetric[];
  serviceMetrics: ServiceMetrics[];
  hourlyDistribution: HourlyMetric[];
  totalRevenue: number;
  totalAppointments: number;
  totalNewPatients: number;
  totalCompleted: number;
  totalCancelled: number;
  totalNoShows: number;
  averageDailyRevenue: number;
  averageDailyAppointments: number;
}

/* ── API ── */
export const analyticsApi = {
  getDashboard: async (date?: string): Promise<DashboardMetrics> => {
    const params = date ? { date } : {};
    const response = await axios.get(`${API_BASE}/analytics/dashboard`, { params });
    return response.data;
  },

  getReport: async (dateFrom: string, dateTo: string): Promise<AnalyticsReport> => {
    const response = await axios.get(`${API_BASE}/analytics/report`, {
      params: { dateFrom, dateTo },
    });
    return response.data;
  },

  getDemographics: async (): Promise<PatientDemographics[]> => {
    const response = await axios.get(`${API_BASE}/analytics/demographics`);
    return response.data;
  },

  exportCsv: async (dateFrom: string, dateTo: string): Promise<Blob> => {
    const response = await axios.get(`${API_BASE}/analytics/export/csv`, {
      params: { dateFrom, dateTo },
      responseType: 'blob',
    });
    return response.data;
  },

  exportExcel: async (dateFrom: string, dateTo: string): Promise<Blob> => {
    const response = await axios.get(`${API_BASE}/analytics/export/excel`, {
      params: { dateFrom, dateTo },
      responseType: 'blob',
    });
    return response.data;
  },
};

/* ── React Query Hooks ── */
export const useDashboardMetrics = (date?: string) => {
  return useQuery({
    queryKey: ['analyticsDashboard', date],
    queryFn: () => analyticsApi.getDashboard(date),
    refetchInterval: 60000,
  });
};

export const useAnalyticsReport = (dateFrom: string, dateTo: string) => {
  return useQuery({
    queryKey: ['analyticsReport', dateFrom, dateTo],
    queryFn: () => analyticsApi.getReport(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });
};

export const usePatientDemographics = () => {
  return useQuery({
    queryKey: ['patientDemographics'],
    queryFn: () => analyticsApi.getDemographics(),
  });
};
