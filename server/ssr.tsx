import ReactDOMServer from 'react-dom/server'
import App from '../client/App'
import { Router } from "wouter";
import { ServerStyleSheet } from "styled-components";

export function render(url, context) {
  const sheet = new ServerStyleSheet();
  const body = ReactDOMServer.renderToString(
    sheet.collectStyles(
      <Router ssrPath={url}>
        <App />
      </Router>
    )
  );
  return {
    body,
    head: sheet.getStyleTags(),
  };
}
