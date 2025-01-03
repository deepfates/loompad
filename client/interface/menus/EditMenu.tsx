import { useState, useEffect, useRef } from "react";
import { StoryNode } from "../types";

interface EditMenuProps {
  node: StoryNode;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export const EditMenu = ({ node, onSave, onCancel }: EditMenuProps) => {
  const [text, setText] = useState(node.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset text when node changes
  useEffect(() => {
    setText(node.text);
  }, [node]);

  // Focus the textarea when mounted
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-grow textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set the height to match the content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Adjust height on mount and when text changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

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

  // Handle button clicks from parent
  useEffect(() => {
    const handleControlPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSave(text);
      } else if (e.key === "`") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleControlPress);
    return () => window.removeEventListener("keydown", handleControlPress);
  }, [text, onSave, onCancel]);

  return (
    <div className="menu-content" onKeyDown={handleKeyDown}>
      <div className="menu-header">
        <h2>Edit Node</h2>
        <div className="menu-close">
          Press SELECT to cancel • Press START to save
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="edit-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={1}
      />
    </div>
  );
};
