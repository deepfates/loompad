import { create } from 'zustand';
import type { StoryNode } from '../types';
import type { GardenState, GardenTree, TreePosition, Camera } from '../types/garden';

interface GardenStore extends GardenState {
  // Tree management
  createTree: (name: string, root?: StoryNode) => GardenTree;
  selectTree: (treeId: string) => void;
  deleteTree: (treeId: string) => void;
  renameTree: (treeId: string, newName: string) => void;
  cycleTree: (direction: 'next' | 'prev') => void;
  
  // Node management
  selectNode: (nodeId: string) => void;
  updateNode: (nodeId: string, content: string) => void;
  
  // Camera
  updateCameraPosition: (position: TreePosition) => void;
  updateCameraRotation: (rotation: { x: number; y: number; z: number }) => void;
  updateCameraZoom: (zoom: number) => void;
  updateCameraTarget: (target: TreePosition) => void;
  orbitCamera: (deltaX: number, deltaY: number) => void;
  panCamera: (deltaX: number, deltaY: number) => void;
  zoomCamera: (delta: number) => void;
  toggleInvertedControls: () => void;
  
  // Generation state
  setGenerating: (isGenerating: boolean) => void;
  
  // Path calculation
  getPathFromRoot: (nodeId: string) => StoryNode[];
  
  // Helper functions for tree positioning
  generateMultivariateGaussian: (mean: TreePosition, covarianceMatrix: number[][], numSamples?: number) => TreePosition[];
  calculateDistance: (pos1: TreePosition, pos2: TreePosition) => number;
  checkMinimumDistance: (newPosition: TreePosition, existingTrees: GardenTree[], minDistance: number) => boolean;
  
  // Integration with existing loompad story tree
  syncWithStoryTrees: (storyTrees: { [key: string]: { root: StoryNode } }) => void;
  getCurrentGardenTree: () => GardenTree | null;
}

export const useGardenStore = create<GardenStore>((set, get) => ({
  // Initial state
  trees: [],
  selectedTree: null,
  selectedNode: null,
  camera: {
    position: { x: 0, y: 0, z: 500 },
    rotation: { x: 0, y: 0, z: 0 },
    zoom: 1,
    target: { x: 0, y: 0, z: 0 }
  },
  invertedControls: true, // Default to inverted controls
  isGenerating: false,

  // Helper function to generate samples from multivariate gaussian
  generateMultivariateGaussian: (mean: TreePosition, covarianceMatrix: number[][], numSamples: number = 1): TreePosition[] => {
    // Validate inputs
    if (!mean || typeof mean.x !== 'number' || typeof mean.y !== 'number' || typeof mean.z !== 'number') {
      console.error('Invalid mean position:', mean);
      return [{ x: 0, y: 0, z: 0 }];
    }

    if (isNaN(mean.x) || isNaN(mean.y) || isNaN(mean.z)) {
      console.error('NaN values in mean position:', mean);
      return [{ x: 0, y: 0, z: 0 }];
    }

    // Box-Muller transform for generating gaussian random numbers
    const gaussianRandom = (): number => {
      let u1 = Math.random();
      let u2 = Math.random();
      
      // Ensure u1 is not 0 to avoid log(0)
      while (u1 === 0) u1 = Math.random();
      
      const result = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return isNaN(result) ? 0 : result;
    };

    // Cholesky decomposition for sampling from multivariate gaussian
    const choleskyDecomposition = (matrix: number[][]): number[][] => {
      const n = matrix.length;
      
      // Validate matrix structure
      if (n !== 3) {
        console.error('Expected 3x3 matrix, got:', n);
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // Identity matrix fallback
      }
      
      for (let i = 0; i < n; i++) {
        if (matrix[i].length !== n) {
          console.error('Matrix is not square:', matrix);
          return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // Identity matrix fallback
        }
        for (let j = 0; j < n; j++) {
          if (!Number.isFinite(matrix[i][j])) {
            console.error('Matrix contains non-finite values:', matrix);
            return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // Identity matrix fallback
          }
        }
      }
      
      const L = Array(n).fill(0).map(() => Array(n).fill(0));
      
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          if (i === j) {
            let sum = 0;
            for (let k = 0; k < j; k++) {
              sum += L[j][k] * L[j][k];
            }
            const diagonal = matrix[i][i] - sum;
            if (diagonal <= 0) {
              console.error('Matrix is not positive definite at diagonal [', i, ',', i, ']:', diagonal);
              console.error('Full matrix:', matrix);
              console.error('Partial L matrix:', L);
              // Use identity matrix fallback
              return [[Math.sqrt(20000), 0, 0], [0, Math.sqrt(400), 0], [0, 0, Math.sqrt(20000)]];
            } else {
              L[i][j] = Math.sqrt(diagonal);
            }
          } else {
            let sum = 0;
            for (let k = 0; k < j; k++) {
              sum += L[i][k] * L[j][k];
            }
            if (L[j][j] === 0) {
              L[i][j] = 0;
            } else {
              L[i][j] = (matrix[i][j] - sum) / L[j][j];
            }
          }
        }
      }
      return L;
    };

    const L = choleskyDecomposition(covarianceMatrix);
    const samples: TreePosition[] = [];

    for (let sample = 0; sample < numSamples; sample++) {
      // Generate independent gaussian samples
      const z = [gaussianRandom(), gaussianRandom(), gaussianRandom()];
      
      // Transform using Cholesky decomposition
      const x = [
        L[0][0] * z[0] + mean.x,
        L[1][0] * z[0] + L[1][1] * z[1] + mean.y,
        L[2][0] * z[0] + L[2][1] * z[1] + L[2][2] * z[2] + mean.z
      ];

      // Validate result for NaN values
      const position = { 
        x: isNaN(x[0]) ? mean.x : x[0], 
        y: isNaN(x[1]) ? mean.y : x[1], 
        z: isNaN(x[2]) ? mean.z : x[2] 
      };

      samples.push(position);
    }

    return samples;
  },

  // Helper function to calculate distance between two positions
  calculateDistance: (pos1: TreePosition, pos2: TreePosition): number => {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2) + 
      Math.pow(pos1.z - pos2.z, 2)
    );
  },

  // Helper function to check if position meets minimum distance requirements
  checkMinimumDistance: (newPosition: TreePosition, existingTrees: GardenTree[], minDistance: number): boolean => {
    return existingTrees.every(tree => 
      get().calculateDistance(newPosition, tree.position) >= minDistance
    );
  },

  // Tree management
  createTree: (name: string, root?: StoryNode) => {
    const { trees } = get();
    
    // Calculate position based on multivariate gaussian distribution
    let position: TreePosition = { x: 0, y: 0, z: 0 }; // Initialize with default
    
    if (trees.length === 0) {
      // First tree at origin
      position = { x: 0, y: 0, z: 0 };
    } else {
      // Use multivariate gaussian distribution for positioning
      const mean = { x: 0, y: 0, z: 0 };
      const covarianceMatrix = [
        [20000, 0, 0],     // X variance
        [0, 400, 0],       // Y variance (smaller for height)
        [0, 0, 20000]      // Z variance
      ];
      
      const minDistance = 200; // Minimum distance between trees
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        const samples = get().generateMultivariateGaussian(mean, covarianceMatrix, 1);
        position = samples[0];
        attempts++;
        
        if (attempts >= maxAttempts) {
          console.warn('Could not find valid position after', maxAttempts, 'attempts, using fallback');
          position = { x: Math.random() * 400 - 200, y: 0, z: Math.random() * 400 - 200 };
          break;
        }
      } while (!get().checkMinimumDistance(position, trees, minDistance));
    }
    
    const newTree: GardenTree = {
      id: `tree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      root: root || { id: 'root', text: 'Once upon a time...', continuations: [] },
      position,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    set(state => ({
      trees: [...state.trees, newTree],
      selectedTree: newTree,
      selectedNode: newTree.root
    }));
    
    return newTree;
  },

  selectTree: (treeId: string) => {
    const { trees } = get();
    const tree = trees.find(t => t.id === treeId);
    if (tree) {
      set({
        selectedTree: tree
        // Don't automatically select root node - let existing selection persist
      });
    }
  },

  deleteTree: (treeId: string) => {
    set(state => {
      const newTrees = state.trees.filter(t => t.id !== treeId);
      const newSelectedTree = state.selectedTree?.id === treeId ? 
        (newTrees.length > 0 ? newTrees[0] : null) : state.selectedTree;
      // Don't automatically select root node - let existing selection persist
      const newSelectedNode = null;
      
      return {
        trees: newTrees,
        selectedTree: newSelectedTree,
        selectedNode: newSelectedNode
      };
    });
  },

  renameTree: (treeId: string, newName: string) => {
    set(state => ({
      trees: state.trees.map(tree => 
        tree.id === treeId ? { ...tree, name: newName, updatedAt: Date.now() } : tree
      ),
      selectedTree: state.selectedTree?.id === treeId ? 
        { ...state.selectedTree, name: newName, updatedAt: Date.now() } : state.selectedTree
    }));
  },

  cycleTree: (direction: 'next' | 'prev') => {
    const { trees, selectedTree } = get();
    if (trees.length === 0) return;
    
    const currentIndex = selectedTree ? trees.findIndex(t => t.id === selectedTree.id) : -1;
    let newIndex: number;
    
    if (direction === 'next') {
      newIndex = currentIndex < trees.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : trees.length - 1;
    }
    
    const newSelectedTree = trees[newIndex];
    set({
      selectedTree: newSelectedTree
      // Don't automatically select root node - let existing selection persist
    });
  },

  // Node management
  selectNode: (nodeId: string) => {
    const { trees, selectedTree, selectedNode } = get();
    if (!trees.length) return;
    
    console.log('🎯 [GARDEN STORE] selectNode called with:', {
      nodeId,
      currentSelectedNodeId: selectedNode?.id,
      currentTreeName: selectedTree?.name,
      availableTrees: trees.map(t => t.name)
    });
    
    // Search through all trees to find the node
    let foundNode: StoryNode | null = null;
    let foundTree: GardenTree | null = null;
    
    const findNodeInTree = (node: StoryNode, tree: GardenTree): StoryNode | null => {
      if (node.id === nodeId) return node;
      if (node.continuations) {
        for (const child of node.continuations) {
          const found = findNodeInTree(child, tree);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Search through all trees
    for (const tree of trees) {
      const node = findNodeInTree(tree.root, tree);
      if (node) {
        foundNode = node;
        foundTree = tree;
        break;
      }
    }
    
    if (foundNode && foundTree) {
      const wasInDifferentTree = foundTree.id !== selectedTree?.id;
      console.log('✅ [GARDEN STORE] Node found and selected:', {
        nodeId: foundNode.id,
        nodeText: foundNode.text.slice(0, 50),
        treeName: foundTree.name,
        wasInDifferentTree,
        previousSelectedNodeId: selectedNode?.id
      });
      
      // If the node is in a different tree, switch to that tree
      if (wasInDifferentTree) {
        console.log('🔄 [GARDEN STORE] Switching to different tree:', {
          fromTree: selectedTree?.name,
          toTree: foundTree.name,
          nodeId: foundNode.id
        });
        set({ 
          selectedTree: foundTree,
          selectedNode: foundNode 
        });
      } else {
        console.log('🔄 [GARDEN STORE] Updating selected node in same tree:', {
          treeName: foundTree.name,
          fromNodeId: selectedNode?.id,
          toNodeId: foundNode.id
        });
        set({ selectedNode: foundNode });
      }
    } else {
      console.warn('❌ [GARDEN STORE] Node not found in any tree:', {
        nodeId,
        availableTrees: trees.map(t => t.name)
      });
    }
  },

  updateNode: (nodeId: string, content: string) => {
    const { selectedTree } = get();
    if (!selectedTree) return;
    
    // Update node in the tree
    const updateNodeInTree = (node: StoryNode): StoryNode => {
      if (node.id === nodeId) {
        return { ...node, text: content };
      }
      if (node.continuations) {
        return {
          ...node,
          continuations: node.continuations.map(child => updateNodeInTree(child))
        };
      }
      return node;
    };
    
    const updatedRoot = updateNodeInTree(selectedTree.root);
    const updatedTree = { ...selectedTree, root: updatedRoot, updatedAt: Date.now() };
    
    set(state => ({
      trees: state.trees.map(t => t.id === selectedTree.id ? updatedTree : t),
      selectedTree: updatedTree
    }));
  },

  // Camera controls
  updateCameraPosition: (position: TreePosition) => {
    set(state => ({
      camera: { ...state.camera, position }
    }));
  },

  updateCameraRotation: (rotation: { x: number; y: number; z: number }) => {
    set(state => ({
      camera: { ...state.camera, rotation }
    }));
  },

  updateCameraZoom: (zoom: number) => {
    set(state => ({
      camera: { ...state.camera, zoom }
    }));
  },

  updateCameraTarget: (target: TreePosition) => {
    set(state => ({
      camera: { ...state.camera, target }
    }));
  },

  orbitCamera: (deltaX: number, deltaY: number) => {
    set(state => {
      const sensitivity = 0.005;
      const multiplier = state.invertedControls ? -1 : 1;
      const newRotation = {
        x: state.camera.rotation.x + deltaY * sensitivity * multiplier,
        y: state.camera.rotation.y + deltaX * sensitivity * multiplier,
        z: state.camera.rotation.z
      };
      return {
        camera: { ...state.camera, rotation: newRotation }
      };
    });
  },

  panCamera: (deltaX: number, deltaY: number) => {
    set(state => {
      const sensitivity = 1;
      const multiplier = state.invertedControls ? -1 : 1;
      const newPosition = {
        x: state.camera.position.x + deltaX * sensitivity * multiplier,
        y: state.camera.position.y - deltaY * sensitivity * multiplier,
        z: state.camera.position.z
      };
      return {
        camera: { ...state.camera, position: newPosition }
      };
    });
  },

  zoomCamera: (delta: number) => {
    set(state => {
      const sensitivity = 0.005; // Reduced for smoother zoom
      const multiplier = state.invertedControls ? -1 : 1;
      const zoomChange = Math.max(-0.2, Math.min(0.2, delta * sensitivity * multiplier)); // Clamp per event
      const newZoom = Math.max(0.1, state.camera.zoom + zoomChange);
      return {
        camera: { ...state.camera, zoom: newZoom }
      };
    });
  },

  toggleInvertedControls: () => {
    set(state => ({
      invertedControls: !state.invertedControls
    }));
  },

  // Generation state
  setGenerating: (isGenerating: boolean) => {
    set({ isGenerating });
  },

  // Path calculation
  getPathFromRoot: (nodeId: string) => {
    const { trees, selectedTree } = get();
    if (!selectedTree) return [];
    
    // First try to find the path in the currently selected tree
    const findPath = (node: StoryNode, targetId: string, path: StoryNode[] = []): StoryNode[] | null => {
      const currentPath = [...path, node];
      
      if (node.id === targetId) {
        return currentPath;
      }
      
      if (node.continuations) {
        for (const child of node.continuations) {
          const result = findPath(child, targetId, currentPath);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    let path = findPath(selectedTree.root, nodeId);
    
    // If not found in selected tree, search through all trees
    if (!path) {
      for (const tree of trees) {
        if (tree.id !== selectedTree.id) {
          path = findPath(tree.root, nodeId);
          if (path) break;
        }
      }
    }
    
    return path || [];
  },

  // Integration with existing loompad story tree
  syncWithStoryTrees: (storyTrees: { [key: string]: { root: StoryNode } }) => {
    set(state => {
      const { trees: currentGardenTrees, selectedTree, selectedNode, generateMultivariateGaussian, checkMinimumDistance } = state;
      const storyTreeKeys = Object.keys(storyTrees);

      let finalTrees: GardenTree[] = [];

      // 1. Update existing and add new trees
      storyTreeKeys.forEach(key => {
        const storyTreeData = storyTrees[key];
        let existingTree = currentGardenTrees.find(t => t.name === key);

        if (existingTree) {
            // If root object is different, update it.
            if (existingTree.root !== storyTreeData.root) {
                finalTrees.push({ ...existingTree, root: storyTreeData.root, updatedAt: Date.now() });
            } else {
                finalTrees.push(existingTree);
            }
        } else {
            // New tree to add.
            let position: TreePosition = { x: 0, y: 0, z: 0 };
            const allCurrentTrees = [...currentGardenTrees, ...finalTrees]; // Use all known trees for positioning
            if (allCurrentTrees.length === 0) {
                position = { x: 0, y: 0, z: 0 };
            } else {
                const mean = { x: 0, y: 0, z: 0 };
                const covarianceMatrix = [[20000, 0, 0], [0, 400, 0], [0, 0, 20000]];
                const minDistance = 200;
                let attempts = 0;
                const maxAttempts = 100;
                do {
                    const samples = generateMultivariateGaussian(mean, covarianceMatrix, 1);
                    position = samples[0];
                    attempts++;
                    if (attempts >= maxAttempts) {
                        position = { x: Math.random() * 400 - 200, y: 0, z: Math.random() * 400 - 200 };
                        break;
                    }
                } while (!checkMinimumDistance(position, allCurrentTrees, minDistance));
            }

            const newTree: GardenTree = {
                id: storyTreeData.root.id, // Use root ID for tree ID for consistency
                name: key,
                root: storyTreeData.root,
                position,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            finalTrees.push(newTree);
        }
      });

      // 2. Filter out trees that are no longer in storyTrees
      finalTrees = finalTrees.filter(t => storyTreeKeys.includes(t.name));

      // 3. Preserve selection
      let newSelectedTree = selectedTree ? finalTrees.find(t => t.id === selectedTree.id) || null : null;
      let newSelectedNode = newSelectedTree ? selectedNode : null;

      if (!newSelectedTree && selectedTree) {
           newSelectedTree = finalTrees.find(t => t.name === selectedTree.name) || null;
      }

      if (newSelectedTree && newSelectedNode) {
        const findNodeInTree = (node: StoryNode, targetId: string): StoryNode | null => {
          if (node.id === targetId) return node;
          if (node.continuations) {
            for (const child of node.continuations) {
              const found = findNodeInTree(child, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        newSelectedNode = findNodeInTree(newSelectedTree.root, newSelectedNode.id);
      } else {
          newSelectedNode = null;
      }

      if (!newSelectedTree && finalTrees.length > 0) {
        const currentKey = Object.keys(storyTrees).find(k => storyTrees[k].root.id === state.selectedTree?.root.id);
        newSelectedTree = currentKey ? finalTrees.find(t => t.name === currentKey) || finalTrees[0] : (selectedTree ? finalTrees.find(t => t.name === selectedTree.name) || finalTrees[0] : finalTrees[0]);
      }

      return {
        trees: finalTrees,
        selectedTree: newSelectedTree,
        selectedNode: newSelectedNode,
      };
    });
  },

  getCurrentGardenTree: () => {
    const { selectedTree } = get();
    return selectedTree;
  }
})); 