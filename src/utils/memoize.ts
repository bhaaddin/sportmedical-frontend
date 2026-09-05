// Memoization utilities

export function memoize<T extends (...args: any[]) => any>(fn: T, getKey?: (...args: Parameters<T>) => string): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

export function memoizeWithTTL<T extends (...args: any[]) => any>(fn: T, ttlMs = 300000): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttlMs) return cached.value;
    const value = fn(...args);
    cache.set(key, { value, timestamp: now });
    return value;
  }) as T;
}

export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  const cache = new Map<string, Promise<ReturnType<T>>>();
  return ((...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const promise = fn(...args);
    cache.set(key, promise);
    promise.finally(() => { setTimeout(() => cache.delete(key), 100); });
    return promise;
  }) as T;
}
