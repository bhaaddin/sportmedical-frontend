import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSearchOptions<T> {
  searchFn: (query: string) => Promise<T[]>;
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
}

export function useSearch<T>({ searchFn, debounceMs = 300, minChars = 2, maxResults = 10 }: UseSearchOptions<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minChars) { setResults([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await searchFn(searchQuery);
      setResults(res.slice(0, maxResults));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [searchFn, minChars, maxResults]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(query), debounceMs);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query, debounceMs, search]);

  const clear = useCallback(() => { setQuery(''); setResults([]); setError(null); }, []);

  return { query, setQuery, results, loading, error, clear };
}

export function useUniversalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    document.addEventListener('open-search', handleOpen);
    document.addEventListener('close-search', handleClose);
    return () => {
      document.removeEventListener('open-search', handleOpen);
      document.removeEventListener('close-search', handleClose);
    };
  }, []);

  return { isOpen, setIsOpen, query, setQuery };
}
