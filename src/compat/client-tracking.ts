import type { ServerState } from "../types/server";
import type { WebSocket } from "../types/ws";
import { emitClose } from "./server-close";

/// Adds an accepted socket to `server.clients` and removes it on close. When
/// `close()` was called first, the last client leaving releases the deferred
/// server `close` event.
export function trackClient(state: ServerState, socket: WebSocket): void {
  state.clients.add(socket);
  socket.once("close", () => {
    state.clients.delete(socket);
    if (state.shouldEmitClose && state.clients.size === 0) process.nextTick(() => emitClose(state));
  });
}
