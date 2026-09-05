import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export enum WeekParity {
  All = 0,
  Odd = 1,
  Even = 2,
}

export interface WorkingHour {
  id: string;
  calendarId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekParity: WeekParity;
  breakStart?: string;
  breakEnd?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TimeSlot {
  id: string;
  calendarId: string;
  serviceId?: string;
  startAt: string;
  endAt: string;
  status: number;
  bookingId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GenerateSlotsRequest {
  startDate: string;
  endDate: string;
  slotDurationMinutes: number;
  bufferMinutes?: number;
}

export interface GenerateSlotsResult {
  slotsGenerated: number;
  from: string;
  to: string;
}

export const workingHoursApi = {
  getByCalendar: async (calendarId: string): Promise<WorkingHour[]> => {
    const response = await client.get(`${API_BASE}/calendars/${calendarId}/working-hours`);
    return response.data;
  },

  create: async (calendarId: string, data: Partial<WorkingHour>): Promise<WorkingHour> => {
    const response = await client.post(
      `${API_BASE}/calendars/${calendarId}/working-hours`, 
      data
    );
    return response.data;
  },

  update: async (
    calendarId: string, 
    id: string, 
    data: Partial<WorkingHour>
  ): Promise<WorkingHour> => {
    const response = await client.put(
      `${API_BASE}/calendars/${calendarId}/working-hours/${id}`, 
      data
    );
    return response.data;
  },

  delete: async (calendarId: string, id: string): Promise<void> => {
    await client.delete(`${API_BASE}/calendars/${calendarId}/working-hours/${id}`);
  },
};

export const timeSlotApi = {
  getAvailable: async (
    calendarId: string, 
    start: string, 
    end: string
  ): Promise<TimeSlot[]> => {
    const response = await client.get(
      `${API_BASE}/calendars/${calendarId}/slots`, 
      { params: { start, end } }
    );
    return response.data;
  },

  generate: async (
    calendarId: string, 
    data: GenerateSlotsRequest
  ): Promise<GenerateSlotsResult> => {
    const response = await client.post(
      `${API_BASE}/calendars/${calendarId}/slots/generate`, 
      data
    );
    return response.data;
  },
};

export const useWorkingHours = (calendarId: string) => {
  return useQuery({
    queryKey: ['workingHours', calendarId],
    queryFn: () => workingHoursApi.getByCalendar(calendarId),
    enabled: !!calendarId,
  });
};

export const useCreateWorkingHour = (calendarId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<WorkingHour>) => 
      workingHoursApi.create(calendarId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours', calendarId] });
    },
  });
};

export const useDeleteWorkingHour = (calendarId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workingHoursApi.delete(calendarId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours', calendarId] });
    },
  });
};

export const useGenerateSlots = (calendarId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GenerateSlotsRequest) => 
      timeSlotApi.generate(calendarId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeSlots', calendarId] });
    },
  });
};

