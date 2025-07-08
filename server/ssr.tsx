import ReactDOMServer from 'react-dom/server'
import App from '../client/App'
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
        </Router>
      )
    );

    // Get the styles from styled-components
    const styledComponentsStyles = sheet.getStyleTags();

    // Inline Terminal CSS and custom CSS to avoid MIME issues in production
    const terminalCss = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "node_modules/terminal.css/dist/terminal.min.css"
      ),
      "utf8"
    );

    const customCss = fs.readFileSync(
      path.resolve(process.cwd(), "client/interface/terminal-custom.css"),
      "utf8"
    );

    const externalStyles = `
      <style>
        ${terminalCss}
        ${customCss}
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
