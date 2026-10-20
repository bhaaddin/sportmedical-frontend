/*
 * PlannerUserTools - the two account tools every planner header carries, `<nav class="club-top-userbar">`:
 *
 *   bell          the unread count of the application's notifications (badge, 99+), opens the `notifications` dialog
 *   profile chip  the signed-in person (initials, name), opens the `profile` dialog
 *
 * Used by the club's full header (`ClubHeader`, upper right of the banner) and by the standard calendar's slim top bar
 * (`ClinicTopBar`); the markup, ids and test ids are the file's (`#club-bell-count`, `data-command="profile"`).
 */
import { usePlannerActions } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { initialsOf, usePlannerUser } from './dialogs/generic/account';
import { usePlannerNotificationFeed } from './dialogs/generic/notificationFeed';

export interface PlannerUserToolsProps {
  /** The signed-in person shown in the profile chip; falls back to the stored sign-in, then a neutral label. */
  user?: { displayName: string } | null;
}

export function PlannerUserTools({ user = null }: PlannerUserToolsProps) {
  const act = usePlannerActions();
  const feed = usePlannerNotificationFeed();
  const account = usePlannerUser();
  const displayName = user?.displayName?.trim() || account?.displayName || 'Uživatel';
  const unread = feed.unreadCount;
  return (
    <nav className="club-top-userbar" aria-label="Uživatelské nástroje">
      <div className="club-user-actions">
        <button
          type="button"
          className="club-user-bell"
          data-command="notification"
          aria-label="Oznámení"
          aria-describedby={unread > 0 ? 'club-bell-count' : undefined}
          title={unread > 0 ? `Oznámení (${unread} nepřečtených)` : 'Oznámení'}
          onClick={() => act.openDialog({ kind: 'notifications' })}
        >
          <Icon name="bell" />
          {unread > 0 ? (
            <span className="club-bell-badge" id="club-bell-count" data-testid="club-bell-count" aria-label={`${unread} nepřečtených oznámení`}>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
        <button type="button" className="club-user-chip" data-command="profile" aria-label={`Profil uživatele ${displayName}`} title="Profil uživatele" onClick={() => act.openDialog({ kind: 'profile' })}>
          <span className="club-user-avatar">{initialsOf(displayName)}</span>
          <span className="club-user-name">{displayName}</span>
          <span className="club-user-chevron"><Icon name="chevron-down" /></span>
        </button>
      </div>
    </nav>
  );
}
