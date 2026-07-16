import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import HostApp from './ui/HostApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HostApp />
  </StrictMode>,
);
