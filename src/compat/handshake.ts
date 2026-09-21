import { createHash } from "node:crypto";
import { STATUS_CODES } from "node:http";
import type { IncomingMessage, OutgoingHttpHeaders } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerState } from "../types/server";
import { emitEvent } from "./emitter";
import { createError } from "./errors";
import { listenerCount } from "./events";
import { parseProtocolHeader } from "./options";

export const KEY_PATTERN = /^[+/0-9A-Za-z]{22}==$/;
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function socketAccept(key: string): string {
  return createHash("sha1")
    .update(key + GUID)
    .digest("base64");
}

export function requestHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function isSecure(request: IncomingMessage): boolean {
  const socket = request.socket as { authorized?: boolean; encrypted?: boolean };
  return Boolean(socket.authorized || socket.encrypted);
}

/// Parses the requested subprotocols, aborting with the `ws` message when the
/// header is malformed. Returns undefined once the rejection is written.
export function parseProtocols(
  state: ServerState,
  request: IncomingMessage,
  socket: Duplex,
): readonly string[] | undefined {
  const header = request.headers["sec-websocket-protocol"];
  if (header === undefined) return [];
  try {
    return parseProtocolHeader(Array.isArray(header) ? header.join(",") : header);
  } catch {
    abortOrEmit(state, request, socket, 400, "Invalid Sec-WebSocket-Protocol header");
    return undefined;
  }
}

/// Picks the response subprotocol: the `handleProtocols` hook owns the
/// decision when present, otherwise `ws` takes the first offered protocol.
export function selectProtocol(
  state: ServerState,
  protocols: readonly string[],
  request: IncomingMessage,
): string | false {
  if (protocols.length === 0) return false;
  const offered = new Set(protocols);
  const handleProtocols = state.options.handleProtocols;
  if (handleProtocols) return handleProtocols(offered, request);
  return protocols[0] ?? false;
}

/// Emits `wsClientError` when a listener exists, otherwise writes the HTTP
/// rejection. The coded error keeps the stable `ERR_PROTOCOL` surface while
/// the message stays byte-identical to `ws`.
export function abortOrEmit(
  state: ServerState,
  request: IncomingMessage,
  socket: Duplex,
  code: number,
  message: string,
): void {
  if (listenerCount(state.listeners, "wsClientError") > 0) {
    emitEvent(state, "wsClientError", createError("ERR_PROTOCOL", message), socket, request);
    return;
  }
  abortHandshake(socket, code, message);
}

/// Writes the HTTP error response `ws` sends when preconditions fail. The
/// caller-owned headers merge over the defaults exactly like upstream.
export function abortHandshake(
  socket: Duplex,
  code: number,
  message?: string,
  headers?: OutgoingHttpHeaders,
): void {
  const body = message || STATUS_CODES[code] || "";
  const merged: OutgoingHttpHeaders = {
    Connection: "close",
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  };
  const lines = Object.keys(merged)
    .map((name) => `${name}: ${String(merged[name])}`)
    .join("\r\n");
  socket.once("finish", () => {
    socket.destroy();
  });
  socket.end(`HTTP/1.1 ${code} ${STATUS_CODES[code] ?? ""}\r\n${lines}\r\n\r\n${body}`);
}
