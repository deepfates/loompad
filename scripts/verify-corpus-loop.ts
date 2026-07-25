import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createTestLoomClient } from "@deepfates/lync/client/testing";
import { projectRawLyncFile } from "../client/interface/lync/rawLync";
import {
  appendAnnotation,
  appendKeepMark,
  projectStoryTree,
  type ReadableLoom,
} from "../client/interface/lync/storyLoom";
import type { StoryLoom } from "../client/interface/lync/storyTypes";
import { buildRawLyncCurationEvents } from "../client/interface/utils/storyExport";
import type { StoryNode } from "../client/interface/types";

const SEED = 42;
const SELECTION_AT = "2026-07-01T12:03:00.000Z";
const FIXTURE_OPERATOR = "corpus-rehearsal";
const FIXTURE_SOURCE_REF = "fixture://corpus-loop-twitter";
const FIXTURE_NOTE = "Retain this branch because its provenance is useful.";
const here = dirname(fileURLToPath(import.meta.url));
const textileRoot = resolve(here, "..");
const checkoutParent = resolve(textileRoot, "..");

const roots = {
  lync: resolveCheckout("LYNC_ROOT", "lync", "@deepfates/lync"),
  splice: resolveCheckout("SPLICE_ROOT", "splice", "@deepfates/splice"),
  curare: resolveCheckout("CURARE_ROOT", "curare", "curare"),
};
const fixturePath = resolve(here, "fixtures/corpus-loop-twitter");

function resolveCheckout(envName: string, sibling: string, packageName: string): string {
  const root = resolve(process.env[envName] ?? resolve(checkoutParent, sibling));
  const packagePath = resolve(root, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`${envName} did not resolve to a checkout: ${root}`);
  }
  const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
  if (manifest.name !== packageName) {
    throw new Error(`${envName} resolved ${manifest.name ?? "an unnamed package"}, expected ${packageName}`);
  }
  return root;
}

function run(
  stage: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${stage} failed (${command} ${args.join(" ")}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

function equalFiles(stage: string, first: string, second: string): void {
  if (readFileSync(first, "utf8") !== readFileSync(second, "utf8")) {
    throw new Error(`${stage} was not reproducible: ${first} differs from ${second}`);
  }
}

function findDecision(root: StoryNode): { chosen: StoryNode; rejected: StoryNode } | null {
  const sourceChildren = (root.continuations ?? []).filter((node) => node.sourceId);
  if (sourceChildren.length >= 2) {
    const chosen = sourceChildren.find((node) => node.text.includes("preserves provenance"));
    const rejected = sourceChildren.find((node) => node !== chosen);
    if (chosen && rejected) return { chosen, rejected };
  }
  for (const child of root.continuations ?? []) {
    const found = findDecision(child);
    if (found) return found;
  }
  return null;
}

const temp = mkdtempSync(join(tmpdir(), "textile-corpus-loop-"));
try {
  const source = join(temp, "source.lync");
  const sourceReplay = join(temp, "source-replay.lync");
  const curareFirst = join(temp, "curare-first");
  const curareSecond = join(temp, "curare-second");
  const annotations = join(curareFirst, "source.lync.annotations.lync");
  const annotated = join(temp, "annotated.lync");
  const curation = join(temp, "textile-curation.lync");
  const corpus = join(temp, "corpus.lync");
  const archive = join(temp, "corpus.md");
  const training = join(temp, "training");
  const trainingReplay = join(temp, "training-replay");

  run("Lync build", "pnpm", ["build"], roots.lync);

  const ingestArgs = (out: string) => [
    "run", "start", "--", "lync", "archive", "--source", fixturePath, "--out", out,
    "--operator", FIXTURE_OPERATOR, "--source-ref", FIXTURE_SOURCE_REF,
  ];
  const ingestLog = run("Splice source ingest", "npm", ingestArgs(source), roots.splice);
  run("Splice source replay", "npm", ingestArgs(sourceReplay), roots.splice);
  if (!ingestLog.includes('"command": "lync archive"')) {
    throw new Error("Splice source stage did not report the archive importer");
  }
  equalFiles("Splice source ingest", source, sourceReplay);
  run("Lync source verification", "node", ["bin/lync.js", "verify", source], roots.lync);

  const sourceEvents = readFileSync(source, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  if (sourceEvents.length !== 3 || !sourceEvents.every((event) => event.kind === "twitter/tweet")) {
    throw new Error("Splice did not emit the three expected source tweet events");
  }
  if (
    sourceEvents.some(
      (event) =>
        event.author?.operator !== FIXTURE_OPERATOR ||
        !event.author?.source?.startsWith(`${FIXTURE_SOURCE_REF}:`),
    )
  ) {
    throw new Error("Synthetic source events exposed non-portable operator or source provenance");
  }
  const sourceIds = new Set(sourceEvents.map((event) => event.id));

  const curareArgs = (out: string) => [
    "tsx", "src/cli.ts", source, "--no-llm", "--clusters", "2", "--seed", String(SEED),
    "--samples", "2", "--out-dir", out,
  ];
  run("Curare clustering", "npx", curareArgs(curareFirst), roots.curare, {
    ...process.env,
    OPENROUTER_API_KEY: "",
  });
  run("Curare replay", "npx", curareArgs(curareSecond), roots.curare, {
    ...process.env,
    OPENROUTER_API_KEY: "",
  });
  equalFiles("Curare clusters", join(curareFirst, "clusters.json"), join(curareSecond, "clusters.json"));
  equalFiles(
    "Curare annotations",
    annotations,
    join(curareSecond, "source.lync.annotations.lync"),
  );
  const clusterReport = JSON.parse(readFileSync(join(curareFirst, "clusters.json"), "utf8"));
  if (clusterReport.seed !== SEED || clusterReport.clusters.length !== 2) {
    throw new Error("Curare did not report the controlled seed and two real clusters");
  }
  const clusteredIds = new Set(clusterReport.clusters.flatMap((cluster: { items: string[] }) => cluster.items));
  if (clusteredIds.size !== sourceIds.size || [...sourceIds].some((id) => !clusteredIds.has(id))) {
    throw new Error("Curare clustering did not preserve every Splice source id");
  }

  run(
    "Lync source/annotation union",
    "node",
    ["bin/lync.js", "merge", source, annotations, "-o", annotated],
    roots.lync,
  );

  const projection = projectRawLyncFile(readFileSync(annotated, "utf8"), "annotated.lync");
  if (projection.sourceEventCount !== 3 || projection.annotationCount !== 2) {
    throw new Error("Textile did not project all real source and Curare annotation events");
  }
  const projectedTags = projection.snapshot.turns
    .filter((turn) => turn.meta.sourceId)
    .flatMap((turn) => turn.meta.rawTags ?? []);
  if (projectedTags.length !== 3 || projectedTags.some((tag) => tag.actor !== "curare")) {
    throw new Error("Textile did not surface Curare's real cluster annotations");
  }

  let nextIdCalls = 0;
  const client = createTestLoomClient({
    author: { actor: "corpus-rehearsal", via: "textile-app-layer" },
    createId: () => {
      nextIdCalls += 1;
      return `019f7000-0000-7000-8000-${String(nextIdCalls).padStart(12, "0")}`;
    },
    now: () => Date.parse(SELECTION_AT),
  });
  const imported = await client.looms.import(projection.snapshot);
  const loom = await client.looms.open(imported.id);
  const beforeSelection = await projectStoryTree(loom as unknown as ReadableLoom);
  const decision = findDecision(beforeSelection.root);
  if (!decision?.chosen.sourceId || !decision.rejected.sourceId) {
    throw new Error("Textile navigation did not retain the source branch decision");
  }
  const keepMark = await appendKeepMark(
    loom as unknown as StoryLoom,
    decision.chosen.id,
    true,
    { actor: "corpus-rehearsal", via: "textile-app-layer" },
  );
  const noteTurn = await appendAnnotation(
    loom as unknown as StoryLoom,
    decision.chosen.id,
    FIXTURE_NOTE,
    { actor: "corpus-reviewer", via: "textile-app-layer" },
  );
  const afterSelection = await projectStoryTree(loom as unknown as ReadableLoom);
  const curationEvents = buildRawLyncCurationEvents(afterSelection);
  const selectionEvents = curationEvents.filter((event) => event.payload.label === "selection");
  const noteEvents = curationEvents.filter((event) => event.payload.label === "note");
  if (selectionEvents.length !== 1) {
    throw new Error(`Textile app-layer selection exported ${selectionEvents.length} events, expected one`);
  }
  const selection = selectionEvents[0];
  if (
    selection.id !== keepMark.id ||
    selection.payload.chosen[0] !== decision.chosen.sourceId ||
    !selection.payload.shown.includes(decision.rejected.sourceId)
  ) {
    throw new Error("Textile selection did not target the projected source siblings");
  }
  const note = noteEvents[0];
  if (
    noteEvents.length !== 1 ||
    note?.id !== noteTurn.id ||
    note?.parents[0] !== decision.chosen.sourceId ||
    note?.author.actor !== "corpus-reviewer" ||
    note?.payload.label !== "note" ||
    note.payload.text !== FIXTURE_NOTE
  ) {
    throw new Error("Textile note did not retain its author, text, and exact source target");
  }
  writeFileSync(curation, `${curationEvents.map((event) => JSON.stringify(event)).join("\n")}\n`);
  loom.close();

  run(
    "Lync final union",
    "node",
    ["bin/lync.js", "merge", source, annotations, curation, "-o", corpus],
    roots.lync,
  );
  run("Lync final verification", "node", ["bin/lync.js", "verify", corpus], roots.lync);

  const finalProjection = projectRawLyncFile(readFileSync(corpus, "utf8"), "corpus.lync");
  const finalTurns = finalProjection.snapshot.turns.filter((turn) => turn.meta.sourceId);
  if (!finalTurns.find((turn) => turn.meta.sourceId === decision.chosen.sourceId)?.meta.sourceSelected) {
    throw new Error("Textile final projection lost the selected source identity");
  }
  if (finalTurns.find((turn) => turn.meta.sourceId === decision.rejected.sourceId)?.meta.sourceSelected) {
    throw new Error("Textile final projection selected the rejected source branch");
  }

  run(
    "Splice archive export",
    "npm",
    ["run", "start", "--", "lync", "markdown", "--source", corpus, "--out", archive],
    roots.splice,
  );
  const archiveText = readFileSync(archive, "utf8");
  if (!archiveText.includes(FIXTURE_NOTE) || !archiveText.includes("corpus-reviewer")) {
    throw new Error("Splice readable archive did not retain Textile's human-authored note");
  }

  const exportArgs = (out: string) => [
      "run", "start", "--", "lync", "training", "--source", corpus,
      "--out-dir", out, "--render", "messages",
    ];
  const exportLog = run(
    "Splice training export",
    "npm",
    exportArgs(training),
    roots.splice,
  );
  run("Splice training replay", "npm", exportArgs(trainingReplay), roots.splice);
  if (!exportLog.includes('"command": "lync training"')) {
    throw new Error("Splice export stage did not report the training exporter");
  }
  for (const artifact of ["sft.jsonl", "preferences.jsonl", "stats.json"]) {
    equalFiles(
      `Splice training ${artifact}`,
      join(training, artifact),
      join(trainingReplay, artifact),
    );
  }
  const stats = JSON.parse(readFileSync(join(training, "stats.json"), "utf8"));
  if (stats.sft_rows !== 1 || stats.preference_rows !== 1 || stats.obstacles.length !== 0) {
    throw new Error(`Splice export did not close the loop cleanly: ${JSON.stringify(stats)}`);
  }

  console.log("Provider-free corpus rehearsal passed through real tool and app-layer stages.");
  console.log(JSON.stringify({
    sourceEvents: sourceEvents.length,
    curareClusters: clusterReport.clusters.length,
    seed: clusterReport.seed,
    textileSelection: selection.payload,
    textileNote: note.payload,
    archive: "Splice Markdown retained the note and actor",
    sftRows: stats.sft_rows,
    preferenceRows: stats.preference_rows,
  }, null, 2));
  if (process.env.KEEP_CORPUS_LOOP_OUTPUT === "1") {
    console.log(`Artifacts: ${temp}`);
  } else {
    console.log("Artifacts verified and removed; rerun with KEEP_CORPUS_LOOP_OUTPUT=1 to inspect them.");
  }
} finally {
  if (process.env.KEEP_CORPUS_LOOP_OUTPUT !== "1") {
    rmSync(temp, { recursive: true });
  }
}
