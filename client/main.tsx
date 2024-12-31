import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import "terminal.css";

// @ts-ignore
const initial_state = window.__INITIAL_STATE__;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
