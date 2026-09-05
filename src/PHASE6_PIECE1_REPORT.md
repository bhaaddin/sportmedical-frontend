# Phase 6 — Piece 1 Report: i18n Setup

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**TypeScript:** 0 errors

---

## What Was Built

### 1. i18n Infrastructure

- Installed `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- Created `src/i18n/index.ts` configuration
- Language detection: localStorage → navigator → HTML tag
- Fallback: Czech (cs)

### 2. Translation Files

| Language | File | Status |
|----------|------|--------|
| Czech (cs) | `src/i18n/locales/cs.json` | ✅ Default |
| English (en) | `src/i18n/locales/en.json` | ✅ |
| Slovak (sk) | `src/i18n/locales/sk.json` | ✅ |

### 3. Translation Keys

| Section | Keys |
|---------|------|
| `app` | Common actions (save, cancel, delete, etc.) |
| `nav` | Navigation items (dashboard, patients, calendar, etc.) |
| `patients` | Patient-related strings |
| `injuries` | Injury-related strings |
| `billing` | Billing-related strings |
| `settings` | Settings-related strings |
| `calendar` | Calendar-related strings |

### 4. Language Switcher

- Added to header bar (top right, next to theme toggle)
- Cycles through: CZ → EN → SK
- Shows current language as badge (CZ/EN/SK)
- Saves preference to localStorage

---

## How to Use

### In Components
```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <Typography>{t('patients.title')}</Typography>;
}
```

### Programmatic Language Change
```tsx
import i18n from './i18n';
i18n.changeLanguage('en');
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/i18n/index.ts` | i18n configuration |
| `src/i18n/locales/cs.json` | Czech translations |
| `src/i18n/locales/en.json` | English translations |
| `src/i18n/locales/sk.json` | Slovak translations |

## Files Modified

| File | Changes |
|------|---------|
| `src/main.tsx` | Added i18n import |
| `src/App.tsx` | Added language switcher, i18n import |

## Next Piece

Piece 2: Accessibility improvements (skip links, ARIA, keyboard nav).
