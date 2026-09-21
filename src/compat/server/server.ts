import { STATUS_CODES, createServer as createHttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerEventMap, ServerSocketConstructor, ServerState } from "../../types/server";
import type { ServerOptions, WebSocket, WebSocketServer } from "../../types/ws";
import { createEmitter } from "../events/emitter";
import { createRegistry } from "../events/registry";
import { addressOf, closeWebSocketServer } from "./close";
import { wireServer } from "./listeners";
import { normalizeServerOptions } from "../options/server";
import { handleUpgrade, shouldHandle } from "./upgrade";
import type { UpgradeCallback } from "./accept";

const SERVER_BRAND = Symbol("ventijs.server");

export function isServer(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return (value as { [SERVER_BRAND]?: true })[SERVER_BRAND] === true;
}

/// Builds the `ws`-shaped server record. The listener modes match upstream:
/// an explicit `port` owns an internal HTTP server answering 426 to plain
/// requests, `server` adopts the caller's HTTP server, and `noServer` only
/// accepts sockets passed to `handleUpgrade`.
export function createWebSocketServer(
  socketClass: ServerSocketConstructor,
  options?: ServerOptions,
  callback?: () => void,
): WebSocketServer {
  const resolved = {
    allowSynchronousEvents: true,
    autoPong: true,
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
    perMessageDeflate: false,
    handleProtocols: null,
    clientTracking: true,
    verifyClient: null,
    noServer: false,
    backlog: null,
    server: null,
    host: null,
    path: null,
    port: null,
    WebSocket: socketClass,
    ...options,
  } as ServerOptions;
  const normalized = normalizeServerOptions(resolved);
  const state: ServerState = {
    options: resolved,
    normalizedOptions: normalized,
    path: resolved.path ?? "",
    clients: new Set<WebSocket>(),
    webSocket: (resolved.WebSocket ?? socketClass) as ServerSocketConstructor,
    server: null,
    lifecycle: "running",
    shouldEmitClose: false,
    removeListeners: null,
    listeners: createRegistry<ServerEventMap>(),
    maxListeners: 10,
    target: undefined,
  };

  if (resolved.port !== null && resolved.port !== undefined) {
    const httpServer = createHttpServer((_request, response) => {
      const body = STATUS_CODES[426] ?? "Upgrade Required";
      response.writeHead(426, {
        "Content-Length": Buffer.byteLength(body),
        "Content-Type": "text/plain",
      });
      response.end(body);
    });
    state.server = httpServer as ServerState["server"];
    httpServer.listen(
      resolved.port,
      resolved.host ?? undefined,
      resolved.backlog ?? undefined,
      callback,
    );
  } else if (resolved.server) {
    state.server = resolved.server;
  }
  if (state.server !== null) wireServer(state);

  const server = {
    ...createEmitter(state),
    options: resolved,
    path: state.path,
    clients: state.clients,
    address: () => addressOf(state),
    close: (closeCallback?: (error?: Error) => void): void => {
      closeWebSocketServer(state, closeCallback);
    },
    handleUpgrade: (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      upgradeCallback: UpgradeCallback,
    ): void => {
      handleUpgrade(state, request, socket, head, upgradeCallback);
    },
    shouldHandle: (request: IncomingMessage): boolean => shouldHandle(state, request),
  };
  state.target = server;
  Object.defineProperty(server, SERVER_BRAND, { value: true });
  return server as unknown as WebSocketServer;
}
