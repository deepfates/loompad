import path from "path";

type RuntimeEnvironment = Record<string, string | undefined>;

export function resolveRuntimeDataDir(
  env: RuntimeEnvironment = process.env,
  cwd = process.cwd(),
): string {
  const configured = env.TEXTILE_DATA_DIR?.trim();
  return configured
    ? path.resolve(cwd, configured)
    : path.resolve(cwd, ".data");
}

export function resolveLyncStorageDir(
  env: RuntimeEnvironment = process.env,
  cwd = process.cwd(),
): string {
  const configured = env.LYNC_STORAGE_DIR?.trim();
  return configured
    ? path.resolve(cwd, configured)
    : path.join(resolveRuntimeDataDir(env, cwd), "lync");
}

export function resolveModelsFile(
  env: RuntimeEnvironment = process.env,
  cwd = process.cwd(),
): string {
  const configured = env.TEXTILE_MODELS_FILE?.trim();
  return configured
    ? path.resolve(cwd, configured)
    : path.join(resolveRuntimeDataDir(env, cwd), "models.json");
}
