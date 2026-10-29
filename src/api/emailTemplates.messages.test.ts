/* The messages contract (2026-10-29) as the client reads and writes it. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailTemplatesApi } from './emailTemplates';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock('./client', () => {
  const client = {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
    delete: (...a: unknown[]) => del(...a),
  };
  return { default: client, client };
});

const view = {
  code: 'club-block-booked', name: 'Klub: blok rezervován', category: 'club', description: 'd', subject: 's', bodyHtml: '<p>x</p>',
  placeholders: [], isCustomized: false, version: 1,
};

beforeEach(() => { [get, post, put, del].forEach((m) => m.mockReset()); });

describe('template view', () => {
  it('reads the three new fields', async () => {
    get.mockResolvedValue({ data: [{ ...view, isCustom: false, autoSend: true, audience: 'club' }, { ...view, code: 'vlastni-x', isCustom: true, autoSend: null, audience: 'any' }] });
    const list = await emailTemplatesApi.list();
    expect(list[0]).toMatchObject({ isCustom: false, autoSend: true, audience: 'club' });
    expect(list[1]).toMatchObject({ isCustom: true, autoSend: null, audience: 'any' });
  });

  it('defaults them for a server that predates the contract', async () => {
    get.mockResolvedValue({ data: [view] });
    const [one] = await emailTemplatesApi.list();
    expect(one).toMatchObject({ isCustom: false, autoSend: null, audience: 'patient' });
  });

  it('refuses an unknown audience', async () => {
    get.mockResolvedValue({ data: [{ ...view, audience: 'staff' }] });
    await expect(emailTemplatesApi.list()).rejects.toBeDefined();
  });
});

describe('writes', () => {
  it('creates a custom template', async () => {
    post.mockResolvedValue({ data: { ...view, code: 'vlastni-posun', isCustom: true, audience: 'club' } });
    await emailTemplatesApi.create({ name: 'Posun', subject: 's', bodyHtml: 'b', audience: 'club' });
    expect(post).toHaveBeenCalledWith('/api/email-templates', { name: 'Posun', subject: 's', bodyHtml: 'b', audience: 'club' });
  });

  it('sends the name only when given, and encodes the code', async () => {
    put.mockResolvedValue({ data: view });
    await emailTemplatesApi.save('a b', 's', 'b');
    expect(put).toHaveBeenLastCalledWith('/api/email-templates/a%20b', { subject: 's', bodyHtml: 'b' });
    await emailTemplatesApi.save('vlastni-x', 's', 'b', 'Nové jméno');
    expect(put).toHaveBeenLastCalledWith('/api/email-templates/vlastni-x', { name: 'Nové jméno', subject: 's', bodyHtml: 'b' });
  });

  it('toggles auto-send and deletes', async () => {
    put.mockResolvedValue({ data: null });
    del.mockResolvedValue({ data: null });
    await emailTemplatesApi.setAutoSend('booking-reminder', false);
    expect(put).toHaveBeenCalledWith('/api/email-templates/booking-reminder/auto-send', { enabled: false });
    await emailTemplatesApi.remove('vlastni-x');
    expect(del).toHaveBeenCalledWith('/api/email-templates/vlastni-x');
  });

  it('reads and writes the calendar alarms', async () => {
    get.mockResolvedValue({ data: { alarmMinutes: [1440, 60] } });
    put.mockResolvedValue({ data: null });
    expect(await emailTemplatesApi.getCalendar()).toEqual({ alarmMinutes: [1440, 60] });
    await emailTemplatesApi.saveCalendar([60]);
    expect(put).toHaveBeenCalledWith('/api/email-templates/calendar', { alarmMinutes: [60] });
  });
});

describe('send', () => {
  const answer = { recipients: 12, skippedWithoutEmail: 2, subject: 'Posun', bodyHtml: '<p>Ahoj</p>', queued: 0 };

  it('posts the target and the dry-run flag', async () => {
    post.mockResolvedValue({ data: answer });
    const result = await emailTemplatesApi.send('vlastni-posun', { kind: 'club', id: 'c1', includePlayers: true }, true);
    expect(post).toHaveBeenCalledWith('/api/email-templates/vlastni-posun/send', { target: { kind: 'club', id: 'c1', includePlayers: true }, dryRun: true });
    expect(result).toEqual(answer);
  });

  it('refuses an answer without the counts', async () => {
    post.mockResolvedValue({ data: { subject: 's' } });
    await expect(emailTemplatesApi.send('x', { kind: 'patient', id: 'p' }, true)).rejects.toBeDefined();
  });
});
