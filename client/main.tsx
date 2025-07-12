import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import "terminal.css";

// @ts-ignore
const initial_state = window.__INITIAL_STATE__;

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
