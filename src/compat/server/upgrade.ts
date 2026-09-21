import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerState } from "../../types/server";
import type {
  VerifyClientCallbackAsync,
  VerifyClientCallbackSync,
  WebSocket,
} from "../../types/ws";
import { trackClient } from "./clients";
import { emitEvent } from "../events/emitter";
import { createError } from "../errors";
import {
  abortHandshake,
  abortOrEmit,
  isSecure,
  KEY_PATTERN,
  parseProtocols,
  requestHeader,
  selectProtocol,
  socketAccept,
} from "./handshake";
import { attachSocket } from "../socket/attach";

const UPGRADED = Symbol("ventijs.upgraded");

export type UpgradeCallback = (client: WebSocket, request: IncomingMessage) => void;

export function shouldHandle(state: ServerState, request: IncomingMessage): boolean {
  const path = state.options.path;
  if (!path) return true;
  const url = request.url ?? "";
  const index = url.indexOf("?");
  return (index !== -1 ? url.slice(0, index) : url) === path;
}

/// Mirrors `WebSocketServer.handleUpgrade`: validate the handshake, apply
/// `verifyClient`, write the 101 response, and hand the accepted socket to the
/// caller. Validation failures route through the `wsClientError` policy.
export function handleUpgrade(
  state: ServerState,
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  callback: UpgradeCallback,
): void {
  socket.on("error", () => {
    socket.destroy();
  });

  const key = request.headers["sec-websocket-key"];
  const upgrade = request.headers.upgrade;
  const version = Number(request.headers["sec-websocket-version"]);

  if (request.method !== "GET") {
    abortOrEmit(state, request, socket, 405, "Invalid HTTP method");
    return;
  }
  if (typeof upgrade !== "string" || upgrade.toLowerCase() !== "websocket") {
    abortOrEmit(state, request, socket, 400, "Invalid Upgrade header");
    return;
  }
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
    abortOrEmit(state, request, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
    return;
  }
  if (version !== 8 && version !== 13) {
    abortOrEmit(state, request, socket, 400, "Missing or invalid Sec-WebSocket-Version header");
    return;
  }
  if (!shouldHandle(state, request)) {
    abortHandshake(socket, 400);
    return;
  }

  const protocols = parseProtocols(state, request, socket);
  if (protocols === undefined) return;
  const verify = state.normalizedOptions.verifyClient ?? null;
  if (verify === null) {
    completeUpgrade(state, request, socket, head, key, protocols, callback);
    return;
  }
  // `ws` forwards the raw header, which can be undefined, even though its
  // types declare `origin: string`; the cast keeps that observable behavior.
  const info = {
    origin: requestHeader(request, version === 8 ? "sec-websocket-origin" : "origin"),
    secure: isSecure(request),
    req: request,
  } as unknown as Parameters<VerifyClientCallbackSync>[0];
  if (verify.length === 2) {
    (verify as VerifyClientCallbackAsync)(info, (verified, code, message, headers) => {
      if (!verified) {
        abortHandshake(socket, code || 401, message, headers);
        return;
      }
      completeUpgrade(state, request, socket, head, key, protocols, callback);
    });
    return;
  }
  if (!(verify as VerifyClientCallbackSync)(info)) {
    abortHandshake(socket, 401);
    return;
  }
  completeUpgrade(state, request, socket, head, key, protocols, callback);
}

function completeUpgrade(
  state: ServerState,
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  key: string,
  protocols: readonly string[],
  callback: UpgradeCallback,
): void {
  if (!socket.readable || !socket.writable) {
    socket.destroy();
    return;
  }
  if ((socket as Duplex & { [UPGRADED]?: true })[UPGRADED] === true) {
    throw createError(
      "ERR_INVALID_STATE",
      "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration",
    );
  }
  if (state.lifecycle !== "running") {
    abortHandshake(socket, 503);
    return;
  }
  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${socketAccept(key)}`,
  ];
  const accepted = Reflect.construct(state.webSocket, [
    null,
    undefined,
    state.options,
  ]) as WebSocket;
  const protocol = selectProtocol(state, protocols, request);
  if (protocol) headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
  emitEvent(state, "headers", headers, request);
  Object.defineProperty(socket, UPGRADED, { value: true });
  socket.write(headers.concat("\r\n").join("\r\n"));
  attachSocket(accepted, socket);
  if (state.normalizedOptions.clientTracking) trackClient(state, accepted);
  callback(accepted, request);
}
