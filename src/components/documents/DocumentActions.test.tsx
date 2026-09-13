/*
 * Opening, moving and striking out a filed document.
 *
 * The part worth care is the warning before a move. A výpis moved away stops
 * counting for the patient it left - correctly, it was never theirs - but
 * somebody should learn that before pressing the button rather than by
 * noticing a red banner on a card they have already left.
 *
 * And "would this leave a gap" has to be counted, not assumed. A patient can
 * hold several valid copies of the same document, and moving one of three
 * costs nothing. The other lane's first measurement of the move was taken on a
 * patient with three výpis and looked like the move had done nothing at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const content = vi.fn();
const move = vi.fn();
const invalidate = vi.fn();
const getAll = vi.fn();

vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { content, move, invalidate } };
});
vi.mock('../../api/patients', () => ({ patientsApi: { getAll } }));

import type { PatientDocument } from '../../api/documents';

const { default: DocumentActions, lastOfItsKind } = await import('./DocumentActions');

const VYPIS = 'tmpl-vypis';

/* Typed as the real thing so a field the server adds cannot be forgotten here
   without the compiler noticing. */
const doc = (over: Partial<PatientDocument> = {}): PatientDocument =>
  ({
    id: 'd1',
    patientId: 'p1',
    templateId: VYPIS,
    uploadedAt: '2026-09-12T10:00:00Z',
    signedAt: '2026-09-12T10:01:00Z',
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
    specialtyCode: null,
    specialtyName: null,
    specialtyOther: null,
    specialtySuggestedByPatient: null,
    reportDate: null,
    movedFromPatientId: null,
    movedByUserId: null,
    movedAtUtc: null,
    invalidationReasonCode: null,
    invalidationNote: null,
    invalidatedByUserId: null,
    invalidatedAtUtc: null,
    ...over,
  }) as PatientDocument;

beforeEach(() => {
  content.mockReset().mockResolvedValue('blob:fake');
  move.mockReset().mockResolvedValue({});
  invalidate.mockReset().mockResolvedValue({});
  getAll.mockReset().mockResolvedValue([
    { id: 'p1', firstName: 'Anna', lastName: 'Černá' },
    { id: 'p2', firstName: 'Jan', lastName: 'Novák' },
  ]);
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const renderActions = (over: Partial<PatientDocument> = {}, all?: PatientDocument[]) => {
  const d = doc(over);
  const onChanged = vi.fn();
  render(
    <DocumentActions
      document={d}
      patientDocuments={all ?? [d]}
      patientName="Anna"
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

describe('whether moving would leave a gap', () => {
  it('says yes when it is the only valid one of its kind', () => {
    const only = doc();
    expect(lastOfItsKind(only, [only])).toBe(true);
  });

  /* Counted, not assumed. Three on file and moving one costs nothing. */
  it('says no when the patient holds others of the same kind', () => {
    const a = doc({ id: 'a' });
    const b = doc({ id: 'b' });
    const c = doc({ id: 'c' });
    expect(lastOfItsKind(a, [a, b, c])).toBe(false);
  });

  /* Only a valid one was ever counting, so losing an invalid one costs
     nothing either. */
  it('says no when the one being moved does not count anyway', () => {
    const pending = doc({ status: 'Pending' });
    expect(lastOfItsKind(pending, [pending])).toBe(false);
  });

  it('ignores others of the same kind that are not valid', () => {
    const good = doc({ id: 'good' });
    const bad = doc({ id: 'bad', status: 'Rejected' });
    expect(lastOfItsKind(good, [good, bad])).toBe(true);
  });

  /* A report from another doctor satisfies no requirement, so moving it can
     leave no gap. */
  it('says no for a document that belongs to no template', () => {
    const report = doc({ templateId: null });
    expect(lastOfItsKind(report, [report])).toBe(false);
  });
});

describe('moving', () => {
  it('warns by name before the move, when it would leave a gap', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByLabelText('Přesunout dokument'));

    expect(await screen.findByText(/Po přesunu bude Anna chybět/)).toBeInTheDocument();
  });

  it('does not warn when the patient keeps another one', async () => {
    const user = userEvent.setup();
    const a = doc({ id: 'a' });
    const b = doc({ id: 'b' });
    render(
      <DocumentActions document={a} patientDocuments={[a, b]} patientName="Anna" onChanged={vi.fn()} />,
    );

    await user.click(screen.getByLabelText('Přesunout dokument'));
    await screen.findByLabelText('Komu dokument patří');

    expect(screen.queryByText(/bude Anna chybět/)).not.toBeInTheDocument();
  });

  it('does not offer to move a document to the patient it is already on', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByLabelText('Přesunout dokument'));
    await user.click(await screen.findByLabelText('Komu dokument patří'));

    expect(screen.getByRole('option', { name: /Jan Novák/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Anna Černá/ })).not.toBeInTheDocument();
  });

  it('moves, and tells the caller to reload', async () => {
    const user = userEvent.setup();
    const onChanged = renderActions();

    await user.click(screen.getByLabelText('Přesunout dokument'));
    await user.click(await screen.findByLabelText('Komu dokument patří'));
    await user.click(await screen.findByRole('option', { name: /Jan Novák/ }));
    await user.click(screen.getByRole('button', { name: 'Přesunout' }));

    expect(move).toHaveBeenCalledWith('d1', 'p2');
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('striking a document out', () => {
  it('sends the reason and the note', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByLabelText('Zneplatnit dokument'));
    await user.type(await screen.findByLabelText('Poznámka'), 'Naskenovaná jen první strana');
    await user.click(screen.getByRole('button', { name: 'Zneplatnit' }));

    expect(invalidate).toHaveBeenCalledWith('d1', 'unreadable', 'Naskenovaná jen první strana');
  });

  /*
   * "Belongs to another patient" is deliberately not a reason - it is the one
   * case where striking out is the wrong answer, and the most tempting. The
   * dialog says so instead.
   */
  it('points a misfiled document at the move rather than offering it as a reason', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByLabelText('Zneplatnit dokument'));

    expect(await screen.findByText(/nezneplatňujte ho — přesuňte ho/)).toBeInTheDocument();
  });

  it('offers nothing further on one already struck out', () => {
    renderActions({ invalidatedAtUtc: '2026-09-12T12:00:00Z', invalidationReasonCode: 'duplicate' });

    expect(screen.getByLabelText('Už je zneplatněný')).toBeDisabled();
    expect(screen.getByLabelText('Přesunout dokument')).toBeDisabled();
  });
});

describe('opening the file', () => {
  it('fetches it and shows it rather than downloading it', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByLabelText('Otevřít dokument'));

    expect(content).toHaveBeenCalledWith('d1');
    expect(await screen.findByTitle('Dokument')).toBeInTheDocument();
  });

  /*
   * The record can outlive its file - a moved environment, a database restored
   * without the storage behind it. Saying which of the two is missing is the
   * difference between "upload it again" and "call somebody".
   */
  it('says the file is gone rather than blaming the network', async () => {
    const user = userEvent.setup();
    content.mockRejectedValue({ response: { status: 404 } });
    renderActions();

    await user.click(screen.getByLabelText('Otevřít dokument'));

    expect(await screen.findByText(/Záznam zůstal, soubor ne/)).toBeInTheDocument();
  });
});
