import { defineConfig } from "rolldown";

export default defineConfig({
  input: { cli: "src/cli.ts" },
  platform: "node",
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
    banner: (chunk) => (chunk.name === "cli" ? "#!/usr/bin/env node" : ""),
  },
  external: [/^node:/],
});
