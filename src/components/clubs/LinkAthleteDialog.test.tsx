import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkAthleteDialog } from './LinkAthleteDialog';
import { linkAthleteProblem, toAthletes } from '../../api/clubBlocks';

const post = vi.fn();
vi.mock('../../api/client', () => ({
  default: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
  client: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));
vi.mock('../patients/PatientPicker', () => ({
  default: ({ onChange }: { onChange: (p: unknown) => void }) => (
    <button onClick={() => onChange({ id: 'p1', firstName: 'ZZ', lastName: 'test' })}>vybrat</button>
  ),
}));

beforeEach(() => post.mockReset());

describe('Spojit s pacientem', () => {
  it('needs a patient and a reason, then posts both', async () => {
    post.mockResolvedValue({ data: { patientId: 'p1', clubId: 'c1', linkedAppointments: 2, clubMemberCreated: true } });
    const onLinked = vi.fn();
    render(<LinkAthleteDialog blockId="b1" athleteId="a1" athleteName="ZZ test" onClose={() => {}} onLinked={onLinked} />);
    const go = screen.getByRole('button', { name: 'Spojit' });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByText('vybrat'));
    await userEvent.type(screen.getByLabelText(/Důvod spojení/), 'stejná osoba');
    await userEvent.click(go);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/club-blocks/b1/athletes/a1/patient', { patientId: 'p1', reason: 'stejná osoba' }));
    await waitFor(() => expect(onLinked).toHaveBeenCalled());
  });

  it('words each refusal in Czech', () => {
    expect(linkAthleteProblem({ response: { status: 409, data: { code: 'club_athlete.linked_to_another_patient' } } })).toMatch(/už spojen s jiným pacientem/);
    expect(linkAthleteProblem({ response: { status: 400, data: { code: 'club_athlete.reason_required' } } })).toMatch(/důvod/);
  });

  it('reads patientId on an athlete only when present', () => {
    const [a, b] = toAthletes([{ id: '1', name: 'A', patientId: 'p9' }, { id: '2', name: 'B' }]);
    expect(a.patientId).toBe('p9');
    expect('patientId' in b).toBe(false);
    expect(linkAthleteProblem({ response: { status: 404, data: {} } })).toMatch(/zatím server nepodporuje/);
  });
});
