import ReactDOMServer from "react-dom/server";
import App from "../client/App";
import { Router } from "wouter";
import { ServerStyleSheet } from "styled-components";
import fs from "fs";
import path from "path";

export function render(url, context) {
  const sheet = new ServerStyleSheet();

  try {
    // Render the app and collect styled-components styles
    const body = ReactDOMServer.renderToString(
      sheet.collectStyles(
        <Router ssrPath={url}>
          <App />
        </Router>,
      ),
    );

    // Get the styles from styled-components
    const styledComponentsStyles = sheet.getStyleTags();

    // In development, Vite handles CSS. In production, it's bundled.
    // We no longer inline CSS for SSR to avoid duplication with Tailwind/srcl.
    const externalStyles = "";

    return {
      body,
      head: `
        ${styledComponentsStyles}
        ${externalStyles}
      `,
    };
  } finally {
    sheet.seal(); // Important: prevents memory leaks
  }
}
