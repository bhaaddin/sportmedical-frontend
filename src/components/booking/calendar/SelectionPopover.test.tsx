import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectionPopover } from './SelectionPopover';

/*
 * The desktop popover for a marked day range (N-Slot): "Objednat pacienta", "Zablokovat čas" and, since Etapa 12,
 * "Přidat do objednávky klubu" - attaching the marked range to a club order that already exists. Never a path to a
 * NEW order (that stays only in "Klubová objednávka").
 */
describe('the "Kluby" action', () => {
  const base = {
    anchor: { x: 10, y: 10 },
    title: '26. 10. 2026',
    subtitle: '1 den',
    mayBlock: true,
    onBlock: vi.fn(),
    onClose: vi.fn(),
  };

  it('shows beside "Objednat pacienta" when mayBook and the callback are given', () => {
    const onAddToClubOrder = vi.fn();
    render(<SelectionPopover {...base} mayBook onBook={vi.fn()} onAddToClubOrder={onAddToClubOrder} />);
    const action = screen.getByText('Přidat do objednávky klubu');
    expect(action).toBeInTheDocument();
    expect(screen.getByText('Přidá vybraný čas do existující objednávky')).toBeInTheDocument();
    fireEvent.click(action);
    expect(onAddToClubOrder).toHaveBeenCalled();
  });

  it('is absent without mayBook, and absent without the callback', () => {
    const { rerender } = render(<SelectionPopover {...base} mayBook={false} onBook={vi.fn()} onAddToClubOrder={vi.fn()} />);
    expect(screen.queryByText('Přidat do objednávky klubu')).not.toBeInTheDocument();
    rerender(<SelectionPopover {...base} mayBook onBook={vi.fn()} />);
    expect(screen.queryByText('Přidat do objednávky klubu')).not.toBeInTheDocument();
  });

  it('never offers a way to create a new order from here', () => {
    render(<SelectionPopover {...base} mayBook onBook={vi.fn()} onAddToClubOrder={vi.fn()} />);
    expect(screen.queryByText(/telefonická objednávka/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Klubová objednávka/i)).not.toBeInTheDocument();
  });
});
