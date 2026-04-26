import { invalidReference } from "./errors.js";
import type { IndexId, LoomId, LoomReference, TurnId } from "./types.js";

export interface ReferenceUrlOptions {
  param?: string;
}

export function loomRef(loomId: LoomId): LoomReference {
  return { v: 1, kind: "loom", loomId };
}

export function turnRef(loomId: LoomId, turnId: TurnId): LoomReference {
  return { v: 1, kind: "turn", loomId, turnId };
}

export function threadRef(loomId: LoomId, turnId: TurnId): LoomReference {
  return { v: 1, kind: "thread", loomId, turnId };
}

export function indexRef(indexId: IndexId): LoomReference {
  return { v: 1, kind: "index", indexId };
}

export function parseReference(value: unknown): LoomReference {
  if (!value || typeof value !== "object") {
    throw invalidReference("Reference must be an object");
  }
  const ref = value as Record<string, unknown>;
  if (ref.v !== 1) throw invalidReference("Unsupported reference version");
  if (ref.kind === "loom" && typeof ref.loomId === "string") {
    return loomRef(ref.loomId);
  }
  if (
    ref.kind === "turn" &&
    typeof ref.loomId === "string" &&
    typeof ref.turnId === "string"
  ) {
    return turnRef(ref.loomId, ref.turnId);
  }
  if (
    ref.kind === "thread" &&
    typeof ref.loomId === "string" &&
    typeof ref.turnId === "string"
  ) {
    return threadRef(ref.loomId, ref.turnId);
  }
  if (ref.kind === "index" && typeof ref.indexId === "string") {
    return indexRef(ref.indexId);
  }
  throw invalidReference("Invalid reference shape");
}

export function encodeReference(ref: LoomReference): string {
  return encodeBase64Url(JSON.stringify(parseReference(ref)));
}

export function decodeReference(encoded: string): LoomReference {
  try {
    return parseReference(JSON.parse(decodeBase64Url(encoded)));
  } catch (error) {
    if (error instanceof Error && error.name === "LoomError") throw error;
    throw invalidReference("Invalid encoded reference");
  }
}

export function referenceToUrl(
  ref: LoomReference,
  location: Location | URL,
  options: ReferenceUrlOptions = {},
): string {
  const param = options.param ?? "ref";
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(param, encodeReference(ref));
  return url.toString();
}

export function referenceFromUrl(
  location: Location | URL,
  options: ReferenceUrlOptions = {},
): LoomReference | null {
  const param = options.param ?? "ref";
  const encoded = new URLSearchParams(location.search).get(param);
  return encoded ? decodeReference(encoded) : null;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(value, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  if (typeof atob === "function") {
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }
  return Buffer.from(padded, "base64").toString("utf8");
}
