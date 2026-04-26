import { useState, useEffect, useRef } from "react";
import { StoryNode } from "../types";

export const EDIT_CONTROL_EVENT = "textile:edit-control";

interface EditMenuProps {
  node: StoryNode;
  onSave: (text: string) => Promise<void> | void;
  onCancel: () => Promise<void> | void;
}

export const EditMenu = ({ node, onSave, onCancel }: EditMenuProps) => {
  const [text, setText] = useState(node.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const cancelledRef = useRef(false);

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

  const triggerSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await onSave(text);
    } finally {
      savingRef.current = false;
    }
  };

  const triggerCancel = async () => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    try {
      await onCancel();
    } finally {
      cancelledRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't let our keyboard controls interfere with typing
    e.stopPropagation();

    // Save on Start (Escape)
    if (e.key === "Escape") {
      e.preventDefault();
      void triggerSave();
    }
    // Cancel on Select (`)
    else if (e.key === "`") {
      e.preventDefault();
      void triggerCancel();
    }
  };

  // Handle button clicks from parent
  useEffect(() => {
    const handleControlPress = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (key === "Escape") {
        void triggerSave();
      } else if (key === "`") {
        void triggerCancel();
      }
    };

    window.addEventListener(EDIT_CONTROL_EVENT, handleControlPress);
    return () => window.removeEventListener(EDIT_CONTROL_EVENT, handleControlPress);
  }, [text, onSave, onCancel]);

  return (
    <div className="menu-content" onKeyDown={handleKeyDown}>
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
