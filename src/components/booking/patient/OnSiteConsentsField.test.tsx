/*
 * "Souhlasy podepsány na místě (papírově)": never preselected, the server's own
 * list for the činnost, "(nepovinný)" on the optional one, nothing ticked means
 * no call, a failure is a message and not an exception.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { setViewport, VIEWPORTS, type ViewportName } from '../../../test/viewport';

const getOptions = vi.fn();
const record = vi.fn();
vi.mock('../../../api/onSiteConsents', () => ({
  onSiteConsentsApi: { getOptions, record },
  default: { getOptions, record },
}));

const {
  OnSiteConsentsField,
  EMPTY_ON_SITE_CONSENTS,
  recordOnSiteConsents,
} = await import('./OnSiteConsentsField');

const ALL = {
  activityId: 'act-1',
  options: [
    { code: 'treatment', label: 'Souhlas se zpracováním údajů o zdravotním stavu', required: true },
    { code: 'club', label: 'Souhlas se sdílením výsledků s klubem', required: true },
    { code: 'communication', label: 'Novinky a nabídky', required: false },
  ],
};

let latest = EMPTY_ON_SITE_CONSENTS;
function Host({ activityId }: { activityId: string | null }) {
  const [v, setV] = useState(EMPTY_ON_SITE_CONSENTS);
  latest = v;
  return <OnSiteConsentsField activityId={activityId} value={v} onChange={setV} />;
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getOptions.mockReset().mockResolvedValue(ALL);
  record.mockReset().mockResolvedValue({
    patientId: 'p1', recorded: [], alreadyOnFile: [], missingConsents: [], paperwork: null,
  });
  latest = EMPTY_ON_SITE_CONSENTS;
});

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('the field at %s width', (name) => {
  it('lists the server options, all unticked, with "(nepovinný)" on the optional one', async () => {
    setViewport(VIEWPORTS[name]);
    render(<Host activityId="act-1" />);
    expect(await screen.findByText('Souhlasy podepsány na místě (papírově)')).toBeInTheDocument();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    boxes.forEach((b) => expect(b).not.toBeChecked());
    expect(screen.getByText(/Novinky a nabídky \(nepovinný\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Souhlas se sdílením výsledků s klubem \(nepovinný\)/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Poznámka')).toBeInTheDocument();
    expect(getOptions).toHaveBeenCalledWith('act-1');
  });
});

describe('the field', () => {
  it('asks without a činnost when none is chosen', async () => {
    getOptions.mockResolvedValue({ activityId: null, options: [ALL.options[0]] });
    render(<Host activityId={null} />);
    expect(await screen.findAllByRole('checkbox')).toHaveLength(1);
    expect(getOptions).toHaveBeenCalledWith(null);
  });

  it('reloads the list when the činnost changes and drops a box that is no longer offered', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Host activityId="act-1" />);
    await user.click((await screen.findAllByRole('checkbox'))[1]);
    expect(latest.codes).toEqual(['club']);
    getOptions.mockResolvedValue({ activityId: null, options: [ALL.options[0]] });
    rerender(<Host activityId={null} />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
    await waitFor(() => expect(latest.codes).toEqual([]));
  });

  it('collects the ticked codes and the note', async () => {
    const user = userEvent.setup();
    render(<Host activityId="act-1" />);
    const boxes = await screen.findAllByRole('checkbox');
    await user.click(boxes[0]);
    await user.click(boxes[2]);
    await user.type(screen.getByLabelText('Poznámka'), 'papír v šanonu');
    expect(latest).toEqual({ codes: ['treatment', 'communication'], note: 'papír v šanonu' });
    await user.click(boxes[0]);
    expect(latest.codes).toEqual(['communication']);
  });

  it('says so, without crashing, when the options cannot be loaded', async () => {
    getOptions.mockRejectedValue(new Error('x'));
    render(<Host activityId="act-1" />);
    expect(await screen.findByText(/Nabídku souhlasů se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('recordOnSiteConsents', () => {
  it('makes no call when nothing is ticked', async () => {
    const out = await recordOnSiteConsents('p1', 'act-1', { codes: [], note: 'x' });
    expect(out).toEqual({ status: 'none' });
    expect(record).not.toHaveBeenCalled();
  });

  it('sends patient, činnost, codes and a trimmed note', async () => {
    const out = await recordOnSiteConsents('p1', 'act-1', { codes: ['treatment', 'club'], note: '  papír ' });
    expect(out.status).toBe('recorded');
    expect(record).toHaveBeenCalledWith('p1', { activityId: 'act-1', consents: ['treatment', 'club'], note: 'papír' });
  });

  it('sends null for no činnost and an empty note', async () => {
    await recordOnSiteConsents('p1', '', { codes: ['treatment'], note: ' ' });
    expect(record).toHaveBeenCalledWith('p1', { activityId: null, consents: ['treatment'], note: null });
  });

  it('turns a failure into a Czech warning that the registration stands, with the server message', async () => {
    record.mockRejectedValue({ response: { data: { code: 'consent.on_site.not_offered', message: 'Souhlas se nenabízí.' } } });
    const out = await recordOnSiteConsents('p1', null, { codes: ['club'], note: '' });
    expect(out.status).toBe('failed');
    if (out.status === 'failed') {
      expect(out.message).toMatch(/Pacient je zaregistrován, ale souhlasy se nepodařilo zapsat/);
      expect(out.message).toContain('Souhlas se nenabízí.');
      expect(out.message).toMatch(/zopakovat/);
    }
  });
});
