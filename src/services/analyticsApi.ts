import client from '../api/client';
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
  /**
   * `null` means the rate is not known, and it is `null` for everything today:
   * it used to be computed from a table with no rows and no write path, so a
   * "0 % occupancy" was nought divided by nought presented as a measurement of
   * an empty clinic (`app` lane, 10. 9. 2026).
   *
   * When the capacity port lands, `null` and `0` stop being the same thing:
   * `null` will mean the clinic was not open - a Sunday, a holiday - and `0`
   * will mean it was open and nobody came, which is a real number and must be
   * shown. So a screen may not render an em dash for both. It can also exceed
   * 100: an appointment booked outside opening hours is a real appointment.
   */
  occupancyRate: number | null;
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
  /**
   * `null` means the rate is not known, and it is `null` for everything today:
   * it used to be computed from a table with no rows and no write path, so a
   * "0 % occupancy" was nought divided by nought presented as a measurement of
   * an empty clinic (`app` lane, 10. 9. 2026).
   *
   * When the capacity port lands, `null` and `0` stop being the same thing:
   * `null` will mean the clinic was not open - a Sunday, a holiday - and `0`
   * will mean it was open and nobody came, which is a real number and must be
   * shown. So a screen may not render an em dash for both. It can also exceed
   * 100: an appointment booked outside opening hours is a real appointment.
   */
  occupancyRate: number | null;
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
    const response = await client.get(`${API_BASE}/analytics/dashboard`, { params });
    return response.data;
  },

  getReport: async (dateFrom: string, dateTo: string): Promise<AnalyticsReport> => {
    const response = await client.get(`${API_BASE}/analytics/report`, {
      params: { dateFrom, dateTo },
    });
    return response.data;
  },

  getDemographics: async (): Promise<PatientDemographics[]> => {
    const response = await client.get(`${API_BASE}/analytics/demographics`);
    return response.data;
  },

  exportCsv: async (dateFrom: string, dateTo: string): Promise<Blob> => {
    const response = await client.get(`${API_BASE}/analytics/export/csv`, {
      params: { dateFrom, dateTo },
      responseType: 'blob',
    });
    return response.data;
  },

  exportExcel: async (dateFrom: string, dateTo: string): Promise<Blob> => {
    const response = await client.get(`${API_BASE}/analytics/export/excel`, {
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
