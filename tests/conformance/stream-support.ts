export type Handler = (...args: unknown[]) => void;

export type FakeSocket = {
  readyState: number;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
  isPaused: boolean;
  readonly sent: unknown[];
  readonly counts: { paused: number; resumed: number; terminated: number };
  on(event: string, handler: Handler): FakeSocket;
  once(event: string, handler: Handler): FakeSocket;
  removeListener(event: string, handler: Handler): FakeSocket;
  emit(event: string, ...args: unknown[]): void;
  pause(): void;
  resume(): void;
  send(data: unknown, callback?: (error?: Error) => void): void;
  close(): void;
  terminate(): void;
};

/// The socket surface `createWebSocketStream` consumes, shared by both
/// implementations under test.
export function fakeSocket(): FakeSocket {
  const listeners = new Map<string, Handler[]>();
  const add = (event: string, handler: Handler): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), handler]);
  };
  const remove = (event: string, handler: Handler): void => {
    listeners.set(
      event,
      (listeners.get(event) ?? []).filter((entry) => entry !== handler),
    );
  };
  const fake: FakeSocket = {
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    isPaused: false,
    sent: [],
    counts: { paused: 0, resumed: 0, terminated: 0 },
    on(event, handler) {
      add(event, handler);
      return fake;
    },
    once(event, handler) {
      const wrapper = (...args: unknown[]): void => {
        remove(event, wrapper);
        handler(...args);
      };
      add(event, wrapper);
      return fake;
    },
    removeListener(event, handler) {
      remove(event, handler);
      return fake;
    },
    emit(event, ...args) {
      for (const handler of (listeners.get(event) ?? []).slice()) handler(...args);
    },
    pause() {
      fake.isPaused = true;
      fake.counts.paused += 1;
    },
    resume() {
      fake.isPaused = false;
      fake.counts.resumed += 1;
    },
    send(data, callback) {
      fake.sent.push(data);
      callback?.();
    },
    close() {
      fake.readyState = 2;
    },
    terminate() {
      fake.counts.terminated += 1;
      fake.readyState = 3;
      fake.emit("close");
    },
  };
  return fake;
}

export function settle(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
