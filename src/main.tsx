import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initAuth } from './services/auth';

void initAuth();
import { installDomTranslator } from './i18n/dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
installDomTranslator();
if (import.meta.env.DEV) { void import('./store/game').then((m) => { (window as unknown as { __game: unknown }).__game = m.useGame; }); }
