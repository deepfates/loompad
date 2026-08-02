import { afterEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { loadModelsFromFiles } from "../modelsStore";
import {
  resolveLyncStorageDir,
  resolveModelsFile,
  resolveRuntimeDataDir,
} from "../runtimeData";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "textile-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("runtime data paths", () => {
  it("keeps every mutable server artifact beneath .data by default", () => {
    const cwd = "/srv/textile";
    expect(resolveRuntimeDataDir({}, cwd)).toBe("/srv/textile/.data");
    expect(resolveLyncStorageDir({}, cwd)).toBe("/srv/textile/.data/lync");
    expect(resolveModelsFile({}, cwd)).toBe("/srv/textile/.data/models.json");
  });

  it("supports one durable data mount plus narrow compatibility overrides", () => {
    const cwd = "/srv/textile";
    expect(
      resolveLyncStorageDir({ TEXTILE_DATA_DIR: "/var/data" }, cwd),
    ).toBe("/var/data/lync");
    expect(resolveModelsFile({ TEXTILE_DATA_DIR: "/var/data" }, cwd)).toBe(
      "/var/data/models.json",
    );
    expect(
      resolveLyncStorageDir({ LYNC_STORAGE_DIR: "relay" }, cwd),
    ).toBe("/srv/textile/relay");
    expect(resolveModelsFile({ TEXTILE_MODELS_FILE: "models.json" }, cwd)).toBe(
      "/srv/textile/models.json",
    );
  });
});

describe("mutable model catalog", () => {
  it("seeds the durable runtime file from the checked-in catalog", () => {
    const directory = temporaryDirectory();
    const mutableFile = path.join(directory, "data", "models.json");
    const bundledFile = path.join(directory, "bundled.json");
    fs.writeFileSync(
      bundledFile,
      JSON.stringify({
        "test/model": {
          name: "Test Model",
          maxTokens: 123,
          defaultTemp: 0.4,
          generationMode: "instruction",
        },
      }),
    );

    const models = loadModelsFromFiles(mutableFile, bundledFile);

    expect(models["test/model"]?.name).toBe("Test Model");
    expect(JSON.parse(fs.readFileSync(mutableFile, "utf-8"))).toEqual(models);
  });

  it("uses the mutable catalog after seeding and fails loudly on corruption", () => {
    const directory = temporaryDirectory();
    const mutableFile = path.join(directory, "models.json");
    const bundledFile = path.join(directory, "bundled.json");
    fs.writeFileSync(
      bundledFile,
      JSON.stringify({
        bundled: {
          name: "Bundled",
          maxTokens: 10,
          defaultTemp: 0.5,
          generationMode: "instruction",
        },
      }),
    );
    fs.writeFileSync(
      mutableFile,
      JSON.stringify({
        customized: {
          name: "Customized",
          maxTokens: 20,
          defaultTemp: 0.6,
          generationMode: "completion",
        },
      }),
    );

    expect(loadModelsFromFiles(mutableFile, bundledFile).customized?.name).toBe(
      "Customized",
    );

    fs.writeFileSync(mutableFile, "not json");
    expect(() => loadModelsFromFiles(mutableFile, bundledFile)).toThrow(
      "Mutable model catalog is unreadable",
    );
  });
});
