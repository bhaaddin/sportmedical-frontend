/* The summary experience's own icon set (prototype `s41Icon`): separate from the shared sprite. */
import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  back: <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  next: <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  people: (
    <>
      <path d="M16 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M23 19v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  layers: <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />,
  document: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </>
  ),
  chart: <path d="M5 20v-7m6 7V4m6 16v-11" strokeWidth="3" />,
  target: (
    <>
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="3" />
      <path d="m14 10 8-8m-1 0v5m1-5h-5" />
    </>
  ),
  pulse: <path d="M2 12h4l3-6 5 12 3-6h5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v6m0-10v.01" />
    </>
  ),
  check: <path d="m4 13 5 5L20 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
};

export type S41IconName = 'back' | 'next' | 'people' | 'calendar' | 'layers' | 'document' | 'chart' | 'target' | 'pulse' | 'info' | 'check' | 'close' | 'clock';

export function S41Icon({ name }: { name: S41IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}
