/*
 * R14f: the buttons of every export follow `exports.download`. Allowed (stored permission, or the server says so, or an
 * older backend without the route): the button is plain. Not allowed: it is switched off and says why.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Button } from '@mui/material';

const { policy } = vi.hoisted(() => ({ policy: vi.fn() }));
vi.mock('../../api/exports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/exports')>();
  return { ...actual, exportsApi: { policy, authorize: vi.fn() } };
});

import { exportAccessOf, resetExportAccessForTests } from '../../auth/useExportAccess';
import { ExportGate } from './ExportGate';

function mount() {
  return render(<ExportGate>{(blocked) => <Button disabled={blocked}>Stáhnout</Button>}</ExportGate>);
}

describe('exportAccessOf', () => {
  it('allows a stored permission, an allowed policy, an older backend and an unanswered question', () => {
    expect(exportAccessOf(['exports.download'], 'forbidden').allowed).toBe(true);
    expect(exportAccessOf([], 'allowed').allowed).toBe(true);
    expect(exportAccessOf([], 'unsupported').allowed).toBe(true);
    expect(exportAccessOf([], undefined).allowed).toBe(true);
  });

  it('refuses with the reason in Czech only when the server said so', () => {
    expect(exportAccessOf(['patients.view'], 'forbidden')).toEqual({ allowed: false, reason: 'Stahování povoluje administrátor.' });
  });
});

describe('ExportGate', () => {
  beforeEach(() => {
    policy.mockReset();
    resetExportAccessForTests();
    window.localStorage.clear();
    window.localStorage.setItem('token', 'test-token');
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('draws a plain button for somebody holding the permission, without asking the server', () => {
    window.localStorage.setItem('permissions', JSON.stringify(['exports.download']));
    mount();

    expect((screen.getByRole('button', { name: 'Stáhnout' }) as HTMLButtonElement).disabled).toBe(false);
    expect(policy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('export-blocked')).toBeNull();
  });

  it('switches the button off and explains why when the server says the person may not download', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['billing.manage']));
    policy.mockResolvedValue('forbidden');
    mount();

    const blocked = await screen.findByTestId('export-blocked');
    expect((screen.getByRole('button', { name: 'Stáhnout' }) as HTMLButtonElement).disabled).toBe(true);
    expect(blocked.getAttribute('aria-label')).toBe('Stahování povoluje administrátor.');
    expect(blocked.getBoundingClientRect().height).toBeGreaterThanOrEqual(0);
  });

  it('leaves the button alone on an older backend that has no such route', async () => {
    policy.mockResolvedValue('unsupported');
    mount();

    await waitFor(() => expect(policy).toHaveBeenCalled());
    expect((screen.getByRole('button', { name: 'Stáhnout' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('export-blocked')).toBeNull();
  });

  it('asks nothing when nobody is signed in', () => {
    window.localStorage.removeItem('token');
    mount();

    expect(policy).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Stáhnout' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not grey the button out while the answer is still on its way', () => {
    policy.mockReturnValue(new Promise(() => undefined));
    mount();

    expect((screen.getByRole('button', { name: 'Stáhnout' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
