import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useUnsavedGuard } from './useUnsavedGuard';

function Page({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty);
  return <a href="/patients">Pacienti</a>;
}

afterEach(() => vi.restoreAllMocks());

describe('useUnsavedGuard', () => {
  it('stays out of the way while nothing is edited', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByText } = render(<Page dirty={false} />);
    fireEvent.click(getByText('Pacienti'));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before an in-app link is followed and cancels when the answer is no', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByText } = render(<Page dirty />);
    const notPrevented = fireEvent.click(getByText('Pacienti'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('lets the link through when the answer is yes', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { getByText } = render(<Page dirty />);
    expect(fireEvent.click(getByText('Pacienti'))).toBe(true);
  });

  it('asks the browser before the tab is closed', () => {
    render(<Page dirty />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
