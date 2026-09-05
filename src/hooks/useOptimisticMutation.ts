import { useState, useCallback } from 'react';

interface OptimisticOptions<T, R> {
  onMutate: (data: T) => Promise<T>;
  onSuccess?: (result: R, variables: T) => void;
  onError?: (error: Error, variables: T, previousData: T) => void;
}

interface OptimisticState<T> {
  data: T | null;
  isOptimistic: boolean;
  isPending: boolean;
  error: Error | null;
}

export function useOptimisticMutation<T, R = any>(
  initialData: T,
  options: OptimisticOptions<T, R>
) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isOptimistic: false,
    isPending: false,
    error: null,
  });

  const mutate = useCallback(async (newData: T) => {
    const previousData = state.data;

    setState(prev => ({
      ...prev,
      data: newData,
      isOptimistic: true,
      isPending: true,
      error: null,
    }));

    try {
      const result = await options.onMutate(newData);

      setState(prev => ({
        ...prev,
        isOptimistic: false,
        isPending: false,
      }));

      options.onSuccess?.(result, newData);
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        data: previousData,
        isOptimistic: false,
        isPending: false,
        error: error as Error,
      }));

      options.onError?.(error as Error, newData, previousData as T);
      throw error;
    }
  }, [state.data, options]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isOptimistic: false,
      isPending: false,
      error: null,
    });
  }, [initialData]);

  return { ...state, mutate, reset };
}

// Optimistic list mutation hook
export function useOptimisticList<T extends { id: string }>(
  initialList: T[]
) {
  const [list, setList] = useState<T[]>(initialList);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const addItem = useCallback(async (
    item: T,
    addFn: (item: T) => Promise<T>
  ) => {
    setList(prev => [...prev, item]);
    setPendingIds(prev => new Set(prev).add(item.id));

    try {
      const result = await addFn(item);
      setList(prev => prev.map(i => i.id === item.id ? result : i));
      return result;
    } catch (error) {
      setList(prev => prev.filter(i => i.id !== item.id));
      throw error;
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, []);

  const updateItem = useCallback(async (
    id: string,
    updates: Partial<T>,
    updateFn: (id: string, updates: Partial<T>) => Promise<T>
  ) => {
    const previousItem = list.find(i => i.id === id);
    if (!previousItem) return;

    setList(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    setPendingIds(prev => new Set(prev).add(id));

    try {
      const result = await updateFn(id, updates);
      setList(prev => prev.map(i => i.id === id ? result : i));
      return result;
    } catch (error) {
      setList(prev => prev.map(i => i.id === id ? previousItem : i));
      throw error;
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [list]);

  const removeItem = useCallback(async (
    id: string,
    removeFn: (id: string) => Promise<void>
  ) => {
    const previousItem = list.find(i => i.id === id);
    if (!previousItem) return;

    setList(prev => prev.filter(i => i.id !== id));
    setPendingIds(prev => new Set(prev).add(id));

    try {
      await removeFn(id);
      return true;
    } catch (error) {
      setList(prev => [...prev, previousItem]);
      throw error;
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [list]);

  return {
    list,
    pendingIds,
    isPending: (id: string) => pendingIds.has(id),
    addItem,
    updateItem,
    removeItem,
    setList,
  };
}
