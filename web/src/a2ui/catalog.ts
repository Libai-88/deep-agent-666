"use client";

import { createCatalog } from "@copilotkit/a2ui-renderer";
import { definitions } from "./definitions";
import { renderers } from "./renderers";

export const CATALOG_ID = "deepagent://a2ui-catalog";

export const catalog = createCatalog(definitions as any, renderers as any, {
  catalogId: CATALOG_ID,
  includeBasicCatalog: true,
});
