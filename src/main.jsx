import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.includes('workbox') || key.includes('root-facts')) {
          caches.delete(key);
        }
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
);

// Register Service Worker via Virtual PWA
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}