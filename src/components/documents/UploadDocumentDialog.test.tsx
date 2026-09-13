/*
 * What the upload dialog says, and whether it is true.
 *
 * Two things it said today that were not. Both were found by uploading a real
 * výpis through the real screen against the running server, which is the only
 * way either could have been found - the rules were right and the sentences
 * were wrong.
 *
 * 1. It never asked for the issue date of a výpis. The field was offered only
 *    for a report from another doctor; a výpis has a template, so it was never
 *    asked, and the server has started answering 400 without it. Every výpis
 *    uploaded here failed after the file had gone up.
 *
 * 2. Afterwards it said "dokud není podepsaný, bere se jako nedodaný" - about
 *    a document the server had already signed off as it landed. A warning
 *    about nothing is how a screen teaches people to ignore its warnings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DocumentTemplate, PatientDocument } from '../../api/documents';

const upload = vi.fn();
const sign = vi.fn();
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { upload, sign, specialties: vi.fn().mockResolvedValue([]) } };
});

const { default: UploadDocumentDialog } = await import('./UploadDocumentDialog');

const vypis = { id: 't1', name: 'Výpis', type: 'Vypis' } as unknown as DocumentTemplate;
const souhlas = { id: 't2', name: 'Souhlas', type: 'InformovanySouhlas' } as unknown as DocumentTemplate;

const landed = (status: string): PatientDocument =>
  ({ id: 'd1', status, templateId: 't1' }) as PatientDocument;

const file = () => new File([new Uint8Array([1, 2, 3])], 'vypis.png', { type: 'image/png' });

beforeEach(() => {
  upload.mockReset().mockResolvedValue(landed('SignedOff'));
  sign.mockReset().mockResolvedValue(landed('SignedOff'));
});

const open = (template: DocumentTemplate | null) =>
  render(
    <UploadDocumentDialog
      open
      onClose={vi.fn()}
      patientId="p1"
      template={template}
      onUploaded={vi.fn()}
    />,
  );

/*
 * Puts a file in without a file picker.
 *
 * Looked for in the document and not in `render`'s container: a MUI Dialog
 * goes into a portal on `document.body`, so the container holds nothing at
 * all. The first version of this searched the container and failed with
 * "Cannot read properties of null", which is the right failure for the wrong
 * reason - the test was wrong, not the screen.
 */
const choose = async () => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement | null;
  expect(input, 'the dialog should offer a file input').not.toBeNull();
  await userEvent.upload(input!, file());
};

describe('the issue date of a výpis', () => {
  it('is asked for, and the upload waits for it', async () => {
    open(vypis);
    await choose();

    expect(await screen.findByLabelText(/Datum vydání výpisu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nahrát' })).toBeDisabled();
    expect(screen.getByText(/Doplňte datum vydání výpisu/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('lets the upload go once it is filled in, and sends it', async () => {
    open(vypis);
    await choose();

    await userEvent.type(await screen.findByLabelText(/Datum vydání výpisu/), '2026-05-03');
    await userEvent.click(screen.getByRole('button', { name: 'Nahrát' }));

    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(upload.mock.calls[0][4]).toMatchObject({ reportDate: '2026-05-03' });
  });

  /* A consent form has no date of its own; asking would be furniture. */
  it('is not asked for on other templates', async () => {
    open(souhlas);
    await choose();

    await screen.findByRole('button', { name: 'Nahrát' });
    expect(screen.queryByLabelText(/Datum vydání/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nahrát' })).toBeEnabled();
  });
});

describe('what it says once the document has landed', () => {
  const uploadIt = async () => {
    open(vypis);
    await choose();
    await userEvent.type(await screen.findByLabelText(/Datum vydání výpisu/), '2026-05-03');
    await userEvent.click(screen.getByRole('button', { name: 'Nahrát' }));
    await screen.findByText('Dokument je nahraný.');
  };

  /*
   * The server signs off a staff upload as it lands - measured, `SignedOff`
   * with `signedAt` already set. The old sentence warned about a state the
   * document was never in.
   */
  it('does not warn about signing a document that is already signed', async () => {
    await uploadIt();

    expect(screen.getByText(/Počítá se jako doložený/)).toBeInTheDocument();
    expect(screen.queryByText(/bere se jako nedodaný/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Podepsat teď/ })).not.toBeInTheDocument();
  });

  /* And still asks when there is something to ask for. */
  it('offers signing when the document really is waiting for it', async () => {
    upload.mockResolvedValue(landed('Pending'));
    await uploadIt();

    expect(screen.getByText(/bere se jako nedodaný/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Podepsat teď/ })).toBeInTheDocument();
  });
});
