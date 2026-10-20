/*
 * Vstupní dotazník: adding and rewording a question. The two things that went wrong were invisible on screen:
 * the choices field swallowed the Enter that starts a second choice, and a question could be added with no key
 * (or a key the answers cannot be filed under) because the server accepts both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const m = vi.hoisted(() => ({
  list: vi.fn(), addQuestion: vi.fn(), editQuestion: vi.fn(), create: vi.fn(), rename: vi.fn(), readDefault: vi.fn(), startDraft: vi.fn(),
  publish: vi.fn(), discardDraft: vi.fn(), removeQuestion: vi.fn(), moveQuestion: vi.fn(), renameSection: vi.fn(), activate: vi.fn(),
  deactivate: vi.fn(), setDefault: vi.fn(),
}));
vi.mock('../../api/questionnaireEditor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/questionnaireEditor')>();
  return { ...actual, questionnaireEditorApi: { ...m, get: vi.fn() } };
});

const { default: QuestionnairePage } = await import('./QuestionnairePage');

const question = (over: Record<string, unknown> = {}) => ({
  id: 'q-1', type: 'Boolean', prompt: 'Bolest na hrudi?', helpText: null, isRequired: false, sortOrder: 1, minValue: null, maxValue: null,
  maxTextLength: null, allowMultipleSelection: false, options: [], questionKey: 'kardio_bolest', sectionNumber: '9',
  sectionTitle: 'Kardio', sectionNote: null, placeholder: null, showWhenAnswered: null, femaleOnly: false, ...over,
});
const version = (status: string, questions: unknown[]) => ({
  id: `v-${status}`, definitionId: 'd-1', versionNumber: status === 'Draft' ? 2 : 1, status, note: null, createdAtUtc: '2026-09-21T10:00:00Z', questions,
});
const definition = (versions: unknown[], over: Record<string, unknown> = {}) => ({
  id: 'd-1', organizationId: 'o', clinicId: 'c', key: 'zdravotni', displayName: 'Zdravotní dotazník', createdAtUtc: '2026-09-21T10:00:00Z', versions, ...over,
});

const show = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  [m.addQuestion, m.editQuestion, m.startDraft, m.publish, m.discardDraft, m.removeQuestion, m.moveQuestion, m.renameSection, m.rename, m.activate, m.deactivate]
    .forEach((fn) => fn.mockResolvedValue(undefined));
  m.readDefault.mockResolvedValue({ configuredDefinitionId: null, effectiveDefinitionId: 'd-1' });
  m.create.mockResolvedValue({ id: 'd-9', key: 'x', displayName: 'Nový', isActive: false });
  m.setDefault.mockResolvedValue({ configuredDefinitionId: 'd-1', effectiveDefinitionId: 'd-1' });
  m.list.mockResolvedValue([definition([version('Published', [question()]), version('Draft', [question()])])]);
});

const openAdd = async () => {
  show(<QuestionnairePage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Přidat otázku v nové sekci' }));
  return screen.findByRole('dialog');
};
const addButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Přidat' });
const typeText = async (dialog: HTMLElement, label: string, text: string) => {
  const field = within(dialog).getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, text);
  return field as HTMLInputElement;
};

describe('adding a question', () => {
  it('suggests a key from the wording, without diacritics, and shows it in the key field', async () => {
    const dialog = await openAdd();
    await typeText(dialog, 'Otázka', 'Máte cukrovku?');
    expect((within(dialog).getByLabelText('Klíč') as HTMLInputElement).value).toBe('mate_cukrovku');
  });

  it('stops suggesting once the key was typed by hand', async () => {
    const dialog = await openAdd();
    await typeText(dialog, 'Klíč', 'moje_cukrovka');
    await typeText(dialog, 'Otázka', 'Úplně jiná otázka?');
    expect((within(dialog).getByLabelText('Klíč') as HTMLInputElement).value).toBe('moje_cukrovka');
  });

  it('will not add a question with no wording', async () => {
    const dialog = await openAdd();
    expect(addButton(dialog)).toBeDisabled();
  });

  it('will not add a question whose wording gives no key (nothing a key can be made of), and says why at the key', async () => {
    const dialog = await openAdd();
    await typeText(dialog, 'Otázka', '???');
    expect(addButton(dialog)).toBeDisabled();
    expect(within(dialog).getByText(/Klíč je potřeba/)).toBeInTheDocument();
  });

  it.each([['Bolest'], ['bolest hrudi'], ['bolest-hrudi'], ['bolest_hrudí'], ['_bolest']])('refuses the key %s', async (key) => {
    const dialog = await openAdd();
    await typeText(dialog, 'Otázka', 'Cokoli');
    fireEvent.change(within(dialog).getByLabelText('Klíč'), { target: { value: key } });
    expect(addButton(dialog)).toBeDisabled();
    expect(within(dialog).getByText(/Klíč smí mít jen malá písmena bez diakritiky/)).toBeInTheDocument();
  });

  it('accepts a good key and sends the question as typed, in the section it was opened for', async () => {
    const dialog = await openAdd();
    await typeText(dialog, 'Otázka', 'Máte cukrovku?');
    await userEvent.click(addButton(dialog));
    await waitFor(() => expect(m.addQuestion).toHaveBeenCalled());
    const [definitionId, versionId, sent] = m.addQuestion.mock.calls[0];
    expect([definitionId, versionId]).toEqual(['d-1', 'v-Draft']);
    expect(sent).toMatchObject({ type: 'Boolean', prompt: 'Máte cukrovku?', questionKey: 'mate_cukrovku', isRequired: false });
  });

  it('lets a second choice be typed: Enter starts a new line and the line stays', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: 'Výběr z možností' }));
    await typeText(dialog, 'Otázka', 'Úroveň sportu?');
    const choices = within(dialog).getByLabelText('Možnosti') as HTMLTextAreaElement;
    await userEvent.type(choices, 'Rekreační{Enter}Amatérská{Enter}Profesionální');
    expect(choices.value).toBe('Rekreační\nAmatérská\nProfesionální');
  });

  it('keeps a trailing Enter in the field (the line the next choice is typed on)', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: 'Výběr z možností' }));
    const choices = within(dialog).getByLabelText('Možnosti') as HTMLTextAreaElement;
    await userEvent.type(choices, 'Ano{Enter}');
    expect(choices.value).toBe('Ano\n');
  });

  it('sends the choices keyed by the question\'s key and their place', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: 'Výběr z možností' }));
    await typeText(dialog, 'Otázka', 'Úroveň sportu?');
    await userEvent.type(within(dialog).getByLabelText('Možnosti'), 'Rekreační{Enter}Amatérská');
    await userEvent.click(addButton(dialog));
    await waitFor(() => expect(m.addQuestion).toHaveBeenCalled());
    const sent = m.addQuestion.mock.calls[0][2];
    expect(sent.type).toBe('SingleChoice');
    expect(sent.options).toEqual([
      { key: 'uroven_sportu_1', displayText: 'Rekreační', sortOrder: 1 },
      { key: 'uroven_sportu_2', displayText: 'Amatérská', sortOrder: 2 },
    ]);
  });

  it('numbers the choices from the key as it is at the end, even if the key is changed after they were typed', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: 'Výběr z možností' }));
    await typeText(dialog, 'Otázka', 'Úroveň sportu?');
    await userEvent.type(within(dialog).getByLabelText('Možnosti'), 'A{Enter}B');
    await typeText(dialog, 'Klíč', 'sport');
    await userEvent.click(addButton(dialog));
    await waitFor(() => expect(m.addQuestion).toHaveBeenCalled());
    expect(m.addQuestion.mock.calls[0][2].options.map((o: { key: string }) => o.key)).toEqual(['sport_1', 'sport_2']);
  });

  it('changing a choice question into another type sends no choices', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: 'Výběr z možností' }));
    await typeText(dialog, 'Otázka', 'Úroveň sportu?');
    await userEvent.type(within(dialog).getByLabelText('Možnosti'), 'A{Enter}B');
    await userEvent.click(within(dialog).getByLabelText('Typ otázky'));
    await userEvent.click(await screen.findByRole('option', { name: /Ano \/ ne/i }));
    await userEvent.click(addButton(dialog));
    await waitFor(() => expect(m.addQuestion).toHaveBeenCalled());
    expect(m.addQuestion.mock.calls[0][2].options).toBeNull();
  });

  it('offers only yes/no questions asked earlier as the condition', async () => {
    const dialog = await openAdd();
    await userEvent.click(within(dialog).getByLabelText('Zobrazit jen po odpovědi ano'));
    expect(await screen.findByRole('option', { name: /kardio_bolest — Bolest na hrudi\?/ })).toBeInTheDocument();
  });

  it('Zrušit sends nothing', async () => {
    const dialog = await openAdd();
    await typeText(dialog, 'Otázka', 'Cokoli');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(m.addQuestion).not.toHaveBeenCalled();
  });
});

describe('rewording a question that has choices', () => {
  const withChoices = (options: Array<[string, string]>) => question({
    id: 'q-2', type: 'SingleChoice', prompt: 'Úroveň sportu?', questionKey: 'sport_uroven',
    options: options.map(([key, displayText], i) => ({ key, displayText, sortOrder: i + 1 })),
  });
  const reword = async (options: Array<[string, string]>) => {
    m.list.mockResolvedValue([definition([version('Published', []), version('Draft', [withChoices(options)])])]);
    show(<QuestionnairePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit znění' }));
    return screen.findByRole('dialog');
  };

  it('shows the choices one per line in their order', async () => {
    const dialog = await reword([['sport_uroven_1', 'Rekreační'], ['sport_uroven_2', 'Amatérská']]);
    expect((within(dialog).getByLabelText('Možnosti') as HTMLTextAreaElement).value).toBe('Rekreační\nAmatérská');
  });

  it('keeps each choice\'s key when the first one is removed (answers already given stay on the right wording)', async () => {
    const dialog = await reword([['sport_uroven_1', 'Rekreační'], ['sport_uroven_2', 'Amatérská'], ['sport_uroven_3', 'Profesionální']]);
    const field = within(dialog).getByLabelText('Možnosti');
    fireEvent.change(field, { target: { value: 'Amatérská\nProfesionální' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.editQuestion).toHaveBeenCalled());
    expect(m.editQuestion.mock.calls[0][3].options).toEqual([
      { key: 'sport_uroven_2', displayText: 'Amatérská', sortOrder: 1 },
      { key: 'sport_uroven_3', displayText: 'Profesionální', sortOrder: 2 },
    ]);
  });

  it('keeps the key of a choice whose typo was fixed', async () => {
    const dialog = await reword([['sport_uroven_1', 'Rekreacni'], ['sport_uroven_2', 'Amatérská']]);
    fireEvent.change(within(dialog).getByLabelText('Možnosti'), { target: { value: 'Rekreační\nAmatérská' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.editQuestion).toHaveBeenCalled());
    expect(m.editQuestion.mock.calls[0][3].options.map((o: { key: string }) => o.key)).toEqual(['sport_uroven_1', 'sport_uroven_2']);
  });

  it('gives a new choice a number nobody has used', async () => {
    const dialog = await reword([['sport_uroven_1', 'A'], ['sport_uroven_3', 'C']]);
    fireEvent.change(within(dialog).getByLabelText('Možnosti'), { target: { value: 'A\nC\nD' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.editQuestion).toHaveBeenCalled());
    expect(m.editQuestion.mock.calls[0][3].options.map((o: { key: string }) => o.key)).toEqual(['sport_uroven_1', 'sport_uroven_3', 'sport_uroven_2']);
  });

  it('cannot save with an empty wording', async () => {
    const dialog = await reword([['sport_uroven_1', 'A']]);
    fireEvent.change(within(dialog).getByLabelText('Otázka'), { target: { value: '  ' } });
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('turns an emptied help text into null, not an empty string', async () => {
    const dialog = await reword([['sport_uroven_1', 'A']]);
    await userEvent.type(within(dialog).getByLabelText('Nápověda'), '  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.editQuestion).toHaveBeenCalled());
    expect(m.editQuestion.mock.calls[0][3].helpText).toBeNull();
  });
});

describe('the questionnaire as a whole', () => {
  it('creates a questionnaire from a trimmed name and switches the screen to it', async () => {
    m.list.mockResolvedValue([definition([version('Published', [question()])])]);
    show(<QuestionnairePage />);
    await userEvent.click(await screen.findByRole('button', { name: /Nový dotazník/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Název dotazníku'), '  Pro běžce  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vytvořit' }));
    await waitFor(() => expect(m.create).toHaveBeenCalledWith('Pro běžce'));
  });

  it('will not create one without a name', async () => {
    m.list.mockResolvedValue([definition([version('Published', [question()])])]);
    show(<QuestionnairePage />);
    await userEvent.click(await screen.findByRole('button', { name: /Nový dotazník/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Název dotazníku'), '   ');
    expect(within(dialog).getByRole('button', { name: 'Vytvořit' })).toBeDisabled();
  });

  it('shows the server\'s sentence when a discard of the draft fails', async () => {
    m.discardDraft.mockRejectedValue({ response: { data: { message: 'Požadavek se nepodařilo bezpečně dokončit.' } } });
    show(<QuestionnairePage />);
    await userEvent.click(await screen.findByRole('button', { name: /Zahodit koncept/ }));
    expect(await screen.findByText('Požadavek se nepodařilo bezpečně dokončit.')).toBeInTheDocument();
  });
});
