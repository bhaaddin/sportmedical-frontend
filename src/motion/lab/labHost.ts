/* /motion-lab exists only where the owner can judge the motion: the dev server and `vite preview` (any localhost),
   never on the live domain. It is not linked from anywhere and not prerendered. */
export function isLabHost(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
}
