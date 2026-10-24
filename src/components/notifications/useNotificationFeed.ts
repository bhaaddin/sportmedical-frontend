/*
 * The notification feed behind every bell: the list from the server, the
 * "when did I last look" marker, the unread count and the four things a person
 * can do with a row (open it, mark everything read, delete it, stamp that the
 * panel was seen).
 *
 * Lifted out of `NotificationCenter` so the sidebar bell and the planner's bell
 * read the same feed in the same way, with the same rules:
 *   - the list from the server is the truth, the socket is only the fast path,
 *     so the feed also asks on a timer while the tab is visible;
 *   - a change is shown only once the server agreed to it;
 *   - two bells on screen at once stay in step (`announceChange`) instead of
 *     each waiting for its own next poll.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export interface FeedNotification {
  id: string;
  type: 'appointment' | 'document' | 'system' | 'alert' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  /** Machine-readable event, used for grouping. Absent means "do not group". */
  kind?: string | null;
}

export interface NotificationFeedMessages {
  /** Where a message for the person goes; the sidebar bell uses the app's toaster. */
  success: (message: string) => void;
  error: (message: string) => void;
}

const appMessages: NotificationFeedMessages = {
  success: (message) => void toast.success(message),
  error: (message) => void toast.error(message),
};

/* One feed per bell, one channel between them. */
const siblings = new Set<() => void>();
const announceChange = (except: () => void) => {
  seedList = null;
  seedSeen = null;
  siblings.forEach((refresh) => {
    if (refresh !== except) refresh();
  });
};

const POLL_MS = 60_000;

/** The newest row's instant as an ISO string with an offset (what `?since=` takes), or null when there is none to go by. */
export function newestInstant(list: readonly FeedNotification[]): string | null {
  const times = list.map((n) => Date.parse(n.timestamp)).filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
}

/**
 * The answer to `?since=`: a server that has the parameter sends only rows after it, which are put in front of what is
 * held; an older one ignores it and sends the whole list (it includes rows at or before `since`), which replaces it.
 */
export function mergeSince(held: readonly FeedNotification[], answer: readonly FeedNotification[], since: string): FeedNotification[] {
  if (answer.some((n) => Date.parse(n.timestamp) <= Date.parse(since))) return [...answer];
  return [...answer, ...held.filter((n) => !answer.some((a) => a.id === n.id))];
}

/*
 * What the last bell to ask was told, kept for a moment. Every page draws its own bell, so each navigation used to
 * download the whole list (the largest answer on most screens) again, and the sidebar's bell and the planner's bell,
 * mounted a render apart, asked for the very list the other had just received. A bell that mounts within SEED_MS of an
 * answer starts from it instead of asking again; the socket's nudge and the 60 s poll still refresh it, and any change
 * made here (read, deleted, seen) empties it, so a bell never starts from a list that is known to be out of date.
 */
const SEED_MS = 15_000;
let seedList: { at: number; list: FeedNotification[] } | null = null;
let seedSeen: { at: number; seenAt: string | null } | null = null;
const freshList = () => (seedList !== null && Date.now() - seedList.at < SEED_MS ? seedList : null);
const freshSeen = () => (seedSeen !== null && Date.now() - seedSeen.at < SEED_MS ? seedSeen : null);

/**
 * Test hook: a bell on a new test starts from nothing. The shared test setup reaches it through `globalThis`, so that
 * setting up every test does not import this module (and with it the HTTP client) before the test's own mocks exist.
 */
export function resetNotificationFeedForTests(): void {
  seedList = null;
  seedSeen = null;
}
(globalThis as { __smResetNotificationFeed?: () => void }).__smResetNotificationFeed = resetNotificationFeedForTests;

export interface NotificationFeed {
  notifications: FeedNotification[];
  loading: boolean;
  lastSeenAt: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  /** Marks one row read on the server. Resolves with the row (so the caller can follow its link), or undefined. */
  markRead: (id: string) => Promise<FeedNotification | undefined>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** The panel was looked at: the server moves the marker forward. */
  stampSeen: () => Promise<void>;
}

export function useNotificationFeed(messages: NotificationFeedMessages = appMessages): NotificationFeed {
  const [notifications, setNotifications] = useState<FeedNotification[]>(() => freshList()?.list ?? []);
  const [loading, setLoading] = useState(() => freshList() === null);
  /*
   * When this viewer last opened the panel, straight from the server. Null until
   * the server sends it, and then no "new since" line is drawn at all - a divider
   * in the wrong place is worse than none.
   */
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => freshSeen()?.seenAt ?? null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const selfRef = useRef<() => void>(() => undefined);

  const fetchNotifications = useCallback(async (options: { incremental?: boolean } = {}) => {
    try {
      const since = options.incremental ? newestInstant(notificationsRef.current) : null;
      const res = since === null ? await client.get('/api/notifications') : await client.get('/api/notifications', { params: { since } });
      const data = res.data?.value ?? res.data;
      const list: FeedNotification[] = Array.isArray(data) ? data : data?.items ?? [];
      const next = since === null ? list : mergeSince(notificationsRef.current, list, since);
      setNotifications(next);
      seedList = { at: Date.now(), list: next };
    } catch {
      /* Keep what is on screen; the next poll asks again. */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLastSeen = useCallback(async () => {
    try {
      const res = await client.get('/api/notifications/seen');
      const at = res.data?.lastSeenAtUtc ?? null;
      setLastSeenAt(typeof at === 'string' ? at : null);
      seedSeen = { at: Date.now(), seenAt: typeof at === 'string' ? at : null };
    } catch {
      /* Older servers have no such route. No marker, no line. */
      setLastSeenAt(null);
    }
  }, []);

  useEffect(() => {
    if (freshList() === null) void fetchNotifications();
    if (freshSeen() === null) void fetchLastSeen();
  }, [fetchNotifications, fetchLastSeen]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void fetchNotifications();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const refresh = () => void fetchNotifications();
    selfRef.current = refresh;
    siblings.add(refresh);
    return () => {
      siblings.delete(refresh);
    };
  }, [fetchNotifications]);

  useRealtimeSync({
    onReconnected: () => void fetchNotifications(),
    /* A nudge means something new arrived: ask only for what came after the newest row held (the poll reads it all). */
    onNotificationsChanged: () => void fetchNotifications({ incremental: true }),
  });

  const markRead = useCallback(async (id: string) => {
    const note = notificationsRef.current.find((n) => n.id === id);
    if (note === undefined) return undefined;
    if (!note.read) {
      try {
        await client.patch(`/api/notifications/${id}/read`);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        announceChange(selfRef.current);
      } catch {
        messagesRef.current.error('Oznámení se nepodařilo označit jako přečtené.');
      }
    }
    return note;
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await client.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      messagesRef.current.success('Vše označeno jako přečtené');
      announceChange(selfRef.current);
    } catch {
      messagesRef.current.error('Oznámení se nepodařilo označit jako přečtená. Zkuste to prosím znovu.');
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await client.delete(`/api/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      announceChange(selfRef.current);
    } catch {
      messagesRef.current.error('Oznámení se nepodařilo smazat. Zkuste to prosím znovu.');
    }
  }, []);

  const stampSeen = useCallback(async () => {
    try {
      const res = await client.post('/api/notifications/seen');
      const at = res.data?.lastSeenAtUtc ?? null;
      seedSeen = null;
      if (typeof at === 'string') setLastSeenAt(at);
    } catch {
      /* Failing to stamp shows the line again next time - a repeat, not a loss. */
    }
  }, []);

  return {
    notifications,
    loading,
    lastSeenAt,
    unreadCount: notifications.filter((n) => !n.read).length,
    refresh: () => fetchNotifications(),
    markRead,
    markAllRead,
    remove,
    stampSeen,
  };
}
