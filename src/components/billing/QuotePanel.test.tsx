/*
 * The breakdown of a price quote: each kind of discount (tier, club, package,
 * manual), the higher of tier and club winning with the other struck through,
 * the over-limit notice, the loading and failed states.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { PriceQuote } from '../../api/billing';
import QuotePanel from './QuotePanel';
import DiscountRows from './DiscountRows';

const quote = (over: Partial<PriceQuote> = {}): PriceQuote => ({
  lines: [{ activityId: 'a1', name: 'Komplexní prohlídka', quantity: 12, unitPriceCzk: 2200, listTotalCzk: 26400 }],
  listTotalCzk: 26400,
  discounts: [],
  appliedGroupPercent: 0,
  totalCzk: 26400,
  manualAllowedPercent: 10,
  requiresApproval: false,
  ...over,
});

const row = (kind: string) => screen.getByRole('list', { name: 'Slevy' }).querySelector(`[data-kind="${kind}"]`) as HTMLElement;

describe('QuotePanel', () => {
  it('lists the lines, the list total, the discounts and the total', () => {
    render(
      <QuotePanel
        status="ready"
        quote={quote({
          discounts: [{ kind: 'tier', label: 'Velká skupina', percent: 10, amountCzk: 2640 }],
          appliedGroupPercent: 10,
          totalCzk: 23760,
        })}
      />,
    );
    expect(screen.getByText('12× Komplexní prohlídka')).toBeInTheDocument();
    expect(screen.getByText('Cena podle ceníku')).toBeInTheDocument();
    expect(screen.getByText('Velká skupina')).toBeInTheDocument();
    expect(screen.getByText(/^−2\s640 Kč$/)).toBeInTheDocument();
    expect(screen.getByText('Celkem k úhradě')).toBeInTheDocument();
    expect(screen.getByText(/^23\s760 Kč$/)).toBeInTheDocument();
  });

  it('draws each kind with its label, percent and amount', () => {
    render(
      <DiscountRows
        discounts={[
          { kind: 'manual', label: 'Ruční sleva', percent: 5, amountCzk: 1320 },
          { kind: 'package', label: 'Balíček Komplex', percent: 7.5, amountCzk: 900 },
          { kind: 'club', label: 'FK Slaný', percent: 10, amountCzk: 2640 },
        ]}
      />,
    );
    /* In the order the panel always draws them, whatever order the server sent. */
    expect(screen.getAllByRole('listitem').map((r) => r.getAttribute('data-kind'))).toEqual(['club', 'package', 'manual']);
    expect(within(row('club')).getByText('Sleva klubu')).toBeInTheDocument();
    expect(within(row('club')).getByText(/^−10\s%$/)).toBeInTheDocument();
    expect(within(row('package')).getByText('Balíček')).toBeInTheDocument();
    expect(within(row('package')).getByText(/^−7,5\s%$/)).toBeInTheDocument();
    expect(within(row('package')).getByText(/^−900 Kč$/)).toBeInTheDocument();
    expect(within(row('manual')).getByText('Ruční sleva', { selector: 'p' })).toBeInTheDocument();
    for (const kind of ['club', 'package', 'manual']) expect(row(kind)).toHaveAttribute('data-unused', 'false');
  });

  it('the higher of tier and club applies: tier higher strikes the club through', () => {
    render(
      <DiscountRows
        discounts={[
          { kind: 'tier', label: 'Hladina od 10', percent: 15, amountCzk: 3960 },
          { kind: 'club', label: 'FK Slaný', percent: 10, amountCzk: 0 },
        ]}
      />,
    );
    expect(row('tier')).toHaveAttribute('data-unused', 'false');
    expect(row('club')).toHaveAttribute('data-unused', 'true');
    expect(row('club').querySelector('s')).not.toBeNull();
    expect(within(row('club')).getByText(/nepoužito — vyšší sleva/)).toBeInTheDocument();
    expect(row('tier').querySelector('s')).toBeNull();
  });

  it('the higher of tier and club applies: club higher strikes the tier through', () => {
    render(
      <DiscountRows
        discounts={[
          { kind: 'tier', label: 'Hladina od 6', percent: 10, amountCzk: 2640 },
          { kind: 'club', label: 'FK Slaný', percent: 20, amountCzk: 5280 },
        ]}
      />,
    );
    /* Both rows carry an amount, but only the lower percent is the one that lost. */
    expect(row('tier')).toHaveAttribute('data-unused', 'true');
    expect(row('club')).toHaveAttribute('data-unused', 'false');
    expect(within(row('tier')).getByText(/nepoužito — vyšší sleva/)).toBeInTheDocument();
    expect(within(row('club')).queryByText(/nepoužito/)).not.toBeInTheDocument();
  });

  it('a manual or package row is never struck through', () => {
    render(
      <DiscountRows
        discounts={[
          { kind: 'tier', label: 'Hladina od 4', percent: 5, amountCzk: 0 },
          { kind: 'club', label: 'FK Slaný', percent: 10, amountCzk: 2640 },
          { kind: 'manual', label: 'Ruční sleva', percent: 2, amountCzk: 0 },
        ]}
      />,
    );
    expect(row('tier')).toHaveAttribute('data-unused', 'true');
    expect(row('manual')).toHaveAttribute('data-unused', 'false');
  });

  it('above the limit it says so in a beige notice and names the limit', () => {
    render(<QuotePanel status="ready" quote={quote({ requiresApproval: true, manualAllowedPercent: 10 })} />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Nad limit — faktura půjde ke schválení');
    expect(notice).toHaveTextContent(/nejvýše 10\s%/);
    /* beige: the board's #FBF1E7 */
    expect(getComputedStyle(notice).backgroundColor).toBe('rgb(251, 241, 231)');
  });

  it('says nothing about approval within the limit', () => {
    render(<QuotePanel status="ready" quote={quote()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dims the old answer while a new one is coming and shows the progress', () => {
    render(<QuotePanel status="loading" quote={quote()} />);
    expect(screen.getByLabelText('Počítám cenu')).toBeInTheDocument();
    expect(screen.getByText('Celkem k úhradě')).toBeInTheDocument();
  });

  it('says what failed and offers "Zkusit znovu"', () => {
    const retry = vi.fn();
    render(<QuotePanel status="error" quote={null} error="Klub neexistuje." onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Klub neexistuje.');
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(retry).toHaveBeenCalled();
  });

  it('holds its space with a hint before there is anything to price', () => {
    render(<QuotePanel status="idle" quote={null} />);
    expect(screen.getByText(/spočítá server/)).toBeInTheDocument();
  });
});
