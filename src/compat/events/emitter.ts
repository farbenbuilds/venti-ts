import { inspect } from "node:util";
import type { Emitter, EmitterState, EventMap, EventName, Listener } from "../../types/events";
import { createError } from "../errors";
import { dispatchWith, eventNames, listenerCount, prepend, removeAll, subscribe } from "./registry";
import { listenerView, onceWrapper, removeTagged } from "./tags";

const ERROR_EVENT = "error";

/// Dispatches one event. An unhandled `error` follows Node's policy: an
/// `Error` argument is thrown as-is, anything else is wrapped with the
/// original value on `context`. Both facades share this so the policy lives
/// in one place.
export function emitEvent<E extends EventMap, K extends EventName<E>>(
  state: EmitterState<E>,
  event: K,
  ...args: E[K]
): boolean {
  if (event === ERROR_EVENT && listenerCount(state.listeners, event) === 0) {
    const failure = args[0];
    if (failure instanceof Error) throw failure;
    const wrapped = new Error(`Unhandled error. (${inspect(failure)})`);
    Object.assign(wrapped, { context: failure });
    throw wrapped;
  }
  return dispatchWith(state.listeners, state.target, event, ...args) > 0;
}

export function createEmitter<E extends EventMap>(state: EmitterState<E>): Emitter<E> {
  const addListener: Emitter<E>["addListener"] = (event, handler) => {
    state.listeners = subscribe(state.listeners, event, handler);
    return state.target;
  };
  const once: Emitter<E>["once"] = (event, handler) => {
    state.listeners = subscribe(state.listeners, event, onceWrapper(state, event, handler));
    return state.target;
  };
  const prependListener: Emitter<E>["prependListener"] = (event, handler) => {
    state.listeners = prepend(state.listeners, event, handler);
    return state.target;
  };
  const prependOnceListener: Emitter<E>["prependOnceListener"] = (event, handler) => {
    state.listeners = prepend(state.listeners, event, onceWrapper(state, event, handler));
    return state.target;
  };
  const removeListener: Emitter<E>["removeListener"] = (event, handler) => {
    removeTagged(state, event, handler);
    return state.target;
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
      return state.target;
    },
    emit,
    listeners: (event) => {
      const bucket = state.listeners[event] ?? [];
      return bucket.map((entry) => listenerView(entry) as Listener<E, typeof event>);
    },
    rawListeners: (event) => [...(state.listeners[event] ?? [])],
    eventNames: () => eventNames(state.listeners),
    listenerCount: (event) => listenerCount(state.listeners, event),
    getMaxListeners: () => state.maxListeners,
    setMaxListeners: (count: number | undefined) => {
      if (count === undefined) {
        state.maxListeners = Infinity;
        return state.target;
      }
      if (typeof count !== "number" || count < 0 || Number.isNaN(count)) {
        throw createError(
          "ERR_INVALID_OPTION",
          `The value of "n" is out of range. It must be a non-negative number. Received ${count}`,
          RangeError,
        );
      }
      state.maxListeners = count;
      return state.target;
    },
  };
}
