import { useState, useEffect } from "react";
import { StoryNode } from "../types";

interface EditMenuProps {
  node: StoryNode;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export const EditMenu = ({ node, onSave, onCancel }: EditMenuProps) => {
  const [text, setText] = useState(node.text);

  // Reset text when node changes
  useEffect(() => {
    setText(node.text);
  }, [node]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't let our keyboard controls interfere with typing
    e.stopPropagation();

    // Save on Start (Escape)
    if (e.key === "Escape") {
      e.preventDefault();
      onSave(text);
    }
    // Cancel on Select (`)
    else if (e.key === "`") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="menu-content">
      <div className="menu-header">
        <h2>Edit Node</h2>
        <div className="menu-close">
          Press SELECT to cancel • Press START to save
        </div>
      </div>
      <textarea
        className="edit-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </div>
  );
};
