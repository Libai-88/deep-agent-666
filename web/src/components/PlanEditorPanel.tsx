import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PlanEditorPanelProps = {
  open: boolean;
  currentStep: string | null;
  draftPlan: string;
  onDraftPlanChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

export function PlanEditorPanel({
  open,
  currentStep,
  draftPlan,
  onDraftPlanChange,
  onOpenChange,
  onSubmit,
}: PlanEditorPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <section
      data-testid="plan-editor-panel"
      className="border-b border-border bg-card/30 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Edit plan</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentStep ?? "Paused run"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </div>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Textarea
          value={draftPlan}
          onChange={(event) => onDraftPlanChange(event.target.value)}
          rows={8}
          placeholder="1. Review the current plan&#10;2. Adjust the next step&#10;3. Resume the run"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Apply plan
          </Button>
        </div>
      </form>
    </section>
  );
}
