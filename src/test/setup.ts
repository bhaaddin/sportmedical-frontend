/* Adds the DOM matchers (toBeInTheDocument, toHaveTextContent, ...) to
   vitest's expect. Without this they exist but throw at the call site. */
import '@testing-library/jest-dom/vitest';

/*
 * Czech, the way the application actually renders.
 *
 * Without this `t('booking.activities.new')` returns the key, so a component
 * test of any screen that translates asserts against `booking.activities.new`
 * rather than "Nová činnost". That is a weaker test wearing the shape of a
 * strong one - it passes whether the wording is right, wrong, or missing
 * entirely, which is the thing this repository keeps deleting.
 *
 * Found on 13. 9. 2026, the first time a `t()`-using screen was given a
 * component test: every query for a real label found nothing.
 *
 * Not `src/i18n/index.ts`: that one attaches a language detector which reads
 * `localStorage` and `navigator`, so the language would depend on whatever a
 * test happened to leave behind. Czech, fixed, every time.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import cs from '../i18n/locales/cs.json';

void i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs } },
  lng: 'cs',
  fallbackLng: 'cs',
  interpolation: { escapeValue: false },
});
