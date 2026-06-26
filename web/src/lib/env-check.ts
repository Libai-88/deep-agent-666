/**
 * Environment validation for Deep Agent 666.
 * Run at startup to ensure all required config is present.
 */

export interface EnvCheck {
  name: string;
  required: boolean;
  value: string | undefined;
}

const CHECKS: EnvCheck[] = [
  { name: "AGENT_BASE_URL", required: false, value: process.env.AGENT_BASE_URL },
  { name: "MCP_SERVER_URL", required: false, value: process.env.MCP_SERVER_URL },
  { name: "NODE_ENV", required: false, value: process.env.NODE_ENV },
];

const MISSING_REQUIRED = CHECKS.filter((c) => c.required && !c.value);

export function validateEnv(): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];

  for (const check of CHECKS) {
    if (!check.value) {
      if (check.required) {
        warnings.push(`❌ Missing required env: ${check.name}`);
      } else {
        warnings.push(`⚠️  Optional env not set: ${check.name} (using default)`);
      }
    }
  }

  return { ok: MISSING_REQUIRED.length === 0, warnings };
}

export function getEnvSummary(): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const check of CHECKS) {
    summary[check.name] = check.value || "(not set)";
  }
  return summary;
}
