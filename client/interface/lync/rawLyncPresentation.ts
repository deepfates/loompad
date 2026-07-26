import type { LyncEventBody } from "@deepfates/lync/events";

import {
  BEHOLD_INHABITANT_PROFILE,
  presentBeholdInhabitantEvent,
} from "./beholdResidentPresentation";
import type { RawLyncPresentation } from "./rawLyncPresentationTypes";

export type {
  RawLyncPresentation,
  RawLyncPresentationDiagnostic,
  RawLyncPresentationKind,
  RawLyncPresentationRole,
  RawLyncPresentationSection,
  RawLyncPresentationSource,
} from "./rawLyncPresentationTypes";

export interface RawLyncPresentationContext {
  loomProfile?: string;
}

type Presenter = (payload: Record<string, unknown>) => RawLyncPresentation | null;

const splicePresenters: Record<string, Presenter> = {
  "twitter/tweet": (payload) =>
    content(firstString(payload, ["full_text", "fullText", "text"]), "splice/twitter-archive"),
  "twitter/like": (payload) =>
    content(firstString(payload, ["full_text", "fullText", "text"]), "splice/twitter-archive"),
  "bluesky/post": (payload) =>
    content(
      nestedString(payload, ["record", "text"]) ?? firstString(payload, ["text"]),
      "splice/bluesky-archive",
    ),
  "glowfic/post": (payload) =>
    content(htmlToPlainText(stringField(payload, "content")), "splice/glowfic-json"),
  "twitter/tweet-embed": (payload) =>
    content(
      htmlToPlainText(nestedString(payload, ["embed", "html"])),
      "splice/twitter-embed-cache",
    ),
  "ocr/page": (payload) => content(stringField(payload, "text"), "splice/ocr-text-import"),
  "ocr/document": (payload) =>
    content(stringField(payload, "text"), "splice/ocr-text-import"),
  "glowfic/thread": glowficThread,
  "ocr/set": ocrSet,
};

/**
 * Present known kind contracts first, then Textile's deliberately small
 * generic text/message contract. Unknown payloads are not searched
 * recursively: callers account for them as unsupported instead of guessing.
 */
export function presentRawLyncEvent(
  event: LyncEventBody,
  context: RawLyncPresentationContext = {},
): RawLyncPresentation | null {
  // A declared profile owns its complete presentation boundary. Once claimed,
  // malformed or unknown events must remain unsupported instead of falling
  // through to Textile's generic nested-message reader.
  if (context.loomProfile === BEHOLD_INHABITANT_PROFILE) {
    return presentBeholdInhabitantEvent(event);
  }
  const known = splicePresenters[event.kind];
  if (known) return known(event.payload);
  return genericPresentation(event.payload);
}

function content(text: string | null, contract: string): RawLyncPresentation | null {
  return text === null ? null : { text, kind: "content", contract };
}

function glowficThread(payload: Record<string, unknown>): RawLyncPresentation {
  const title = stringField(payload, "title");
  const id = stringField(payload, "id");
  const authors = stringArray(payload.authors);
  const lines = [
    `Glowfic thread: ${title ?? id ?? "untitled"}`,
    id && title ? `Thread ${id}` : null,
    authors.length ? `Authors: ${authors.join(", ")}` : null,
    stringField(payload, "url") ? `Source: ${stringField(payload, "url")}` : null,
  ].filter((line): line is string => line !== null);
  return { text: lines.join("\n"), kind: "structure", contract: "splice/glowfic-json" };
}

function ocrSet(payload: Record<string, unknown>): RawLyncPresentation {
  const locator = stringField(payload, "locator") ?? "unnamed set";
  const pages = integerField(payload, "pages");
  const documents = Array.isArray(payload.documents) ? payload.documents.length : null;
  const range = recordField(payload, "page_range");
  const min = range ? integerField(range, "min") : null;
  const max = range ? integerField(range, "max") : null;
  const counts = [
    pages === null ? null : `${pages} ${pages === 1 ? "page" : "pages"}`,
    documents === null
      ? null
      : `${documents} ${documents === 1 ? "document" : "documents"}`,
  ].filter((value): value is string => value !== null);
  const lines = [
    `OCR set: ${locator}`,
    counts.length ? counts.join(" · ") : null,
    min === null || max === null ? null : `Page range: ${min}–${max}`,
  ].filter((line): line is string => line !== null);
  return { text: lines.join("\n"), kind: "structure", contract: "splice/ocr-text-import" };
}

function genericPresentation(payload: Record<string, unknown>): RawLyncPresentation | null {
  const direct = firstString(payload, ["text", "full_text", "fullText", "message"]);
  if (direct !== null) return content(direct, "textile/generic-text");
  const message = recordField(payload, "message");
  if (!message) return null;
  const messageText = stringField(message, "content");
  if (messageText !== null) return content(messageText, "textile/generic-message");
  const blocks = message.content;
  if (!Array.isArray(blocks)) return null;
  const text = blocks
    .map((block) => (recordFieldValue(block) ? stringField(block, "text") ?? "" : ""))
    .filter(Boolean)
    .join("");
  return text ? content(text, "textile/generic-message-blocks") : null;
}

/** Convert source HTML to inert, readable plain text without executing it. */
export function htmlToPlainText(html: string | null): string | null {
  if (html === null) return null;
  const withoutExecutable = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const withBreaks = withoutExecutable
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|blockquote|li|h[1-6])\s*>/gi, "\n");
  const decoded = decodeHtmlEntities(withBreaks.replace(/<[^>]*>/g, ""));
  const normalized = decoded
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized || null;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const base = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = base === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(digits, base);
      if (Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function firstString(payload: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = stringField(payload, field);
    if (value !== null) return value;
  }
  return null;
}

function nestedString(payload: Record<string, unknown>, path: string[]): string | null {
  let value: unknown = payload;
  for (const key of path) {
    const record = recordFieldValue(value);
    if (!record) return null;
    value = record[key];
  }
  return typeof value === "string" ? value : null;
}

function stringField(payload: Record<string, unknown>, field: string): string | null {
  return typeof payload[field] === "string" ? payload[field] : null;
}

function integerField(payload: Record<string, unknown>, field: string): number | null {
  const value = payload[field];
  return Number.isInteger(value) ? (value as number) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordField(payload: Record<string, unknown>, field: string): Record<string, unknown> | null {
  return recordFieldValue(payload[field]);
}

function recordFieldValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
