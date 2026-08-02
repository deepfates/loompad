import {
  REASONING_POLICIES,
  type ReasoningPolicy,
} from "../../shared/generation";

interface OpenRouterModelRecord {
  id?: unknown;
  reasoning?: {
    mandatory?: boolean;
    supported_efforts?: unknown;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModelRecord[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const policyCache = new Map<
  string,
  { expiresAt: number; policy: ReasoningPolicy }
>();

export function policyFromOpenRouterModel(
  modelId: string,
  payload: OpenRouterModelsResponse,
): ReasoningPolicy {
  const model = payload.data?.find((candidate) => candidate.id === modelId);
  if (!model?.reasoning?.mandatory) return "none";

  const advertised = model.reasoning.supported_efforts;
  const supported = Array.isArray(advertised)
    ? new Set(advertised.filter((effort): effort is string => typeof effort === "string"))
    : null;
  const weakest = REASONING_POLICIES.find(
    (effort) => effort !== "none" && (supported === null || supported.has(effort)),
  );
  if (!weakest) {
    throw new Error(
      `Model ${modelId} requires reasoning but advertises no usable effort`,
    );
  }
  return weakest;
}

export async function resolveContinuationReasoningPolicy(
  modelId: string,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<ReasoningPolicy> {
  const cached = policyCache.get(modelId);
  if (cached && cached.expiresAt > Date.now()) return cached.policy;

  const response = await fetchImplementation(
    `https://openrouter.ai/api/v1/models?q=${encodeURIComponent(modelId)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Could not inspect reasoning requirements for ${modelId} (OpenRouter ${response.status})`,
    );
  }

  const payload = (await response.json()) as OpenRouterModelsResponse;
  const policy = policyFromOpenRouterModel(modelId, payload);
  policyCache.set(modelId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    policy,
  });
  return policy;
}
