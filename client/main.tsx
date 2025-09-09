import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/terminal.css";

// @ts-ignore
const initial_state = window.__INITIAL_STATE__;

// Service worker registration is handled by VitePWA plugin

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
