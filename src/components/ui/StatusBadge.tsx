import { Chip, ChipProps, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

type StatusType =
  | 'scheduled' | 'confirmed' | 'in-progress' | 'completed'
  | 'cancelled' | 'overdue' | 'paid' | 'pending' | 'draft'
  | 'active' | 'inactive' | 'success' | 'warning' | 'error' | 'info';

interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  status: StatusType;
  size?: 'small' | 'medium';
  showDot?: boolean;
}

const statusStyles: Record<StatusType, { bg: string; color: string; dot: string }> = {
  scheduled: { bg: '#E3F2FD', color: '#1565C0', dot: '#2196F3' },
  confirmed: { bg: '#FFF3E0', color: '#E65100', dot: '#FF9800' },
  'in-progress': { bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
  completed: { bg: '#E8F5E9', color: '#1B5E20', dot: '#4CAF50' },
  cancelled: { bg: '#FFEBEE', color: '#B71C1C', dot: '#F44336' },
  overdue: { bg: '#FBE9E7', color: '#BF360C', dot: '#FF5722' },
  paid: { bg: '#E8F5E9', color: '#1B5E20', dot: '#4CAF50' },
  pending: { bg: '#FFF3E0', color: '#E65100', dot: '#FF9800' },
  draft: { bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' },
  active: { bg: '#E8F5E9', color: '#1B5E20', dot: '#4CAF50' },
  inactive: { bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' },
  success: { bg: '#E8F5E9', color: '#1B5E20', dot: '#4CAF50' },
  warning: { bg: '#FFF8E1', color: '#F57F17', dot: '#FFC107' },
  error: { bg: '#FFEBEE', color: '#B71C1C', dot: '#F44336' },
  info: { bg: '#E3F2FD', color: '#1565C0', dot: '#2196F3' },
};

const statusLabels: Record<StatusType, string> = {
  scheduled: 'Naplánovaný',
  confirmed: 'Potvrzený',
  'in-progress': 'Probíhá',
  completed: 'Dokončený',
  cancelled: 'Zrušený',
  overdue: 'Zpožděný',
  paid: 'Zaplaceno',
  pending: 'Čeká',
  draft: 'Koncept',
  active: 'Aktivní',
  inactive: 'Neaktivní',
  success: 'Úspěch',
  warning: 'Varování',
  error: 'Chyba',
  info: 'Informace',
};

const Dot = styled('span')<{ dotColor: string }>(({ dotColor }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: dotColor,
  marginRight: 6,
  flexShrink: 0,
}));

export default function StatusBadge({
  status,
  size = 'small',
  showDot = true,
  ...props
}: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.info;

  return (
    <Chip
      label={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {showDot && <Dot dotColor={style.dot} />}
          {statusLabels[status]}
        </Box>
      }
      size={size}
      sx={{
        backgroundColor: style.bg,
        color: style.color,
        fontWeight: 500,
        '& .MuiChip-label': {
          px: showDot ? 1 : 1.5,
        },
      }}
      {...props}
    />
  );
}
