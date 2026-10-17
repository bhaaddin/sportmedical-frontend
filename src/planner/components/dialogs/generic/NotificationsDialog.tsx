/*
 * `notifications` - the bell's dialog (prototype `notifications()`).
 *
 * Two parts:
 *   1. the application's own notifications (the same feed the sidebar bell shows: grouping, the
 *      "nové od vašeho posledního pohledu" line, read / delete / read-all), drawn in the planner's
 *      list language; a row with a link opens that page;
 *   2. the prototype's occupancy summary of the terms on the board (full / still empty), whose
 *      rows open the term.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildNotificationSections,
  exactNotificationTime,
  formatNotificationTime,
  groupLabel,
  newSinceBoundary,
  type NotificationRow,
} from '../../../../components/notifications/notificationList';
import { notificationsModel, sourceFor } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import { useAppNavigate } from './account';
import { usePlannerNotificationFeed } from './notificationFeed';

function NotificationsBody({ close }: { close: () => void }) {
  const feed = usePlannerNotificationFeed();
  const ctx = usePlannerCtx();
  const act = usePlannerActions();
  const navigate = useAppNavigate();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const sections = useMemo(
    () => buildNotificationSections(feed.notifications, { lastSeenAt: feed.lastSeenAt }),
    [feed.notifications, feed.lastSeenAt],
  );
  const boundary = useMemo(() => newSinceBoundary(sections), [sections]);

  /* The line "nové od vašeho posledního pohledu" has to survive the whole look: stamp on close. */
  const stamp = useRef(feed.stampSeen);
  stamp.current = feed.stampSeen;
  useEffect(() => () => void stamp.current(), []);

  const open = async (row: NotificationRow) => {
    const note = await feed.markRead(row.id);
    if (note?.actionUrl) {
      close();
      navigate(note.actionUrl);
    }
  };

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const line = (row: NotificationRow, nested = false) => (
    <div className={`generic-note${row.read ? '' : ' is-unread'}${nested ? ' is-nested' : ''}`} key={row.id} data-testid="notification-row">
      <button type="button" className="search-result" onClick={() => void open(row)}>
        <span>
          <strong>{row.title}</strong>
          <small>{row.message}</small>
        </span>
        <span className="result-aux" title={`přišlo ${exactNotificationTime(row.timestamp)}`}>
          {formatNotificationTime(row.timestamp)}
        </span>
      </button>
      <button type="button" className="generic-note-delete" aria-label="Smazat oznámení" title="Smazat oznámení" onClick={() => void feed.remove(row.id)}>
        ×
      </button>
    </div>
  );

  const occupancy = notificationsModel(ctx);
  const openTerm = (id: string) => {
    const term = ctx.sessions.find((s) => s.id === id);
    act.openDialog(term && sourceFor(term) === 'club' ? { kind: 'agendaDetail', id } : { kind: 'eventDetail', id });
  };

  return (
    <>
      <div className="generic-note-head">
        <span className="event-info-note generic-note-summary" data-testid="notification-summary">
          {feed.loading
            ? 'Načítám oznámení…'
            : feed.notifications.length === 0
              ? 'Žádná nová oznámení.'
              : `${feed.unreadCount} nepřečtených · ${feed.notifications.length} celkem`}
        </span>
        {feed.unreadCount > 0 ? (
          <button type="button" className="app-button" onClick={() => void feed.markAllRead()}>Přečíst vše</button>
        ) : null}
      </div>

      <div className="generic-note-scroll" data-testid="notification-list">
      {sections.map((section) => (
        <section className="generic-note-day" key={section.key} aria-label={section.heading}>
          <h3 className="contact-subheading">{section.heading}</h3>
          {section.entries.map((entry, index) => {
            const divider =
              boundary !== null && boundary.sectionKey === section.key && boundary.index === index ? (
                <div className="generic-note-boundary" key={`${section.key}-boundary`}>Nové od vašeho posledního pohledu</div>
              ) : null;
            if (entry.entry === 'group') {
              const key = `${section.key}-${entry.kind}-${entry.timestamp}`;
              const isOpen = expanded.has(key);
              return (
                <div key={key}>
                  {divider}
                  <button type="button" className="search-result generic-note-group" aria-expanded={isOpen} onClick={() => toggle(key)}>
                    <span>
                      <strong>{groupLabel(entry.kind, entry.rows.length)}</strong>
                      <small>{entry.unreadCount > 0 ? `${entry.unreadCount} nepřečtených` : 'vše přečteno'}</small>
                    </span>
                    <span className="result-aux">{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen ? entry.rows.map((row) => line(row, true)) : null}
                </div>
              );
            }
            return (
              <div key={entry.row.id}>
                {divider}
                {line(entry.row)}
              </div>
            );
          })}
        </section>
      ))}
      </div>

      <h3 className="contact-subheading generic-note-occupancy-title">Obsazenost termínů</h3>
      <div className="event-info-note" data-testid="occupancy-summary">{occupancy.summary}</div>
      {[...occupancy.full, ...occupancy.empty].map((r) => (
        <button type="button" className="search-result" key={`${r.label}-${r.id}`} onClick={() => openTerm(r.id)}>
          <span>{r.label}</span>
          <span className="result-aux">{r.aux}</span>
        </button>
      ))}
    </>
  );
}

export const notificationsDialog: DialogRenderer<'notifications'> = ({ close }) => ({
  body: <NotificationsBody close={close} />,
});
