import { createServer, type Server as HttpServer } from "node:http";
import { connect } from "node:net";
import type { WebSocketServer } from "../../src/index";

export const KEY = "dGhlIHNhbXBsZSBub25jZQ==";
export const ACCEPT = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=";

export type RawResult = {
  readonly response: string;
  readonly status: number;
};

export function rawUpgrade(port: number, request: string, waitMs = 200): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(request);
    });
    let data = "";
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      const end = data.indexOf("\r\n\r\n");
      resolve({ response: data, status: end === -1 ? 0 : Number(data.slice(9, 12)) });
    };
    socket.setTimeout(waitMs, finish);
    socket.on("end", finish);
    socket.on("close", finish);
    socket.on("data", (chunk) => {
      data += chunk.toString("latin1");
      if (data.startsWith("HTTP/1.1 101") && data.includes("\r\n\r\n")) finish();
    });
    socket.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

export function request(
  path: string,
  headers: Record<string, string> = {},
  method = "GET",
): string {
  const lines = [`${method} ${path} HTTP/1.1`, "Host: 127.0.0.1"];
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
  lines.push("", "");
  return lines.join("\r\n");
}

export const UPGRADE_HEADERS = {
  Upgrade: "websocket",
  Connection: "Upgrade",
  "Sec-WebSocket-Key": KEY,
  "Sec-WebSocket-Version": "13",
};

export type Harness = {
  readonly port: number;
  readonly server: WebSocketServer;
  readonly httpServer: HttpServer;
  close(): Promise<void>;
};

/// Wires a `noServer` facade to a real HTTP server the way `ws` documents:
/// the user owns the upgrade event and forwards accepted sockets.
export async function serve(server: WebSocketServer): Promise<Harness> {
  const httpServer = createServer();
  httpServer.on("upgrade", (incoming, socket, head) => {
    server.handleUpgrade(incoming, socket, head, (accepted, incomingRequest) => {
      server.emit("connection", accepted, incomingRequest);
    });
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    port,
    server,
    httpServer,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      }),
  };
}
