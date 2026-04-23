export type LoomErrorCode =
  | "UNKNOWN_ROOT"
  | "MISSING_PARENT"
  | "DUPLICATE_NODE_ID"
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

export function unknownRoot(rootId: string): LoomError {
  return new LoomError("UNKNOWN_ROOT", `Unknown root: ${rootId}`);
}

export function missingParent(parentId: string): LoomError {
  return new LoomError("MISSING_PARENT", `Missing parent node: ${parentId}`);
}

export function duplicateNodeId(nodeId: string): LoomError {
  return new LoomError("DUPLICATE_NODE_ID", `Duplicate node ID: ${nodeId}`);
}

export function invalidSnapshot(message: string): LoomError {
  return new LoomError("INVALID_SNAPSHOT", message);
}

export function cycleDetected(nodeId: string): LoomError {
  return new LoomError("CYCLE_DETECTED", `Cycle detected at node: ${nodeId}`);
}

export function brokenTopology(message: string): LoomError {
  return new LoomError("BROKEN_TOPOLOGY", message);
}

export function closedHandle(): LoomError {
  return new LoomError("CLOSED_HANDLE", "This loom world handle is closed");
}
