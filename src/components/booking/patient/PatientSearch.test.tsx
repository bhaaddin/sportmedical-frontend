/*
 * "Three Filip Fehér - which one is on the phone?"
 *
 * The owner's case, end to end through the component: typing a full name finds
 * the namesakes (the server is asked for one word, the page is narrowed to
 * both), every namesake gets an info button, and the card behind it shows the
 * insurance and birth number only to an employee who may see them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const list = vi.fn();
const getProfile = vi.fn();

vi.mock('../../../api/patients', () => ({
  patientsApi: { list, getProfile },
}));

const { PatientSearch } = await import('./PatientSearch');

const row = (id: string, firstName: string, lastName: string, dateOfBirth: string) => ({
  id,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  dateOfBirth,
  sex: 'Male',
  status: 'Active',
});

function renderSearch(onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PatientSearch enabled mayRegister onPick={onPick} />
    </QueryClientProvider>,
  );
  return onPick;
}

beforeEach(() => {
  window.localStorage.removeItem('permissions');
  list.mockReset().mockResolvedValue({
    items: [
      row('f1', 'Filip', 'Fehér', '1990-01-01'),
      row('f2', 'Filip', 'Fehér', '1985-05-05'),
      row('f3', 'Filip', 'Fehér', '2001-02-03'),
      row('p1', 'Petr', 'Fehér', '1970-07-07'),
    ],
    totalCount: 4,
    page: 1,
    pageSize: 50,
  });
  getProfile.mockReset().mockResolvedValue({
    phone: '+420 777 123 456',
    email: 'filip@example.cz',
    birthNumber: '900101/1234',
    insuranceNumber: '9001011234',
  });
});

describe('searching the database for a patient', () => {
  it('asks the server for one word and keeps rows matching every word typed', async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Filip Fehér');

    const results = await screen.findByRole('list', { name: 'Nalezení pacienti' });
    expect(within(results).getAllByRole('listitem')).toHaveLength(3);
    expect(within(results).queryByText('Petr Fehér')).not.toBeInTheDocument();
    expect(within(results).getByText('nar. 5. 5. 1985')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith({ query: 'Fehér', page: 1, pageSize: 50 });
  });

  it('gives every namesake an info button, and a unique name none', async () => {
    list.mockResolvedValueOnce({
      items: [
        row('f1', 'Filip', 'Fehér', '1990-01-01'),
        row('f2', 'Filip', 'Fehér', '1985-05-05'),
        row('j1', 'Jan', 'Fehér', '1970-07-07'),
      ],
      totalCount: 3,
    });
    renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');

    await screen.findByText('Jan Fehér');
    expect(screen.getAllByRole('button', { name: 'Údaje pacienta Filip Fehér' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Údaje pacienta Jan Fehér' })).not.toBeInTheDocument();
  });

  it('hides insurance and birth number from an employee without the permission', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Filip Fehér');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Údaje pacienta Filip Fehér' }))[0]);

    const card = await screen.findByRole('dialog', { name: 'Údaje pacienta Filip Fehér' });
    expect(await within(card).findByText('+420 777 123 456')).toBeInTheDocument();
    expect(within(card).getByText('filip@example.cz')).toBeInTheDocument();
    expect(within(card).queryByText('Rodné číslo')).not.toBeInTheDocument();
    expect(within(card).queryByText('900101/1234')).not.toBeInTheDocument();
    expect(within(card).queryByText('9001011234')).not.toBeInTheDocument();
  });

  it('shows them to an employee who holds patients.sensitive_identity.view', async () => {
    window.localStorage.setItem(
      'permissions',
      JSON.stringify(['patients.view', 'patients.sensitive_identity.view']),
    );
    renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Filip Fehér');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Údaje pacienta Filip Fehér' }))[1]);

    const card = await screen.findByRole('dialog', { name: 'Údaje pacienta Filip Fehér' });
    expect(await within(card).findByText('900101/1234')).toBeInTheDocument();
    expect(within(card).getByText('9001011234')).toBeInTheDocument();
    expect(getProfile).toHaveBeenCalledWith('f2');
  });

  it('picks the patient from the card', async () => {
    const onPick = renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Filip Fehér');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Údaje pacienta Filip Fehér' }))[2]);
    await userEvent.click(await screen.findByRole('button', { name: 'Vybrat tohoto pacienta' }));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'f3', dateOfBirth: '2001-02-03' });
  });

  it('says an empty answer is not proof, and still offers a new patient', async () => {
    list.mockResolvedValueOnce({ items: [], totalCount: 0 });
    renderSearch();
    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Nikdo');

    expect(await screen.findByText(/V databázi nikoho takového nenacházím/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Založit nového pacienta' })).toHaveAttribute(
      'href',
      '/patients/register',
    );
  });
});
