/*
 * A react-query read as the four states a Shelf owns (docs/ui-shelf-system.md, "Shelf").
 *
 * The booking settings screens used `AsyncSection`, whose rule this keeps: no answer yet is never content and never
 * emptiness - not while retrying, not between two attempts. Only a settled query may draw the screen.
 */
import { errorText } from '../../components/booking/errorText';

interface QueryLike {
  isLoading: boolean;
  isSuccess: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface ShelfState {
  loading: boolean;
  error: false | string;
  onRetry: () => void;
}

export function shelfState(query: QueryLike, t: (key: string) => string): ShelfState {
  const failed = query.error !== null && query.error !== undefined;
  return {
    loading: query.isLoading || (!query.isSuccess && !failed),
    error: failed ? errorText(query.error, t) : false,
    onRetry: () => { void query.refetch(); },
  };
}
