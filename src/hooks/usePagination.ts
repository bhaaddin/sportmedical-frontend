import { useState, useCallback, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPerPage?: number;
  totalItems: number;
}

export function usePagination({ initialPage = 1, initialPerPage = 10, totalItems }: UsePaginationOptions) {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPageState] = useState(initialPerPage);

  const totalPages = useMemo(() => Math.ceil(totalItems / perPage), [totalItems, perPage]);
  const startIndex = useMemo(() => (page - 1) * perPage, [page, perPage]);
  const endIndex = useMemo(() => Math.min(startIndex + perPage - 1, totalItems - 1), [startIndex, perPage, totalItems]);

  const nextPage = useCallback(() => { if (page < totalPages) setPage(p => p + 1); }, [page, totalPages]);
  const prevPage = useCallback(() => { if (page > 1) setPage(p => p - 1); }, [page]);
  const firstPage = useCallback(() => setPage(1), []);
  const lastPage = useCallback(() => setPage(totalPages), [totalPages]);

  const setPerPage = useCallback((newPerPage: number) => { setPerPageState(newPerPage); setPage(1); }, []);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return {
    page, perPage, totalItems, totalPages,
    setPage, setPerPage, nextPage, prevPage, firstPage, lastPage,
    canNextPage: page < totalPages, canPrevPage: page > 1,
    startIndex, endIndex, pageNumbers,
  };
}
