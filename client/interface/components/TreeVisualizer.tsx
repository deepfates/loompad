import React from 'react';
import type { StoryNode } from '../types';

interface TreeVisualizerProps {
  storyTree: { root: StoryNode };
  currentDepth: number;
  selectedOptions: number[];
  getCurrentPath: () => StoryNode[];
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  storyTree,
  currentDepth,
  selectedOptions,
  getCurrentPath
}) => {
  const renderTreeNode = (
    node: StoryNode,
    depth: number = 0,
    isLast: boolean = true,
    prefix: string = ''
  ): { line: string; nodeId: string; depth: number; isInPath: boolean; isCurrent: boolean }[] => {
    const currentPath = getCurrentPath();
    const isInCurrentPath = currentPath.some(pathNode => pathNode.id === node.id);
    const isCurrent = currentPath[currentDepth]?.id === node.id;
    
    // Create ASCII art tree branch characters
    let connector = '';
    let leafSymbol = '';
    
    if (depth === 0) {
      // Root node - tree trunk
      connector = '🌳 ';
      leafSymbol = '';
    } else {
      // Branch connectors with more artistic ASCII
      const verticalLine = '│';
      const horizontalLine = '─';
      const cornerLast = '└';
      const cornerMid = '├';
      const teeJoint = '┬';
      
      if (isLast) {
        connector = `${prefix}${cornerLast}${horizontalLine}${horizontalLine}`;
        leafSymbol = node.continuations && node.continuations.length > 0 ? '┐ ' : '● ';
      } else {
        connector = `${prefix}${cornerMid}${horizontalLine}${horizontalLine}`;
        leafSymbol = node.continuations && node.continuations.length > 0 ? '┬ ' : '● ';
      }
    }
    
    // Truncate long text for display
    const displayText = node.text.length > 35 
      ? node.text.substring(0, 35) + '...'
      : node.text;
    
    // Replace newlines with spaces for cleaner display
    const cleanText = displayText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    let result = [{
      line: `${connector}${leafSymbol}${cleanText}`,
      nodeId: node.id,
      depth,
      isInPath: isInCurrentPath,
      isCurrent
    }];
    
    // Render children if they exist
    if (node.continuations && node.continuations.length > 0) {
      const childPrefix = depth === 0 ? '' : `${prefix}${isLast ? '  ' : '│ '}`;
      
      node.continuations.forEach((child, index) => {
        const isLastChild = index === node.continuations!.length - 1;
        
        result.push(...renderTreeNode(
          child,
          depth + 1,
          isLastChild,
          childPrefix
        ));
      });
    }
    
    return result;
  };

  const treeStructure = renderTreeNode(
    storyTree.root,
    0,
    true
  );

  return (
    <div className="tree-visualizer">
      <div className="tree-header">Story Tree</div>
      <div className="tree-display">
        {treeStructure.map((nodeInfo, index) => (
          <div
            key={`${nodeInfo.nodeId}-${index}`}
            className={`tree-node ${nodeInfo.isCurrent ? 'current' : ''} ${nodeInfo.isInPath ? 'in-path' : ''}`}
          >
            {nodeInfo.line}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreeVisualizer;