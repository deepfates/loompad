export interface StoryNode {
  id: string;
  parentId: string | null;
  depth: number;
  choiceIndex: number;
  text: string;
  createdAt: string;
  updatedAt: string;
  children: string[];
  activeChildId?: string;
}

export interface StorySummary {
  id: string;
  slug: string;
  title: string;
  rootId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryRecord extends StorySummary {
  nodes: Record<string, StoryNode>;
}

export interface StoryWindowRequestParams {
  ancestorDepth?: number;
  descendantDepth?: number;
  siblingSpan?: number;
}

export interface StoryWindowResponse {
  story: StorySummary;
  cursor: StoryNode;
  ancestors: StoryNode[];
  favoredPath: StoryNode[];
  siblingGroups: Record<string, StoryNode[]>;
}

export interface CreateStoryPayload {
  title?: string;
  slug?: string;
  rootText?: string;
}

export interface CreateChildPayload {
  text: string;
  choiceIndex?: number;
  makeActive?: boolean;
}

export interface UpdateNodePayload {
  text?: string;
  activeChildId?: string | null;
}
