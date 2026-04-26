import { timingSafeEqual } from "crypto";

export type HeaderSource = {
  header?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

function readHeader(req: HeaderSource, name: string): string | null {
  const fromMethod = req.header?.(name);
  if (fromMethod) return fromMethod;

  const fromHeaders = req.headers?.[name.toLowerCase()];
  if (Array.isArray(fromHeaders)) return fromHeaders[0] ?? null;
  return fromHeaders ?? null;
}

export function getApiAuthToken(req: HeaderSource): string | null {
  const headerToken = readHeader(req, "x-api-key");
  if (headerToken) return headerToken;

  const authorization = readHeader(req, "authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token;
  }

  return null;
}

function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hasValidApiAuthToken(
  req: HeaderSource,
  expected: string | null,
) {
  const provided = getApiAuthToken(req);
  return Boolean(expected && provided && secureEquals(provided, expected));
}
