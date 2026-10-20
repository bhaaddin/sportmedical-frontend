/*
 * Dokumenty, šablony a hlavičky + Pravidla dokumentů: the number fields of a rule (an emptied field is not
 * "never expires"), what is saved, and that the other screen sees it afterwards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingApiError } from '../../api/apiError';

const { listRules, updateRule, addRule, removeRule, listServices, getTemplates, updateTemplate } = vi.hoisted(() => ({
  listRules: vi.fn(), updateRule: vi.fn(), addRule: vi.fn(), removeRule: vi.fn(), listServices: vi.fn(), getTemplates: vi.fn(), updateTemplate: vi.fn(),
}));
vi.mock('../../api/documentRequirements', () => ({ documentRequirementsApi: { list: listRules, update: updateRule, add: addRule, remove: removeRule } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/documents', () => ({ documentsApi: { getTemplates, updateTemplate } }));

const { default: DocumentRequirementsPage } = await import('./DocumentRequirementsPage');
const { default: DocumentTemplatesPage } = await import('./DocumentTemplatesPage');

const rule = (over: Record<string, unknown> = {}) => ({
  id: 'r1', templateId: 't1', templateName: 'Výpis ze zdravotní dokumentace', clinicServiceId: 's1', serviceName: 'Sportovní prohlídky',
  serviceExists: true, validityMonths: 12, warnDaysBefore: 30, firstVisitOnly: false, blocksBooking: false, ...over,
});
const tpl = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, type: 'Vypis', version: 1, fileUrl: '', description: '', isActive: true, ...over,
});
const svc = (id: string, name: string) => ({ id, name, description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1 });

const show = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return client;
};

beforeEach(() => {
  listRules.mockReset().mockResolvedValue([rule()]);
  updateRule.mockReset().mockResolvedValue(rule());
  addRule.mockReset().mockResolvedValue(rule());
  removeRule.mockReset().mockResolvedValue(undefined);
  listServices.mockReset().mockResolvedValue([svc('s1', 'Sportovní prohlídky'), svc('s2', 'Diagnostika')]);
  getTemplates.mockReset().mockResolvedValue([tpl('t1', 'Výpis ze zdravotní dokumentace'), tpl('t2', 'Informovaný souhlas', { type: 'InformovanySouhlas' })]);
  updateTemplate.mockReset().mockResolvedValue(tpl('t1', 'x'));
});

describe('the settings of one rule', () => {
  const openEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Upravit pravidlo Výpis ze zdravotní dokumentace u služby Sportovní prohlídky' }));
    return screen.findByRole('dialog');
  };
  const months = (dialog: HTMLElement) => within(dialog).getByLabelText('Platnost (měsíců)') as HTMLInputElement;
  const days = (dialog: HTMLElement) => within(dialog).getByLabelText('Upozornit předem (dní)') as HTMLInputElement;
  const saveRule = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Uložit' });

  it('opens with the stored numbers and the sentence that says what they mean', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    expect(months(dialog).value).toBe('12');
    expect(days(dialog).value).toBe('30');
    expect(within(dialog).getByText(/Platí 12 měsíců od vystavení · upozorní 30 dní předem · při každé návštěvě/)).toBeInTheDocument();
  });

  it('an emptied months field is not "never expires": it is flagged and cannot be saved', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    await user.clear(months(dialog));
    expect(months(dialog).value).toBe('');
    expect(within(dialog).getByText('Zadejte celý počet měsíců. Zadejte 0, pokud nikdy nevyprší.')).toBeInTheDocument();
    expect(saveRule(dialog)).toBeDisabled();
    expect(within(dialog).queryByText(/Nevyprší/)).toBeNull();
  });

  it('an emptied days field is flagged too, and a typed 0 means "no warning" and is accepted', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    await user.clear(days(dialog));
    expect(saveRule(dialog)).toBeDisabled();
    await user.type(days(dialog), '0');
    expect(saveRule(dialog)).toBeEnabled();
    expect(within(dialog).getByText(/neupozorňuje předem/)).toBeInTheDocument();
  });

  it.each([['validity', '1.5'], ['warn', '10.5']])('a fraction in the %s field cannot be saved', async (which, typed) => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(which === 'validity' ? months(dialog) : days(dialog), { target: { value: typed } });
    expect(saveRule(dialog)).toBeDisabled();
  });

  it.each([
    ['241 months', 'validity', '241', 'Platnost přes 240 měsíců'],
    ['-1 month', 'validity', '-1', 'Platnost nemůže být záporná'],
    ['366 days', 'warn', '366', 'Upozorňovat víc než 365 dní'],
    ['-5 days', 'warn', '-5', 'Počet dní nemůže být záporný'],
  ])('%s is refused at the field', async (_name, which, typed, sentence) => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(which === 'validity' ? months(dialog) : days(dialog), { target: { value: typed } });
    expect(within(dialog).getByText(new RegExp(sentence))).toBeInTheDocument();
    expect(saveRule(dialog)).toBeDisabled();
  });

  it('refuses a warning window longer than the document lasts', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(months(dialog), { target: { value: '1' } });
    fireEvent.change(days(dialog), { target: { value: '45' } });
    expect(within(dialog).getByText(/svítilo by pořád/)).toBeInTheDocument();
    expect(saveRule(dialog)).toBeDisabled();
  });

  it('saves the four settings as typed and asks the server for the list again', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(months(dialog), { target: { value: '6' } });
    fireEvent.change(days(dialog), { target: { value: '10' } });
    await user.click(within(dialog).getByRole('radio', { name: /Jen při první návštěvě/ }));
    await user.click(saveRule(dialog));
    await waitFor(() => expect(updateRule).toHaveBeenCalledWith('r1', { validityMonths: 6, warnDaysBefore: 10, firstVisitOnly: true, blocksBooking: false }));
    await waitFor(() => expect(listRules.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('switching on "Bez dokladu neobjednat" needs an explicit yes before it can be saved; switching it off does not', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    await user.click(within(dialog).getByRole('radio', { name: /Bez dokladu neobjednat/ }));
    expect(saveRule(dialog)).toBeDisabled();
    await user.click(within(dialog).getByRole('switch', { name: 'Rozumím, chci to tak' }));
    expect(saveRule(dialog)).toBeEnabled();
    await user.click(within(dialog).getByRole('radio', { name: /Jen upozornit/ }));
    expect(saveRule(dialog)).toBeEnabled();
  });

  it('shows the server\'s sentence when the save is refused and keeps the dialog open', async () => {
    const user = userEvent.setup();
    updateRule.mockRejectedValue(new BookingApiError('validation', 400, 'Platnost musí být celé číslo.'));
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(months(dialog), { target: { value: '7' } });
    await user.click(saveRule(dialog));
    expect(await within(dialog).findByText('Platnost musí být celé číslo.')).toBeInTheDocument();
  });

  it('a double click on Uložit is one request', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    updateRule.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    show(<DocumentRequirementsPage />);
    const dialog = await openEditor(user);
    fireEvent.change(months(dialog), { target: { value: '7' } });
    await user.dblClick(saveRule(dialog));
    expect(updateRule).toHaveBeenCalledTimes(1);
    release(rule());
  });

  it('warns on the row when a blocking rule is on a document booking never checks', async () => {
    listRules.mockResolvedValue([rule({ templateId: 't2', templateName: 'Informovaný souhlas', blocksBooking: true })]);
    show(<DocumentRequirementsPage />);
    expect(await screen.findByText(/Objednávání dnes kontroluje jen výpis/)).toBeInTheDocument();
  });

  it('does not offer a switched-off document or a retired service for a new rule', async () => {
    const user = userEvent.setup();
    getTemplates.mockResolvedValue([tpl('t1', 'Výpis'), tpl('t3', 'Vypnutý dokument', { isActive: false })]);
    listServices.mockResolvedValue([svc('s1', 'Sportovní prohlídky'), { ...svc('s9', 'Zrušená služba'), isActive: false }]);
    show(<DocumentRequirementsPage />);
    await user.click(await screen.findByLabelText('Dokument'));
    expect(screen.queryByRole('option', { name: 'Vypnutý dokument' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Výpis' })).toBeInTheDocument();
  });

  it('adds a rule for the picked document and service, once, and refuses a duplicate before asking', async () => {
    const user = userEvent.setup();
    show(<DocumentRequirementsPage />);
    await user.click(await screen.findByLabelText('Dokument'));
    await user.click(await screen.findByRole('option', { name: 'Výpis ze zdravotní dokumentace' }));
    await user.click(screen.getByLabelText('Služba'));
    await user.click(await screen.findByRole('option', { name: 'Sportovní prohlídky' }));
    expect(screen.getByText('Tohle pravidlo už v seznamu je.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Přidat pravidlo' })).toBeDisabled();
    await user.click(screen.getByLabelText('Služba'));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.click(screen.getByRole('button', { name: 'Přidat pravidlo' }));
    await waitFor(() => expect(addRule).toHaveBeenCalledWith('t1', 's2'));
  });
});

describe('the kinds of document', () => {
  const edit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(await screen.findByRole('button', { name: `Upravit dokument ${name}` }));
    return screen.findByRole('dialog');
  };

  it('lists switched-off kinds too (this screen alone asks for them) and marks them', async () => {
    getTemplates.mockResolvedValue([tpl('t1', 'Výpis'), tpl('t3', 'Ceník', { isActive: false })]);
    show(<DocumentTemplatesPage />);
    expect(await screen.findByText('Ceník')).toBeInTheDocument();
    expect(screen.getByText('Vypnuto')).toBeInTheDocument();
    expect(getTemplates).toHaveBeenCalledWith(true);
  });

  it('counts the rules that point at a kind', async () => {
    listRules.mockResolvedValue([rule(), rule({ id: 'r2' })]);
    show(<DocumentTemplatesPage />);
    expect(await screen.findByText('2 pravidla ho vyžadují')).toBeInTheDocument();
  });

  it('keeps Uložit off until the name, the description or the switch changes, and off for a blank name', async () => {
    const user = userEvent.setup();
    show(<DocumentTemplatesPage />);
    const dialog = await edit(user, 'Výpis ze zdravotní dokumentace');
    const save = within(dialog).getByRole('button', { name: 'Uložit' });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Popis'), 'nový');
    expect(save).toBeEnabled();
    fireEvent.change(within(dialog).getByLabelText('Název'), { target: { value: '  ' } });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText(/Nesmí zůstat prázdný/)).toBeInTheDocument();
  });

  it('saves all three fields, closes the dialog and asks for both lists again', async () => {
    const user = userEvent.setup();
    show(<DocumentTemplatesPage />);
    const dialog = await edit(user, 'Výpis ze zdravotní dokumentace');
    await user.click(within(dialog).getByRole('switch'));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledWith('t1', { name: 'Výpis ze zdravotní dokumentace', description: '', isActive: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(getTemplates.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(listRules.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('says before the switch how many rules would be left with nothing to ask for', async () => {
    const user = userEvent.setup();
    listRules.mockResolvedValue([rule()]);
    show(<DocumentTemplatesPage />);
    const dialog = await edit(user, 'Výpis ze zdravotní dokumentace');
    await user.click(within(dialog).getByRole('switch'));
    expect(within(dialog).getByText(/Jedno pravidlo na něj ukazuje/)).toBeInTheDocument();
  });

  it('points at a description that still describes the cancelled first-visit rule', async () => {
    getTemplates.mockResolvedValue([tpl('t1', 'Výpis', { description: 'Doloží (vyžaduje se při první návštěvě)' })]);
    show(<DocumentTemplatesPage />);
    expect(await screen.findByText(/Tenhle popis ještě říká/)).toBeInTheDocument();
  });

  it('shows the server\'s refusal and keeps the dialog', async () => {
    const user = userEvent.setup();
    updateTemplate.mockRejectedValue(new BookingApiError('validation', 400, 'Název je povinný.'));
    show(<DocumentTemplatesPage />);
    const dialog = await edit(user, 'Výpis ze zdravotní dokumentace');
    await user.type(within(dialog).getByLabelText('Popis'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Název je povinný.')).toBeInTheDocument();
  });

  it('says the clinic has no kind of document, rather than drawing nothing', async () => {
    getTemplates.mockResolvedValue([]);
    show(<DocumentTemplatesPage />);
    expect(await screen.findByText('Ordinace nemá založený žádný druh dokumentu.')).toBeInTheDocument();
  });
});
