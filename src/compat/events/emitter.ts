import type { Emitter, EmitterState, EventMap, Handler } from "../../types/events";
import { createError } from "../errors";
import {
  dispatchWith,
  eventNames,
  listenerCount,
  prepend,
  removeAll,
  subscribe,
  unsubscribeMatching,
} from "./registry";

const ERROR_EVENT = "error";
const MAX_WRAPPER_DEPTH = 3;

/// A wrapper is a function carrying the original handler on `listener`, which
/// is Node's introspection contract. DOM attribute listeners add `attribute`
/// so removal and dedupe can tell them apart from user listeners.
export type TaggedHandler = Handler<readonly unknown[]> & {
  listener?: unknown;
  attribute?: boolean;
};

export function asTagged(entry: unknown): TaggedHandler {
  return entry as TaggedHandler;
}

/// Resolves a registry entry to the handler the user passed in, unwrapping
/// the `once` and DOM layers. The walk is bounded: only this module ever sets
/// `listener`, and a user function cannot extend the chain.
export function originalOf(entry: unknown): unknown {
  let current: unknown = entry;
  for (let depth = 0; depth < MAX_WRAPPER_DEPTH; depth += 1) {
    if (typeof current !== "function") return current;
    const next = asTagged(current).listener;
    if (next === undefined) return current;
    current = next;
  }
  return current;
}

/// Removes the most recent entry that matches the handler directly or through
/// its wrapper tags, so `off(event, onceHandler)` works like Node.
export function removeTagged<E extends EventMap>(
  state: EmitterState<E>,
  event: keyof E,
  handler: unknown,
): void {
  state.listeners = unsubscribeMatching(
    state.listeners,
    event,
    (entry) => entry === handler || originalOf(entry) === handler,
  );
}

function onceWrapper<E extends EventMap, K extends keyof E>(
  state: EmitterState<E>,
  event: K,
  raw: Handler<E[K]>,
): TaggedHandler {
  const wrapper = (...args: E[K]): void => {
    state.listeners = unsubscribeMatching(
      state.listeners,
      event,
      (entry) => entry === (wrapper as unknown as Handler<E[K]>),
    );
    Reflect.apply(raw, state.target, args);
  };
  return Object.assign(wrapper, { listener: raw }) as unknown as TaggedHandler;
}

/// Subscribes a one-shot listener; the wrapper removes itself before invoking
/// so a throwing handler cannot be called twice.
export function onceEvent<E extends EventMap, K extends keyof E>(
  state: EmitterState<E>,
  event: K,
  handler: Handler<E[K]>,
): void {
  state.listeners = subscribe(state.listeners, event, onceWrapper(state, event, handler));
}

/// Dispatches one event, throwing the argument for an unhandled `error` the
/// way Node does. Both facades share this so the policy lives in one place.
export function emitEvent<E extends EventMap, K extends keyof E>(
  state: EmitterState<E>,
  event: K,
  ...args: E[K]
): boolean {
  if (event === ERROR_EVENT && listenerCount(state.listeners, event) === 0) throw args[0];
  return dispatchWith(state.listeners, state.target, event, ...args) > 0;
}

export function createEmitter<E extends EventMap>(state: EmitterState<E>): Emitter<E> {
  const addListener: Emitter<E>["addListener"] = (event, handler) => {
    state.listeners = subscribe(state.listeners, event, handler);
  };
  const once: Emitter<E>["once"] = (event, handler) => {
    onceEvent(state, event, handler);
  };
  const prependListener: Emitter<E>["prependListener"] = (event, handler) => {
    state.listeners = prepend(state.listeners, event, handler);
  };
  const prependOnceListener: Emitter<E>["prependOnceListener"] = (event, handler) => {
    state.listeners = prepend(state.listeners, event, onceWrapper(state, event, handler));
  };
  const removeListener: Emitter<E>["removeListener"] = (event, handler) => {
    removeTagged(state, event, handler);
  };
  const emit: Emitter<E>["emit"] = (event, ...args) => emitEvent(state, event, ...args);

  return {
    on: addListener,
    addListener,
    once,
    prependListener,
    prependOnceListener,
    off: removeListener,
    removeListener,
    removeAllListeners: (event) => {
      state.listeners = removeAll(state.listeners, event);
    },
    emit,
    listeners: (event) => {
      const bucket = state.listeners[event] ?? [];
      return bucket.map((entry) => originalOf(entry) as Handler<E[typeof event]>);
    },
    rawListeners: (event) => [...(state.listeners[event] ?? [])],
    eventNames: () => eventNames(state.listeners),
    listenerCount: (event) => listenerCount(state.listeners, event),
    getMaxListeners: () => state.maxListeners,
    setMaxListeners: (count) => {
      if (typeof count !== "number" || count < 0 || Number.isNaN(count)) {
        throw createError(
          "ERR_INVALID_OPTION",
          `The value of "n" is out of range. It must be a non-negative number. Received ${count}`,
          RangeError,
        );
      }
      state.maxListeners = count;
    },
  };
}
