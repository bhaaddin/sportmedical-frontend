/*
 * The sections a patient's file is divided into.
 *
 * Its own module because three places read it - the routes, the sidebar and
 * the layout - and if any two of them kept their own copy they would drift.
 *
 * Kept out of `PatientLayout` for a second reason: `App.tsx` needs this list
 * to draw the sidebar, and importing it from the layout would pull that whole
 * page into the main bundle and undo its lazy loading.
 *
 * The order is the board's (design-15): Přehled · Termíny · Výsledky · Faktury ·
 * Dokumenty · Historie. Výsledky and Faktury are pages of their own now
 * (`PatientResultsPage`, `PatientInvoicesPage`); the routes hang under
 * `/patients/:id` in App.tsx, and a section listed here without its route
 * would be a dead link in the sidebar.
 */
import { Dashboard, Description, Event, History, ReceiptLong, Science } from '@mui/icons-material';

export interface PatientSection {
  id: string;
  label: string;
  /** Appended to `/patients/{id}`; empty for the section that is the patient. */
  path: string;
  icon: React.ReactNode;
}

export const PATIENT_SECTIONS: PatientSection[] = [
  { id: 'prehled', label: 'Přehled', path: '', icon: <Dashboard /> },
  { id: 'terminy', label: 'Termíny', path: 'terminy', icon: <Event /> },
  { id: 'vysledky', label: 'Výsledky', path: 'vysledky', icon: <Science /> },
  { id: 'faktury', label: 'Faktury', path: 'faktury', icon: <ReceiptLong /> },
  { id: 'dokumenty', label: 'Dokumenty', path: 'dokumenty', icon: <Description /> },
  { id: 'historie', label: 'Historie', path: 'historie', icon: <History /> },
];

/** Where a section lives for a given patient. */
export function sectionPath(patientId: string, section: PatientSection): string {
  return section.path === '' ? `/patients/${patientId}` : `/patients/${patientId}/${section.path}`;
}

/**
 * Which patient an address is inside, or null.
 *
 * `/patients` is the list and is inside nobody; `/patients/register` is
 * somebody who does not exist yet. Only `/patients/{id}` and what hangs off it
 * counts - that is what decides whether the sidebar belongs to one person or
 * to the application.
 */
export function patientInPath(pathname: string): string | null {
  const match = /^\/patients\/([^/]+)/.exec(pathname);
  if (match === null) return null;
  const id = match[1];
  return id === 'register' ? null : id;
}
