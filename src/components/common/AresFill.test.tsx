/*
 * The shared ARES button and hook, in three layouts: the button opens only for
 * a plausible IČO, a blur asks once per new IČO (and the button asks again),
 * the status line carries the server's sentence or the zaniklý warning, and
 * `applyAresFill` overwrites what the registry knows and remembers what it replaced.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TextField } from '@mui/material';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { AresSubject } from '../../api/ares';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('../../api/ares', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/ares')>();
  return { ...actual, aresApi: { lookup } };
});

const { AresError } = await import('../../api/ares');
const { AresFillButton, AresStatusLine, applyAresFill, useAresFill } = await import('./AresFill');

const VALID = '25596641';
const VALID_2 = '27082440';

const subject = (over: Partial<AresSubject> = {}): AresSubject => ({
  ico: VALID, name: 'Seznam.cz, a.s.', dic: 'CZ25596641', legalForm: 'a.s.', street: 'Radlická 3294/10', city: 'Praha',
  postalCode: '15000', countryCode: 'CZ', established: '1996-01-01', dissolved: null, isActive: true,
  fetchedAtUtc: '2026-10-10T08:00:00Z', management: [], ...over,
});

function Harness({ initialIco = '' }: { initialIco?: string }) {
  const [ico, setIco] = useState(initialIco);
  const [filled, setFilled] = useState('');
  const fill = useAresFill({ ico, initialIco, onSubject: (s) => setFilled(s.name) });
  return (
    <>
      <TextField label="IČO" value={ico} onChange={(e) => setIco(e.target.value)} onBlur={fill.onIcoBlur} />
      <TextField label="Jiné" />
      <AresFillButton fill={fill} />
      <AresStatusLine fill={fill} />
      <div data-testid="filled">{filled}</div>
    </>
  );
}

const button = () => screen.getByRole('button', { name: 'Načíst z ARES' });

beforeEach(() => {
  lookup.mockReset().mockResolvedValue(subject());
});

describe.each(Object.entries(VIEWPORTS))('ARES button at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('is 44 px tall and opens only for a plausible IČO (checksum, not just eight digits)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(button()).toBeDisabled();
    expect(getComputedStyle(button()).minHeight).toBe('44px');
    const ico = screen.getByLabelText('IČO');
    await user.type(ico, '12345678');
    expect(button()).toBeDisabled();
    await user.clear(ico);
    await user.type(ico, '255 966 41');
    expect(button()).toBeEnabled();
  });

  it('asks once when the field loses focus with a new valid IČO, not again for the same one, and fills', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ico = screen.getByLabelText('IČO');
    await user.type(ico, VALID);
    await user.click(screen.getByLabelText('Jiné'));
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    expect(lookup).toHaveBeenCalledWith(VALID);
    expect(await screen.findByTestId('filled')).toHaveTextContent('Seznam.cz, a.s.');
    expect(screen.getByRole('status')).toHaveTextContent('Načteno z ARES 10. 10. 2026 · Seznam.cz, a.s.');

    await user.click(ico);
    await user.click(screen.getByLabelText('Jiné'));
    await new Promise((r) => setTimeout(r, 400));
    expect(lookup).toHaveBeenCalledTimes(1);

    /* The button is the person asking on purpose: it always asks. */
    await user.click(button());
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  });
});

describe('useAresFill', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('does not ask when the field loses focus with the IČO the form opened with', async () => {
    const user = userEvent.setup();
    render(<Harness initialIco={VALID} />);
    await user.click(screen.getByLabelText('IČO'));
    await user.click(screen.getByLabelText('Jiné'));
    await new Promise((r) => setTimeout(r, 400));
    expect(lookup).not.toHaveBeenCalled();
    expect(button()).toBeEnabled();
  });

  it('asks again when the IČO changes to another valid one', async () => {
    const user = userEvent.setup();
    render(<Harness initialIco={VALID} />);
    const ico = screen.getByLabelText('IČO');
    await user.clear(ico);
    await user.type(ico, VALID_2);
    await user.click(screen.getByLabelText('Jiné'));
    await waitFor(() => expect(lookup).toHaveBeenCalledWith(VALID_2));
  });

  it('does not ask for an invalid IČO on blur', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('IČO'), '12345678');
    await user.click(screen.getByLabelText('Jiné'));
    await new Promise((r) => setTimeout(r, 400));
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'ares.ico_invalid', 'IČO nemá správný tvar — zkontrolujte číslice.'],
    [404, 'ares.not_found', 'Subjekt s tímto IČO v registru není.'],
    [502, 'ares.unavailable', 'ARES je momentálně nedostupný, zkuste to později.'],
  ] as const)('shows the server\'s sentence on %i', async (status, code, message) => {
    lookup.mockRejectedValue(new AresError(code, message, status));
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('IČO'), VALID);
    await user.click(button());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('filled')).toHaveTextContent('');
  });

  it('warns when the subject is dissolved, and still fills', async () => {
    lookup.mockResolvedValue(subject({ isActive: false, dissolved: '2024-05-01' }));
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('IČO'), VALID);
    await user.click(button());
    expect(await screen.findByRole('alert')).toHaveTextContent('Subjekt je zaniklý');
    expect(screen.getByRole('status')).toHaveTextContent('Načteno z ARES');
    expect(screen.getByTestId('filled')).toHaveTextContent('Seznam.cz, a.s.');
  });

  it('shows a spinner while asking', async () => {
    let release: (s: AresSubject) => void = () => undefined;
    lookup.mockImplementation(() => new Promise<AresSubject>((r) => { release = r; }));
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('IČO'), VALID);
    await user.click(button());
    expect(button()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Načítám z ARES…');
    release(subject());
    await waitFor(() => expect(button()).not.toHaveAttribute('aria-busy'));
  });
});

describe('applyAresFill', () => {
  it('overwrites every field the registry answers, keeps the rest, and remembers the replaced values', () => {
    const { next, overridden } = applyAresFill(
      { name: 'HC Kladno', dic: '', address: 'Stará 1', city: 'Praha', postalCode: '', bank: '123/0800' },
      { name: 'Seznam.cz, a.s.', dic: 'CZ25596641', address: 'Radlická 3294/10', city: 'Praha', postalCode: '15000' },
    );
    expect(next).toEqual({ name: 'Seznam.cz, a.s.', dic: 'CZ25596641', address: 'Radlická 3294/10', city: 'Praha', postalCode: '15000', bank: '123/0800' });
    /* Empty before or unchanged: nothing to give back. */
    expect(overridden).toEqual({ name: 'HC Kladno', address: 'Stará 1' });
  });

  it('leaves a field alone when the registry has nothing for it', () => {
    const { next, overridden } = applyAresFill({ name: 'HC Kladno', dic: 'CZ123' }, { name: 'Nový', dic: null });
    expect(next).toEqual({ name: 'Nový', dic: 'CZ123' });
    expect(overridden).toEqual({ name: 'HC Kladno' });
  });
});
