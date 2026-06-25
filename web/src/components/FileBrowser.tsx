"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  FileText,
  Loader2,
} from "lucide-react";

interface FileItem {
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

interface FileBrowserProps {
  onOpenFile: (path: string) => void;
  className?: string;
}

function FileTreeItem({
  path,
  name,
  isDir,
  depth,
  onOpenFile,
}: {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (children !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/workspace/files?path=${encodeURIComponent(path)}`);
      if (!res.ok) return;
      const data = await res.json();
      setChildren(data.items ?? []);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [path, children]);

  const toggleExpand = useCallback(() => {
    if (!expanded) {
      loadChildren();
    }
    setExpanded(!expanded);
  }, [expanded, loadChildren]);

  const handleClick = useCallback(() => {
    if (isDir) {
      toggleExpand();
    } else {
      onOpenFile(path);
    }
  }, [isDir, path, onOpenFile, toggleExpand]);

  const modifiedDate = !isDir
    ? new Date().toLocaleDateString()
    : null;

  return (
    <>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs hover:bg-muted/50 transition-colors rounded"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded
              ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            }
            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate text-foreground">{name}</span>
        {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
      </button>
      {expanded && children && (
        <div>
          {children.length === 0 && (
            <p
              className="px-2 py-1 text-xs text-muted-foreground/50 italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              empty
            </p>
          )}
          {children.map((child) => (
            <FileTreeItem
              key={child.name}
              path={path ? `${path}/${child.name}` : child.name}
              name={child.name}
              isDir={child.is_dir}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FileBrowser({ onOpenFile, className }: FileBrowserProps) {
  const [rootItems, setRootItems] = useState<FileItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/workspace/files?path=")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setRootItems(data.items ?? []))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Failed to load workspace files: {error}
      </div>
    );
  }

  if (!rootItems) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto ${className ?? ""}`}>
      {rootItems.map((item) => (
        <FileTreeItem
          key={item.name}
          path={item.name}
          name={item.name}
          isDir={item.is_dir}
          depth={0}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
