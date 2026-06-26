import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@copilotkit/runtime",
    "@copilotkit/react-core",
    "nuqs",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
