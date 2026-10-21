/*
 * Copying text, the one way: the async clipboard API, then a hidden-textarea `execCommand('copy')` for pages
 * where the API is missing or refused (an http address, an old WebView, a permission policy). Resolves true when
 * the text is on the clipboard.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea route */
  }
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

/** How long "Zkopírováno" stays on the button. */
export const COPIED_MS = 2000;

/** `copy(text)` copies and flips `state` to 'copied' for two seconds ('failed' when the browser refused). */
export function useCopyFeedback(ms: number = COPIED_MS): { state: 'idle' | 'copied' | 'failed'; copy: (text: string) => Promise<boolean> } {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = useCallback(async (text: string) => {
    const ok = await copyToClipboard(text);
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), ms);
    return ok;
  }, [ms]);
  return { state, copy };
}
