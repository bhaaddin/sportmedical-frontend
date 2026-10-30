/* The staff / patient APPLICATION entry (everything that is not a page of the public site). Split out of main.tsx and
   loaded on demand, so the prerendered public site never downloads the staff app, its router, its
   charts or its live connection. */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '../i18n';
import App from '../App';
import '../theme.css';
import '../styles/accessibility.css';
import '../motion/motion.css';
import { trackPointerOrigin } from '../motion/pointerOrigin';
/* Public Sans is the product's face (design board 3. 10. 2026); Inter is no longer loaded here (nothing in the
   application sets it; Public Sans covers Czech, system-ui is the fallback). Archivo is the public
   pages' heading face (artboard V-Web2). */
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/public-sans/800.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';

export function mountApp(container: HTMLElement): void {
  /* Dialogs grow out of the button that was pressed (motion.css reads this). */
  trackPointerOrigin();
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
