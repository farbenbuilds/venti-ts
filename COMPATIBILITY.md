# ws Compatibility Matrix

venti-ts targets 1:1 observable behavior and types with `ws` plus `@types/ws`
8.18.1, which is the compatibility contract vendored at
[`src/types/ws.d.ts`](src/types/ws.d.ts). This file is the parity tracker: every
public surface item, the module that owns it, its status, and the test that
proves it.

Update the relevant row in the same pull request that implements or changes a
surface. A row is only `done` when its evidence test exists and passes.

Status legend:

- `done` - implemented and covered by the evidence test.
- `partial` - exists in a limited form; the row names what is missing.
- `todo` - planned, not implemented.
- `deferred` - deliberately out of scope until the named prerequisite lands.

uWebSockets.js is design inspiration only. None of its API is a public surface
of venti-ts.

## Type surface and packaging

| Surface                      | Contract                                                                              | Owner                                | Status | Evidence                         |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ | ------ | -------------------------------- |
| Named type exports           | Every `@types/ws` ESM named export, plus `WebSocketEventMap` as a documented superset | `src/types/ws.d.ts`, `src/index.ts`  | done   | `tests/types/consumer.ts`        |
| `Server` type                | `export { type Server }` in upstream's ESM entry                                      | `src/types/ws.d.ts`, `src/index.ts`  | done   | `tests/types/consumer.ts`        |
| Type-only default            | `import type WebSocket from "venti-ts"` mirrors `ws`                                  | `src/index.ts`                       | done   | `tests/types/consumer.ts`        |
| Qualified names              | `WebSocket.RawData`, `WebSocket.ServerOptions`, ...                                   | `src/types/ws.d.ts`                  | done   | `tests/types/consumer.ts`        |
| Built declaration resolution | Resolves through `exports` as a Node ESM consumer, `skipLibCheck: false`              | `tsconfig.dist-types.json`, `tsdown` | done   | `tests/declarations/consumer.ts` |
| Runtime values               | Default and named `WebSocket`, `WebSocketServer`, `createWebSocketStream`             | `src/compat/**`                      | todo   | -                                |

## Event system

| Surface                            | Contract                                                                                                                       | Owner                                          | Status | Evidence               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------ | ---------------------- |
| Duplicate listeners                | `on` keeps duplicates, matching `EventEmitter`                                                                                 | `src/compat/events.ts`                         | done   | `tests/events.test.ts` |
| Removal semantics                  | One occurrence removed per `unsubscribe`; previous registry untouched                                                          | `src/compat/events.ts`                         | done   | `tests/events.test.ts` |
| Dispatch snapshot                  | Handlers added or removed mid-dispatch do not affect the in-flight run                                                         | `src/compat/events.ts`                         | done   | `tests/events.test.ts` |
| Exception propagation              | A throwing handler propagates and skips the remaining handlers                                                                 | `src/compat/events.ts`                         | done   | `tests/events.test.ts` |
| Listener counts and empty dispatch | `listenerCount` and `dispatch` return counts, zero included                                                                    | `src/compat/events.ts`                         | done   | `tests/events.test.ts` |
| `this` binding                     | Listeners are invoked with the emitter as `this`                                                                               | `src/compat/socket.ts`, `src/compat/server.ts` | todo   | -                      |
| `error` with no listeners          | `emit("error")` throws the error; policy lives with the factories                                                              | `src/compat/socket.ts`, `src/compat/server.ts` | todo   | -                      |
| `once` and prepend variants        | `once`, `prependListener`, `prependOnceListener`                                                                               | `src/compat/events.ts`                         | todo   | -                      |
| Emitter introspection and teardown | `emit`, `removeAllListeners`, `listeners`, `rawListeners`, `eventNames`, `listenerCount`, `getMaxListeners`, `setMaxListeners` | `src/compat/events.ts`                         | todo   | -                      |

## Socket API (server-side connection)

| Surface                   | Contract                                                                                  | Owner                                                             | Status   | Evidence |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | -------- |
| Observable properties     | `binaryType`, `bufferedAmount`, `extensions`, `isPaused`, `protocol`, `readyState`, `url` | `src/compat/socket.ts`, `src/binding/socket.ts`, `src/socket.zig` | todo     | -        |
| Ready-state constants     | `CONNECTING`/`OPEN`/`CLOSING`/`CLOSED` on the constructor and the instance                | `src/compat/socket.ts`                                            | todo     | -        |
| Send and frame methods    | `send(data, options?, cb?)`, `ping`, `pong`, `close`, `terminate`, `pause`, `resume`      | `src/compat/socket.ts`, `src/binding/socket.ts`, `src/socket.zig` | todo     | -        |
| Node events               | `open`, `message`, `close`, `error`, `ping`, `pong`                                       | `src/compat/socket.ts`, `src/types/socket.ts`                     | todo     | -        |
| Client-only socket events | `upgrade`, `redirect`, `unexpected-response`                                              | deferred (client scope, ADR)                                      | deferred | -        |
| DOM handlers              | `onopen`/`onerror`/`onclose`/`onmessage`, `addEventListener`, `removeEventListener`       | `src/compat/socket.ts`                                            | todo     | -        |
| Pause gating              | `pause()` stops event emission until `resume()`                                           | `src/compat/socket.ts`, `src/socket.zig`                          | todo     | -        |

## WebSocketServer

| Surface                         | Contract                                                                                                                                                                                                                 | Owner                                           | Status | Evidence |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------ | -------- |
| Constructor and listen callback | `new WebSocketServer(options?, callback?)`                                                                                                                                                                               | `src/compat/server.ts`                          | todo   | -        |
| Options                         | `host`, `port`, `backlog`, `server`, `noServer`, `path`, `clientTracking`, `verifyClient`, `handleProtocols`, `perMessageDeflate`, `maxPayload`, `skipUTF8Validation`, `allowSynchronousEvents`, `autoPong`, `WebSocket` | `src/compat/options.ts`                         | todo   | -        |
| Observable properties           | `options`, `path`, `clients`                                                                                                                                                                                             | `src/compat/server.ts`, `src/types/server.ts`   | todo   | -        |
| Methods                         | `address()`, `close(cb?)`, `handleUpgrade()`, `shouldHandle()`                                                                                                                                                           | `src/compat/server.ts`, `src/compat/upgrade.ts` | todo   | -        |
| Events                          | `connection`, `error`, `headers`, `close`, `listening`, `wsClientError`                                                                                                                                                  | `src/compat/server.ts`, `src/types/server.ts`   | todo   | -        |
| HTTP server integration         | `noServer` routing, `server` option, `upgrade` wiring with the Node `http.Server`                                                                                                                                        | `src/compat/upgrade.ts`                         | todo   | -        |
| Handshake policy                | `verifyClient` sync/async, `handleProtocols`, origin/path checks                                                                                                                                                         | `src/compat/upgrade.ts`                         | todo   | -        |
| Rejections                      | `wsClientError` for handshake failures, destroy semantics                                                                                                                                                                | `src/compat/upgrade.ts`                         | todo   | -        |

## Stream and client

| Surface                 | Contract                                                                                      | Owner                  | Status   | Evidence |
| ----------------------- | --------------------------------------------------------------------------------------------- | ---------------------- | -------- | -------- |
| `createWebSocketStream` | Duplex stream over an open socket                                                             | `src/compat/stream.ts` | todo     | -        |
| Client construction     | `new WebSocket(address, protocols?, options?)`, redirects, `unexpected-response`              | `src/compat/client.ts` | deferred | -        |
| Client options          | `followRedirects`, `maxRedirects`, `origin`, `headers`, `agent`, TLS options, `finishRequest` | deferred               | deferred | -        |

## Boundary and lifetime invariants

| Invariant                  | Contract                                                              | Owner                                                   | Status | Evidence |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- | ------ | -------- |
| Retained inbound payloads  | Frames are copied into Node-owned buffers before handlers run         | `src/binding/socket.ts`, `src/socket.zig`               | todo   | -        |
| Borrowed outbound buffers  | Buffers live only for the native call, then land in the bounded queue | `src/binding/socket.ts`, `src/socket.zig`               | todo   | -        |
| Generation-checked handles | Stale handles produce typed errors, never crashes or use-after-free   | `src/binding/errors.ts`, `src/handles.zig`              | todo   | -        |
| Exactly-once close         | Terminal state is latched before `close` dispatch                     | `src/compat/close.ts`, `src/socket.zig`                 | todo   | -        |
| Backpressure               | `send() === false` plus `bufferedAmount`, bounded queues              | `src/protocol/backpressure.ts`, `src/binding/socket.ts` | todo   | -        |
| Close code mapping         | `maxPayload` 1009, protocol errors 1002, policy rejections 1008       | `src/protocol/close-codes.ts`, `src/socket.zig`         | todo   | -        |
| Per-message deflate        | Option normalization in TS, codec in the engine                       | `src/compat/options.ts`, `src/socket.zig`               | todo   | -        |

## Verification surface

| Suite                   | Purpose                                                                        | Status |
| ----------------------- | ------------------------------------------------------------------------------ | ------ |
| `tests/binding.test.ts` | Native build, addon load, engine version round-trip                            | done   |
| `tests/events.test.ts`  | Listener registry semantics                                                    | done   |
| `tests/protocol/**`     | Close code, framing, and backpressure helpers                                  | done   |
| `tests/compat/**`       | Option normalization and coded error factories                                 | done   |
| `tests/types/**`        | Compile-time public surface, every event-map entry, state records              | done   |
| `tests/declarations/**` | Built declarations through the package `exports` map                           | done   |
| `tests/conformance/**`  | The same scenario run against `ws` and venti-ts, comparing observable behavior | todo   |
| `bench/**`              | Measured throughput and latency against `ws` on the same host                  | todo   |
| Autobahn (RFC 6455)     | Protocol conformance report through the CI target                              | todo   |
