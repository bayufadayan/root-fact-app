import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
);

// Register Service Worker via Virtual PWA
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}