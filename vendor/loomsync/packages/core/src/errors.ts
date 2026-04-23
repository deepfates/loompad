export type LoomErrorCode =
  | "UNKNOWN_LOOM"
  | "UNKNOWN_INDEX"
  | "MISSING_PARENT"
  | "DUPLICATE_TURN_ID"
  | "DUPLICATE_LOOM_ID"
  | "INVALID_REFERENCE"
  | "INVALID_SNAPSHOT"
  | "CYCLE_DETECTED"
  | "BROKEN_TOPOLOGY"
  | "CLOSED_HANDLE";

export class LoomError extends Error {
  readonly code: LoomErrorCode;

  constructor(code: LoomErrorCode, message: string) {
    super(message);
    this.name = "LoomError";
    this.code = code;
  }
}

export function unknownLoom(loomId: string): LoomError {
  return new LoomError("UNKNOWN_LOOM", `Unknown loom: ${loomId}`);
}

export function unknownIndex(indexId: string): LoomError {
  return new LoomError("UNKNOWN_INDEX", `Unknown index: ${indexId}`);
}

export function missingParent(parentId: string): LoomError {
  return new LoomError("MISSING_PARENT", `Missing parent turn: ${parentId}`);
}

export function duplicateTurnId(turnId: string): LoomError {
  return new LoomError("DUPLICATE_TURN_ID", `Duplicate turn ID: ${turnId}`);
}

export function duplicateLoomId(loomId: string): LoomError {
  return new LoomError("DUPLICATE_LOOM_ID", `Duplicate loom ID: ${loomId}`);
}

export function invalidReference(message: string): LoomError {
  return new LoomError("INVALID_REFERENCE", message);
}

export function invalidSnapshot(message: string): LoomError {
  return new LoomError("INVALID_SNAPSHOT", message);
}

export function cycleDetected(turnId: string): LoomError {
  return new LoomError("CYCLE_DETECTED", `Cycle detected at turn: ${turnId}`);
}

export function brokenTopology(message: string): LoomError {
  return new LoomError("BROKEN_TOPOLOGY", message);
}

export function closedHandle(): LoomError {
  return new LoomError("CLOSED_HANDLE", "This loom handle is closed");
}
