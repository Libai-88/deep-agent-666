export const RUNTIME_BOOTSTRAP_REFRESH_EVENT =
  "deep-agent-666.runtime-bootstrap-refresh";
export const RUNTIME_BOOTSTRAP_READY_EVENT =
  "deep-agent-666.runtime-bootstrap-ready";

export async function requestRuntimeBootstrapRefresh(
  timeoutMs = 5_000,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const finalize = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener(RUNTIME_BOOTSTRAP_READY_EVENT, handleReady);
      clearTimeout(timer);
      resolve();
    };

    const handleReady = () => {
      finalize();
    };

    const timer = window.setTimeout(() => {
      finalize();
    }, timeoutMs);

    window.addEventListener(RUNTIME_BOOTSTRAP_READY_EVENT, handleReady, {
      once: true,
    });
    window.dispatchEvent(new Event(RUNTIME_BOOTSTRAP_REFRESH_EVENT));
  });
}
