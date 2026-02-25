"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface DocumentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 函数说明：DocumentEditor，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export function DocumentEditor({ value, onChange }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: {
        class: "editor-surface",
      },
    },
    /**
     * 函数说明：onUpdate，负责当前模块的业务处理逻辑。
     * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
     * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
     * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
     */
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

  return (
    <div className="editor-shell">
      <div className="editor-toolbar">
        <button
          type="button"
          className={`tool-button ${editor?.isActive("heading", { level: 2 }) ? "active" : ""}`}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={`tool-button ${editor?.isActive("bold") ? "active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          粗体
        </button>
        <button
          type="button"
          className={`tool-button ${editor?.isActive("italic") ? "active" : ""}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          斜体
        </button>
        <button
          type="button"
          className={`tool-button ${editor?.isActive("bulletList") ? "active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          列表
        </button>
        <button
          type="button"
          className={`tool-button ${editor?.isActive("blockquote") ? "active" : ""}`}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          引用
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
