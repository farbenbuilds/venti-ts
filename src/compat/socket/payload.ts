import { socketBufferedAmount } from "../../binding/socket";
import type { CodedError } from "../../types/errors";
import type { SocketState } from "../../types/socket";
import type { ErrorStatus } from "../../types/status";
import { createError, createStatusError } from "../errors";

const READY_STATE_NAMES = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"] as const;

export type SocketPayload = {
  readonly bytes: Buffer;
  readonly binary: boolean;
};

/// Normalizes the `ws` payload surface. Numbers become text like `ws` does;
/// a falsy payload is the empty buffer; everything else goes through
/// `Buffer.from`, which enforces the same BufferLike contract and throws the
/// same `TypeError` for out-of-type values. Blob payloads stay unsupported
/// until the engine owns deflate and blobs; `Buffer.from` rejects them.
export function toPayload(data: unknown): SocketPayload {
  if (typeof data === "number") return { bytes: Buffer.from(String(data), "utf8"), binary: false };
  if (typeof data === "string") {
    return data.length === 0
      ? { bytes: Buffer.alloc(0), binary: false }
      : { bytes: Buffer.from(data, "utf8"), binary: false };
  }
  if (!data) return { bytes: Buffer.alloc(0), binary: true };
  return { bytes: Buffer.from(data as never), binary: true };
}

export function notOpenError(readyState: number): CodedError {
  const name = READY_STATE_NAMES[readyState] ?? "UNKNOWN";
  return createError(
    "ERR_SOCKET_NOT_OPEN",
    `WebSocket is not open: readyState ${readyState} (${name})`,
  );
}

export function statusError(status: ErrorStatus): CodedError {
  return createStatusError(status, `ventijs: socket operation failed with status "${status}"`);
}

export function bufferedAmountOf(state: SocketState): number {
  if (state.attachment === null) return state.bufferedAmount;
  return socketBufferedAmount(state.attachment.server, state.attachment.connection);
}

/// Schedules a `ws`-style callback. `nextTick` keeps send and close callbacks
/// off the caller's stack, matching the native sender's completion timing.
export function defer(callback: unknown, error?: Error): void {
  if (typeof callback !== "function") return;
  process.nextTick(callback as (failure?: Error) => void, error);
}
