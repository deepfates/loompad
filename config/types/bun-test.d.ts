/**
 * Minimal local type declarations for Bun's test API.
 * This is a lightweight shim to satisfy TypeScript when importing from "bun:test"
 * during unit tests in this project.
 */

declare module "bun:test" {
  type TestFn = () => void | Promise<void>;
  type HookFn = () => void | Promise<void>;

  export function describe(name: string, fn: TestFn): void;
  export function it(name: string, fn: TestFn): void;
  export const test: typeof it;

  export function beforeAll(fn: HookFn, timeout?: number): void;
  export function afterAll(fn: HookFn, timeout?: number): void;
  export function beforeEach(fn: HookFn, timeout?: number): void;
  export function afterEach(fn: HookFn, timeout?: number): void;

  export interface Matchers<R = unknown> {
    toBe(expected: any): R;
    toEqual(expected: any): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeNull(): R;
    toBeUndefined(): R;
    toMatch(expected: RegExp | string): R;
  }

  export function expect<T = any>(actual: T): Matchers;

  export function todo(name: string): void;
}
