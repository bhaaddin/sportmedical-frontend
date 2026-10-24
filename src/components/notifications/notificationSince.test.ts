import { describe, expect, it } from 'vitest';
import { mergeSince, newestInstant, type FeedNotification } from './useNotificationFeed';

const n = (id: string, timestamp: string, read = false): FeedNotification => ({ id, type: 'info', title: id, message: '', timestamp, read });

describe('notification ?since', () => {
  const held = [n('b', '2026-10-24T10:00:00Z'), n('a', '2026-10-24T09:00:00Z', true)];

  it('takes the newest row as the instant to ask from', () => {
    expect(newestInstant(held)).toBe('2026-10-24T09:59:59.999Z');
    expect(newestInstant([])).toBeNull();
    expect(newestInstant([n('x', 'nonsense')])).toBeNull();
  });

  it('a server that has the parameter: the new rows go in front of what is held', () => {
    const merged = mergeSince(held, [n('c', '2026-10-24T11:00:00Z')], '2026-10-24T09:59:59.999Z');
    expect(merged.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('nothing new: what is held stays', () => {
    expect(mergeSince(held, [], '2026-10-24T09:59:59.999Z')).toEqual(held);
  });

  it('an older server ignores the parameter and sends the whole list: it replaces what is held', () => {
    const whole = [n('c', '2026-10-24T11:00:00Z'), n('b', '2026-10-24T10:00:00Z', true), n('a', '2026-10-24T09:00:00Z', true)];
    expect(mergeSince(held, whole, '2026-10-24T09:59:59.999Z')).toEqual(whole);
  });

  it('the server row wins on an id both have (read flag), once each', () => {
    const merged = mergeSince(held, [n('b', '2026-10-24T10:00:00Z', true), n('b', '2026-10-24T10:00:00Z', true)], '2026-10-24T09:59:59.999Z');
    expect(merged.map((x) => x.id)).toEqual(['b', 'a']);
    expect(merged[0]!.read).toBe(true);
  });
});
