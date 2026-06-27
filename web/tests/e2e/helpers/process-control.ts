import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function spawnProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  return spawn(command, args, {
    stdio: "pipe",
    ...options,
  });
}

export async function waitForHttp(
  url: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The target process may still be booting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export async function stopProcess(
  child: ChildProcess,
  label: string,
): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      return;
    }
    await delay(200);
  }

  if (process.platform === "win32" && child.pid) {
    const killer = spawn(process.env.ComSpec ?? "cmd.exe", [
      "/c",
      "taskkill",
      "/PID",
      String(child.pid),
      "/T",
      "/F",
    ]);
    await new Promise<void>((resolve) => {
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }

  child.kill("SIGKILL");
  await delay(200);

  if (child.exitCode === null) {
    throw new Error(`Failed to stop ${label} process`);
  }
}
