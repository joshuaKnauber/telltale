import { startServer } from "../src/server.ts";

const PORT = Number(process.env.PORT ?? 5235);
await startServer({ port: PORT, serveUi: false });
console.log(`api listening on http://localhost:${PORT}`);
