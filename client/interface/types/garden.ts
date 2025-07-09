import type { StoryNode } from './index';

export interface TreePosition {
  x: number;
  y: number;
  z: number;
}

export interface TreeVisualNode {
  id: string;
  position: TreePosition;
  type: 'trunk' | 'branch' | 'leaf' | 'root' | 'connection';
  unicode: string;
  nodeId: string; // reference to StoryNode
}

export interface Camera {
  position: TreePosition;
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
  zoom: number;
  target: TreePosition; // Look-at target
}

export interface GardenTree {
  id: string;
  name: string;
  root: StoryNode;
  position: TreePosition;
  createdAt: number;
  updatedAt: number;
}

export interface GardenState {
  trees: GardenTree[];
  selectedTree: GardenTree | null;
  selectedNode: StoryNode | null;
  camera: Camera;
  invertedControls: boolean;
  isGenerating: boolean;
}

export interface LoomHotkeys {
  generate: string;
  generateSiblings: string;
  splitAtPoint: string;
  splitAndCreateChild: string;
  delete: string;
  merge: string;
  nextSibling: string;
  prevSibling: string;
  parent: string;
  child: string;
} 