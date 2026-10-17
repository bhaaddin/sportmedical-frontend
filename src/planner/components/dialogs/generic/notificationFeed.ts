/*
 * The application's notification feed, with its messages routed to the planner's own toast
 * instead of the application toaster (which sits outside the stage). Same data, same rules:
 * everything else is `useNotificationFeed`.
 */
import { useMemo } from 'react';
import { useNotificationFeed, type NotificationFeed } from '../../../../components/notifications/useNotificationFeed';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';

export function usePlannerNotificationFeed(): NotificationFeed {
  const act = usePlannerActions();
  const messages = useMemo(() => ({ success: (m: string) => act.toast(m), error: (m: string) => act.toast(m) }), [act]);
  return useNotificationFeed(messages);
}
