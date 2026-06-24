"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className = "" }) => {
    return (
      <div
        className={cn(
          "prose min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed text-inherit",
          "[&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-semibold",
          "[&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:font-semibold",
          "[&_h3]:mb-4 [&_h3]:mt-6 [&_h3]:font-semibold",
          "[&_p]:mb-4 [&_p:last-child]:mb-0",
          "[&_ul]:my-4 [&_ul]:pl-6",
          "[&_ol]:my-4 [&_ol]:pl-6",
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;
              return !isInline ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="max-w-full rounded-md text-sm"
                  wrapLines={true}
                  wrapLongLines={true}
                  customStyle={{
                    margin: 0,
                    maxWidth: "100%",
                    overflowX: "auto",
                    fontSize: "0.875rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              ) : (
                <code
                  className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return (
                <div className="my-4 max-w-full overflow-hidden last:mb-0">
                  {children}
                </div>
              );
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary no-underline hover:underline"
                >
                  {children}
                </a>
              );
            },
            blockquote({ children }) {
              return (
                <blockquote className="my-4 border-l-4 border-border pl-4 italic text-muted-foreground">
                  {children}
                </blockquote>
              );
            },
            table({ children }) {
              return (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:p-2">
                    {children}
                  </table>
                </div>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  },
);

MarkdownContent.displayName = "MarkdownContent";
