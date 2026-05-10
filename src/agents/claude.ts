import { spawn } from "node:child_process";
import type { AgentRunner } from "./index.ts";

export const claudeAgent: AgentRunner = {
  name: "claude",
  run(prompt, opts = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn("claude", ["-p", prompt], {
        cwd: opts.cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));

      const timeout = opts.timeoutMs
        ? setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`claude run timed out after ${opts.timeoutMs}ms`));
          }, opts.timeoutMs)
        : null;

      child.on("error", (err) => {
        if (timeout) clearTimeout(timeout);
        reject(err);
      });
      child.on("close", (code) => {
        if (timeout) clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
          return;
        }
        resolve(stdout);
      });
    });
  },
};
