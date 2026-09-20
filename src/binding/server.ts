import type { EngineDispatch, NativeServerConfig } from "./native";
import { loadAddon } from "./load";

export type ServerHandle = number;

/// The native side packs the slot byte and a 32 bit generation into a u40.
const MAX_SERVER_HANDLE = 2 ** 40 - 1;

export function assertServerHandle(handle: ServerHandle): void {
  if (!Number.isSafeInteger(handle) || handle < 0 || handle > MAX_SERVER_HANDLE) {
    throw new RangeError(`ventijs: server handle must be a uint40, got ${handle}`);
  }
}

export function createServer(config: NativeServerConfig, dispatch: EngineDispatch): ServerHandle {
  const handle = loadAddon().createServer(config, dispatch);
  assertServerHandle(handle);
  return handle;
}

export function listenServer(handle: ServerHandle): void {
  assertServerHandle(handle);
  loadAddon().listenServer(handle);
}

export function closeServer(handle: ServerHandle): void {
  assertServerHandle(handle);
  loadAddon().closeServer(handle);
}

/// Releases native resources. Must run after `serverClosed` has been
/// dispatched; finalizing while events are queued throws `EventsPending`
/// instead of freeing memory a callback still references.
export function finalizeServer(handle: ServerHandle): void {
  assertServerHandle(handle);
  loadAddon().finalizeServer(handle);
}
