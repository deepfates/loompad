export type LengthMode = "word" | "sentence" | "paragraph" | "page";

export interface LengthPreset {
  label: string;
  stop: string[];
  maxTokens: number;
}

export const LENGTH_PRESETS: Record<LengthMode, LengthPreset> = {
  word: {
    label: "Word",
    stop: [" ", "\n", "\t"],
    maxTokens: 12,
  },
  sentence: {
    label: "Sentence",
    stop: [".\n", "?\n", "!\n", ".\"", "?\"", "!\"", "\n\n"],
    maxTokens: 120,
  },
  paragraph: {
    label: "Paragraph",
    stop: ["\n\n"],
    maxTokens: 400,
  },
  page: {
    label: "Page",
    stop: ["\n\n\n\n"],
    maxTokens: 900,
  },
};

export const DEFAULT_LENGTH_MODE: LengthMode = "sentence";
