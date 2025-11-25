import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/terminal.css";


// @ts-expect-error __INITIAL_STATE__ is injected at runtime by SSR
const initial_state = window.__INITIAL_STATE__;

// Service worker registration is handled by VitePWA plugin

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
