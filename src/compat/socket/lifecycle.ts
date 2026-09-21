import { closeSocket, pauseSocket, resumeSocket } from "../../binding/socket";
import { isValidCloseReason, isValidStatusCode } from "../../protocol/close-codes";
import type { SocketState } from "../../types/socket";
import { emitEvent } from "../events/emitter";
import { createError } from "../errors";
import { CLOSED, CLOSING, CONNECTING, OPEN } from "../ready-state";
import { bufferedAmountOf, defer, notOpenError, toPayload } from "./payload";

const CLOSE_NORMAL = 1000;
const CLOSE_ABNORMAL = 1006;
const EMPTY = Buffer.alloc(0);

export function finishConnection(state: SocketState, code: number, reason: Buffer): void {
  if (state.readyState === CLOSED) return;
  state.readyState = CLOSED;
  state.closeCode = code;
  state.closeReason = reason;
  emitEvent(state, "close", code, reason);
}

export function failConnection(state: SocketState, error: Error): void {
  if (state.readyState === CLOSED) return;
  state.errorEmitted = true;
  emitEvent(state, "error", error);
  finishConnection(state, CLOSE_ABNORMAL, EMPTY);
}

export function closeConnection(state: SocketState, code?: unknown, reason?: unknown): void {
  if (state.readyState === CLOSED) return;
  if (state.readyState === CONNECTING) {
    finishConnection(state, CLOSE_ABNORMAL, EMPTY);
    return;
  }
  if (state.readyState === CLOSING) return;
  const closeCode = code === undefined ? CLOSE_NORMAL : assertCloseCode(code);
  const closeReason = toCloseReason(reason);
  state.readyState = CLOSING;
  if (state.attachment === null) return;
  const status = closeSocket(
    state.attachment.server,
    state.attachment.connection,
    closeCode,
    closeReason,
  );
  if (status !== "ok") return;
  state.closeFrameSent = true;
  state.bufferedAmount = bufferedAmountOf(state);
}

function assertCloseCode(code: unknown): number {
  if (typeof code !== "number" || !isValidStatusCode(code)) {
    throw createError(
      "ERR_INVALID_CLOSE_CODE",
      "First argument must be a valid error code number",
      TypeError,
    );
  }
  return code;
}

function toCloseReason(reason: unknown): Buffer {
  let bytes = EMPTY;
  if (typeof reason === "string") bytes = Buffer.from(reason, "utf8");
  else if (reason instanceof Uint8Array) bytes = Buffer.from(reason);
  if (!isValidCloseReason(bytes)) {
    throw createError(
      "ERR_INVALID_CLOSE_REASON",
      "The message must not be greater than 123 bytes",
      RangeError,
    );
  }
  return bytes;
}

/// Normalizes `ping`/`pong` arguments the way `ws` does. The engine stages
/// text, binary, and close frames today; control-frame staging lands with the
/// ping/pong binding, so an open socket reports the missing transport through
/// its callback instead of silently dropping the frame.
export function controlFrame(
  state: SocketState,
  kind: "ping" | "pong",
  data: unknown,
  mask: unknown,
  callback: unknown,
): void {
  if (state.readyState === CONNECTING) throw notOpenError(CONNECTING);
  let payload = data;
  let failure = callback;
  if (typeof payload === "function") {
    failure = payload;
    payload = undefined;
  } else if (typeof mask === "function") {
    failure = mask;
  }
  if (typeof payload === "number") payload = String(payload);
  if (state.readyState !== OPEN) {
    state.bufferedAmount += toPayload(payload).bytes.length;
    defer(failure, notOpenError(state.readyState));
    return;
  }
  defer(
    failure,
    createError("ERR_INVALID_STATE", `ventijs: ${kind} frames are not implemented yet`),
  );
}

export function pauseConnection(state: SocketState): void {
  if (state.readyState === CONNECTING || state.readyState === CLOSED) return;
  state.isPaused = true;
  if (state.attachment === null) return;
  pauseSocket(state.attachment.server, state.attachment.connection);
}

export function resumeConnection(state: SocketState): void {
  if (state.readyState === CONNECTING || state.readyState === CLOSED) return;
  state.isPaused = false;
  if (state.attachment === null) return;
  resumeSocket(state.attachment.server, state.attachment.connection);
}

export function terminateConnection(state: SocketState): void {
  if (state.readyState === CLOSED) return;
  if (state.transport !== null) {
    state.transport.destroy();
    return;
  }
  finishConnection(state, CLOSE_ABNORMAL, EMPTY);
}
