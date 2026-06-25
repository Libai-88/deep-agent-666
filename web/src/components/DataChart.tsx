"use client";

import React, { useMemo, useState } from "react";
import {
  Table2,
  BarChart3,
  ArrowUpDown,
} from "lucide-react";

interface Column {
  key: string;
  label: string;
}

interface DataChartProps {
  title?: string;
  columns: Column[];
  rows: Record<string, string | number>[];
}

export function DataChart({ title, columns, rows }: DataChartProps) {
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [rows, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (!columns.length || !rows.length) {
    return null;
  }

  return (
    <div className="mx-4 my-2 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
          {title ?? "Data"}
        </div>
        <button
          onClick={() => setViewMode(viewMode === "table" ? "chart" : "table")}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {viewMode === "table" ? (
            <><BarChart3 className="h-3 w-3" /> Chart</>
          ) : (
            <><Table2 className="h-3 w-3" /> Table</>
          )}
        </button>
      </div>

      {viewMode === "table" ? (
        /* Table view */
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-foreground">
                      {row[col.key] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Simple bar chart view (inline SVG, no external deps) */
        <div className="p-4">
          {columns.length >= 2 && (
            <SimpleBarChart
              labelColumn={columns[0]}
              valueColumn={columns[1]}
              rows={sortedRows}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SimpleBarChart({
  labelColumn,
  valueColumn,
  rows,
}: {
  labelColumn: Column;
  valueColumn: Column;
  rows: Record<string, string | number>[];
}) {
  const values = rows.map((r) => Number(r[valueColumn.key]) || 0);
  const maxVal = Math.max(...values, 1);
  const barHeight = 24;
  const chartHeight = rows.length * (barHeight + 8) + 20;

  return (
    <svg width="100%" height={chartHeight} className="overflow-visible">
      <text x="0" y="12" className="text-xs" fill="currentColor" fontSize="11">
        {valueColumn.label}
      </text>
      {rows.map((row, i) => {
        const val = Number(row[valueColumn.key]) || 0;
        const pct = (val / maxVal) * 100;
        const y = i * (barHeight + 8) + 24;
        return (
          <g key={i}>
            <text
              x="0"
              y={y + barHeight / 2 + 4}
              fontSize="11"
              fill="currentColor"
              className="text-muted-foreground"
            >
              {String(row[labelColumn.key]).slice(0, 20)}
            </text>
            <rect
              x="120"
              y={y}
              width={`${pct * 3}px`}
              height={barHeight}
              rx={4}
              className="fill-primary/70"
              style={{ minWidth: pct > 0 ? "4px" : "0" }}
            />
            <text
              x="126"
              y={y + barHeight / 2 + 4}
              fontSize="11"
              fill="white"
              className="font-medium"
            >
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
