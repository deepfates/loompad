import type {
  CreateChildPayload,
  CreateStoryPayload,
  StoryNode,
  StoryRecord,
  StoryWindowResponse,
  StorySummary,
  UpdateNodePayload,
} from "../../../shared/storyTypes";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as unknown;
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : response.statusText;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function fetchStories(): Promise<StorySummary[]> {
  const response = await fetch("/api/stories");
  return handleResponse<StorySummary[]>(response);
}

export async function createStoryApi(
  payload: CreateStoryPayload,
): Promise<StorySummary> {
  const response = await fetch("/api/stories", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return handleResponse<StorySummary>(response);
}

export async function fetchStory(storyIdOrSlug: string): Promise<StoryRecord> {
  const response = await fetch(`/api/stories/${storyIdOrSlug}`);
  return handleResponse<StoryRecord>(response);
}

export async function fetchWindow(
  storyIdOrSlug: string,
  nodeId: string,
  params?: { ancestors?: number; descendants?: number; siblings?: number },
): Promise<StoryWindowResponse> {
  const search = new URLSearchParams();
  if (typeof params?.ancestors === "number") {
    search.set("ancestors", String(params.ancestors));
  }
  if (typeof params?.descendants === "number") {
    search.set("descendants", String(params.descendants));
  }
  if (typeof params?.siblings === "number") {
    search.set("siblings", String(params.siblings));
  }
  const query = search.toString();
  const response = await fetch(
    `/api/stories/${storyIdOrSlug}/nodes/${nodeId}/window${
      query ? `?${query}` : ""
    }`,
  );
  return handleResponse<StoryWindowResponse>(response);
}

export async function createChildApi(
  storyIdOrSlug: string,
  parentId: string,
  payload: CreateChildPayload,
) {
  const response = await fetch(
    `/api/stories/${storyIdOrSlug}/nodes/${parentId}/children`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    },
  );
  return handleResponse<{ child: StoryNode; window: StoryWindowResponse }>(
    response,
  );
}

export async function updateNodeApi(
  storyIdOrSlug: string,
  nodeId: string,
  payload: UpdateNodePayload,
) {
  const response = await fetch(`/api/stories/${storyIdOrSlug}/nodes/${nodeId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}
