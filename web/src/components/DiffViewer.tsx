"use client";

import React, { useMemo } from "react";
import { FileText, Download, Copy, Check } from "lucide-react";

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNum: number;
}

interface DiffViewerProps {
  filePath: string;
  before: string;
  after: string;
}

function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let lineNum = 0;

  for (let i = 0; i < maxLen; i++) {
    lineNum++;
    const bLine = beforeLines[i] ?? "";
    const aLine = afterLines[i] ?? "";

    if (bLine === aLine) {
      result.push({ type: "context", content: bLine, lineNum });
    } else if (aLine === "" || aLine === undefined) {
      result.push({ type: "remove", content: bLine, lineNum });
    } else if (bLine === "" || bLine === undefined) {
      result.push({ type: "add", content: aLine, lineNum });
    } else {
      result.push({ type: "remove", content: bLine, lineNum });
      result.push({ type: "add", content: aLine, lineNum });
    }
  }
  return result;
}

export function DiffViewer({ filePath, before, after }: DiffViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const diff = useMemo(() => computeDiff(before, after), [before, after]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(after);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addCount = diff.filter((l) => l.type === "add").length;
  const removeCount = diff.filter((l) => l.type === "remove").length;

  return (
    <div className="mx-4 my-2 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{filePath}</span>
          {addCount > 0 && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900 dark:text-green-300">
              +{addCount}
            </span>
          )}
          {removeCount > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900 dark:text-red-300">
              -{removeCount}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {copied ? (
            <><Check className="h-3 w-3 text-green-500" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy</>
          )}
        </button>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono leading-relaxed">
          <tbody>
            {diff.map((line, i) => (
              <tr
                key={i}
                className={
                  line.type === "add"
                    ? "bg-green-50 dark:bg-green-950/30"
                    : line.type === "remove"
                    ? "bg-red-50 dark:bg-red-950/30"
                    : ""
                }
              >
                <td className="w-10 select-none px-2 text-right text-muted-foreground/50">
                  {line.lineNum}
                </td>
                <td className="w-6 select-none text-center text-muted-foreground/50">
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                </td>
                <td
                  className={`whitespace-pre px-2 ${
                    line.type === "add"
                      ? "text-green-800 dark:text-green-300"
                      : line.type === "remove"
                      ? "text-red-800 dark:text-red-300"
                      : "text-foreground"
                  }`}
                >
                  {line.content || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
