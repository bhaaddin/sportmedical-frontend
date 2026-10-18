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
