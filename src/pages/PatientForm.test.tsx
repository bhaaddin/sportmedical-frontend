/*
 * Correcting a patient's name, date of birth or sex.
 *
 * Those identify the patient, so `PUT /api/patients/{id}` takes a change only
 * with `changeReason` and records it with the signed-in author. The screen
 * used to send the name and date of birth alone - no reason and no sex, which
 * the server requires - so every save was refused.
 *
 * What would have to break for these to fail: saving without a reason, not
 * sending the reason or the sex, or showing a refusal as a generic failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getById = vi.fn();
const getProfile = vi.fn();
const update = vi.fn();

vi.mock('../api/patients', () => ({ patientsApi: { getById, getProfile, update } }));
vi.mock('../api/client', () => ({ default: { put: vi.fn() }, client: { put: vi.fn() } }));
vi.mock('../api/patientIdentity', () => ({ patientIdentityApi: {} }));
vi.mock('../components/registration/RuianAddressPicker', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: PatientForm } = await import('./PatientForm');

beforeEach(() => {
  getById.mockReset().mockResolvedValue({
    id: 'p1',
    firstName: 'Jana',
    lastName: 'Markova',
    preferredName: '',
    dateOfBirth: '1990-05-15',
    sex: 'Female',
    createdAtUtc: '2026-09-01T10:00:00Z',
    updatedAtUtc: '2026-09-01T10:00:00Z',
  });
  getProfile.mockReset().mockResolvedValue({});
  update.mockReset().mockResolvedValue({});
});

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/patients/p1/edit']}>
        <Routes>
          <Route path="/patients/:id/edit" element={<PatientForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const saveButton = () => screen.getAllByRole('button', { name: 'Uložit' })[0];

describe('a correction to name, date of birth or sex', () => {
  it('cannot be saved without a reason', async () => {
    renderForm();
    await screen.findByDisplayValue('Markova');

    expect(saveButton()).toBeDisabled();
  });

  it('sends the reason and the sex with the change', async () => {
    const user = userEvent.setup();
    renderForm();

    const lastName = await screen.findByDisplayValue('Markova');
    await user.clear(lastName);
    await user.type(lastName, 'Marková');
    await user.type(screen.getByLabelText(/Důvod změny/), 'Překlep při registraci');
    await user.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('p1', {
      firstName: 'Jana',
      lastName: 'Marková',
      preferredName: null,
      dateOfBirth: '1990-05-15',
      sex: 'Female',
      changeReason: 'Překlep při registraci',
    });
  });

  it('says which rule refused it', async () => {
    update.mockRejectedValue({
      response: { data: { code: 'patients.change_reason.too_long', message: 'Zadané údaje nelze uložit.' } },
    });
    const user = userEvent.setup();
    renderForm();

    await screen.findByDisplayValue('Markova');
    await user.type(screen.getByLabelText(/Důvod změny/), 'x');
    await user.click(saveButton());

    expect(await screen.findByText('Důvod změny je příliš dlouhý.')).toBeInTheDocument();
  });
});
