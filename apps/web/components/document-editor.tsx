"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface DocumentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function DocumentEditor({ value, onChange }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: {
        class: "editor-surface",
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
