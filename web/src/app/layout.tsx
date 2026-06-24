import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

import { Providers } from "./providers";
import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

export const metadata: Metadata = {
  title: "Deep Agent 666",
  description: "Local-first general-purpose AI agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased scrollbar-pretty">
        <NuqsAdapter>
          <Providers>{children}</Providers>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
