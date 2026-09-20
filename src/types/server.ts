import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Registry } from "./events";
import type { NormalizedServerOptions } from "./options";
import type { ServerOptions, WebSocket } from "./ws";

export type ServerEventMap = {
  connection: [socket: WebSocket, request: IncomingMessage];
  error: [error: Error];
  headers: [headers: string[], request: IncomingMessage];
  close: [];
  listening: [];
  wsClientError: [error: Error, socket: Duplex, request: IncomingMessage];
};

export type ServerState = {
  readonly options: ServerOptions;
  /// The trusted record the factory stores and passes to the binding.
  readonly normalizedOptions: NormalizedServerOptions;
  readonly path: string;
  readonly clients: Set<WebSocket>;
  listeners: Registry<ServerEventMap>;
};
