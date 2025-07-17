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

    // Include Terminal CSS and your custom CSS
    const externalStyles = `
      <style>
        ${fs.readFileSync(
          path.resolve(process.cwd(), "client/styles/terminal.css"),
          "utf8",
        )}
      </style>
    `;

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
