export function assertJsonEncodable(value: unknown, label: string): void {
  try {
    JSON.stringify(value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TypeError(`${label} must be JSON-encodable: ${reason}`);
  }
}

export function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
