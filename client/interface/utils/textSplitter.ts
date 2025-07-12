/**
 * Text splitter that respects natural reading boundaries
 * Uses ranked boundary detection with backward scanning
 */

const MAX_CHUNK_SIZE = 1024;
const LOOKBACK_WINDOW = 80;

interface BoundaryPattern {
  name: string;
  regex: RegExp;
  priority: number;
}

// Ranked from strongest to weakest boundary cues
const BOUNDARY_PATTERNS: BoundaryPattern[] = [
  {
    name: "markdown_heading",
    regex: /^#{1,6}\s.*$/gm,
    priority: 100,
  },
  {
    name: "underline_heading", 
    regex: /^.+\n[=\-]{3,}$/gm,
    priority: 95,
  },
  {
    name: "blank_lines",
    regex: /\n\n+/g,
    priority: 80,
  },
  {
    name: "paragraph_break",
    regex: /\n(?=[A-Z])/g,
    priority: 60,
  },
  {
    name: "sentence_end",
    regex: /[.!?]\s+/g,
    priority: 40,
  },
];

/**
 * Find the last occurrence of any boundary pattern within a text slice
 */
function findLastBoundary(text: string, start: number, end: number): number | null {
  const slice = text.substring(start, end);
  let bestCut: number | null = null;
  let bestPriority = -1;

  // Search for each pattern in order of priority
  for (const pattern of BOUNDARY_PATTERNS) {
    // Find all matches in the slice
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    const matches = Array.from(slice.matchAll(regex));
    
    if (matches.length > 0) {
      // Get the last match
      const lastMatch = matches[matches.length - 1];
      const matchEnd = lastMatch.index! + lastMatch[0].length;
      const absoluteIndex = start + matchEnd;
      
      // Only consider matches that are better priority and leave reasonable content
      if (pattern.priority > bestPriority && matchEnd > 10) {
        bestCut = absoluteIndex;
        bestPriority = pattern.priority;
      }
    }
  }

  return bestCut;
}

/**
 * Split text into chunks respecting natural boundaries
 */
export function splitText(text: string): string[] {
  if (!text.trim()) return [];
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const end = Math.min(i + MAX_CHUNK_SIZE, text.length);
    
    // If we're at the end of the text, take everything
    if (end === text.length) {
      const remaining = text.substring(i).trim();
      if (remaining) {
        chunks.push(remaining);
      }
      break;
    }
    
    // Search for the best boundary within this window
    const cut = findLastBoundary(text, i, end) || end;
    
    const chunk = text.substring(i, cut).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    
    i = cut;
    
    // Skip any whitespace at the start of the next chunk
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Convert a flat array of text chunks into a linked chain of StoryNodes
 */
export function createNodeChain(chunks: string[]): import('../types').StoryNode | null {
  if (chunks.length === 0) return null;
  
  const generateId = () => Math.random().toString(36).substring(2, 15);
  
  const head: import('../types').StoryNode = {
    id: generateId(),
    text: chunks[0],
    continuations: [],
  };
  
  let current = head;
  
  for (let i = 1; i < chunks.length; i++) {
    const child: import('../types').StoryNode = {
      id: generateId(),
      text: chunks[i],
      continuations: [],
    };
    
    current.continuations = [child];
    current.lastSelectedIndex = 0;
    current = child;
  }
  
  return head;
}

/**
 * Split text and create a node chain in one step
 */
export function splitTextToNodes(text: string): import('../types').StoryNode | null {
  const chunks = splitText(text);
  return createNodeChain(chunks);
}