import type { Handler } from "../types/events";
import type { SocketEventMap, SocketState } from "../types/socket";
import type { WebSocket } from "../types/ws";
import {
  callListener,
  createCloseEvent,
  createErrorEvent,
  createMessageEvent,
  createOpenEvent,
} from "./event-objects";
import { asTagged, originalOf, type TaggedHandler } from "./emitter";
import { subscribe, unsubscribeMatching } from "./events";

const DOM_TYPES = ["open", "error", "close", "message"] as const;
const ATTRIBUTES = [
  ["onopen", "open"],
  ["onerror", "error"],
  ["onclose", "close"],
  ["onmessage", "message"],
] as const;

export type DomEventType = (typeof DOM_TYPES)[number];

export type DomListenerOptions = {
  readonly once?: boolean;
  readonly attribute?: boolean;
};

function isDomType(type: string): type is DomEventType {
  return (DOM_TYPES as readonly string[]).includes(type);
}

function isAttribute(entry: unknown): boolean {
  const tagged = asTagged(entry);
  if (tagged.attribute === true) return true;
  return asTagged(tagged.listener).attribute === true;
}

function wrapperFor(state: SocketState, type: DomEventType, handler: unknown): TaggedHandler {
  const socket = state.target as WebSocket;
  switch (type) {
    case "open":
      return ((): void => {
        callListener(handler, socket, createOpenEvent(socket));
      }) as unknown as TaggedHandler;
    case "message":
      return ((data: WebSocket.RawData, isBinary: boolean): void => {
        callListener(
          handler,
          socket,
          createMessageEvent(socket, isBinary ? data : data.toString()),
        );
      }) as unknown as TaggedHandler;
    case "close":
      return ((code: number, reason: Buffer): void => {
        const clean = state.closeFrameReceived && state.closeFrameSent;
        callListener(handler, socket, createCloseEvent(socket, code, reason, clean));
      }) as unknown as TaggedHandler;
    case "error":
      return ((error: Error): void => {
        callListener(handler, socket, createErrorEvent(socket, error));
      }) as unknown as TaggedHandler;
  }
}

function onceDomWrapper(
  state: SocketState,
  type: DomEventType,
  wrapper: TaggedHandler,
): TaggedHandler {
  const once = (...args: readonly unknown[]): void => {
    state.listeners = unsubscribeMatching(
      state.listeners,
      type,
      (entry) => entry === (once as unknown as never),
    );
    Reflect.apply(wrapper, state.target, args);
  };
  return Object.assign(once, { listener: wrapper }) as unknown as TaggedHandler;
}

export function addEventListener(
  state: SocketState,
  type: string,
  handler: unknown,
  options: DomListenerOptions = {},
): void {
  if (!isDomType(type)) return;
  const attributed = options.attribute === true;
  const bucket = state.listeners[type] ?? [];
  if (!attributed && bucket.some((entry) => originalOf(entry) === handler && !isAttribute(entry))) {
    return;
  }
  const wrapper = wrapperFor(state, type, handler);
  wrapper.attribute = attributed;
  wrapper.listener = handler;
  const entry =
    options.once === true ? onceDomWrapper(state, type, wrapper) : (wrapper as TaggedHandler);
  state.listeners = subscribe(
    state.listeners,
    type,
    entry as unknown as Handler<SocketEventMap[DomEventType]>,
  );
}

export function removeEventListener(state: SocketState, type: string, handler: unknown): void {
  if (!isDomType(type)) return;
  state.listeners = unsubscribeMatching(
    state.listeners,
    type,
    (entry) => originalOf(entry) === handler && !isAttribute(entry),
  );
}

export function findAttributeListener(state: SocketState, type: DomEventType): unknown {
  for (const entry of state.listeners[type] ?? []) {
    if (isAttribute(entry)) return originalOf(entry);
  }
  return null;
}

export function defineDomAttributes(socket: object, state: SocketState): void {
  for (const [attribute, type] of ATTRIBUTES) {
    Object.defineProperty(socket, attribute, {
      enumerable: true,
      configurable: true,
      get: (): unknown => findAttributeListener(state, type),
      set: (handler: unknown): void => {
        state.listeners = unsubscribeMatching(state.listeners, type, (entry) => isAttribute(entry));
        if (typeof handler !== "function") return;
        addEventListener(state, type, handler, { attribute: true });
      },
    });
  }
}
