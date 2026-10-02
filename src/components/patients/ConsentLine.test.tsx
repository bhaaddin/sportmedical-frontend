/*
 * Whether the patient consented - and the difference between "no" and
 * "nobody asked".
 *
 * The card this replaces said "Neudělen" about every patient, because it read
 * a table that had never held a row. The obvious way to rebuild it badly is to
 * keep that shape and merely point it at the right table: an empty answer
 * would still draw as a refusal, and it would still be a lie - only now about
 * people registered at the desk, whom nobody ever showed the form to.
 *
 * So these three states are the point of the component, and of this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get } }));

const { default: ConsentLine, consentState, treatmentConsent } = await import('./ConsentLine');

const consent = (over: Record<string, unknown> = {}) => ({
  policyCode: 'treatment',
  policyVersion: '2026-09-01',
  purpose: 'Zpracování údajů o zdravotním stavu…',
  granted: true,
  grantedAtUtc: '2026-09-12T14:18:47Z',
  ...over,
});

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: [] });
});

describe('deciding which of the three states', () => {
  it('granted when the treatment consent says so', () => {
    expect(consentState([consent()])).toBe('granted');
  });

  it('refused when they were asked and said no', () => {
    expect(consentState([consent({ granted: false })])).toBe('refused');
  });

  /* The distinction the whole component exists for. */
  it('never-asked when there is nothing recorded at all', () => {
    expect(consentState([])).toBe('never-asked');
  });

  /* Other consents are not this one. Somebody who declined marketing has not
     declined treatment. */
  it('never-asked when only other policies are recorded', () => {
    expect(consentState([consent({ policyCode: 'marketing', granted: false })])).toBe('never-asked');
    expect(treatmentConsent([consent({ policyCode: 'club' })])).toBeNull();
  });

  it('picks the treatment consent out of several', () => {
    const found = treatmentConsent([
      consent({ policyCode: 'marketing', granted: false }),
      consent({ policyCode: 'treatment', granted: true }),
      consent({ policyCode: 'club', granted: false }),
    ]);
    expect(found?.policyCode).toBe('treatment');
    expect(found?.granted).toBe(true);
  });
});

describe('what the line says', () => {
  it('gives the date and the wording the patient agreed to', async () => {
    get.mockResolvedValue({ data: [consent()] });

    render(<ConsentLine patientId="p1" />);

    expect(await screen.findByText(/udělen/)).toBeInTheDocument();
    expect(screen.getByText('12. 9. 2026')).toBeInTheDocument();
    /* The policy version is what makes it provable a year later. */
    expect(screen.getByText('znění 2026-09-01')).toBeInTheDocument();
  });

  /*
   * A patient registered at the desk never saw the form. Calling that a
   * refusal accuses them of declining a question nobody put to them - the same
   * lie the old card told, pointing the other way.
   */
  it('says nobody asked, rather than that they refused', async () => {
    get.mockResolvedValue({ data: [] });

    render(<ConsentLine patientId="p1" />);

    expect(await screen.findByText(/nebyl dotázán/)).toBeInTheDocument();
    expect(screen.queryByText(/neudělen/)).not.toBeInTheDocument();
  });

  it('says refused only when they actually were asked', async () => {
    get.mockResolvedValue({ data: [consent({ granted: false })] });

    render(<ConsentLine patientId="p1" />);

    expect(await screen.findByText(/neudělen/)).toBeInTheDocument();
    expect(screen.queryByText(/nebyl dotázán/)).not.toBeInTheDocument();
  });

  /* Not knowing is not the same as knowing there is nothing. */
  it('draws nothing at all when the answer cannot be fetched', async () => {
    get.mockRejectedValue(new Error('offline'));

    const { container } = render(<ConsentLine patientId="p1" />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(container.textContent).toBe('');
  });

  it('asks about the patient it was given', async () => {
    render(<ConsentLine patientId="abc-123" />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(get).toHaveBeenCalledWith('/api/patients/abc-123/consents');
  });
});
