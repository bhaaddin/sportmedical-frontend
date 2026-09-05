import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useSignalR(
  onPatientUpdate?: (data: unknown) => void,
  onAppointmentUpdate?: (data: unknown) => void,
  onInjuryUpdate?: (data: unknown) => void,
  onMeasurementUpdate?: (data: unknown) => void,
) {
  const connectionRef = useRef<HubConnection | null>(null);

  const startConnection = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/notifications`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('PatientUpdated', (data) => onPatientUpdate?.(data));
    connection.on('AppointmentUpdated', (data) => onAppointmentUpdate?.(data));
    connection.on('InjuryUpdated', (data) => onInjuryUpdate?.(data));
    connection.on('MeasurementUpdated', (data) => onMeasurementUpdate?.(data));

    try {
      await connection.start();
      connectionRef.current = connection;
    } catch {
      // Will auto-reconnect
    }
  }, [onPatientUpdate, onAppointmentUpdate, onInjuryUpdate, onMeasurementUpdate]);

  useEffect(() => {
    startConnection();

    return () => {
      connectionRef.current?.stop();
    };
  }, [startConnection]);

  return {
    subscribePatient: (patientId: string) => {
      connectionRef.current?.invoke('SubscribePatient', patientId);
    },
    unsubscribePatient: (patientId: string) => {
      connectionRef.current?.invoke('UnsubscribePatient', patientId);
    },
    connection: connectionRef.current,
  };
}
