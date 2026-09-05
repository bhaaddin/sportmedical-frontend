import { useRef, useEffect, useCallback } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  renderTime: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    renderCountRef.current += 1;
    renderTimesRef.current.push(duration);
    if (renderTimesRef.current.length > 100) renderTimesRef.current.shift();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} render #${renderCountRef.current}: ${duration.toFixed(2)}ms`);
    }
  });

  const startMeasure = useCallback(() => { startTimeRef.current = performance.now(); }, []);

  const getMetrics = useCallback((): PerformanceMetrics => {
    const times = renderTimesRef.current;
    const total = times.reduce((sum, t) => sum + t, 0);
    return {
      renderCount: renderCountRef.current,
      renderTime: total,
      lastRenderTime: times[times.length - 1] || 0,
      averageRenderTime: times.length > 0 ? total / times.length : 0,
    };
  }, []);

  useEffect(() => { startMeasure(); });

  return { startMeasure, getMetrics };
}

export function useAsyncPerformance(operationName: string) {
  const measure = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${operationName}: ${(performance.now() - start).toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[Performance] ${operationName} failed after ${(performance.now() - start).toFixed(2)}ms:`, error);
      }
      throw error;
    }
  }, [operationName]);

  return { measure };
}
