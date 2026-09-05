import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface BookingDetails {
  bookingId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  canCancel: boolean;
  canReschedule: boolean;
  expiresAt: string;
  remainingValidity: string;
}

export interface TimeSlot {
  id: string;
  calendarId: string;
  startAt: string;
  endAt: string;
  status: number;
}

export interface TokenValidationResult {
  status: string;
  isValid: boolean;
}

export const selfServiceBookingApi = {
  getBookingDetails: async (token: string): Promise<BookingDetails> => {
    const response = await axios.get(`${API_BASE}/public/booking/manage/${token}`);
    return response.data;
  },

  cancelBooking: async (token: string, reason?: string): Promise<void> => {
    await axios.post(`${API_BASE}/public/booking/cancel/${token}`, { reason });
  },

  rescheduleBooking: async (token: string, newSlotId: string): Promise<void> => {
    await axios.post(`${API_BASE}/public/booking/reschedule/${token}`, { newSlotId });
  },

  getAvailableSlots: async (token: string, start: string, end: string): Promise<TimeSlot[]> => {
    const response = await axios.get(
      `${API_BASE}/public/booking/${token}/available-slots`,
      { params: { start, end } }
    );
    return response.data;
  },

  validateToken: async (token: string): Promise<TokenValidationResult> => {
    const response = await axios.get(`${API_BASE}/public/booking/validate/${token}`);
    return response.data;
  },
};

export const useBookingDetails = (token: string) => {
  return useQuery({
    queryKey: ['publicBooking', token],
    queryFn: () => selfServiceBookingApi.getBookingDetails(token),
    enabled: !!token,
    retry: false,
  });
};

export const useCancelBooking = (token: string) => {
  return useMutation({
    mutationFn: (reason?: string) => selfServiceBookingApi.cancelBooking(token, reason),
  });
};

export const useRescheduleBooking = (token: string) => {
  return useMutation({
    mutationFn: (newSlotId: string) => selfServiceBookingApi.rescheduleBooking(token, newSlotId),
  });
};