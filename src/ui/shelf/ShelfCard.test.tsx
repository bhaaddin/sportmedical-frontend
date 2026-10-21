/*
 * The four cards on a shelf: entity, metric, action, attention. One stretched link per card (no link inside a link),
 * a name a screen reader can say, and the same words as the shelves that hold them.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { attentionGroups } from './attention';
import { ActionCard, AttentionCard, EntityCard, MetricCard } from './ShelfCard';

const renderCard = (ui: React.ReactElement) => render(<MemoryRouter><div role="list">{ui}</div></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  setViewport(VIEWPORTS.desktop);
});

describe('EntityCard', () => {
  it('is one link: the title, stretched over the card, named by kind and label', () => {
    renderCard(<EntityCard entity={{ kind: 'patient', id: 'p1', label: 'Jana Marková' }} subtitle="nar. 1990" status={{ label: 'Aktivní', tone: 'green' }} />);
    const card = screen.getByRole('listitem');
    expect(within(card).getAllByRole('link')).toHaveLength(1);
    expect(within(card).getByRole('link', { name: 'Pacient: Jana Marková' })).toHaveAttribute('href', '/patients/p1');
    expect(within(card).getByText('nar. 1990')).toBeInTheDocument();
    expect(within(card).getByText('Aktivní')).toBeInTheDocument();
  });

  it('keeps a control of its own (a pin) clickable, outside the link', async () => {
    const pin = vi.fn();
    renderCard(<EntityCard entity={{ kind: 'club', id: 'c1', label: 'FC Sparta' }} trailing={<button type="button" onClick={pin}>Připnout</button>} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Připnout' }));
    expect(pin).toHaveBeenCalledTimes(1);
  });

  it('can be one line (dense) and says the same thing', () => {
    renderCard(<EntityCard dense entity={{ kind: 'invoice', id: 'i1', label: 'FA-1' }} />);
    const card = screen.getByRole('listitem');
    expect(card).toHaveAttribute('data-dense');
    expect(within(card).getByRole('link', { name: 'Faktura: FA-1' })).toHaveAttribute('href', '/billing');
  });
});

describe('MetricCard', () => {
  it('names its figure for a screen reader and links to where it is worked on', () => {
    renderCard(<MetricCard label="Dnes objednáno" value={4} hint="termínů, které ještě stojí" to="/dnes" />);
    const link = screen.getByRole('link', { name: 'Dnes objednáno: 4' });
    expect(link).toHaveAttribute('href', '/dnes');
    expect(screen.getByText('termínů, které ještě stojí')).toBeInTheDocument();
  });

  it('is not a link without a place to go, and says "—" for no figure', () => {
    renderCard(<MetricCard label="Kartotéka" value={null} hint="bez oprávnění" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('draws a string as it is and a number through its formatter', () => {
    renderCard(
      <>
        <MetricCard label="Krevní tlak" value="120/80" />
        <MetricCard label="Dnes" value={1600} format={(n) => `${n} korun`} />
      </>,
    );
    expect(screen.getByText('120/80')).toBeInTheDocument();
    expect(screen.getByText('1600 korun')).toBeInTheDocument();
  });
});

describe('ActionCard', () => {
  it('is a link when it goes somewhere and a button when it does something', async () => {
    const press = vi.fn();
    renderCard(
      <>
        <ActionCard primary title="Nový pacient" description="Plná registrace" to="/patients/register" />
        <ActionCard title="Poslat odkaz" onClick={press} />
      </>,
    );
    expect(screen.getByRole('link', { name: /Nový pacient/ })).toHaveAttribute('href', '/patients/register');
    await userEvent.setup().click(screen.getByRole('button', { name: /Poslat odkaz/ }));
    expect(press).toHaveBeenCalledTimes(1);
  });
});

describe('AttentionCard', () => {
  const NOW = new Date('2026-10-21T08:00:00Z');
  const groups = attentionGroups({
    now: NOW,
    clubOrders: [{ id: 'o1', clubId: 'c1', clubName: 'FC Sparta', status: 'Requested', totalSeats: 12, submittedAtUtc: '2026-10-15T10:00:00Z' }],
    failedMessages: 2,
  });

  it('says how many, how urgent, and links every case to the place that fixes it', () => {
    renderCard(<AttentionCard group={groups.find((g) => g.id === 'clubInquiries')!} />);
    const card = document.querySelector('[data-card="attention"]') as HTMLElement;
    expect(card).toHaveAttribute('data-attention', 'clubInquiries');
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('Poptávky klubů: 1');
    expect(within(card).getByText('Čeká')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /FC Sparta/ })).toHaveAttribute('href', '/clubs/objednavky');
    expect(within(card).getByRole('link', { name: 'Objednávky klubů' })).toHaveAttribute('href', '/clubs/objednavky');
  });

  it('marks its urgency on the card for tests and for CSS', () => {
    renderCard(<AttentionCard group={groups.find((g) => g.id === 'failedMessages')!} />);
    expect(document.querySelector('[data-card="attention"]')).toHaveAttribute('data-severity', 'medium');
  });
});
