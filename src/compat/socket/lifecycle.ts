import { closeSocket, pauseSocket, resumeSocket } from "../../binding/socket";
import {
  CLOSE_ABNORMAL,
  CLOSE_NORMAL,
  isValidCloseReason,
  isValidStatusCode,
} from "../../protocol/close-codes";
import type { SocketState } from "../../types/socket";
import type { EngineStatus } from "../../types/status";
import { emitEvent } from "../events/emitter";
import { createError } from "../errors";
import { CLOSED, CLOSING, CONNECTING } from "../ready-state";
import { bufferedAmountOf, statusError } from "./payload";

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
  // The terminal latch must run even when an unhandled `error` throws.
  try {
    emitEvent(state, "error", error);
  } finally {
    finishConnection(state, CLOSE_ABNORMAL, EMPTY);
  }
}

export function closeConnection(state: SocketState, code?: unknown, reason?: unknown): void {
  if (state.readyState === CLOSED) return;
  if (state.readyState === CONNECTING) {
    finishConnection(state, CLOSE_ABNORMAL, EMPTY);
    return;
  }
  if (state.readyState === CLOSING) return;
  const closeCode = code === undefined ? CLOSE_NORMAL : Math.trunc(assertCloseCode(code));
  const closeReason = toCloseReason(reason);
  state.readyState = CLOSING;
  if (state.attachment === null) return;
  const status = closeSocket(
    state.attachment.server,
    state.attachment.connection,
    closeCode,
    closeReason,
  );
  if (status === "ok") {
    state.closeFrameSent = true;
    state.bufferedAmount = bufferedAmountOf(state);
    return;
  }
  if (status === "closing" || status === "closed") {
    finishConnection(state, CLOSE_ABNORMAL, EMPTY);
    return;
  }
  failConnection(state, closeFailure(status));
}

/// Maps a rejected native close onto a coded error instead of leaving the
/// socket latched in CLOSING with no frame sent.
function closeFailure(status: EngineStatus): Error {
  if (status === "backpressure") {
    return createError("ERR_BACKPRESSURE", "ventijs: the outbound staging ring is full");
  }
  if (status === "invalid-handle") {
    return createError("ERR_INVALID_HANDLE", "ventijs: the connection handle is stale");
  }
  if (status === "ok" || status === "closing" || status === "closed") {
    return createError("ERR_INVALID_STATE", "ventijs: the connection is already closing");
  }
  return statusError(status);
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
