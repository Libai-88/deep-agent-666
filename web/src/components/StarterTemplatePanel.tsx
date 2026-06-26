import {
  groupStarterTemplates,
  type StarterTemplate,
} from "@/lib/starter-templates";

const LABELS = {
  engineering: "Engineering",
  research: "Research",
  general: "General",
} as const;

export function StarterTemplatePanel({
  templates,
  onSelect,
}: {
  templates: readonly StarterTemplate[];
  onSelect: (template: StarterTemplate) => void;
}) {
  const grouped = groupStarterTemplates(templates);

  return (
    <section className="flex h-full flex-col gap-6 px-6 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Start with a guided task</h2>
        <p className="text-sm text-muted-foreground">
          Pick a starter task to see how the agent works in this workspace.
        </p>
      </div>
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((key) => (
        <div key={key} className="space-y-2">
          <h3 className="text-sm font-semibold">{LABELS[key]}</h3>
          <div className="grid gap-2">
            {grouped[key].map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-lg border border-border px-4 py-3 text-left"
                onClick={() => onSelect(template)}
              >
                <div className="font-medium">{template.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {template.prompt}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
