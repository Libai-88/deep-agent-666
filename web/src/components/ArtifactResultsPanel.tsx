import type { WorkbenchArtifact } from "@/lib/workbench-state";
import { DataChart } from "@/components/DataChart";

function tryParseDataChart(content: string) {
  try {
    const d = JSON.parse(content);
    if (Array.isArray(d?.columns) && Array.isArray(d?.rows)) return d;
  } catch {}
  return null;
}

export function ArtifactResultsPanel({
  artifacts,
  finalSummary,
  onOpenFile,
}: {
  artifacts: WorkbenchArtifact[];
  finalSummary: string | null;
  onOpenFile: (path: string) => void;
}) {
  return (
    <section
      data-testid="artifact-results-panel"
      className="flex h-full flex-col bg-card/20"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Results</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Files, findings, and summaries
        </p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {finalSummary ? (
          <div
            data-testid="artifact-final-summary"
            className="rounded-lg border border-border bg-background p-3 text-sm"
          >
            {finalSummary}
          </div>
        ) : null}
        {artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No artifacts yet.
          </p>
        ) : (
          artifacts.map((artifact) => (
            <div
              key={artifact.id}
              data-testid={`artifact-card-${artifact.id}`}
              className="rounded-lg border border-border bg-background p-3"
            >
              {artifact.path ? (
                <button
                  className="text-left text-sm font-medium underline"
                  onClick={() => onOpenFile(artifact.path!)}
                >
                  {artifact.title}
                </button>
              ) : (
                <div className="text-sm font-medium">{artifact.title}</div>
              )}
              {(() => {
                const d = tryParseDataChart(artifact.content);
                return d ? (
                  <DataChart columns={d.columns} rows={d.rows} />
                ) : (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    {artifact.content}
                  </pre>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
