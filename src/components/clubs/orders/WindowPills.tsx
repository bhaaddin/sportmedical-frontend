/*
 * The windows ("termíny") of ONE club order, as small read-only pills: date and hours. The same list is the order
 * card's "Termíny", the calendar popover's list (the clicked window highlighted) and, with `onRemove`, the order
 * detail's list where each upcoming window has a "×" that takes exactly that window out of the order.
 */
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { orderWindows, windowIsUpcoming, windowLabel } from './orderWindows';

export function WindowPills({ order, today, highlightBlockId, onRemove, removeBlockedReason, testId = 'order-windows' }: {
  order: Pick<ClubOrderView, 'blocks'>;
  /** yyyy-MM-dd; windows already over cannot be removed. */
  today: string;
  highlightBlockId?: string | null;
  /** Present = every upcoming window gets a "×". */
  onRemove?: (block: ClubBlockView) => void;
  /** Present = the "×" is disabled with this reason (the order's last window). */
  removeBlockedReason?: string | null;
  testId?: string;
}) {
  const windows = orderWindows(order);
  if (windows.length === 0) return null;
  return (
    <Stack direction="row" component="ul" data-testid={testId} sx={{ m: 0, p: 0, listStyle: 'none', gap: 0.75, flexWrap: 'wrap' }}>
      {windows.map((b) => {
        const label = windowLabel(b);
        const clicked = highlightBlockId === b.id;
        const removable = onRemove !== undefined && windowIsUpcoming(b, today);
        return (
          <Box
            key={b.id}
            component="li"
            data-testid="order-window"
            data-clicked={clicked ? 'true' : 'false'}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.25, minHeight: 36, maxWidth: '100%',
              pl: 1.25, pr: removable ? 0.25 : 1.25, borderRadius: 4,
              border: '1px solid', borderColor: clicked ? 'primary.main' : 'divider',
              bgcolor: clicked ? 'action.selected' : 'transparent',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: clicked ? 700 : 500, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{label}</Typography>
            {removable ? (
              <IconButton
                size="small"
                aria-label={`Odebrat termín ${label}`}
                title={removeBlockedReason ?? undefined}
                disabled={removeBlockedReason != null}
                onClick={() => onRemove(b)}
                sx={{ width: 36, height: 36 }}
              >
                <Close fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}

export default WindowPills;
