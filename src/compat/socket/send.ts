import { sendSocket } from "../../binding/socket";
import type { SocketState } from "../../types/socket";
import type { EngineStatus } from "../../types/status";
import { createError } from "../errors";
import { CONNECTING, OPEN } from "../ready-state";
import { bufferedAmountOf, defer, notOpenError, statusError, toPayload } from "./payload";

const NOT_ATTACHED =
  "ventijs: the socket has no native transport attached; engine socket adoption is not implemented yet";

export function sendData(
  state: SocketState,
  data: unknown,
  options: unknown,
  callback: unknown,
): void {
  if (state.readyState === CONNECTING) throw notOpenError(CONNECTING);
  const payload = toPayload(data);
  const failure = resolveCallback(options, callback);
  if (state.readyState !== OPEN) {
    state.bufferedAmount += payload.bytes.length;
    defer(failure, notOpenError(state.readyState));
    return;
  }
  if (state.attachment === null) {
    defer(failure, createError("ERR_INVALID_STATE", NOT_ATTACHED));
    return;
  }
  const binary = sendBinary(options, payload.binary);
  const status = sendSocket(
    state.attachment.server,
    state.attachment.connection,
    payload.bytes,
    binary,
  );
  applySendStatus(state, status, payload.bytes.length, failure);
}

/// `ws` treats a function in the options position as the callback, so the
/// options object never doubles as the callback slot.
function resolveCallback(options: unknown, callback: unknown): unknown {
  if (typeof options === "function") return options;
  return callback;
}

function sendBinary(options: unknown, fallback: boolean): boolean {
  if (typeof options !== "object" || options === null) return fallback;
  const binary = (options as { binary?: unknown }).binary;
  return typeof binary === "boolean" ? binary : fallback;
}

function applySendStatus(
  state: SocketState,
  status: EngineStatus,
  length: number,
  callback: unknown,
): void {
  switch (status) {
    case "ok":
      state.bufferedAmount = bufferedAmountOf(state);
      defer(callback);
      return;
    case "backpressure":
      defer(
        callback,
        createError("ERR_BACKPRESSURE", "ventijs: the outbound staging ring is full"),
      );
      return;
    case "closing":
    case "closed":
      state.bufferedAmount += length;
      defer(callback, notOpenError(state.readyState));
      return;
    case "invalid-handle":
      defer(callback, createError("ERR_INVALID_HANDLE", "ventijs: the connection handle is stale"));
      return;
    default:
      defer(callback, statusError(status));
  }
}
