import type { ReadyState } from "../../types/close";
import type { ClientOptions, ServerOptions, WebSocket } from "../../types/ws";
import { createEmitter } from "../events/emitter";
import { createError } from "../errors";
import {
  addEventListener,
  defineDomAttributes,
  removeEventListener,
  type DomListenerOptions,
} from "../events/dom-listeners";
import { CLOSED, CLOSING, CONNECTING, OPEN } from "../ready-state";
import {
  closeConnection,
  pauseConnection,
  resumeConnection,
  terminateConnection,
} from "./lifecycle";
import { controlFrame } from "./control";
import { sendData } from "./send";
import { brandSocket, createSocketState } from "./state";

export { isSocket } from "./state";

/// The `ws`-shaped socket record. Client construction is deferred, so a
/// non-null address reports the deferred scope; `null` builds the server-side
/// socket the upgrade path adopts, exactly like `new WebSocket(null)`.
export function createSocket(
  address: string | URL | null,
  protocols?: string | string[],
  options?: ClientOptions | ServerOptions,
): WebSocket {
  if (address !== null) {
    throw createError(
      "ERR_INVALID_STATE",
      "ventijs: client construction is deferred; only server-side sockets are implemented",
    );
  }
  const state = createSocketState();
  void protocols;
  void options;
  const emitter = createEmitter(state);
  const socket = {
    CONNECTING,
    OPEN,
    CLOSING,
    CLOSED,
    get binaryType(): string {
      return state.binaryType;
    },
    set binaryType(value: string) {
      // `ws` also accepts "blob" whenever the Blob global exists; the vendored
      // types omit it, so the record widens only at runtime.
      if (
        value !== "nodebuffer" &&
        value !== "arraybuffer" &&
        value !== "fragments" &&
        value !== "blob"
      ) {
        return;
      }
      state.binaryType = value as typeof state.binaryType;
    },
    get bufferedAmount(): number {
      return state.bufferedAmount;
    },
    get extensions(): string {
      return state.extensions;
    },
    get isPaused(): boolean {
      return state.isPaused;
    },
    get protocol(): string {
      return state.protocol;
    },
    get readyState(): ReadyState {
      return state.readyState;
    },
    get url(): string {
      return state.url;
    },
    ...emitter,
    send: (data: unknown, sendOptions?: unknown, callback?: unknown): void => {
      sendData(state, data, sendOptions, callback);
    },
    ping: (data?: unknown, mask?: unknown, callback?: unknown): void => {
      controlFrame(state, "ping", data, mask, callback);
    },
    pong: (data?: unknown, mask?: unknown, callback?: unknown): void => {
      controlFrame(state, "pong", data, mask, callback);
    },
    close: (code?: unknown, reason?: unknown): void => {
      closeConnection(state, code, reason);
    },
    terminate: (): void => {
      terminateConnection(state);
    },
    pause: (): void => {
      pauseConnection(state);
    },
    resume: (): void => {
      resumeConnection(state);
    },
    addEventListener: (
      type: string,
      handler: unknown,
      listenerOptions?: DomListenerOptions,
    ): void => {
      addEventListener(state, type, handler, listenerOptions);
    },
    removeEventListener: (type: string, handler: unknown): void => {
      removeEventListener(state, type, handler);
    },
  };
  state.target = socket;
  defineDomAttributes(socket, state);
  brandSocket(socket, state);
  return socket as unknown as WebSocket;
}
