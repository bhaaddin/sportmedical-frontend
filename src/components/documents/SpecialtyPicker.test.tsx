/*
 * The specialty box, and what it says after you have chosen something.
 *
 * It said "107 107".
 *
 * The label was `${code} ${name}` and the name was looked up in `options` -
 * which is refetched on every keystroke, including the one the selection
 * itself causes. A moment after picking Kardiologie the list no longer held
 * it, the lookup fell through to a placeholder built from the code, and the
 * code printed twice: once as itself and once standing in for the missing
 * name. On screen it appeared, flickered, and turned into that.
 *
 * Two separate faults, so two separate tests: the code should not be in the
 * box at all, and the name must survive the list changing underneath it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const specialties = vi.fn();

vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { specialties } };
});

const { default: SpecialtyPicker } = await import('./SpecialtyPicker');

const KARDIOLOGIE = { code: '107', name: 'Kardiologie', isCommon: true };

beforeEach(() => {
  specialties.mockReset().mockResolvedValue([KARDIOLOGIE]);
});

const box = () => screen.getByRole('combobox') as HTMLInputElement;

describe('what the box shows after choosing', () => {
  it('shows the name and not the code', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SpecialtyPicker value={{ specialtyCode: null, specialtyOther: null }} onChange={onChange} />,
    );

    await user.type(box(), 'srdce');
    await user.click(await screen.findByText('Kardiologie'));

    expect(onChange).toHaveBeenCalledWith({ specialtyCode: '107', specialtyOther: null });

    /* The parent stores what it was given and renders again - which is when
       the old code went looking in a list that had moved on. */
    rerender(
      <SpecialtyPicker value={{ specialtyCode: '107', specialtyOther: null }} onChange={onChange} />,
    );

    await waitFor(() => expect(box().value).toBe('Kardiologie'));
    expect(box().value).not.toContain('107');
  });

  /*
   * The exact failure: the list is refetched and no longer holds the chosen
   * specialty. The name must survive that, because nothing about the choice
   * has changed.
   */
  it('keeps the name when the list no longer contains it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SpecialtyPicker value={{ specialtyCode: null, specialtyOther: null }} onChange={onChange} />,
    );

    await user.type(box(), 'srdce');
    await user.click(await screen.findByText('Kardiologie'));

    /* Whatever arrives next, it is not Kardiologie. */
    specialties.mockResolvedValue([{ code: '606', name: 'Ortopedie', isCommon: false }]);
    const callsBefore = specialties.mock.calls.length;

    rerender(
      <SpecialtyPicker value={{ specialtyCode: '107', specialtyOther: null }} onChange={onChange} />,
    );

    /*
     * Wait for the list to have actually been replaced before asserting.
     *
     * Without this the test passed with the fault put back, because the
     * refetch had not happened yet and `options` still held Kardiologie - it
     * was asserting against the very state the bug needs to leave. Caught by
     * mutating the code and watching it stay green.
     */
    await user.type(box(), 'x');
    await waitFor(() => expect(specialties.mock.calls.length).toBeGreaterThan(callsBefore));
    await screen.findByText('Ortopedie');

    rerender(
      <SpecialtyPicker value={{ specialtyCode: '107', specialtyOther: null }} onChange={onChange} />,
    );

    await waitFor(() => expect(box().value).toBe('Kardiologie'));
    expect(box().value).not.toBe('107 107');
  });

  it('shows free text as itself when no code was chosen', async () => {
    render(
      <SpecialtyPicker
        value={{ specialtyCode: null, specialtyOther: 'Sportovní lékař z Brna' }}
        onChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(box().value).toBe('Sportovní lékař z Brna'));
  });

  /* Better the bare code than a blank box, if a code arrives whose name we
     have never been told. */
  it('falls back to the code alone, never to the code twice', async () => {
    render(
      <SpecialtyPicker value={{ specialtyCode: '999', specialtyOther: null }} onChange={vi.fn()} />,
    );

    await waitFor(() => expect(box().value).toBe('999'));
  });
});

describe('the dropdown', () => {
  /* The code stays here, where it helps somebody pick the right row - and
     where it is what lets them search by number in the first place. */
  it('still shows the code beside each name', async () => {
    const user = userEvent.setup();
    render(
      <SpecialtyPicker value={{ specialtyCode: null, specialtyOther: null }} onChange={vi.fn()} />,
    );

    await user.type(box(), 'srdce');

    expect(await screen.findByText('107')).toBeInTheDocument();
    expect(screen.getByText('Kardiologie')).toBeInTheDocument();
  });

  it('asks the server rather than filtering a local copy', async () => {
    const user = userEvent.setup();
    render(
      <SpecialtyPicker value={{ specialtyCode: null, specialtyOther: null }} onChange={vi.fn()} />,
    );

    await user.type(box(), 'srdce');

    await waitFor(() => expect(specialties).toHaveBeenCalledWith('srdce', 10));
  });
});

describe('what the patient said', () => {
  it('is shown as a hint and never chosen for anybody', async () => {
    render(
      <SpecialtyPicker
        value={{ specialtyCode: null, specialtyOther: null }}
        onChange={vi.fn()}
        suggestion="bolelo me koleno"
      />,
    );

    expect(await screen.findByText(/bolelo me koleno/)).toBeInTheDocument();
    expect(box().value).toBe('');
  });
});
