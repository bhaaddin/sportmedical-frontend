/* ══════════════════════════════════════════════════════════════
   INDEXEDDB CACHE SERVICE
   Stores large datasets (ICD-10 codes, medications, procedures)
   in the browser for instant local search with 0ms latency.
   ══════════════════════════════════════════════════════════════ */

const DB_NAME = 'SportMedical_Cache';
const DB_VERSION = 1;

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
}

/* ── Open database ── */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
  });
}

/* ── Generic get/set ── */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const req = store.get(key);
      req.onsuccess = () => {
        const entry: CacheEntry | undefined = req.result;
        if (entry && Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) {
          resolve(entry.data as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const entry: CacheEntry = { key, data, timestamp: Date.now() };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail if IndexedDB unavailable
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail
  }
}

/* ── ICD-10 specific helpers ── */
export interface ICDCode {
  id: string;
  code: string;
  description: string;
  category: string;
  subCodes?: ICDCode[];
}

const ICD_CACHE_KEY = 'icd10_full_dump';
const ICD_CATEGORIES_KEY = 'icd10_categories';

export async function getCachedICDCodes(): Promise<ICDCode[] | null> {
  return cacheGet<ICDCode[]>(ICD_CACHE_KEY);
}

export async function setCachedICDCodes(codes: ICDCode[]): Promise<void> {
  await cacheSet(ICD_CACHE_KEY, codes);
}

export async function getCachedICDCategories(): Promise<string[] | null> {
  return cacheGet<string[]>(ICD_CATEGORIES_KEY);
}

export async function setCachedICDCategories(categories: string[]): Promise<void> {
  await cacheSet(ICD_CATEGORIES_KEY, categories);
}

/**
 * Search ICD codes locally from IndexedDB cache.
 * Returns matching codes with highlighting.
 */
export function searchICDCodesLocally(codes: ICDCode[], query: string): ICDCode[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return codes.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}

/**
 * Group ICD codes by their top-level category letter (A00-B99 → "Některé infekční...")
 */
export function groupICDCodesByCategory(codes: ICDCode[]): Map<string, ICDCode[]> {
  const groups = new Map<string, ICDCode[]>();
  for (const code of codes) {
    const category = code.category || 'Ostatní';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(code);
  }
  return groups;
}
