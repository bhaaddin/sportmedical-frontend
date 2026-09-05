import { useState, useCallback } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoRedoOptions {
  maxHistory?: number;
  onUndo?: (state: any) => void;
  onRedo?: (state: any) => void;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistory = 50, onUndo, onRedo } = options;

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setState(prev => {
      const newPresent = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prev.present)
        : newState;

      const past = [...prev.past, prev.present].slice(-maxHistory);

      return { past, present: newPresent, future: [] };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;

      onUndo?.(newPresent);

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, [onUndo]);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;

      onRedo?.(newPresent);

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, [onRedo]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const reset = useCallback((newState?: T) => {
    setState({
      past: [],
      present: newState ?? initialState,
      future: [],
    });
  }, [initialState]);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    history: state.past,
  };
}

export function useUndoRedoForm<T extends Record<string, any>>(initialValues: T) {
  const undoRedo = useUndoRedo(initialValues);

  const updateField = useCallback((field: keyof T, value: any) => {
    undoRedo.set(prev => ({ ...prev, [field]: value }));
  }, [undoRedo.set]);

  const updateFields = useCallback((fields: Partial<T>) => {
    undoRedo.set(prev => ({ ...prev, ...fields }));
  }, [undoRedo.set]);

  return { ...undoRedo, values: undoRedo.state, updateField, updateFields };
}
