/*
 * A patient with nothing on file must not have that absence printed at them.
 *
 * This screen used to render `Pojišťovna: undefined` - the word `undefined`
 * shown to a person, about a patient - and with no email or phone it drew a
 * lone bullet with nothing either side of it. Neither was visible to typecheck
 * or to the build, because both are valid strings as far as those are
 * concerned. Only looking at it found them.
 *
 * What would have to break for these to fail: dropping the `insuranceCompany`
 * conditional and interpolating it directly, or removing the `filter(Boolean)`
 * from the contact line.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const get = vi.fn();
vi.mock('../api/client', () => ({
  default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { default: PatientRecords } = await import('./PatientRecords');

const bare = {
  id: 'p1',
  firstName: 'Jan',
  lastName: 'Novák',
  email: '',
  phone: '',
  dateOfBirth: '1990-05-15',
  insuranceCompany: '',
};

beforeEach(() => {
  get.mockReset();
  window.history.pushState({}, '', '/patients/p1');
});
afterEach(() => vi.clearAllMocks());

describe('a patient with no insurer and no contact', () => {
  it('never prints the word undefined anywhere on the screen', async () => {
    get.mockResolvedValue({ data: bare });
    const { container } = render(<PatientRecords />);

    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined/i);
    expect(container.textContent).not.toMatch(/\[object Object\]/);
  });

  it('says the insurer is missing in words instead of interpolating an empty value', async () => {
    get.mockResolvedValue({ data: bare });
    render(<PatientRecords />);

    expect(await screen.findByText('Pojišťovna neuvedena')).toBeInTheDocument();
    expect(screen.queryByText(/^Pojišťovna:\s*$/)).not.toBeInTheDocument();
  });

  it('says the contact is missing rather than drawing a bullet with nothing either side', async () => {
    get.mockResolvedValue({ data: bare });
    render(<PatientRecords />);

    expect(await screen.findByText('Kontakt neuveden')).toBeInTheDocument();
    /* The separator is only earned when there is something on both sides. */
    expect(screen.queryByText(/^\s*•\s*$/)).not.toBeInTheDocument();
  });
});

describe('a patient who does have the details', () => {
  it('shows the insurer and joins contact with a single bullet', async () => {
    get.mockResolvedValue({
      data: { ...bare, email: 'jan@example.cz', phone: '+420111222333', insuranceCompany: 'VZP' },
    });
    render(<PatientRecords />);

    expect(await screen.findByText('Pojišťovna: VZP')).toBeInTheDocument();
    expect(screen.getByText('jan@example.cz • +420111222333')).toBeInTheDocument();
  });

  it('with only one of the two, shows it without a dangling separator', async () => {
    get.mockResolvedValue({ data: { ...bare, phone: '+420111222333' } });
    render(<PatientRecords />);

    expect(await screen.findByText('+420111222333')).toBeInTheDocument();
  });
});
