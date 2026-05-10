import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
);

// Hindari SW di localhost/preview untuk mencegah cache chunk stale (blank page).
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (import.meta.env.PROD && !isLocalhost && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch((error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
    if ('caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
  });
}