/* ══════════════════════════════════════════════════════════════
   USE PRESENCE HOOK
   Tracks online users and broadcasts current activity.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import { socketService, SOCKET_EVENTS } from '../services/socketService';

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  avatarColor: string;
  activity: 'idle' | 'viewing_calendar' | 'editing_patient' | 'running_diagnostics' | 'writing_document' | 'in_billing';
  lastSeen: number;
  currentPage?: string;
}

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const unsub = socketService.on(SOCKET_EVENTS.SYSTEM_SESSION_UPDATE, (data: { users: PresenceUser[] }) => {
      if (data.users) setOnlineUsers(data.users);
    });
    return () => { unsub(); };
  }, []);

  const broadcastActivity = useCallback((activity: PresenceUser['activity'], page?: string) => {
    socketService.send('presence:update', { activity, page });
  }, []);

  return { onlineUsers, broadcastActivity };
}
