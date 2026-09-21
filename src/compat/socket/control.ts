import type { SocketState } from "../../types/socket";
import { createError } from "../errors";
import { CONNECTING, OPEN } from "../ready-state";
import { defer, notOpenError, toPayload } from "./payload";

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
