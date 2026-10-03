import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ADMIN_SITE_CONTENT_KEY,
  problemOf,
  siteContentAdminApi,
  type AdminSiteContent,
} from '../../../api/siteContentAdmin';

export function useAdminSiteContent() {
  return useQuery({ queryKey: ADMIN_SITE_CONTENT_KEY, queryFn: siteContentAdminApi.get, retry: false, refetchOnWindowFocus: false });
}

interface MutationOptions<V, R> {
  run: (variables: V) => Promise<R>;
  /** What the screen shows at once, before the server has answered. Rolled back on failure. */
  optimistic?: (content: AdminSiteContent, variables: V) => AdminSiteContent;
  success?: string | ((variables: V) => string);
  /** Used when the server gave no sentence of its own. */
  failure: string | ((variables: V) => string);
  /** Where a failure is also written on the page (a toast alone vanishes). */
  onError?: (message: string, variables: V) => void;
  onDone?: (variables: V, result: R) => void;
}

/**
 * One write to the admin content: optimistic, rolled back with a visible sentence on failure,
 * and followed by a refetch so `updatedAtUtc` / `updatedBy` and generated ids come from the server.
 */
export function useSiteMutation<V, R = unknown>(options: MutationOptions<V, R>) {
  const queryClient = useQueryClient();
  return useMutation<R, unknown, V, { previous: AdminSiteContent | undefined }>({
    mutationFn: options.run,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_SITE_CONTENT_KEY });
      const previous = queryClient.getQueryData<AdminSiteContent>(ADMIN_SITE_CONTENT_KEY);
      if (previous !== undefined && options.optimistic !== undefined) {
        queryClient.setQueryData(ADMIN_SITE_CONTENT_KEY, options.optimistic(previous, variables));
      }
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(ADMIN_SITE_CONTENT_KEY, context.previous);
      const fallback = typeof options.failure === 'function' ? options.failure(variables) : options.failure;
      const message = problemOf(error, fallback);
      toast.error(message);
      options.onError?.(message, variables);
    },
    onSuccess: (result, variables) => {
      if (options.success !== undefined) {
        toast.success(typeof options.success === 'function' ? options.success(variables) : options.success);
      }
      options.onDone?.(variables, result);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_SITE_CONTENT_KEY });
    },
  });
}
