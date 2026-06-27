"use client";

import React from "react";

function DiffPreviewRenderer({
  props,
}: {
  props: { filePath: string; before: string; after: string };
}) {
  const { filePath, before, after } = props;

  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-[#DBDBE5] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E9E9EF] bg-[#FAFAFC] px-4 py-2">
        <span className="text-xs font-semibold text-[#010507]">{filePath}</span>
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#57575B]">
          {before !== after ? "Modified" : "Unchanged"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-0 p-0">
        <div className="border-r border-[#E9E9EF] p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#838389]">Before</div>
          <pre className="text-xs text-[#57575B] whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">
            {before || "(empty)"}
          </pre>
        </div>
        <div className="p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#838389]">After</div>
          <pre className="text-xs text-[#189370] whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">
            {after || "(empty)"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export const renderers = {
  DiffPreview: DiffPreviewRenderer,
};
