import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './theme.css';
import './styles/reset.css';
import './styles/accessibility.css';
/* Public Sans is the product's face (design board 3. 10. 2026); Inter stays as
   the fallback and for the public pages that already wear it. */
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/public-sans/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
