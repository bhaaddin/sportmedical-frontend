import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { toOrder } from '../../../api/clubOrders';
import { ClubLinksBlock } from './ClubLinksBlock';

vi.mock('../../../api/clinicSettings', () => ({ clinicSettingsApi: { getAll: vi.fn().mockResolvedValue({}), get: vi.fn().mockResolvedValue({}) } }));

const order = (over: Record<string, unknown>) =>
  toOrder({
    id: 'o-1', clubId: 'c-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed',
    activitySeats: [], blocks: [], ...over,
  });

function show(o: ReturnType<typeof order>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ClubLinksBlock order={o} /></QueryClientProvider>);
}

describe('club links of an order', () => {
  it('shows the portal link even when the order was made as Confirmed and has no form link', () => {
    show(order({ formUrl: '', portalUrl: '/klub-objednavka/portal-token', registrationUrl: '/klub/players-token' }));
    expect(screen.getByTestId('club-portal-url').getAttribute('data-url')).toContain('/klub-objednavka/portal-token');
    expect(screen.getByTestId('players-url').getAttribute('data-url')).toContain('/klub/players-token');
    expect(screen.getByTestId('rotate-links')).toBeInTheDocument();
    expect(screen.queryByTestId('links-stale')).not.toBeInTheDocument();
  });

  it('falls back to the form link when the server sends no portal link (older server)', () => {
    show(order({ status: 'Invited', formUrl: '/klub-objednavka/form-token', registrationUrl: '' }));
    expect(screen.getByTestId('club-portal-url').getAttribute('data-url')).toContain('/klub-objednavka/form-token');
  });

  it('says so when the links cannot be shown after a key change and still offers a new link', () => {
    show(order({ formUrl: '', portalUrl: '', registrationUrl: '', linksStale: true }));
    expect(screen.getByTestId('links-stale')).toHaveTextContent('nelze zobrazit');
    expect(screen.getByTestId('rotate-links')).toBeInTheDocument();
  });

  it('offers no new link for a cancelled order', () => {
    show(order({ status: 'Cancelled', formUrl: '', portalUrl: '/klub-objednavka/x', registrationUrl: '' }));
    expect(screen.queryByTestId('rotate-links')).not.toBeInTheDocument();
  });
});
