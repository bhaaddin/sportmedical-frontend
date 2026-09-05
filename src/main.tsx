import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './theme.css';
import './styles/reset.css';
import './styles/variables.css';
import './styles/accessibility.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
