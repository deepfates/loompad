import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { StoryNode } from '../types';

interface TreeVisualizerThreeProps {
  storyTree: { root: StoryNode };
  currentDepth: number;
  selectedOptions: number[];
  getCurrentPath: () => StoryNode[];
}

interface TreeBranch {
  node: StoryNode;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  depth: number;
  isInPath: boolean;
  isCurrent: boolean;
  angle: number;
  length: number;
  parentBranch?: TreeBranch;
  childBranches: TreeBranch[];
  mesh?: THREE.Mesh;
  nodeMesh?: THREE.Mesh;
}

const TreeVisualizerThree: React.FC<TreeVisualizerThreeProps> = ({
  storyTree,
  currentDepth,
  selectedOptions,
  getCurrentPath
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const animationFrameRef = useRef<number>();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const treeBranches = useRef<TreeBranch[]>([]);
  const allMeshes = useRef<THREE.Mesh[]>([]);
  const mouseState = useRef({
    isRotating: false,
    lastMouseX: 0,
    lastMouseY: 0,
    rotation: { x: 0, y: 0 },
    zoom: 8
  });

  const generateTreeBranches = useCallback((
    node: StoryNode,
    depth: number = 0,
    parentBranch?: TreeBranch,
    childIndex: number = 0,
    siblingCount: number = 1,
    seed: number = 0
  ): TreeBranch => {
    // Use node ID as seed for consistent positioning
    const nodeSeed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
    const seededRandom = (salt: number = 0) => {
      const x = Math.sin(nodeSeed + salt) * 10000;
      return x - Math.floor(x);
    };

    // Calculate branch parameters (structure doesn't change)
    const baseRadius = Math.max(0.05, 0.3 - depth * 0.04);
    const baseLength = Math.max(0.8, 2.5 - depth * 0.3);
    
    let startPos: THREE.Vector3;
    let direction: THREE.Vector3;
    let angle: number;
    
    if (depth === 0) {
      // Root trunk
      startPos = new THREE.Vector3(0, 0, 0);
      direction = new THREE.Vector3(0, 1, 0);
      angle = 0;
    } else if (parentBranch) {
      // Child branch - use deterministic positioning
      const parentLength = parentBranch.length;
      const branchPoint = 0.3 + (seededRandom(1) * 0.4); // Deterministic point along parent branch
      startPos = parentBranch.startPos.clone().add(
        parentBranch.direction.clone().multiplyScalar(parentLength * branchPoint)
      );
      
      // Calculate branch angle - deterministic
      const baseAngle = Math.PI * 0.3; // 54 degrees from vertical
      const angleVariation = (seededRandom(2) - 0.5) * 0.5;
      angle = baseAngle + angleVariation;
      
      // Distribute branches around the parent in a spiral pattern
      const radialAngle = (childIndex / siblingCount) * Math.PI * 2 + depth * 0.5;
      
      // Create direction vector
      const upComponent = Math.cos(angle);
      const outComponent = Math.sin(angle);
      
      direction = new THREE.Vector3(
        Math.cos(radialAngle) * outComponent,
        upComponent,
        Math.sin(radialAngle) * outComponent
      ).normalize();
    } else {
      startPos = new THREE.Vector3(0, 0, 0);
      direction = new THREE.Vector3(0, 1, 0);
      angle = 0;
    }
    
    const length = baseLength * (0.7 + seededRandom(3) * 0.3);
    const radius = baseRadius * (0.8 + seededRandom(4) * 0.2);
    const endPos = startPos.clone().add(direction.clone().multiplyScalar(length));
    
    const branch: TreeBranch = {
      node,
      startPos,
      endPos,
      direction,
      radius,
      depth,
      isInPath: false, // Will be updated separately
      isCurrent: false, // Will be updated separately
      angle,
      length,
      parentBranch,
      childBranches: []
    };

    // Generate child branches
    if (node.continuations && node.continuations.length > 0) {
      node.continuations.forEach((child, index) => {
        const childBranch = generateTreeBranches(
          child,
          depth + 1,
          branch,
          index,
          node.continuations!.length,
          nodeSeed
        );
        branch.childBranches.push(childBranch);
      });
    }

    return branch;
  }, []);

  const createBranchMesh = useCallback((branch: TreeBranch) => {
    const direction = branch.direction.clone();
    const length = branch.length;
    
    // Create tapered cylinder geometry
    const topRadius = branch.radius * 0.6; // Taper the branch
    const bottomRadius = branch.radius;
    const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 8);
    
    // Branch material
    const material = new THREE.MeshLambertMaterial({
      color: branch.isInPath ? 0x4a7c59 : 0x8b4513, // Green for path, brown for regular
      transparent: true,
      opacity: branch.isInPath ? 0.9 : 0.7
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the branch
    const midpoint = branch.startPos.clone().add(direction.clone().multiplyScalar(length / 2));
    mesh.position.copy(midpoint);
    
    // Orient the branch
    mesh.lookAt(branch.endPos);
    mesh.rotateX(Math.PI / 2);
    
    return mesh;
  }, []);

  const createNodeMesh = useCallback((branch: TreeBranch) => {
    const geometry = new THREE.SphereGeometry(0.12, 8, 8);
    
    let material: THREE.Material;
    
    if (branch.isCurrent) {
      material = new THREE.MeshBasicMaterial({
        color: 0x58a6ff
      });
    } else if (branch.isInPath) {
      material = new THREE.MeshBasicMaterial({
        color: 0x58a6ff,
        opacity: 0.8,
        transparent: true
      });
    } else {
      material = new THREE.MeshBasicMaterial({
        color: 0x90EE90, // Light green for leaves
        opacity: 0.6,
        transparent: true
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(branch.endPos);
    
    return mesh;
  }, []);

  const collectAllBranches = useCallback((branch: TreeBranch): TreeBranch[] => {
    const branches = [branch];
    branch.childBranches.forEach(child => {
      branches.push(...collectAllBranches(child));
    });
    return branches;
  }, []);


  const treeStructureHash = useRef<string>('');
  
  const getTreeStructureHash = useCallback((node: StoryNode): string => {
    const nodeHash = node.id + (node.continuations ? node.continuations.map(child => getTreeStructureHash(child)).join('') : '');
    return nodeHash;
  }, []);

  const initializeTree = useCallback(() => {
    if (!sceneRef.current) return;
    
    // Check if tree structure has changed
    const currentHash = getTreeStructureHash(storyTree.root);
    if (currentHash === treeStructureHash.current && treeBranches.current.length > 0) {
      return; // Tree structure hasn't changed
    }
    
    // Clear existing tree
    allMeshes.current.forEach(mesh => {
      sceneRef.current!.remove(mesh);
    });
    allMeshes.current = [];
    treeBranches.current = [];
    
    // Generate new tree structure
    const rootBranch = generateTreeBranches(storyTree.root);
    const allBranches = collectAllBranches(rootBranch);
    treeBranches.current = allBranches;
    treeStructureHash.current = currentHash;
    
    // Create branch meshes
    allBranches.forEach(branch => {
      const branchMesh = createBranchMesh(branch);
      branch.mesh = branchMesh;
      sceneRef.current!.add(branchMesh);
      allMeshes.current.push(branchMesh);
    });
    
    // Create node meshes (leaves/fruit at branch ends)
    allBranches.forEach(branch => {
      if (branch.childBranches.length === 0) { // Only leaf nodes get visible nodes
        const nodeMesh = createNodeMesh(branch);
        branch.nodeMesh = nodeMesh;
        sceneRef.current!.add(nodeMesh);
        allMeshes.current.push(nodeMesh);
      }
    });
  }, [storyTree, generateTreeBranches, collectAllBranches, createBranchMesh, createNodeMesh, getTreeStructureHash]);

  const updateHighlighting = useCallback(() => {
    if (treeBranches.current.length === 0) return;
    
    const currentPath = getCurrentPath();
    
    // Update branch states and materials
    treeBranches.current.forEach(branch => {
      const isInPath = currentPath.some(pathNode => pathNode.id === branch.node.id);
      const isCurrent = currentPath[currentDepth]?.id === branch.node.id;
      
      branch.isInPath = isInPath;
      branch.isCurrent = isCurrent;
      
      // Update branch material
      if (branch.mesh) {
        const material = branch.mesh.material as THREE.MeshLambertMaterial;
        material.color.setHex(isInPath ? 0x4a7c59 : 0x8b4513);
        material.opacity = isInPath ? 0.9 : 0.7;
      }
      
      // Update node material
      if (branch.nodeMesh) {
        const material = branch.nodeMesh.material as THREE.MeshBasicMaterial;
        if (isCurrent) {
          material.color.setHex(0x58a6ff);
          material.opacity = 1.0;
        } else if (isInPath) {
          material.color.setHex(0x58a6ff);
          material.opacity = 0.8;
        } else {
          material.color.setHex(0x90EE90);
          material.opacity = 0.6;
        }
      }
    });
  }, [getCurrentPath, currentDepth]);

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    
    const { rotation, zoom } = mouseState.current;
    const camera = cameraRef.current;
    
    // Calculate camera position based on rotation and zoom
    const distance = zoom;
    const x = Math.sin(rotation.y) * Math.cos(rotation.x) * distance;
    const z = Math.cos(rotation.y) * Math.cos(rotation.x) * distance;
    const y = Math.sin(rotation.x) * distance + 3; // Offset up to look at tree center
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 2, 0); // Look at tree center
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mouseState.current.isRotating = true;
    mouseState.current.lastMouseX = e.clientX;
    mouseState.current.lastMouseY = e.clientY;
    setIsRotating(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!mouseState.current.isRotating) return;
    
    const deltaX = e.clientX - mouseState.current.lastMouseX;
    const deltaY = e.clientY - mouseState.current.lastMouseY;
    
    mouseState.current.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, mouseState.current.rotation.x + deltaY * 0.01));
    mouseState.current.rotation.y += deltaX * 0.01;
    
    mouseState.current.lastMouseX = e.clientX;
    mouseState.current.lastMouseY = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseState.current.isRotating = false;
    setIsRotating(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 1.0;
    const minZoom = 3;
    const maxZoom = 20;
    
    mouseState.current.zoom = Math.max(minZoom, Math.min(maxZoom, mouseState.current.zoom + e.deltaY * zoomSpeed * 0.01));
  }, []);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    updateCamera();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateCamera]);

  useEffect(() => {
    if (!mountRef.current) return;
    
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    sceneRef.current = scene;
    
    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 8);
    cameraRef.current = camera;
    
    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Add simple lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);
    
    // Initialize tree structure
    initializeTree();
    
    // Start animation
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      initializeTree();
      updateHighlighting();
    }, 100); // Check every 100ms
    
    return () => clearInterval(timer);
  }, [storyTree, currentDepth, selectedOptions, initializeTree, updateHighlighting]);

  return (
    <div className="tree-visualizer">
      <div className="tree-header">Story Tree</div>
      <div 
        ref={mountRef}
        className="tree-display"
        style={{ 
          width: '100%', 
          height: '100%',
          cursor: isRotating ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default TreeVisualizerThree;