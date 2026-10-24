import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The live connection is a convenience: it opens after the first paint, its library is loaded on demand (not part of the
 * entry every page downloads), and a browser that signed out meanwhile never connects.
 */
const built: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      const connection = {
        state: 'Disconnected',
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        onclose: vi.fn(),
        onreconnected: vi.fn(),
      };
      built.push(connection);
      return connection;
    }
  }
  return { HubConnectionBuilder, LogLevel: { Warning: 3 }, HubConnectionState: { Connected: 'Connected', Reconnecting: 'Reconnecting' } };
});

async function freshService() {
  vi.resetModules();
  const mod = await import('./socketService');
  return mod.socketService;
}

beforeEach(() => {
  built.length = 0;
  localStorage.clear();
  localStorage.setItem('token', 't');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('socketService.connect', () => {
  it('does not open the hub synchronously: the first screen is not delayed by it', async () => {
    const service = await freshService();
    service.connect();
    expect(built).toHaveLength(0);
    await vi.waitFor(() => expect(built).toHaveLength(1), { timeout: 3000 });
    expect(built[0]?.start).toHaveBeenCalledTimes(1);
    await service.stop();
  });

  it('opens one connection however many screens ask for it', async () => {
    const service = await freshService();
    service.connect();
    service.connect();
    service.connect();
    await vi.waitFor(() => expect(built).toHaveLength(1), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(built).toHaveLength(1);
    await service.stop();
  });

  it('does nothing for a browser that is not signed in', async () => {
    localStorage.clear();
    const service = await freshService();
    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(built).toHaveLength(0);
  });

  it('never connects a browser that signed out while the connection was still being prepared', async () => {
    const service = await freshService();
    service.connect();
    await service.stop();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(built).toHaveLength(0);
  });

  it('can connect again after a sign-out and a new sign-in', async () => {
    const service = await freshService();
    service.connect();
    await service.stop();
    service.connect();
    await vi.waitFor(() => expect(built).toHaveLength(1), { timeout: 3000 });
    await service.stop();
  });
});

describe('socketService calendar groups', () => {
  async function connected() {
    const service = await freshService();
    service.connect();
    await vi.waitFor(() => expect(built).toHaveLength(1), { timeout: 3000 });
    const connection = built[0] as unknown as { state: string; invoke: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
    connection.invoke = vi.fn().mockResolvedValue([]);
    connection.state = 'Connected';
    return { service, connection };
  }

  it('joins once per calendar however many screens ask, and leaves when the last one goes', async () => {
    const { service, connection } = await connected();
    const one = service.watchCalendars(['a', 'b']);
    const two = service.watchCalendars(['b', 'c']);
    expect(connection.invoke.mock.calls).toEqual([
      ['JoinCalendars', ['a', 'b']],
      ['JoinCalendars', ['c']],
    ]);
    one();
    one();
    expect(connection.invoke).toHaveBeenLastCalledWith('LeaveCalendars', ['a']);
    two();
    expect(connection.invoke).toHaveBeenLastCalledWith('LeaveCalendars', ['b', 'c']);
    await service.stop();
  });

  it('an older hub without the method, or one that refuses, is silent', async () => {
    const { service, connection } = await connected();
    connection.invoke.mockRejectedValue(new Error('Method does not exist'));
    expect(() => service.watchCalendars(['a'])).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    await service.stop();
  });

  it('asking before the hub is up is remembered and sent when it comes up', async () => {
    const service = await freshService();
    service.watchCalendars(['a']);
    service.connect();
    await vi.waitFor(() => expect(built).toHaveLength(1), { timeout: 3000 });
    await service.stop();
  });

  it('relays calendarChanged to its listeners and ignores anything else', async () => {
    const { service, connection } = await connected();
    const seen: unknown[] = [];
    service.on('calendarChanged', (m) => seen.push(m));
    const handler = connection.on.mock.calls.find((c) => c[0] === 'calendarChanged')![1] as (m: unknown) => void;
    handler({ calendarIds: ['a'], from: '2026-11-02', to: '2026-11-03', kinds: ['appointment'] });
    handler('garbage');
    handler(null);
    expect(seen).toEqual([{ calendarIds: ['a'], from: '2026-11-02', to: '2026-11-03', kinds: ['appointment'] }]);
    await service.stop();
  });
});
