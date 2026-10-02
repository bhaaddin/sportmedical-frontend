/*
 * The screen where the clinic edits its own questionnaire.
 *
 * ── What is worth checking by rendering it ──
 *
 * One thing above all: that a PUBLISHED questionnaire cannot be edited from
 * here. It is what patients are filling in at that moment, and their stored
 * answers name its questions; an edit button that works on it is not a cosmetic
 * slip, it changes questions out from under answers already given. So the test
 * asserts the buttons are ABSENT, not merely that pressing them does nothing.
 *
 * Then the opposite: that a draft is fully editable, and that the screen says
 * plainly which of the two somebody is looking at. "Is this live?" has to be
 * answerable without clicking anything.
 *
 * And that a refusal from the server reaches the screen in the server's own
 * words. The domain refuses the mistakes that are invisible on the patient's
 * form — a follow-up pointed at a question nobody asks never appears, with no
 * gap and no warning — and that sentence is the only explanation the clinic
 * gets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const list = vi.fn();
const startDraft = vi.fn();
const publish = vi.fn();
const discardDraft = vi.fn();
const addQuestion = vi.fn();
const editQuestion = vi.fn();
const removeQuestion = vi.fn();
const moveQuestion = vi.fn();
const renameSection = vi.fn();
const rename = vi.fn();
const create = vi.fn();
const activate = vi.fn();
const deactivate = vi.fn();
const readDefault = vi.fn();
const setDefault = vi.fn();

vi.mock('../../api/questionnaireEditor', async () => {
  const actual = await vi.importActual<typeof import('../../api/questionnaireEditor')>(
    '../../api/questionnaireEditor',
  );

  return {
    ...actual,
    questionnaireEditorApi: {
      list,
      get: vi.fn(),
      startDraft,
      publish,
      discardDraft,
      addQuestion,
      editQuestion,
      removeQuestion,
      moveQuestion,
      renameSection,
      rename,
      create,
      activate,
      deactivate,
      readDefault,
      setDefault,
    },
  };
});

const { default: QuestionnairePage } = await import('./QuestionnairePage');

const question = (over: Record<string, unknown> = {}) => ({
  id: 'q-1',
  type: 'Boolean',
  prompt: 'Bolest na hrudi při zátěži?',
  helpText: null,
  isRequired: false,
  sortOrder: 1,
  minValue: null,
  maxValue: null,
  maxTextLength: null,
  allowMultipleSelection: false,
  options: [],
  questionKey: 'kardio_bolest',
  sectionNumber: '9',
  sectionTitle: 'Kardiovaskulární onemocnění',
  sectionNote: null,
  placeholder: null,
  showWhenAnswered: null,
  femaleOnly: false,
  ...over,
});

const version = (status: string, over: Record<string, unknown> = {}) => ({
  id: `v-${status}`,
  definitionId: 'd-1',
  versionNumber: status === 'Draft' ? 2 : 1,
  status,
  note: null,
  createdAtUtc: '2026-09-21T10:00:00Z',
  questions: [question()],
  ...over,
});

const definition = (versions: unknown[]) => ({
  id: 'd-1',
  organizationId: 'org',
  clinicId: 'clinic',
  key: 'sportmedical-cz-zdravotni-dotaznik',
  displayName: 'Zdravotní dotazník',
  createdAtUtc: '2026-09-21T10:00:00Z',
  versions,
});

beforeEach(() => {
  [
    list,
    startDraft,
    publish,
    discardDraft,
    addQuestion,
    editQuestion,
    removeQuestion,
    moveQuestion,
    renameSection,
  ].forEach((fn) => fn.mockReset());

  [
    startDraft,
    publish,
    discardDraft,
    addQuestion,
    editQuestion,
    removeQuestion,
    moveQuestion,
    renameSection,
  ].forEach((fn) => fn.mockResolvedValue(undefined));

  [rename, create, activate, deactivate, readDefault, setDefault].forEach((fn) => fn.mockReset());
  [rename, activate, deactivate].forEach((fn) => fn.mockResolvedValue(undefined));
  create.mockResolvedValue({ id: 'd-9', key: 'dotaznik-pro-bezce', displayName: 'Dotazník pro běžce', isActive: false });
  readDefault.mockResolvedValue({ configuredDefinitionId: null, effectiveDefinitionId: 'd-1' });
  setDefault.mockResolvedValue({ configuredDefinitionId: 'd-2', effectiveDefinitionId: 'd-2' });
});

const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

describe('what patients are answering is not editable from here', () => {
  beforeEach(() => {
    list.mockResolvedValue([definition([version('Published')])]);
  });

  it('says plainly that this one is live, without anybody having to click', async () => {
    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText(/Nasazeno — verze 1/)).toBeInTheDocument();
    expect(screen.getByText(/Toto pacienti právě vyplňují/)).toBeInTheDocument();
  });

  it('offers no way to change a question — the buttons are not there at all', async () => {
    render(withQueries(<QuestionnairePage />));

    await screen.findByText('Bolest na hrudi při zátěži?');

    expect(screen.queryByRole('button', { name: /Upravit znění/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Odebrat z konceptu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Posunout/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat otázku/i })).not.toBeInTheDocument();
  });

  it('offers to open a draft instead', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Otevřít koncept' }));

    await waitFor(() => expect(startDraft).toHaveBeenCalledWith('d-1', null));
  });
});

describe('a draft is the copy the clinic works on', () => {
  beforeEach(() => {
    list.mockResolvedValue([definition([version('Published'), version('Draft')])]);
  });

  it('says it is a draft and which version patients still have', async () => {
    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText(/Koncept — verze 2/)).toBeInTheDocument();
    expect(screen.getByText(/Pacienti zatím vyplňují verzi 1/)).toBeInTheDocument();
  });

  it('removes a question from the draft', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Odebrat z konceptu' }));

    await waitFor(() => expect(removeQuestion).toHaveBeenCalledWith('d-1', 'v-Draft', 'q-1'));
  });

  it('publishes the draft', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Zveřejnit' }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith('d-1', 'v-Draft'));
  });

  it('will not move the only question off either end', async () => {
    render(withQueries(<QuestionnairePage />));

    await screen.findByText('Bolest na hrudi při zátěži?');

    expect(screen.getByRole('button', { name: 'Posunout výš' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Posunout níž' })).toBeDisabled();
  });

  it('renames a whole section at once, and says why', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Přejmenovat sekci' }));

    expect(
      await screen.findByText(/propíše do všech otázek v sekci najednou/),
    ).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');

    const title = within(dialog).getByLabelText('Název sekce');

    await userEvent.clear(title);
    await userEvent.type(title, 'Srdce a cévy');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));

    await waitFor(() =>
      expect(renameSection).toHaveBeenCalledWith('d-1', 'v-Draft', {
        sectionNumber: '9',
        newNumber: '9',
        newTitle: 'Srdce a cévy',
        newNote: null,
        femaleOnly: false,
      }),
    );
  });
});

describe('the key and the type are permanent, and the screen says so', () => {
  beforeEach(() => {
    list.mockResolvedValue([definition([version('Draft')])]);
  });

  it('shows the question key, because a condition names it', async () => {
    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText('kardio_bolest')).toBeInTheDocument();
  });

  it('tells somebody rewording a question what they cannot change', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Upravit znění' }));

    expect(await screen.findByText(/se nemění — odpovědi už se pod ně ukládají/)).toBeInTheDocument();
  });

  it('sends the new wording and leaves the choices alone for a question with none', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Upravit znění' }));

    const dialog = await screen.findByRole('dialog');
    const prompt = within(dialog).getByLabelText('Otázka');

    await userEvent.clear(prompt);
    await userEvent.type(prompt, 'Bolest na hrudi?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(editQuestion).toHaveBeenCalled());

    const [, , , sent] = editQuestion.mock.calls[0];

    expect(sent.prompt).toBe('Bolest na hrudi?');

    // Null, not []: an empty list would try to CLEAR the choices of a
    // question that has none, which is a different instruction.
    expect(sent.options).toBeNull();
  });
});

describe('a refusal reaches the person in the words the server used', () => {
  beforeEach(() => {
    list.mockResolvedValue([definition([version('Draft')])]);

    removeQuestion.mockRejectedValue({
      response: {
        data: {
          code: 'questionnaires.question.order.invalid',
          message:
            'Another question is shown only when this one is answered, so removing it would leave a question nobody can reach.',
        },
      },
    });
  });

  it('shows it rather than swallowing it into a generic failure', async () => {
    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Odebrat z konceptu' }));

    expect(
      await screen.findByText(/would leave a question nobody can reach/),
    ).toBeInTheDocument();
  });
});

/*
 * The questionnaire as a whole — new, renamed, on, off, the default.
 *
 * The clinic had one questionnaire and no way to have a second, stop asking
 * one, or say which one a činnost without its own gets. What is worth
 * checking here is the one refusal the screen must not let anybody walk into:
 * the default cannot be switched off, so the button is disabled rather than
 * pressed and refused.
 */
describe('the questionnaire as a whole', () => {
  it('says which one is switched on and which one is the default', async () => {
    list.mockResolvedValue([definition([version('Published')])]);

    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText('Zapnutý')).toBeInTheDocument();
    expect(screen.getByText('Výchozí')).toBeInTheDocument();
  });

  it('will not let the default be switched off — the button is disabled', async () => {
    list.mockResolvedValue([definition([version('Published')])]);

    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByRole('button', { name: 'Vypnout' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Nastavit jako výchozí' })).not.toBeInTheDocument();
  });

  it('switches a questionnaire that is not the default off', async () => {
    readDefault.mockResolvedValue({ configuredDefinitionId: 'd-1', effectiveDefinitionId: 'd-1' });
    list.mockResolvedValue([{ ...definition([version('Published')]), id: 'd-2', key: 'dotaznik-pro-plavce' }]);

    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Vypnout' }));

    await waitFor(() => expect(deactivate).toHaveBeenCalledWith('d-2'));
  });

  it('makes a switched-on questionnaire the default', async () => {
    readDefault.mockResolvedValue({ configuredDefinitionId: 'd-1', effectiveDefinitionId: 'd-1' });
    list.mockResolvedValue([{ ...definition([version('Published')]), id: 'd-2', key: 'dotaznik-pro-plavce' }]);

    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Nastavit jako výchozí' }));

    await waitFor(() => expect(setDefault).toHaveBeenCalledWith('d-2'));
  });

  it('shows a switched-off questionnaire with what it last asked, and switches it back on', async () => {
    list.mockResolvedValue([definition([version('Retired')])]);

    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText(/Vypnuto — naposledy verze 1/)).toBeInTheDocument();
    expect(screen.getByText('Bolest na hrudi při zátěži?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zapnout' }));

    await waitFor(() => expect(activate).toHaveBeenCalledWith('d-1'));
  });

  it('starts a new questionnaire from a name alone', async () => {
    list.mockResolvedValue([definition([version('Published')])]);

    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Nový dotazník' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'Vytvořit' })).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText('Název dotazníku'), 'Dotazník pro běžce');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vytvořit' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith('Dotazník pro běžce'));
  });

  it('renames a questionnaire — the name, never the key answers are filed under', async () => {
    list.mockResolvedValue([definition([version('Published')])]);

    render(withQueries(<QuestionnairePage />));

    await userEvent.click(await screen.findByRole('button', { name: 'Přejmenovat' }));

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Název dotazníku');

    await userEvent.clear(name);
    await userEvent.type(name, 'Vstupní dotazník');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(rename).toHaveBeenCalledWith('d-1', 'Vstupní dotazník'));
  });
});

describe('before there is anything to edit', () => {
  it('says so rather than drawing an empty questionnaire, and offers to start one', async () => {
    list.mockResolvedValue([]);

    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText('Ordinace zatím žádný dotazník nemá.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nový dotazník' })).toBeInTheDocument();
  });

  it('says the load failed rather than looking like a clinic with no questions', async () => {
    list.mockRejectedValue(new Error('Network Error'));

    render(withQueries(<QuestionnairePage />));

    expect(await screen.findByText('Dotazníky se nepodařilo načíst.')).toBeInTheDocument();
  });
});
