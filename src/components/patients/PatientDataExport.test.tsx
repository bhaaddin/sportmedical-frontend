import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';

const { get, held, toastError } = vi.hoisted(() => ({ get: vi.fn(), held: { current: true }, toastError: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get }, client: { get } }));
vi.mock('../../auth/usePermission', () => ({ usePermission: () => held.current, usePermissions: () => [] }));
vi.mock('../../auth/useExportAccess', () => ({ useExportAccess: () => ({ allowed: true, reason: null }) }));
vi.mock('react-hot-toast', () => ({ default: { error: toastError, success: vi.fn() } }));

const { PatientDataExport } = await import('./PatientDataExport');

beforeEach(() => {
  get.mockReset();
  toastError.mockReset();
  held.current = true;
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('PatientDataExport', () => {
  it('is not drawn without patients.export', () => {
    held.current = false;
    const { container } = renderScreen(<PatientDataExport patientId="p1" />);
    expect(container.textContent).toBe('');
  });

  it('asks first, then fetches the file from the export route', async () => {
    get.mockResolvedValue({ data: new Blob(['{}']), headers: { 'content-disposition': 'attachment; filename="pacient-novak.json"' } });
    const user = userEvent.setup();
    renderScreen(<PatientDataExport patientId="p1" />);
    await user.click(screen.getByRole('button', { name: 'Exportovat údaje pacienta' }));
    expect(get).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Exportovat' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/patients/p1/export', { responseType: 'blob' }));
  });

  it('answers calmly when the server has no such route (404)', async () => {
    get.mockRejectedValue({ response: { status: 404, data: new Blob(['']) } });
    const user = userEvent.setup();
    renderScreen(<PatientDataExport patientId="p1" />);
    await user.click(screen.getByRole('button', { name: 'Exportovat údaje pacienta' }));
    await user.click(screen.getByRole('button', { name: 'Exportovat' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Server ho možná zatím neumí')));
  });
});
