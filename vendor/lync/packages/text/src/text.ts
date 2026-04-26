import type {
  Loom,
  Turn,
  TurnId,
} from "../../core/src/index";
import type { TextPayload, TextThreadTurn } from "./types.js";

export function flattenThread(turns: Turn<TextPayload>[]): string {
  return turns.map((turn) => turn.payload.text).join("");
}

export function threadToTextTurns(turns: Turn<TextPayload>[]): TextThreadTurn[] {
  return turns.map((turn) => ({
    id: turn.id,
    text: turn.payload.text,
  }));
}

export async function appendChain<TTurnMeta = unknown>(
  loom: Loom<TextPayload, unknown, TTurnMeta>,
  parentId: TurnId | null,
  chunks: TextPayload[],
  meta?: TTurnMeta,
): Promise<Turn<TextPayload, TTurnMeta>[]> {
  const appended: Turn<TextPayload, TTurnMeta>[] = [];
  let currentParent = parentId;
  for (const chunk of chunks) {
    const turn = await loom.appendTurn(currentParent, chunk, meta);
    appended.push(turn);
    currentParent = turn.id;
  }
  return appended;
}
