import { spawn } from "node:child_process";
import { platform } from "node:os";
import { startServer } from "./server.ts";

const PORT = 5235;

export async function runReview(): Promise<void> {
  const url = `http://localhost:${PORT}/`;
  try {
    await startServer({ port: PORT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }
  console.log(`telltale: review UI at ${url}`);
  console.log("press Ctrl-C to stop.");
  openBrowser(url);

  await new Promise<void>((resolve) => {
    const stop = () => resolve();
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

function openBrowser(url: string): void {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // best-effort
  }
}
