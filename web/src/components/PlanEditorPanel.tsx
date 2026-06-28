import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  RunControlAction,
  RunControlSnapshot,
} from "@/lib/run-control-state";

const APPROVE_ACTION: RunControlAction = "approve_plan";
const EDIT_ACTION: RunControlAction = "edit_plan";

type PlanEditorPanelProps = {
  snapshot: RunControlSnapshot;
  draftPlan: string;
  onDraftPlanChange: (value: string) => void;
  onSubmit: (action: RunControlAction) => void;
};

export function PlanEditorPanel({
  snapshot,
  draftPlan,
  onDraftPlanChange,
  onSubmit,
}: PlanEditorPanelProps) {
  if (snapshot.phase !== "interrupted" || snapshot.reason !== "plan_approval") {
    return null;
  }

  return (
    <section data-testid="plan-editor-panel" className="border-b border-border bg-card/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-foreground">Review and edit plan</h3>
      <p className="mt-1 text-xs text-muted-foreground">{snapshot.statusMessage}</p>
      <Textarea value={draftPlan} onChange={(event) => onDraftPlanChange(event.target.value)} rows={10} />
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onSubmit(APPROVE_ACTION)}>Approve plan</Button>
        <Button type="button" onClick={() => onSubmit(EDIT_ACTION)}>Apply edited plan</Button>
      </div>
    </section>
  );
}
