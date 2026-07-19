import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PopupApp from './PopupApp.tsx';
import { applyDocumentTheme, readStoredTheme } from './ui/theme';
import './index.css';

applyDocumentTheme(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);
