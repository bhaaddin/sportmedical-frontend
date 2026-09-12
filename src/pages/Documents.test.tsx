/*
 * The documents screen, and the names it puts on things.
 *
 * It used to hold its own table of seven document types with its own labels.
 * Six of the seven no longer exist, and the three templates the server really
 * has - Informovaný souhlas, Ceník, Podmínky - matched none of them, so they
 * all fell through to a default and came out labelled "Info prohlídka". Three
 * identical cards, none of them named what it was.
 *
 * Nobody noticed because the fallback looked deliberate. It took the owner
 * asking what "Info prohlídka" meant.
 *
 * So what is tested here is not that names appear - it is that they are the
 * server's names, and that a type this screen has never heard of still comes
 * out called what it is.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getTemplates = vi.fn();
const getPatientDocuments = vi.fn();
const getAll = vi.fn();

vi.mock('../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../api/documents')>('../api/documents');
  return { ...actual, documentsApi: { getTemplates, getPatientDocuments } };
});
vi.mock('../api/patients', () => ({ patientsApi: { getAll } }));

const { default: Documents } = await import('./Documents');

const template = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'Výpis ze zdravotní dokumentace',
  type: 'Vypis',
  version: 1,
  fileUrl: '',
  requiredForVisit: true,
  firstVisitOnly: true,
  ageGated: false,
  minimumAge: 0,
  description: '',
  isActive: true,
  ...over,
});

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([]);
  getPatientDocuments.mockReset().mockResolvedValue([]);
  getTemplates.mockReset().mockResolvedValue([]);
});

describe('the templates the screen shows', () => {
  it('calls each one by the name the server gave it', async () => {
    getTemplates.mockResolvedValue([
      template(),
      template({ id: 't2', name: 'Informovaný souhlas s poskytováním služeb', type: 'InformovanySouhlas', requiredForVisit: false }),
      template({ id: 't3', name: 'Ceník poskytovaných služeb', type: 'Cenik', requiredForVisit: false }),
      template({ id: 't4', name: 'Podmínky poskytování služeb', type: 'Podminky', requiredForVisit: false }),
    ]);

    render(<Documents />);

    expect(await screen.findByText('Informovaný souhlas s poskytováním služeb')).toBeInTheDocument();
    expect(screen.getByText('Ceník poskytovaných služeb')).toBeInTheDocument();
    expect(screen.getByText('Podmínky poskytování služeb')).toBeInTheDocument();
  });

  /* The exact fault, kept as its own test: three real templates rendered under
     one borrowed label. */
  it('never labels a template "Info prohlídka"', async () => {
    getTemplates.mockResolvedValue([
      template({ id: 't2', name: 'Informovaný souhlas s poskytováním služeb', type: 'InformovanySouhlas' }),
      template({ id: 't3', name: 'Ceník poskytovaných služeb', type: 'Cenik' }),
      template({ id: 't4', name: 'Podmínky poskytování služeb', type: 'Podminky' }),
    ]);

    render(<Documents />);
    await screen.findByText('Ceník poskytovaných služeb');

    expect(screen.queryByText('Info prohlídka')).not.toBeInTheDocument();
  });

  /*
   * A type added on the server tomorrow must arrive named, not renamed. This
   * is the whole reason the labels moved off this screen.
   */
  it('names a type it has never heard of', async () => {
    getTemplates.mockResolvedValue([
      template({ id: 'tx', name: 'Souhlas s fotografováním', type: 'NeznamyTypZitrka' }),
    ]);

    render(<Documents />);

    expect(await screen.findByText('Souhlas s fotografováním')).toBeInTheDocument();
  });

  /* Six cards saying "not available" for types nobody can create is noise
     pretending to be information. */
  it('shows no card for a type the server does not have', async () => {
    getTemplates.mockResolvedValue([template()]);

    render(<Documents />);
    await screen.findByText('Výpis ze zdravotní dokumentace');

    expect(screen.queryByText('Šablona není k dispozici')).not.toBeInTheDocument();
    expect(screen.queryByText('GDPR souhlas')).not.toBeInTheDocument();
    expect(screen.queryByText('Zákonný zástupce (mladší 18)')).not.toBeInTheDocument();
  });

  it('marks required from the template rather than from its own opinion', async () => {
    getTemplates.mockResolvedValue([
      template({ id: 't1', name: 'Povinná věc', requiredForVisit: true }),
      template({ id: 't2', name: 'Nepovinná věc', type: 'Cenik', requiredForVisit: false }),
    ]);

    render(<Documents />);
    await screen.findByText('Povinná věc');

    expect(screen.getAllByText('Povinný')).toHaveLength(1);
  });

  it('says so plainly when there are no templates at all', async () => {
    render(<Documents />);
    expect(await screen.findByText(/Zatím nejsou nastavené žádné šablony/)).toBeInTheDocument();
  });
});

describe('the upload list', () => {
  it('offers each template under its own name too', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([{ id: 'p1', firstName: 'Eva', lastName: 'Adresova' }]);
    getTemplates.mockResolvedValue([
      template({ id: 't3', name: 'Ceník poskytovaných služeb', type: 'Cenik', requiredForVisit: false }),
    ]);

    render(<Documents />);

    /* The upload list only appears once a patient is chosen - it is per
       patient, which is the point of the screen. */
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Eva Adresova/ }));
    await user.click(screen.getByRole('tab', { name: /Dokumenty pacienta/i }));

    /* Once in the templates tab and once in the upload list - what matters is
       that neither of them says "Info prohlídka". */
    expect(screen.getAllByText('Ceník poskytovaných služeb').length).toBeGreaterThan(0);
    expect(screen.queryByText('Info prohlídka')).not.toBeInTheDocument();
  });
});
