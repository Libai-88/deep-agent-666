"use client";

import { z } from "zod";

export const definitions = {
  DiffPreview: {
    description: "Renders a side-by-side file diff preview",
    props: z.object({
      filePath: z.string().describe("Path to the modified file"),
      before: z.string().describe("Original content"),
      after: z.string().describe("Modified content"),
    }),
  },
};
