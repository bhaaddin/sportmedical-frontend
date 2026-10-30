import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import type { PatientDocument } from '../../api/documents';

const { review, held } = vi.hoisted(() => ({ review: vi.fn(), held: { current: true } }));
vi.mock('../../api/documents', async (original) => ({ ...(await original<typeof import('../../api/documents')>()), documentsApi: { review } }));
vi.mock('../../auth/usePermission', () => ({ usePermission: () => held.current, usePermissions: () => [] }));

const { DocumentReview, awaitsReview } = await import('./DocumentReview');

const doc = (over: Partial<PatientDocument> = {}) => ({ id: 'd1', status: 'Pending', source: 'Patient', ...over }) as PatientDocument;

beforeEach(() => { review.mockReset().mockResolvedValue(doc({ status: 'SignedOff' })); held.current = true; });

describe('DocumentReview', () => {
  it('knows which documents wait for a decision', () => {
    expect(awaitsReview(doc())).toBe(true);
    expect(awaitsReview(doc({ source: 'Staff' }))).toBe(false);
    expect(awaitsReview(doc({ status: 'SignedOff' }))).toBe(false);
  });

  it('accepts and rejects through the review route', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderScreen(<DocumentReview document={doc()} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: 'Přijmout' }));
    await waitFor(() => expect(review).toHaveBeenCalledWith('d1', true));
    await user.click(screen.getByRole('button', { name: 'Odmítnout' }));
    await waitFor(() => expect(review).toHaveBeenCalledWith('d1', false));
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('shows nothing without documents.manage or when nothing waits', () => {
    held.current = false;
    const { container } = renderScreen(<DocumentReview document={doc()} onChanged={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('says calmly when the review fails', async () => {
    review.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderScreen(<DocumentReview document={doc()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Přijmout' }));
    expect(await screen.findByText(/nepodařilo přijmout/)).toBeInTheDocument();
  });
});
