import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { combinedSchema } from '../../../api/clubOneOrder';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const { splitOrder } = vi.hoisted(() => ({ splitOrder: vi.fn() }));
vi.mock('../../../api/clubOneOrder', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubOneOrder')>()), splitOrder }));
const { SplitOrderDialog } = await import('./SplitOrderDialog');

const day = (orderId: string, over: Record<string, unknown> = {}) => ({ orderId, reference: `KO-${orderId}`, serviceName: 'Prohlídka', seats: 5, status: 'Confirmed', ranges: [{ fromDate: '2026-11-05', toDate: '2026-11-05' }], ...over });
const combined = combinedSchema.parse({ rootId: 'r', reference: 'KO-r', days: [day('r'), day('a'), day('b'), day('inv', { invoiceId: 'i' }), day('x', { status: 'Cancelled' })] });

beforeEach(() => { splitOrder.mockReset(); setViewport(VIEWPORTS.desktop); });

describe('SplitOrderDialog', () => {
  it('disables root, invoiced and cancelled days with a reason; confirm needs a choice', async () => {
    render(<SplitOrderDialog combined={combined} onClose={() => {}} onSplit={() => {}} />);
    for (const id of ['r', 'inv', 'x']) expect(screen.getByTestId(`split-day-${id}`)).toBeDisabled();
    expect(screen.getByText(/Základ objednávky se neodděluje/)).toBeInTheDocument();
    expect(screen.getByText(/Už je na faktuře/)).toBeInTheDocument();
    expect(screen.getByText(/Je zrušená/)).toBeInTheDocument();
    expect(screen.getByTestId('split-confirm')).toBeDisabled();
    await userEvent.click(screen.getByTestId('split-day-a'));
    expect(screen.getByTestId('split-confirm')).toBeEnabled();
  });

  it('sends the chosen days and hands the new root on', async () => {
    splitOrder.mockResolvedValue('n1');
    const onSplit = vi.fn();
    render(<SplitOrderDialog combined={combined} onClose={() => {}} onSplit={onSplit} />);
    await userEvent.click(screen.getByTestId('split-day-a'));
    await userEvent.click(screen.getByTestId('split-day-b'));
    await userEvent.click(screen.getByTestId('split-confirm'));
    await waitFor(() => expect(onSplit).toHaveBeenCalledWith('n1'));
    expect(splitOrder).toHaveBeenCalledWith('r', ['a', 'b']);
  });

  it('shows a refusal and stays open', async () => {
    splitOrder.mockRejectedValue({ response: { data: { message: 'Den je na faktuře.' } } });
    const onSplit = vi.fn();
    render(<SplitOrderDialog combined={combined} onClose={() => {}} onSplit={onSplit} />);
    await userEvent.click(screen.getByTestId('split-day-a'));
    await userEvent.click(screen.getByTestId('split-confirm'));
    expect(await screen.findByTestId('split-error')).toHaveTextContent('Den je na faktuře.');
    expect(onSplit).not.toHaveBeenCalled();
  });

  it('refuses to split everything off', async () => {
    const two = combinedSchema.parse({ rootId: 'r', reference: 'KO-r', days: [day('a'), day('b')] });
    render(<SplitOrderDialog combined={two} onClose={() => {}} onSplit={() => {}} />);
    await userEvent.click(screen.getByTestId('split-day-a'));
    await userEvent.click(screen.getByTestId('split-day-b'));
    expect(screen.getByTestId('split-confirm')).toBeDisabled();
    expect(screen.getByTestId('split-problem')).toBeInTheDocument();
  });
});
