/* ══════════════════════════════════════════════════════════════
   USER PRESENCE — Collaborative presence indicator
   Shows online users with avatars, activity status, and
   real-time presence updates via WebSocket.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Box, Typography, Avatar, AvatarGroup, Tooltip, Chip, Badge } from '@mui/material';
import { Circle, Edit, CalendarMonth, Science, Description } from '@mui/icons-material';
import type { PresenceUser } from '../hooks/usePresence';

/* ── Config ── */
const ACTIVITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  idle: { label: 'Nečinný', icon: <Circle sx={{ fontSize: 10 }} />, color: '#9E9E9E' },
  viewing_calendar: { label: 'Prohlíží kalendář', icon: <CalendarMonth sx={{ fontSize: 14 }} />, color: '#0D7377' },
  editing_patient: { label: 'Upravuje pacienta', icon: <Edit sx={{ fontSize: 14 }} />, color: '#0288D1' },
  running_diagnostics: { label: 'Spouští diagnostiku', icon: <Science sx={{ fontSize: 14 }} />, color: '#7C3AED' },
  writing_document: { label: 'Píše dokument', icon: <Description sx={{ fontSize: 14 }} />, color: '#EA580C' },
  in_billing: { label: 'Ve faktuře', icon: <Description sx={{ fontSize: 14 }} />, color: '#16A34A' },
};

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: '#B71C1C',
  Admin: '#D32F2F',
  HeadPhysician: '#0D7377',
  Doctor: '#0288D1',
  Nurse: '#7C3AED',
  Receptionist: '#16A34A',
};

/* ══════════════════════════════════════════════════════════════ */
interface UserPresenceBarProps {
  users: PresenceUser[];
  maxVisible?: number;
  activeThresholdMs?: number;
}

export default function UserPresenceBar({ users, maxVisible = 5, activeThresholdMs = 60_000 }: UserPresenceBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const online = users.filter(u => now - u.lastSeen < activeThresholdMs);
  const offline = users.filter(u => now - u.lastSeen >= activeThresholdMs);

  if (online.length === 0 && offline.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {/* Online users — avatar stack */}
      {online.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={online.length} color="success" max={99}
            sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 18, minWidth: 18 } }}>
            <AvatarGroup max={maxVisible} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 13 } }}>
              {online.map(user => {
                const act = ACTIVITY_CONFIG[user.activity] || ACTIVITY_CONFIG.idle;
                return (
                  <Tooltip key={user.userId} arrow
                    title={
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{user.name}</Typography>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span style={{ color: act.color }}>{act.icon}</span> {act.label}
                        </Typography>
                      </Box>
                    }>
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Circle sx={{ fontSize: 10, color: act.color, bgcolor: 'white', borderRadius: '50%', p: '2px' }} />
                      }>
                      <Avatar sx={{ bgcolor: ROLE_COLORS[user.role] || '#666', border: '2px solid white' }}>
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </Avatar>
                    </Badge>
                  </Tooltip>
                );
              })}
            </AvatarGroup>
          </Badge>
        </Box>
      )}

      {/* Activity chips — show what users are doing */}
      {online.length > 0 && online.length <= 3 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {online.map(user => {
            const act = ACTIVITY_CONFIG[user.activity] || ACTIVITY_CONFIG.idle;
            return (
              <Chip key={user.userId} size="small"
                icon={<>{act.icon}</>}
                label={`${user.name.split(' ')[0]}: ${act.label}`}
                sx={{
                  height: 24, fontSize: 11, fontWeight: 500,
                  bgcolor: `${act.color}12`, color: act.color,
                  border: `1px solid ${act.color}30`,
                  '& .MuiChip-icon': { color: act.color },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Offline users — grey avatars */}
      {offline.length > 0 && (
        <Tooltip title={`Offline: ${offline.map(u => u.name).join(', ')}`}>
          <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10, bgcolor: '#E0E0E0', color: '#999' } }}>
            {offline.map(user => (
              <Avatar key={user.userId}>{user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Avatar>
            ))}
          </AvatarGroup>
        </Tooltip>
      )}
    </Box>
  );
}
