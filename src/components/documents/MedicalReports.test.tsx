/*
 * Reports from other doctors, and the line between them and the výpis.
 *
 * The owner's first worry when he asked for these was that they must not mix
 * with the required documents. He was right for a reason he did not have to
 * name: a cardiology report counted as the výpis would let the readiness gate
 * pass a patient whose výpis is missing - and nobody would find out until it
 * mattered.
 *
 * The separation comes from the shape rather than from a rule: a report has no
 * `templateId`, and the readiness check pairs documents to templates. These
 * tests hold the shape, because a shape can be undone by one `??`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const review = vi.fn();
const reclassify = vi.fn();
const specialties = vi.fn();

vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { review, reclassify, specialties } };
});

const { default: MedicalReports, isMedicalReport, byReportDate, specialtyLabel } =
  await import('./MedicalReports');

type Doc = Parameters<typeof isMedicalReport>[0];

const doc = (over: Partial<Doc> = {}): Doc =>
  ({
    id: 'd1',
    patientId: 'p1',
    templateId: null,
    uploadedAt: '2026-09-12T10:00:00Z',
    signedAt: null,
    expiryAt: null,
    filePath: 'x.pdf',
    status: 'SignedOff',
    appointmentId: null,
    notes: '',
    contentSha256: null,
    contentType: 'application/pdf',
    sizeBytes: 100,
    source: 'Staff',
    uploadedByUserId: 'u1',
    reviewedByUserId: null,
    reviewedAtUtc: null,
    specialtyCode: '107',
    specialtyOther: null,
    specialtySuggestedByPatient: null,
    reportDate: '2026-03-01',
    ...over,
  }) as Doc;

beforeEach(() => {
  review.mockReset().mockResolvedValue({});
  reclassify.mockReset().mockResolvedValue({});
  specialties.mockReset().mockResolvedValue([]);
});

const renderList = (documents: Doc[], onChanged = vi.fn()) => {
  render(<MedicalReports documents={documents} onChanged={onChanged} onAdd={vi.fn()} />);
  return onChanged;
};

describe('which documents belong here', () => {
  it('takes the ones with no template', () => {
    expect(isMedicalReport(doc({ templateId: null }))).toBe(true);
  });

  /* The výpis has a template. If it ever showed up in this list, the two kinds
     would have stopped being distinguishable somewhere upstream. */
  it('leaves the výpis alone', () => {
    expect(isMedicalReport(doc({ templateId: '01a0833e-85cb-77a8-9f15-f84c35bf0bd7' }))).toBe(false);
  });

  it('shows only reports even when required documents are in the same array', () => {
    renderList([
      doc({ id: 'report', specialtyOther: 'Kardiologie z nemocnice' }),
      doc({ id: 'vypis', templateId: 'tmpl-vypis', specialtyOther: 'Zprava k vypisu', specialtyCode: null }),
    ]);

    expect(screen.getByText('Kardiologie z nemocnice')).toBeInTheDocument();
    expect(screen.queryByText('Zprava k vypisu')).not.toBeInTheDocument();
  });
});

describe('the order they are shown in', () => {
  /* "Newer or older" is the first thing anybody asks of a stack of these, and
     the day somebody got round to scanning them says nothing about it. */
  it('puts the newest report first by the date on the report', () => {
    const older = doc({ id: 'a', reportDate: '2024-01-01' });
    const newer = doc({ id: 'b', reportDate: '2026-05-05' });
    expect([older, newer].sort(byReportDate)[0].id).toBe('b');
  });

  it('sinks an undated report below the dated ones', () => {
    const undated = doc({ id: 'none', reportDate: null });
    const dated = doc({ id: 'dated', reportDate: '2020-01-01' });
    expect([undated, dated].sort(byReportDate).map((d) => d.id)).toEqual(['dated', 'none']);
  });

  /*
   * A document whose `reportDate` the server simply omits arrives as
   * `undefined`, not `null`, however the type is written - and the guard here
   * once read `!== null`, so it formatted `undefined`, threw, and took the
   * whole patient card down. Found by a fixture that predated the field, which
   * is exactly the shape an older document has.
   *
   * `formatDateOnly` is defensive now too, so the page survives either way -
   * its own test covers that. What this one holds is that no empty date chip
   * is drawn, which is the part only this component decides.
   */
  it('draws no date chip at all when the server never sent one', () => {
    const withoutDate = { ...doc(), reportDate: undefined } as unknown as Doc;
    const { container } = render(
      <MedicalReports documents={[withoutDate]} onChanged={vi.fn()} onAdd={vi.fn()} />,
    );

    expect(screen.getByText('107')).toBeInTheDocument();
    for (const chip of container.querySelectorAll('.MuiChip-label')) {
      expect(chip.textContent?.trim()).not.toBe('');
    }
  });

  it('does not fall over when nothing has a date', () => {
    const a = doc({ id: 'a', reportDate: null });
    const b = doc({ id: 'b', reportDate: null });
    expect([a, b].sort(byReportDate)).toHaveLength(2);
  });
});

describe('what the row says', () => {
  it('prefers the words somebody typed over a bare code', () => {
    expect(specialtyLabel(doc({ specialtyCode: '107', specialtyOther: 'Kardiologie MUDr. Novak' })))
      .toBe('Kardiologie MUDr. Novak');
  });

  it('falls back to the code, and then to saying it is unknown', () => {
    expect(specialtyLabel(doc({ specialtyCode: '107', specialtyOther: null }))).toBe('107');
    expect(specialtyLabel(doc({ specialtyCode: null, specialtyOther: null }))).toBe('Neurčený obor');
  });

  /*
   * The whole reason the review step exists. Without this, "waiting" is a
   * delay with no explanation and the person looking at it has no idea why
   * they are being asked.
   */
  it('says outright when the patient sent it', () => {
    renderList([doc({ source: 'Patient', status: 'Pending' })]);
    expect(screen.getByText('Nahrál pacient')).toBeInTheDocument();
  });

  it('says nothing of the sort about one the staff uploaded', () => {
    renderList([doc({ source: 'Staff' })]);
    expect(screen.queryByText('Nahrál pacient')).not.toBeInTheDocument();
  });
});

describe('reviewing what a patient sent', () => {
  it('offers accept and reject only while it is waiting', () => {
    renderList([doc({ source: 'Patient', status: 'Pending' })]);
    expect(screen.getByRole('button', { name: 'Přijmout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zamítnout' })).toBeInTheDocument();
  });

  /* A document the staff carried in has nothing to decide - the owner's point
     exactly: he can see what he is uploading. */
  it('asks nothing about a document the staff uploaded', () => {
    renderList([doc({ source: 'Staff', status: 'SignedOff' })]);
    expect(screen.queryByRole('button', { name: 'Přijmout' })).not.toBeInTheDocument();
  });

  it('asks nothing about one that has already been reviewed', () => {
    renderList([doc({ source: 'Patient', status: 'SignedOff', reviewedByUserId: 'u9' })]);
    expect(screen.queryByRole('button', { name: 'Přijmout' })).not.toBeInTheDocument();
    expect(screen.getByText('Zkontrolováno')).toBeInTheDocument();
  });

  it('accepts, and tells the caller to reload', async () => {
    const user = userEvent.setup();
    const onChanged = renderList([doc({ id: 'x', source: 'Patient', status: 'Pending' })]);

    await user.click(screen.getByRole('button', { name: 'Přijmout' }));

    expect(review).toHaveBeenCalledWith('x', true);
    expect(onChanged).toHaveBeenCalled();
  });

  it('rejects with the same call and the opposite answer', async () => {
    const user = userEvent.setup();
    renderList([doc({ id: 'x', source: 'Patient', status: 'Pending' })]);

    await user.click(screen.getByRole('button', { name: 'Zamítnout' }));

    expect(review).toHaveBeenCalledWith('x', false);
  });

  it('says so when the server refuses, instead of looking like it worked', async () => {
    const user = userEvent.setup();
    review.mockRejectedValue(new Error('nope'));
    renderList([doc({ source: 'Patient', status: 'Pending' })]);

    await user.click(screen.getByRole('button', { name: 'Přijmout' }));

    expect(await screen.findByText(/nepodařilo přijmout/)).toBeInTheDocument();
  });
});
