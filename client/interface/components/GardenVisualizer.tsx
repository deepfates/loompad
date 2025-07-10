import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import Delaunator from 'delaunator';
import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
import { useGardenStore } from '../stores/gardenStore';
import type { TreeVisualNode, TreePosition } from '../types/garden';
import type { StoryNode } from '../types';

interface GardenVisualizerProps {
  showMeshGrid?: boolean;
  showAxis?: boolean;
  currentDepth?: number;
  selectedOptions?: number[];
  useAsciiEffect?: boolean;
}

interface ThreeNode {
  id: string;
  mesh: THREE.Mesh;
  nodeId: string;
  type: string;
  position: TreePosition;
}

interface TreeGeometry {
  trunk: THREE.Mesh;
  branches: THREE.Mesh[];
  leaves: THREE.Mesh[];
  connections: THREE.Mesh[];
}

/**
 * GardenVisualizer - 3D Tree Visualization with ASCII Effect
 * 
 * Renders story trees as 3D geometry using ASCII art style rendering.
 * Features:
 * - 3D tree trunks, branches, and leaves
 * - ASCII art rendering for retro aesthetic
 * - Interactive selection and navigation
 * - Dynamic color changes during story generation
 * - Camera controls (orbit, pan, zoom)
 */
const GardenVisualizer: React.FC<GardenVisualizerProps> = ({ 
  showMeshGrid = false, // Disabled by default
  showAxis = false,
  currentDepth = 0,
  selectedOptions = [],
  useAsciiEffect = true, // Disabled by default
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const raycasterRef = useRef<THREE.Raycaster>();
  const mouseRef = useRef<THREE.Vector2>();
  
  const { trees, selectedTree, selectedNode, camera, getPathFromRoot, isGenerating } = useGardenStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'orbit' | 'pan'>('orbit');
  const [animationTime, setAnimationTime] = useState(0);
  const animationStartTime = useRef<number>(0);
  const [threeNodes, setThreeNodes] = useState<ThreeNode[]>([]);
  const [meshLines, setMeshLines] = useState<THREE.LineSegments[]>([]);
  const [axisHelper, setAxisHelper] = useState<THREE.AxesHelper>();
  const [selectionIndicator, setSelectionIndicator] = useState<THREE.Mesh | null>(null);
  const [showCustomCursor, setShowCustomCursor] = useState(false);
  const [treeGeometries, setTreeGeometries] = useState<Map<string, TreeGeometry>>(new Map());
  const [effect, setEffect] = useState<AsciiEffect | null>(null);

  // Create trunk geometry
  const createTrunkGeometry = (height: number, radius: number): THREE.Mesh => {
    const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // Saddle brown
    });
    return new THREE.Mesh(geometry, material);
  };

  // Create branch geometry
  const createBranchGeometry = (length: number, radius: number): THREE.Mesh => {
    const geometry = new THREE.CylinderGeometry(radius * 0.6, radius, length, 6);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x654321 // Dark brown
    });
    return new THREE.Mesh(geometry, material);
  };

  // Create single leaf sphere
  const createLeafSphere = (radius: number): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(radius * 0.4, 8, 6);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x32CD32 // Lime green for better ASCII contrast
    });
    return new THREE.Mesh(geometry, material);
  };

  // Create connection line between nodes
  const createConnectionLine = (startPos: TreePosition, endPos: TreePosition): THREE.Mesh => {
    const direction = new THREE.Vector3(
      endPos.x - startPos.x,
      endPos.y - startPos.y,
      endPos.z - startPos.z
    );
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(2.5, 2.5, length, 8); // Much thicker branches
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x90EE90, // Light green for better ASCII contrast
      transparent: true,
      opacity: 0.9
    });
    
    const line = new THREE.Mesh(geometry, material);
    line.position.copy(new THREE.Vector3(
      (startPos.x + endPos.x) / 2,
      (startPos.y + endPos.y) / 2,
      (startPos.z + endPos.z) / 2
    ));
    
    // Orient the line to point from start to end
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    line.setRotationFromQuaternion(quaternion);
    
    return line;
  };

  // Generate 3D tree structure
  const generateTreeGeometry = (tree: any, treeIndex: number): TreeGeometry => {
    const trunk: THREE.Mesh[] = [];
    const branches: THREE.Mesh[] = [];
    const leaves: THREE.Mesh[] = [];
    const connections: THREE.Mesh[] = [];
    const nodePositions = new Map<string, TreePosition>();
    const processedNodes = new Set<string>();
    
    if (tree.root) {
      const rootNode = tree.root;
      const rootPos = tree.position;
      nodePositions.set(rootNode.id, rootPos);
      processedNodes.add(rootNode.id);
      
      const isSeedling = !rootNode.continuations || rootNode.continuations.length === 0;
      
      if (isSeedling) {
        // Create a small seedling trunk
        const seedlingTrunk = createTrunkGeometry(15, 3);
        seedlingTrunk.position.set(rootPos.x, rootPos.y, rootPos.z);
        trunk.push(seedlingTrunk);
        
        // Add a single small leaf
        const seedlingLeaf = createLeafSphere(8);
        seedlingLeaf.position.set(rootPos.x, rootPos.y + 8, rootPos.z);
        leaves.push(seedlingLeaf);
      } else {
        // Create main trunk
        const mainTrunk = createTrunkGeometry(25, 5);
        mainTrunk.position.set(rootPos.x, rootPos.y + 12.5, rootPos.z);
        trunk.push(mainTrunk);
      }
    }

    const positionChildren = (parentNode: StoryNode, parentPos: TreePosition, depth: number = 0) => {
      if (depth > 8) return;
      
      if (!parentNode.continuations || parentNode.continuations.length === 0) return;
      
      const children = parentNode.continuations;
      const angleStep = (2 * Math.PI) / children.length;

      children.forEach((childNode: StoryNode, index: number) => {
        if (processedNodes.has(childNode.id)) return;
        
        const seed = childNode.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seededRandom1 = ((seed * 9301 + 49297) % 233280) / 233280;
        const seededRandom2 = ((seed * 9301 + 49297 + 12345) % 233280) / 233280;
        
        const gaussianRandom1 = Math.sqrt(-2 * Math.log(seededRandom1)) * Math.cos(2 * Math.PI * seededRandom2);
        const gaussianRandom2 = Math.sqrt(-2 * Math.log(seededRandom1)) * Math.sin(2 * Math.PI * seededRandom2);
        
        const heightVariance = 22.5 / (1 + depth * 0.5);
        const baseHeight = 52.5;
        const heightStep = Math.max(30, Math.min(75, baseHeight + gaussianRandom1 * heightVariance));
        
        const radiusVariance = 15 / (1 + depth * 0.7);
        const baseRadius = 40;
        const radius = Math.max(25, Math.min(55, baseRadius + gaussianRandom2 * radiusVariance));
        
        const angle = index * angleStep;
        const childPos: TreePosition = {
          x: parentPos.x + Math.cos(angle) * radius,
          y: parentPos.y + heightStep,
          z: parentPos.z + Math.sin(angle) * radius
        };

        nodePositions.set(childNode.id, childPos);
        processedNodes.add(childNode.id);
        
        const hasChildren = childNode.continuations && childNode.continuations.length > 0;
        
        // Create connection line
        const connection = createConnectionLine(parentPos, childPos);
        connections.push(connection);
        
        if (hasChildren) {
          // Create branch
          const branchLength = 20;
          const branchRadius = 2;
          const branch = createBranchGeometry(branchLength, branchRadius);
          
          // Position and orient branch
          const direction = new THREE.Vector3(
            childPos.x - parentPos.x,
            childPos.y - parentPos.y,
            childPos.z - parentPos.z
          ).normalize();
          
          branch.position.set(
            parentPos.x + direction.x * 10,
            parentPos.y + direction.y * 10,
            parentPos.z + direction.z * 10
          );
          
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
          branch.setRotationFromQuaternion(quaternion);
          
          branches.push(branch);
        } else {
          // Create single leaf sphere
          const leaf = createLeafSphere(12);
          leaf.position.set(childPos.x, childPos.y, childPos.z);
          leaves.push(leaf);
        }

        if (hasChildren) {
          positionChildren(childNode, childPos, depth + 1);
        }
      });
    };

    if (tree.root) {
      positionChildren(tree.root, tree.position);
    }

    return {
      trunk: trunk[0] || new THREE.Mesh(),
      branches,
      leaves,
      connections
    };
  };

  // Create Three.js mesh for node selection
  const createNodeMesh = (position: TreePosition, nodeId: string, nodeType: string): THREE.Mesh => {
    // Validate position to prevent NaN values
    const safePosition = {
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0,
      z: Number.isFinite(position.z) ? position.z : 0
    };

    if (safePosition.x !== position.x || safePosition.y !== position.y || safePosition.z !== position.z) {
      console.error('Invalid position detected in createNodeMesh:', position, 'using fallback:', safePosition);
    }

    // Create a small sphere to represent the node for selection
    const geometry = new THREE.SphereGeometry(3, 8, 6);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.0 // Invisible but clickable
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(safePosition.x, safePosition.y, safePosition.z);
    
    // Store metadata
    mesh.userData = { nodeId, nodeType, originalColor: '#ffffff' };
    
    return mesh;
  };

  // Memoized tree geometries
  const treeGeometriesData = useMemo(() => {
    const geometries = new Map<string, TreeGeometry>();
    trees.forEach((tree, treeIndex) => {
      try {
        const treeGeometry = generateTreeGeometry(tree, treeIndex);
        geometries.set(tree.id || `tree_${treeIndex}`, treeGeometry);
      } catch (error) {
        console.error('Error generating tree geometry:', error);
      }
    });
    return geometries;
  }, [trees]);

  // Memoized node positions for selection
  const nodePositions = useMemo(() => {
    const positions: TreeVisualNode[] = [];
    trees.forEach((tree, treeIndex) => {
      try {
        const treeGeometry = treeGeometriesData.get(tree.id || `tree_${treeIndex}`);
        if (treeGeometry) {
          // Add trunk position
          if (tree.root) {
            positions.push({
              id: `trunk_${tree.root.id}`,
              position: tree.position,
              type: 'trunk',
              unicode: '',
              nodeId: tree.root.id
            });
          }
          
          // Add branch positions
          treeGeometry.branches.forEach((branch, index) => {
            positions.push({
              id: `branch_${treeIndex}_${index}`,
              position: {
                x: branch.position.x,
                y: branch.position.y,
                z: branch.position.z
              },
              type: 'branch',
              unicode: '',
              nodeId: `branch_${treeIndex}_${index}`
            });
          });
        }
      } catch (error) {
        console.error('Error generating node positions:', error);
      }
    });
    return positions;
  }, [trees, treeGeometriesData]);

  // Memoized path data
  const pathData = useMemo(() => {
    if (!selectedNode) {
      return { pathFromRoot: [], pathNodeIds: new Set<string>() };
    }
    
    const pathFromRoot = getPathFromRoot(selectedNode.id);
    const pathNodeIds = new Set(pathFromRoot.map(node => node.id));
    
    return { pathFromRoot, pathNodeIds };
  }, [selectedNode, getPathFromRoot]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // transparent background
    sceneRef.current = scene;

    // Add lighting optimized for ASCII effect
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
    
    // Add a second light for better contrast
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-50, 50, -50);
    scene.add(fillLight);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(0, 0, 200);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // transparent
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Create ASCII effect with leading spaces and transparent background
    const asciiEffect = new AsciiEffect(renderer, '     .:-+*=%@#', { 
      invert: false, // Map background to spaces
      resolution: 0.15, // Standard resolution for better space handling
      scale: 1,
      color: true
    });
    asciiEffect.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    asciiEffect.domElement.style.backgroundColor = 'transparent';
    asciiEffect.domElement.style.fontFamily = 'Courier New, monospace';
    asciiEffect.domElement.style.fontSize = '6px';
    asciiEffect.domElement.style.lineHeight = '6px';
    asciiEffect.domElement.style.letterSpacing = '0px';
    asciiEffect.domElement.style.cursor = 'default';
    asciiEffect.domElement.style.overflow = 'hidden';
    asciiEffect.domElement.style.userSelect = 'none';
    (asciiEffect.domElement.style as any).webkitUserSelect = 'none';
    
    // Only append ASCII effect if enabled
    if (useAsciiEffect) {
      containerRef.current.appendChild(asciiEffect.domElement);
      setEffect(asciiEffect);
    } else {
      // Append regular renderer for normal 3D rendering
      containerRef.current.appendChild(renderer.domElement);
      setEffect(null);
    }

    // Raycaster for mouse picking
    raycasterRef.current = new THREE.Raycaster();
    mouseRef.current = new THREE.Vector2();

    // Create selection radius indicator
    const indicatorGeometry = new THREE.RingGeometry(1.8, 2, 16);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x8b4513,
      transparent: true, 
      opacity: 1,
      side: THREE.DoubleSide
    });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.z = 100;
    indicator.visible = false;
    scene.add(indicator);
    setSelectionIndicator(indicator);

    // Handle resize (both window and container)
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Update camera aspect ratio
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      // Update renderer size
      rendererRef.current.setSize(width, height, false);
      
      // Update effect size if ASCII effect is enabled
      if (effect) {
        effect.setSize(width, height);
      }
      
      console.log('GardenVisualizer resized:', { width, height, aspect: width / height });
    };
    
    // Listen to window resize
    window.addEventListener('resize', handleResize);
    
    // Listen to container size changes (for fullscreen mode)
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (containerRef.current && effect) {
        containerRef.current.removeChild(effect.domElement);
      } else if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      // Clean up mesh lines
      meshLines.forEach(line => {
        if (line.geometry) {
          line.geometry.dispose();
        }
        if (line.material) {
          if (Array.isArray(line.material)) {
            line.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            (line.material as THREE.Material).dispose();
          }
        }
      });
      
      // Clean up tree geometries
      treeGeometries.forEach((treeGeometry, treeId) => {
        if (treeGeometry.trunk.geometry) treeGeometry.trunk.geometry.dispose();
        if (treeGeometry.trunk.material) (treeGeometry.trunk.material as THREE.Material).dispose();
        
        treeGeometry.branches.forEach(branch => {
          if (branch.geometry) branch.geometry.dispose();
          if (branch.material) (branch.material as THREE.Material).dispose();
        });
        
        treeGeometry.leaves.forEach(leaf => {
          if (leaf.geometry) leaf.geometry.dispose();
          if (leaf.material) (leaf.material as THREE.Material).dispose();
        });
        
        treeGeometry.connections.forEach(connection => {
          if (connection.geometry) connection.geometry.dispose();
          if (connection.material) (connection.material as THREE.Material).dispose();
        });
      });
    };
  }, []);

  // Handle 3D axis helper separately
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing axis helper if it exists
    if (axisHelper) {
      sceneRef.current.remove(axisHelper);
      setAxisHelper(undefined);
    }

    // Add new axis helper if showAxis is true
    if (showAxis) {
      const axes = new THREE.AxesHelper(100);
      sceneRef.current.add(axes);
      setAxisHelper(axes);
    }
  }, [showAxis]);

  // Update Three.js objects when tree geometries change
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing tree geometries
    treeGeometries.forEach((treeGeometry, treeId) => {
      sceneRef.current!.remove(treeGeometry.trunk);
      treeGeometry.branches.forEach(branch => sceneRef.current!.remove(branch));
      treeGeometry.leaves.forEach(leaf => sceneRef.current!.remove(leaf));
      treeGeometry.connections.forEach(connection => sceneRef.current!.remove(connection));
    });

    // Clear existing selection nodes
    threeNodes.forEach(node => {
      sceneRef.current!.remove(node.mesh);
    });

    // Add new tree geometries
    const newTreeGeometries = new Map<string, TreeGeometry>();
    treeGeometriesData.forEach((treeGeometry, treeId) => {
      // Add trunk
      sceneRef.current!.add(treeGeometry.trunk);
      
      // Add branches
      treeGeometry.branches.forEach(branch => {
        sceneRef.current!.add(branch);
      });
      
      // Add leaves
      treeGeometry.leaves.forEach(leaf => {
        sceneRef.current!.add(leaf);
      });
      
      // Add connections
      treeGeometry.connections.forEach(connection => {
        sceneRef.current!.add(connection);
      });
      
      newTreeGeometries.set(treeId, treeGeometry);
    });

    // Create new selection nodes
    const newNodes: ThreeNode[] = [];
    nodePositions.forEach(node => {
      const mesh = createNodeMesh(node.position, node.nodeId, node.type);
      sceneRef.current!.add(mesh);
      newNodes.push({
        id: node.id,
        mesh,
        nodeId: node.nodeId,
        type: node.type,
        position: node.position
      });
    });

    setTreeGeometries(newTreeGeometries);
    setThreeNodes(newNodes);
  }, [treeGeometriesData, nodePositions]);

  // Update Delaunay mesh
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing mesh lines and properly dispose of resources
    meshLines.forEach(line => {
      sceneRef.current!.remove(line);
      // Dispose of geometry and material to prevent memory leaks
      if (line.geometry) {
        line.geometry.dispose();
      }
      if (line.material) {
        if (Array.isArray(line.material)) {
          line.material.forEach((mat: THREE.Material) => mat.dispose());
        } else {
          (line.material as THREE.Material).dispose();
        }
      }
    });

    // If showMeshGrid is false, just clear the lines and return
    if (!showMeshGrid) {
      console.log('Mesh grid disabled, clearing lines');
      setMeshLines([]);
      return;
    }

    if (trees.length < 3) {
      setMeshLines([]);
      return;
    }

    try {
      // Validate tree positions before using them
      const validTrees = trees.filter(tree => {
        const pos = tree.position;
        return pos && 
               typeof pos.x === 'number' && !isNaN(pos.x) &&
               typeof pos.y === 'number' && !isNaN(pos.y) &&
               typeof pos.z === 'number' && !isNaN(pos.z);
      });

      if (validTrees.length < 3) {
        setMeshLines([]);
        return;
      }

      // Use X,Z coordinates for 2D Delaunay triangulation, but keep 3D positions for actual mesh
      const rootPoints2D = validTrees.map(tree => [tree.position.x, tree.position.z]);
      const rootPoints3D = validTrees.map(tree => tree.position);
      
      const delaunay = Delaunator.from(rootPoints2D);
      const { triangles } = delaunay;

      const lines: THREE.LineSegments[] = [];
      const material = new THREE.LineBasicMaterial({ color: 0x444444 });

      for (let i = 0; i < triangles.length; i += 3) {
        const aIndex = triangles[i];
        const bIndex = triangles[i + 1];
        const cIndex = triangles[i + 2];

        const a = rootPoints3D[aIndex];
        const b = rootPoints3D[bIndex];
        const c = rootPoints3D[cIndex];

        if (a && b && c) {
          // Double-check positions are valid numbers
          const positions = [
            a.x, a.y, a.z,  // First triangle edge: A to B
            b.x, b.y, b.z,
            b.x, b.y, b.z,  // Second triangle edge: B to C
            c.x, c.y, c.z,
            c.x, c.y, c.z,  // Third triangle edge: C to A
            a.x, a.y, a.z
          ];

          // Validate all positions are finite numbers
          const allFinite = positions.every(pos => Number.isFinite(pos));
          if (!allFinite) {
            console.error('Non-finite positions detected:', positions);
            continue;
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
          
          const line = new THREE.LineSegments(geometry, material);
          sceneRef.current!.add(line);
          lines.push(line);
        }
      }

      setMeshLines(lines);
    } catch (error) {
      console.error('Error creating Delaunay mesh:', error);
      setMeshLines([]);
    }
  }, [trees, showMeshGrid]);

  // Update camera position from store
  useEffect(() => {
    if (!cameraRef.current) return;

    const cam = cameraRef.current;
    
    // Convert store camera to Three.js camera
    cam.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z
    );
    
    // Apply zoom - rebased so zoom level 2 becomes zoom level 1
    const calculatedFov = 75 / (camera.zoom * 2);
    cam.fov = Math.max(1, Math.min(179, calculatedFov));
    cam.updateProjectionMatrix();
    
    // Apply rotation (simplified - Three.js handles this differently)
    cam.rotation.set(camera.rotation.x, camera.rotation.y, 0);
  }, [camera]);

  // Update tree colors based on selection and generation state
  const updateTreeColors = (currentAnimationTime?: number) => {
    if (!treeGeometries.size) return;

    const timeToUse = currentAnimationTime !== undefined ? currentAnimationTime : animationTime;

    // Calculate which node should be preview highlighted (yellow)
    let previewNodeId: string | null = null;
    if (selectedTree && currentDepth >= 0 && selectedOptions.length > currentDepth) {
      const currentPath = getPathFromRoot(selectedNode?.id || '');
      if (currentPath.length > currentDepth) {
        const currentNodeAtDepth = currentPath[currentDepth];
        if (currentNodeAtDepth && currentNodeAtDepth.continuations) {
          const selectedOptionIndex = selectedOptions[currentDepth];
          if (selectedOptionIndex >= 0 && selectedOptionIndex < currentNodeAtDepth.continuations.length) {
            previewNodeId = currentNodeAtDepth.continuations[selectedOptionIndex].id;
          }
        }
      }
    }

    treeGeometries.forEach((treeGeometry, treeId) => {
      // Update trunk color
      const trunkMaterial = treeGeometry.trunk.material as THREE.MeshLambertMaterial;
      if (selectedNode && selectedNode.id === treeId) {
        if (isGenerating && pathData.pathNodeIds.has(treeId)) {
          // Animated blue for selected tree during generation
          const frequency = 2.0;
          const intensity = Math.sin(timeToUse * frequency * Math.PI) * 0.5 + 0.5;
          const baseBlue = 100 + intensity * 155;
          const red = Math.round(intensity * 50);
          const green = Math.round(intensity * 100);
          const blue = Math.round(baseBlue);
          trunkMaterial.color.setRGB(red / 255, green / 255, blue / 255);
        } else {
          trunkMaterial.color.setRGB(0, 1, 0); // Green for selected
        }
      } else if (pathData.pathNodeIds.has(treeId)) {
        const pathIndex = pathData.pathFromRoot.findIndex(n => n.id === treeId);
        const totalPathLength = pathData.pathFromRoot.length;
        
        if (pathIndex >= 0) {
          if (isGenerating) {
            // Animated blue for path trees during generation
            const frequency = 2.0;
            const phaseOffset = pathIndex * 0.3;
            const intensity = Math.sin((timeToUse + phaseOffset) * frequency * Math.PI) * 0.5 + 0.5;
            const baseBlue = 100 + intensity * 155;
            const red = Math.round(intensity * 50);
            const green = Math.round(intensity * 100);
            const blue = Math.round(baseBlue);
            trunkMaterial.color.setRGB(red / 255, green / 255, blue / 255);
          } else {
            // Brown to green gradient for path
            const ratio = (totalPathLength - 1 - pathIndex) / (totalPathLength - 1);
            const baseGreen = 100 + ratio * 155;
            const red = Math.round(139 * (1 - ratio * 0.6));
            const green = Math.round(baseGreen);
            const blue = Math.round(69 * (1 - ratio * 0.7));
            trunkMaterial.color.setRGB(red / 255, green / 255, blue / 255);
          }
        }
      } else {
        trunkMaterial.color.setRGB(0.545, 0.271, 0.075); // Default brown
      }

      // Update connection colors
      treeGeometry.connections.forEach(connection => {
        const connectionMaterial = connection.material as THREE.MeshLambertMaterial;
        if (isGenerating) {
          // Animated connection during generation
          const frequency = 1.5;
          const intensity = Math.sin(timeToUse * frequency * Math.PI) * 0.5 + 0.5;
          connectionMaterial.opacity = 0.3 + intensity * 0.4;
        } else {
          connectionMaterial.opacity = 0.6;
        }
      });
    });
  };

  // Update static colors when selection changes (non-animated)
  useEffect(() => {
    if (!isGenerating) {
      updateTreeColors();
    }
  }, [treeGeometries, selectedNode, pathData, isGenerating, currentDepth, selectedOptions]);

  // Log selected node changes in visualizer
  useEffect(() => {
    console.log('👁️ Garden Visualizer: Selected node changed:', {
      selectedNodeId: selectedNode?.id,
      selectedNodeText: selectedNode?.text?.slice(0, 50),
      pathLength: pathData.pathFromRoot.length,
      pathNodeIds: pathData.pathFromRoot.map(n => n.id)
    });
  }, [selectedNode, pathData]);

  // Main animation loop - always running
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const animate = (currentTime: number) => {
      frameRef.current = requestAnimationFrame(animate);
      
      // Update tree colors during generation
      if (isGenerating) {
        updateTreeColors(currentTime / 1000);
      }
      
      // Update selection indicator color with green-brown cycling animation (always active)
      if (selectionIndicator && selectionIndicator.visible) {
        const frequency = 1.5;
        const timeInSeconds = currentTime / 1000;
        const intensity = Math.sin(timeInSeconds * frequency * Math.PI) * 0.5 + 0.5;
        
        // Green to brown color transition (similar to path nodes)
        const red = Math.round(139 * (1 - intensity * 0.6) + intensity * 50);
        const green = Math.round(100 + intensity * 155);
        const blue = Math.round(69 * (1 - intensity * 0.7));
        
        const material = selectionIndicator.material as THREE.MeshBasicMaterial;
        material.color.setRGB(red / 255, green / 255, blue / 255);
      }
      
      // Use ASCII effect or regular renderer for rendering
      if (effect && sceneRef.current && cameraRef.current) {
        effect.render(sceneRef.current, cameraRef.current);
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate(performance.now());

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [treeGeometries, selectionIndicator, isGenerating, effect]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDown(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    
    // Set drag mode based on key
    if (e.shiftKey) {
      setDragMode('pan');
    } else {
      setDragMode('orbit');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    
      // Update selection indicator position
  if (containerRef.current && selectionIndicator && cameraRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Use raycaster to find the correct world position at the same Z plane as the tree meshes
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    
    // Find the average Z position of tree meshes to position indicator correctly
    let averageZ = 0;
    if (treeGeometries.size > 0) {
      let totalZ = 0;
      let count = 0;
      treeGeometries.forEach((treeGeometry) => {
        totalZ += treeGeometry.trunk.position.z;
        count++;
      });
      averageZ = count > 0 ? totalZ / count : 0;
    }
    
    // Calculate where the ray intersects the plane at the tree mesh Z level
    const t = (averageZ - raycaster.ray.origin.z) / raycaster.ray.direction.z;
    const worldPos = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
    
    selectionIndicator.position.copy(worldPos);
    selectionIndicator.lookAt(cameraRef.current.position);
    
    // Scale based on click threshold and distance to camera
    const clickThreshold = 0.2; // Match the threshold from handleClick
    const distance = cameraRef.current.position.distanceTo(worldPos);
    const scale = clickThreshold * distance * 0.02; // Adjust scaling factor
    selectionIndicator.scale.set(scale, scale, scale);
    
    selectionIndicator.visible = true;
    setShowCustomCursor(true);
  }
    
    if (isMouseDown) {
      setIsDragging(true);
    }

    if (isDragging) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      if (dragMode === 'orbit') {
        useGardenStore.getState().orbitCamera(deltaX, deltaY);
      } else {
        useGardenStore.getState().panCamera(deltaX, deltaY);
      }
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    // Small delay to prevent click from firing immediately after drag
    setTimeout(() => setIsDragging(false), 10);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
    setIsDragging(false);
    // Hide selection indicator when mouse leaves canvas
    if (selectionIndicator) {
      selectionIndicator.visible = false;
    }
    setShowCustomCursor(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    useGardenStore.getState().zoomCamera(e.deltaY);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !raycasterRef.current || !mouseRef.current) {
      return;
    }
    if (isDragging) {
      return; // Don't handle click if we were dragging
    }

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = mouseRef.current;
    
    // Convert mouse coordinates to normalized device coordinates (-1 to +1)
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    
    // Get all tree trunk objects for intersection testing
    const trunkObjects: THREE.Mesh[] = [];
    treeGeometries.forEach((treeGeometry) => {
      if (treeGeometry.trunk && treeGeometry.trunk.visible) {
        trunkObjects.push(treeGeometry.trunk);
      }
    });
    
    if (trunkObjects.length === 0) {
      return;
    }

    // Use screen-space selection method
    let closestMesh: THREE.Mesh | null = null;
    let closestDistance = Infinity;
    const clickThreshold = 0.2;
    
    trunkObjects.forEach((mesh) => {
      // Project 3D position to screen coordinates
      const meshScreenPos = mesh.position.clone();
      meshScreenPos.project(cameraRef.current!);
      
      // Calculate 2D distance from mouse click to projected mesh position
      const screenDistance = Math.sqrt(
        Math.pow(meshScreenPos.x - mouse.x, 2) + 
        Math.pow(meshScreenPos.y - mouse.y, 2)
      );
      
      // Find the closest mesh within threshold
      if (screenDistance < clickThreshold && screenDistance < closestDistance) {
        closestDistance = screenDistance;
        closestMesh = mesh;
      }
    });
    
    if (closestMesh) {
      // Find the tree ID based on the trunk mesh
      let selectedTreeId: string | null = null;
      treeGeometries.forEach((treeGeometry, treeId) => {
        if (treeGeometry.trunk === closestMesh) {
          selectedTreeId = treeId;
        }
      });
      
      if (selectedTreeId) {
        useGardenStore.getState().selectNode(selectedTreeId);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="garden-visualizer"
      style={{ 
        width: '100%', 
        height: '100%',
        cursor: showCustomCursor ? 'none' : (isDragging ? 'grabbing' : 'grab'),
        overflow: 'hidden'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onClick={handleClick}
    />
  );
};

export default GardenVisualizer; 