/* ══════════════════════════════════════════════════════════════
   SEARCH BAR — Global search with debounced input
   Features: 250ms debounce, keyboard shortcut, clear button,
   accessible label, loading indicator
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
import { Search, Close } from '@mui/icons-material';

interface SearchBarProps {
  placeholder?: string;
  /** Debounce delay in ms (default 250) */
  debounceMs?: number;
  /** Called with debounced value */
  onSearch: (value: string) => void;
  /** Called immediately on clear */
  onClear?: () => void;
  /** Optional controlled value */
  value?: string;
  /** Show loading spinner */
  loading?: boolean;
  /** Maximum width CSS */
  maxWidth?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Unique label for aria-label */
  ariaLabel?: string;
}

export default function SearchBar({
  placeholder = 'Hledat...',
  debounceMs = 250,
  onSearch,
  onClear,
  value: controlledValue,
  loading = false,
  maxWidth = '400px',
  autoFocus = false,
  ariaLabel = 'Vyhledávání',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Derive display value: use controlled value if provided, else internal */
  const displayValue = controlledValue !== undefined ? controlledValue : internalValue;

  /* Debounced search callback */
  const debouncedSearch = useCallback(
    (val: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => onSearch(val), debounceMs);
    },
    [onSearch, debounceMs],
  );

  /* Cleanup timer on unmount */
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  /* Global Ctrl+K / Cmd+K shortcut to focus */
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleChange = (val: string) => {
    setInternalValue(val);
    debouncedSearch(val);
  };

  const handleClear = () => {
    setInternalValue('');
    onSearch('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="search-input"
      role="search"
      style={{ maxWidth }}
    >
      <Search sx={{ fontSize: 18, color: 'var(--color-text-muted)', flexShrink: 0 }} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={loading}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
      {loading && (
        <span className="btn__spinner" style={{ width: 14, height: 14 }} aria-label="Načítání" />
      )}
      {displayValue && (
        <button
          onClick={handleClear}
          className="btn btn--ghost"
          style={{ minWidth: 24, minHeight: 24, padding: 2, borderRadius: 'var(--radius-full)' }}
          aria-label="Vymazat vyhledávání"
        >
          <Close sx={{ fontSize: 14 }} />
        </button>
      )}
      <kbd
        style={{
          fontSize: 11, padding: '1px 5px', borderRadius: 4,
          border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-family)', flexShrink: 0,
        }}
        aria-hidden="true"
      >
        Ctrl+K
      </kbd>
    </div>
  );
}
