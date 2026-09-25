/*
 * `/` is the doctor's workspace for a Staff account and for anybody who chose
 * it, and the dashboard for an owner or administrator who did not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './Home';

vi.mock('./Dashboard', () => ({ default: () => <div>DASHBOARD</div> }));
vi.mock('./DoctorHome', () => ({ default: () => <div>DOCTOR HOME</div> }));

function signedInAs(role: string, workspace?: string) {
  localStorage.setItem('user', JSON.stringify({ firstName: 'A', lastName: 'B', email: 'a@b.cz', role }));
  if (workspace) localStorage.setItem('preferences', JSON.stringify({ theme: 'clinic-light', workspace }));
}

afterEach(() => localStorage.clear());

describe('the home route', () => {
  it('opens the doctor workspace for Staff', async () => {
    signedInAs('Staff');
    render(<Home />);
    expect(await screen.findByText('DOCTOR HOME')).toBeInTheDocument();
  });

  it('opens the dashboard for an owner who did not choose otherwise', async () => {
    signedInAs('Owner');
    render(<Home />);
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
  });

  it('opens the doctor workspace for an administrator who chose it', async () => {
    signedInAs('Administrator', 'doctor');
    render(<Home />);
    expect(await screen.findByText('DOCTOR HOME')).toBeInTheDocument();
  });
});
