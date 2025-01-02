import { useState, useEffect } from "react";
import { StoryNode } from "../types";

interface EditMenuProps {
  node: StoryNode;
  onSave: (text: string) => void;
}

export const EditMenu = ({ node, onSave }: EditMenuProps) => {
  const [text, setText] = useState(node.text);

  // Reset text when node changes
  useEffect(() => {
    setText(node.text);
  }, [node]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't let our keyboard controls interfere with typing
    e.stopPropagation();

    // Save on Ctrl/Cmd + Enter
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      onSave(text);
    }
  };

  return (
    <div className="menu-content">
      <div className="menu-header">
        <h2>Edit Node</h2>
        <div className="menu-close">Press ⌫ to cancel • Press ⌘↵ to save</div>
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
