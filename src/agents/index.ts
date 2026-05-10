export interface AgentRunner {
  name: string;
  run(prompt: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<string>;
}
