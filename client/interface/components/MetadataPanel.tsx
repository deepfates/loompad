import { StoryNode } from "../types";
import { useModels } from "../hooks/useModels";

interface MetadataPanelProps {
  currentNode: StoryNode;
  currentDepth: number;
  totalDepth: number;
  selectedOptions: number[];
  isExpanded: boolean;
  onToggle: () => void;
}

export const MetadataPanel = ({
  currentNode,
  currentDepth,
  totalDepth,
  selectedOptions,
  isExpanded,
  onToggle,
}: MetadataPanelProps) => {
  const { getModelName } = useModels();

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDepthPath = () => {
    if (selectedOptions.length === 0) return "Root";
    return selectedOptions.slice(0, currentDepth).map((option, index) => 
      `${index + 1}.${option + 1}`
    ).join(" → ");
  };

  const getNodeType = () => {
    if (currentDepth === 0) return "Root";
    if (!currentNode.generationMetadata) return "Manual";
    if (currentNode.isEdited) return "Edited";
    return "Generated";
  };

  const metadata = currentNode.generationMetadata;

  return (
    <div className={`metadata-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="metadata-toggle"
        onClick={onToggle}
        aria-label={isExpanded ? "Hide metadata" : "Show metadata"}
      >
        <span className="metadata-toggle-icon">
          ▶
        </span>
      </button>
      
      {isExpanded && (
        <div className="metadata-content-wrapper">
          <div className="metadata-header">
            <h3>Segment Info</h3>
          </div>
          
          <div className="metadata-content">
            <div className="metadata-row">
              <span className="metadata-label">Type:</span>
              <span className="metadata-value">{getNodeType()}</span>
            </div>
            
            <div className="metadata-row">
              <span className="metadata-label">Depth:</span>
              <span className="metadata-value">{currentDepth} / {totalDepth - 1}</span>
            </div>
            
            <div className="metadata-row">
              <span className="metadata-label">Path:</span>
              <span className="metadata-value">{formatDepthPath()}</span>
            </div>
            
            {currentNode.generatedByModel && (
              <div className="metadata-row">
                <span className="metadata-label">Model:</span>
                <span className="metadata-value">{getModelName(currentNode.generatedByModel)}</span>
              </div>
            )}
            
            {metadata && (
              <>
                <div className="metadata-row">
                  <span className="metadata-label">Temperature:</span>
                  <span className="metadata-value">{metadata.temperature.toFixed(1)}</span>
                </div>
                
                <div className="metadata-row">
                  <span className="metadata-label">Max Tokens:</span>
                  <span className="metadata-value">{metadata.maxTokens}</span>
                </div>
                
                <div className="metadata-row">
                  <span className="metadata-label">Generated:</span>
                  <span className="metadata-value">{formatTimestamp(metadata.timestamp)}</span>
                </div>
              </>
            )}
            
            <div className="metadata-row">
              <span className="metadata-label">Length:</span>
              <span className="metadata-value">{currentNode.text.length} chars</span>
            </div>
            
            {currentNode.continuations && currentNode.continuations.length > 0 && (
              <div className="metadata-row">
                <span className="metadata-label">Branches:</span>
                <span className="metadata-value">{currentNode.continuations.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 