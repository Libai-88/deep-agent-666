"use client";

import { z } from "zod";

const DynString = z.union([z.string(), z.object({ path: z.string() })]);

export const definitions = {
  DiffPreview: {
    description: "Renders a side-by-side file diff preview",
    props: z.object({
      filePath: DynString.describe("Path to the modified file"),
      before: DynString.describe("Original content"),
      after: DynString.describe("Modified content"),
    }),
  },
};
