import { Badge, BadgeProps, Tooltip } from '@mui/material';

interface NotificationBadgeProps extends BadgeProps {
  count: number;
  max?: number;
  showZero?: boolean;
  tooltip?: string;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

export default function NotificationBadge({ count, max = 99, showZero = false, tooltip, color = 'error', children, ...props }: NotificationBadgeProps) {
  const displayCount = count > max ? `${max}+` : count;
  const showBadge = count > 0 || showZero;

  const badge = (
    <Badge
      badgeContent={displayCount}
      color={color}
      invisible={!showBadge}
      sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 18, minWidth: 18, padding: '0 4px' } }}
      {...props}
    >
      {children}
    </Badge>
  );

  return tooltip ? <Tooltip title={tooltip}>{badge}</Tooltip> : badge;
}
