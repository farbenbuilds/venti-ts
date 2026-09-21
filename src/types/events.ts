export type EventMap = {
  readonly [event: string]: readonly unknown[];
};

export type Handler<Args extends readonly unknown[]> = (...args: Args) => void;

export type Registry<E extends EventMap> = {
  [K in keyof E]?: readonly Handler<E[K]>[];
};

/// The mutable slice an emitter factory closes over. `target` is the record
/// listeners observe as `this`; it is assigned once the record exists.
export type EmitterState<E extends EventMap> = {
  listeners: Registry<E>;
  maxListeners: number;
  target: unknown;
};

/// The Node `EventEmitter` surface both facades expose. `ws` types the
/// registration methods as returning the emitter; the constructor boundary
/// restores that with a cast, so the factories never touch `this`.
export type Emitter<E extends EventMap> = {
  on: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  addListener: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  once: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  prependListener: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  prependOnceListener: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  off: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  removeListener: <K extends keyof E>(event: K, handler: Handler<E[K]>) => void;
  removeAllListeners: (event?: keyof E) => void;
  emit: <K extends keyof E>(event: K, ...args: E[K]) => boolean;
  listeners: <K extends keyof E>(event: K) => Handler<E[K]>[];
  rawListeners: <K extends keyof E>(event: K) => Handler<E[K]>[];
  eventNames: () => (keyof E)[];
  listenerCount: (event: keyof E) => number;
  getMaxListeners: () => number;
  setMaxListeners: (count: number) => void;
};
