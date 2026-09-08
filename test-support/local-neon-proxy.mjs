import { createRequire } from "node:module";
import { createConnection } from "node:net";
const require = createRequire(import.meta.url);
const { WebSocketServer, WebSocket } = require("ws");

/** Test-only wire proxy: exercise the production Neon adapter against isolated localhost Postgres. */
export async function startLocalNeonProxy(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local proxy requires a local test database");
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  server.on("connection", socket => {
    const tcp = createConnection({ host: url.hostname, port: Number(url.port || 5432) });
    socket.on("message", data => tcp.write(data));
    tcp.on("data", data => { if (socket.readyState === WebSocket.OPEN) socket.send(data); });
    tcp.on("error", () => socket.close());
    socket.on("error", () => tcp.destroy());
    socket.on("close", () => tcp.destroy());
    tcp.on("close", () => socket.close());
  });
  await new Promise(resolve => server.once("listening", resolve));
  return { WebSocket, port: server.address().port, close: () => { for (const socket of server.clients) socket.terminate(); return new Promise(resolve => server.close(resolve)); } };
}
