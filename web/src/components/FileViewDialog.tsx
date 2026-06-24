"use client";

import React, { useMemo, useState, useEffect } from "react";
import { FileText, Copy, Download, X } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { FileItem } from "./TasksFilesSidebar";

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust",
  java: "java", cpp: "cpp", c: "c", cs: "csharp",
  sh: "bash", bash: "bash", zsh: "bash",
  json: "json", xml: "xml", html: "html", css: "css",
  yaml: "yaml", yml: "yaml", toml: "toml", md: "markdown",
};

function ext(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

interface FileViewDialogProps {
  file: FileItem | null;
  onClose: () => void;
  onSave?: (path: string, content: string) => void;
}

export function FileViewDialog({ file, onClose, onSave }: FileViewDialogProps) {
  const [editContent, setEditContent] = useState<string>("");

  useEffect(() => {
    if (file) setEditContent(file.content);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [file, onClose]);

  if (!file) return null;

  const fileExt = ext(file.path);
  const lang = LANGUAGE_MAP[fileExt] || fileExt;
  const isMarkdown = fileExt === "md" || fileExt === "markdown";

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
  };

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() ?? "file";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] min-w-[60vw] max-w-[80vw] flex-col rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {file.path.split("/").pop()}
            </span>
            <span className="text-xs text-muted-foreground">({file.path})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={handleDownload}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isMarkdown ? (
            <MarkdownContent content={file.content} />
          ) : (
            <SyntaxHighlighter
              style={oneDark}
              language={lang}
              showLineNumbers
              customStyle={{ margin: 0, borderRadius: "0.5rem", fontSize: "0.875rem" }}
            >
              {file.content}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
}
