import type { EngineStatus } from "../types/status";
import type { ConnectionHandle } from "./handle";
import type { NativeSocketStatus } from "./native";
import { assertConnectionHandle } from "./handle";
import { loadAddon } from "./load";
import { assertServerHandle, type ServerHandle } from "./server";

const MAX_UINT16 = 65_535;

const ENGINE_STATUS_BY_NATIVE: Readonly<Record<NativeSocketStatus, EngineStatus>> = {
  ok: "ok",
  closing: "closing",
  closed: "closed",
  backpressure: "backpressure",
  invalidHandle: "invalid-handle",
  payloadTooLarge: "payload-too-large",
  invalidCloseCode: "invalid-close-code",
  invalidCloseReason: "invalid-close-reason",
  protocolError: "protocol-error",
  policyViolation: "policy-violation",
};

function assertPayload(data: Uint8Array): void {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("ventijs: socket payload must be a Uint8Array");
  }
}

function assertCloseCode(code: number): void {
  if (!Number.isInteger(code) || code < 0 || code > MAX_UINT16) {
    throw new RangeError(`ventijs: close code must be a uint16, got ${code}`);
  }
}

/// Stages one outbound text or binary message. The engine copies `data` into
/// its bounded staging ring before returning, so retaining or mutating the
/// buffer afterwards cannot affect the queued frame.
export function sendSocket(
  server: ServerHandle,
  connection: ConnectionHandle,
  data: Uint8Array,
  binary = false,
): EngineStatus {
  assertServerHandle(server);
  assertConnectionHandle(connection);
  assertPayload(data);
  return ENGINE_STATUS_BY_NATIVE[loadAddon().sendSocket(server, connection, data, binary)];
}

/// Validates the close code and reason, stages the close frame, and enters the
/// closing state. A second call reports `closing` instead of restaging.
export function closeSocket(
  server: ServerHandle,
  connection: ConnectionHandle,
  code: number,
  reason: Uint8Array,
): EngineStatus {
  assertServerHandle(server);
  assertConnectionHandle(connection);
  assertCloseCode(code);
  assertPayload(reason);
  return ENGINE_STATUS_BY_NATIVE[loadAddon().closeSocket(server, connection, code, reason)];
}

/// Suspends outbound writes for the connection.
export function pauseSocket(server: ServerHandle, connection: ConnectionHandle): EngineStatus {
  assertServerHandle(server);
  assertConnectionHandle(connection);
  return ENGINE_STATUS_BY_NATIVE[loadAddon().pauseSocket(server, connection)];
}

/// Resumes outbound writes for the connection.
export function resumeSocket(server: ServerHandle, connection: ConnectionHandle): EngineStatus {
  assertServerHandle(server);
  assertConnectionHandle(connection);
  return ENGINE_STATUS_BY_NATIVE[loadAddon().resumeSocket(server, connection)];
}

/// Bytes staged for the connection and not yet drained. A stale handle reads
/// zero, matching a closed `ws` socket.
export function socketBufferedAmount(server: ServerHandle, connection: ConnectionHandle): number {
  assertServerHandle(server);
  assertConnectionHandle(connection);
  return loadAddon().socketBufferedAmount(server, connection);
}
