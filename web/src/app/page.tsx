import { AgentWorkbench } from "@/components/agent-workbench";
import { getCatalogState } from "@/lib/runtime-state";

export default async function Page() {
  const state = await getCatalogState();

  return (
    <AgentWorkbench
      catalog={state.catalog}
      initialSource={state.source}
    />
  );
}
