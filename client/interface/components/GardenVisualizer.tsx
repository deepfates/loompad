import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import Delaunator from 'delaunator';
import { useGardenStore } from '../stores/gardenStore';
import type { TreeVisualNode, TreePosition } from '../types/garden';
import type { StoryNode } from '../types';

interface GardenVisualizerProps {
  showMeshGrid?: boolean;
  showAxis?: boolean;
  currentDepth?: number;
  selectedOptions?: number[];
}

interface ThreeNode {
  id: string;
  mesh: THREE.Mesh;
  nodeId: string;
  type: string;
  position: TreePosition;
}

const GardenVisualizer: React.FC<GardenVisualizerProps> = ({ 
  showMeshGrid = true, 
  showAxis = false,
  currentDepth = 0,
  selectedOptions = []
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

  // ASCII mappings for tree parts
  const asciiMap = {
    trunk: ['@', '#', '|', '+'],
    branch: ['&', '*', '/', '\\'],
    leaf: ['*', 'o', '~', '^'],
    root: ['~', 'v', '>', '<'],
    connection: ['|', '/', '\\', '-', '_']
  };

  // Generate visual tree nodes
  const generateVisualTree = (tree: any, treeIndex: number): TreeVisualNode[] => {
    const visualNodes: TreeVisualNode[] = [];
    const nodePositions = new Map<string, TreePosition>();
    const processedNodes = new Set<string>();
    
    if (tree.root) {
      const rootNode = tree.root;
      const rootPos = tree.position;
      nodePositions.set(rootNode.id, rootPos);
      processedNodes.add(rootNode.id);
      
      const isSeedling = !rootNode.continuations || rootNode.continuations.length === 0;
      
      if (isSeedling) {
        visualNodes.push({
          id: `seedling_${rootNode.id}`,
          position: rootPos,
          type: 'root',
          unicode: '•',
          nodeId: rootNode.id
        });
      } else {
        const rootChar = asciiMap.trunk[0];
        const rootLength = 5;
        const rootSpacing = 10;
        for (let y = 0; y < rootLength; y++) {
          visualNodes.push({
            id: `root_${rootNode.id}_${y}`,
            position: {
              x: rootPos.x,
              y: rootPos.y - y * rootSpacing,
              z: rootPos.z
            },
            type: 'trunk',
            unicode: rootChar,
            nodeId: rootNode.id
          });
        }
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
        
        const pathNodes = createNodeCharacterPath(parentPos, childPos, depth, index, hasChildren, childNode.id);
        visualNodes.push(...pathNodes);
        
        if (hasChildren) {
          visualNodes.push({
            id: `visual_${childNode.id}`,
            position: childPos,
            type: 'branch',
            unicode: asciiMap.branch[index % asciiMap.branch.length],
            nodeId: childNode.id
          });
        } else {
          const leafChar = asciiMap.leaf[index % asciiMap.leaf.length];
          const gridOffset = 8;
          for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
              for (let z = 0; z <= 1; z++) {
                visualNodes.push({
                  id: `leaf_${childNode.id}_${x}_${y}_${z}`,
                  position: {
                    x: childPos.x + x * gridOffset,
                    y: childPos.y + y * gridOffset,
                    z: childPos.z + z * gridOffset
                  },
                  type: 'leaf',
                  unicode: leafChar,
                  nodeId: childNode.id
                });
              }
            }
          }
        }

        if (hasChildren) {
          positionChildren(childNode, childPos, depth + 1);
        }
      });
    };

    if (tree.root) {
      positionChildren(tree.root, tree.position);
    }

    return visualNodes;
  };

  // Create character path between nodes
  const createNodeCharacterPath = (
    startPos: TreePosition,
    endPos: TreePosition,
    depth: number,
    index: number,
    hasChildren: boolean,
    nodeId: string
  ): TreeVisualNode[] => {
    const pathNodes: TreeVisualNode[] = [];
    const distance = Math.sqrt(
      Math.pow(endPos.x - startPos.x, 2) + 
      Math.pow(endPos.y - startPos.y, 2) + 
      Math.pow(endPos.z - startPos.z, 2)
    );
    
    const steps = Math.max(3, Math.floor(distance / 15));
    const connectionChars = asciiMap.connection;
    
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const position: TreePosition = {
        x: startPos.x + (endPos.x - startPos.x) * t,
        y: startPos.y + (endPos.y - startPos.y) * t,
        z: startPos.z + (endPos.z - startPos.z) * t
      };
      
      const charIndex = (depth + index + i) % connectionChars.length;
      pathNodes.push({
        id: `path_${nodeId}_${i}`,
        position,
        type: 'connection',
        unicode: connectionChars[charIndex],
        nodeId
      });
    }
    
    return pathNodes;
  };

  // Create Three.js text mesh
  const createTextMesh = (text: string, position: TreePosition, nodeId: string, nodeType: string): THREE.Mesh => {
    // Validate position to prevent NaN values
    const safePosition = {
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0,
      z: Number.isFinite(position.z) ? position.z : 0
    };

    if (safePosition.x !== position.x || safePosition.y !== position.y || safePosition.z !== position.z) {
      console.error('Invalid position detected in createTextMesh:', position, 'using fallback:', safePosition);
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const fontSize = 48;
    canvas.width = fontSize * 2;
    canvas.height = fontSize * 2;
    
    context.font = `${fontSize}px "Courier New", monospace`;
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, fontSize, fontSize);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create a plane geometry for the text
    const geometry = new THREE.PlaneGeometry(10, 10);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(safePosition.x, safePosition.y, safePosition.z);
    
    // CRITICAL: Compute bounding volumes for raycasting to work
    try {
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
    } catch (error) {
      console.error('Error computing bounding volumes:', error);
      // Fallback: manually set bounding sphere
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5);
    }
    
    // Store metadata
    mesh.userData = { nodeId, nodeType, originalColor: '#ffffff' };
    
    return mesh;
  };

  // Memoized visual nodes
  const visualNodes = useMemo(() => {
    const allNodes: TreeVisualNode[] = [];
    trees.forEach((tree, treeIndex) => {
      try {
        const treeNodes = generateVisualTree(tree, treeIndex);
        allNodes.push(...treeNodes);
      } catch (error) {
        console.error('Error generating visual tree:', error);
      }
    });
    return allNodes;
  }, [trees]);

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
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

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
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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
      if (containerRef.current && renderer.domElement) {
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

  // Update Three.js objects when visual nodes change
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing nodes
    threeNodes.forEach(node => {
      sceneRef.current!.remove(node.mesh);
    });

    // Create new nodes
    const newNodes: ThreeNode[] = [];
    
    visualNodes.forEach(node => {
      const mesh = createTextMesh(node.unicode, node.position, node.nodeId, node.type);
      sceneRef.current!.add(mesh);
      newNodes.push({
        id: node.id,
        mesh,
        nodeId: node.nodeId,
        type: node.type,
        position: node.position
      });
    });

    setThreeNodes(newNodes);
  }, [visualNodes]);

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

  // Update node colors - moved to render loop for better performance
  const updateNodeColors = (currentAnimationTime?: number) => {
    if (!threeNodes.length) return;

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
            console.log('🎯 Preview highlighting:', {
              currentDepth,
              selectedOptionIndex,
              previewNodeId,
              currentNodeAtDepth: currentNodeAtDepth.id,
              continuationsCount: currentNodeAtDepth.continuations.length
            });
          }
        }
      }
    }

    threeNodes.forEach(node => {
      const material = (node.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      
      // Set color based on selection, path, and preview
      if (selectedNode && selectedNode.id === node.nodeId) {
        if (isGenerating && pathData.pathNodeIds.has(node.nodeId)) {
          // Smooth animated blue for selected node during generation
          const frequency = 2.0;
          const intensity = Math.sin(timeToUse * frequency * Math.PI) * 0.5 + 0.5;
          const baseBlue = 100 + intensity * 155;
          const red = Math.round(intensity * 50);
          const green = Math.round(intensity * 100);
          const blue = Math.round(baseBlue);
          material.color.setRGB(red / 255, green / 255, blue / 255);
        } else {
          material.color.setRGB(0, 1, 0); // Green for selected
        }
      } else if (previewNodeId && previewNodeId === node.nodeId) {
        // Yellow for preview selected node (D-pad left/right target)
        material.color.setRGB(1, 1, 0); // Yellow
      } else if (pathData.pathNodeIds.has(node.nodeId)) {
        const pathIndex = pathData.pathFromRoot.findIndex(n => n.id === node.nodeId);
        const totalPathLength = pathData.pathFromRoot.length;
        
        if (pathIndex >= 0) {
          if (isGenerating) {
            // Smooth animated blue for path nodes during generation with phase offset
            const frequency = 2.0;
            const phaseOffset = pathIndex * 0.3;
            const intensity = Math.sin((timeToUse + phaseOffset) * frequency * Math.PI) * 0.5 + 0.5;
            const baseBlue = 100 + intensity * 155;
            const red = Math.round(intensity * 50);
            const green = Math.round(intensity * 100);
            const blue = Math.round(baseBlue);
            material.color.setRGB(red / 255, green / 255, blue / 255);
          } else {
            // Brown to green gradient for path
            const ratio = (totalPathLength - 1 - pathIndex) / (totalPathLength - 1);
            const baseGreen = 100 + ratio * 155;
            const red = Math.round(139 * (1 - ratio * 0.6));
            const green = Math.round(baseGreen);
            const blue = Math.round(69 * (1 - ratio * 0.7));
            material.color.setRGB(red / 255, green / 255, blue / 255);
          }
        }
      } else {
        material.color.setRGB(1, 1, 1); // White for normal nodes
      }
    });
  };

  // Update static colors when selection changes (non-animated)
  useEffect(() => {
    if (!isGenerating) {
      updateNodeColors();
    }
  }, [threeNodes, selectedNode, pathData, isGenerating, currentDepth, selectedOptions]);

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
      
      // Make sure all text meshes face the camera
      if (cameraRef.current && threeNodes.length > 0) {
        threeNodes.forEach((node) => {
          node.mesh.lookAt(cameraRef.current!.position);
        });
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
      
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
    };

    animate(performance.now());

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [threeNodes, selectionIndicator]);

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
      
      // Use raycaster to find the correct world position at the same Z plane as the text meshes
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      
      // Find the average Z position of text meshes to position indicator correctly
      let averageZ = 0;
      if (threeNodes.length > 0) {
        averageZ = threeNodes.reduce((sum, node) => sum + node.mesh.position.z, 0) / threeNodes.length;
      }
      
      // Calculate where the ray intersects the plane at the text mesh Z level
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
    
    // Get all mesh objects for intersection testing
    const meshObjects = threeNodes.map(node => node.mesh).filter(mesh => mesh && mesh.visible);
    
    if (meshObjects.length === 0) {
      return;
    }

    // Use screen-space selection method
    let closestMesh: THREE.Mesh | null = null;
    let closestDistance = Infinity;
    const clickThreshold = 0.2;
    
    meshObjects.forEach((mesh) => {
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
      const nodeId = (closestMesh as any).userData.nodeId;
      
      if (nodeId) {
        useGardenStore.getState().selectNode(nodeId);
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