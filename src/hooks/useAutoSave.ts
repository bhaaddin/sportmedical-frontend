import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAutoSaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
  onSave?: () => void;
  onError?: (error: Error) => void;
}

export function useAutoSave<T>({ data, saveFn, delay = 2000, enabled = true, onSave, onError }: UseAutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T>(data);
  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const save = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveFn(dataRef.current);
      previousDataRef.current = dataRef.current;
      setLastSaved(new Date());
      setHasChanges(false);
      onSave?.();
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [saveFn, onSave, onError, isSaving]);

  useEffect(() => {
    if (!enabled) return;
    if (JSON.stringify(data) !== JSON.stringify(previousDataRef.current)) {
      setHasChanges(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => save(), delay);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [data, delay, enabled, save]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return save();
  }, [save]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setHasChanges(false);
  }, []);

  return { isSaving, lastSaved, hasChanges, saveNow, cancel };
}
