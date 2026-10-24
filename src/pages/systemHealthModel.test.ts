import { describe, expect, it } from 'vitest';
import { gigabytes, healthAttention, readHealth, waitText, type HealthView } from './systemHealthModel';

const healthy: HealthView = {
  status: 'ok', dbLatencyMs: 4, dbReachable: true, pendingMigrations: 0, activeSessions: 2, timestamp: '2026-10-24T08:00:00Z',
  outboxPending: 0, outboxFailed: 0, outboxOldestMinutes: null, smtpConfigured: true, storageWritable: true,
  storageFreeBytes: 10 * 1024 ** 3, storageTotalBytes: 20 * 1024 ** 3, version: '1.0',
};

describe('healthAttention: only what the measured answer says is wrong', () => {
  it('draws nothing when the answer did not come, and nothing when all is well', () => {
    expect(healthAttention(null)).toBeNull();
    expect(healthAttention(healthy)).toBeNull();
  });

  it('does not treat an unmeasured field as a problem', () => {
    expect(healthAttention(readHealth({}))).toBeNull();
  });

  it('lists failed messages as a high case linked to the e-mail settings', () => {
    const group = healthAttention({ ...healthy, outboxFailed: 3 });
    expect(group?.severity).toBe('high');
    expect(group?.count).toBe(1);
    expect(group?.items[0]).toMatchObject({ id: 'outbox-failed', title: 'Neodeslané zprávy: 3', to: '/nastaveni/email' });
    expect(group?.summary).toBe('Jedna věc potřebuje nastavit.');
  });

  it('a missing e-mail server is medium, and hides the "waiting long" case it would explain', () => {
    const group = healthAttention({ ...healthy, smtpConfigured: false, outboxPending: 5, outboxOldestMinutes: 300 });
    expect(group?.severity).toBe('medium');
    expect(group?.items.map((i) => i.id)).toEqual(['smtp']);
  });

  it('flags a queue whose oldest message waited an hour or more, not before', () => {
    expect(healthAttention({ ...healthy, outboxPending: 2, outboxOldestMinutes: 59 })).toBeNull();
    const group = healthAttention({ ...healthy, outboxPending: 2, outboxOldestMinutes: 125 });
    expect(group?.items).toHaveLength(1);
    expect(group?.items[0]).toMatchObject({ id: 'outbox-old', detail: 'Nejstarší čeká 2 h.' });
  });

  it('an unwritable store is high and links to the media storage settings; several cases pluralise', () => {
    const group = healthAttention({ ...healthy, storageWritable: false, smtpConfigured: false, outboxFailed: 1 });
    expect(group?.severity).toBe('high');
    expect(group?.count).toBe(3);
    expect(group?.items.find((i) => i.id === 'storage')?.to).toBe('/nastaveni/uloziste-medii');
    expect(group?.summary).toBe('3 věci potřebují nastavit.');
    expect(group?.action).toEqual({ label: 'Otevřít nastavení', to: group?.items[0].to });
  });
});

describe('readHealth and its words', () => {
  it('reads the nested contract and falls back to the old flat latency', () => {
    expect(readHealth({ status: 'ok', database: { latencyMs: 7, reachable: true } })).toMatchObject({ status: 'ok', dbLatencyMs: 7, dbReachable: true });
    expect(readHealth({ dbLatencyMs: 9 }).dbLatencyMs).toBe(9);
    expect(readHealth({ status: 'weird' }).status).toBe('unknown');
  });

  it('writes gigabytes and waits the way a person reads them', () => {
    expect(gigabytes(null)).toBe('—');
    expect(gigabytes(Math.round(27.5 * 1024 ** 3))).toBe('27,5 GB');
    expect(waitText(null)).toBe('—');
    expect(waitText(12)).toBe('12 min');
    expect(waitText(300)).toBe('5 h');
    expect(waitText(60 * 24 * 16 + 120)).toBe('16 dní 2 h');
    expect(waitText(60 * 24 * 2)).toBe('2 dní');
  });
});
