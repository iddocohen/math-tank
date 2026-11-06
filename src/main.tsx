import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { swUpdate } from './app/swUpdate';
import './app/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

// The service worker precaches the game for offline play; a new version waits for the start screen (FR-051, FR-051a).
swUpdate.install(registerSW);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
