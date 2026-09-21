# ws Compatibility Matrix

ventijs targets 1:1 observable behavior and types with `ws` plus `@types/ws`
8.18.1, which is the compatibility contract vendored at
[`src/types/ws.d.ts`](src/types/ws.d.ts); the pinned packages are
devDependencies so the conformance suite can run both implementations side by
side. This file is the parity tracker: every public surface item, the module
that owns it, its status, and the test that proves it.

Update the relevant row in the same pull request that implements or changes a
surface. A row is only `done` when its evidence test exists and passes.

Status legend:

- `done` - implemented and covered by the evidence test.
- `partial` - exists in a limited form; the row names what is missing.
- `todo` - planned, not implemented.
- `deferred` - deliberately out of scope until the named prerequisite lands.

uWebSockets.js is design inspiration only. None of its API is a public surface
of ventijs.

## Type surface and packaging

| Surface                      | Contract                                                                              | Owner                                             | Status | Evidence                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ | --------------------------------------------------------------- |
| Named type exports           | Every `@types/ws` ESM named export, plus `WebSocketEventMap` as a documented superset | `src/types/ws.d.ts`, `src/index.ts`               | done   | `tests/types/consumer.ts`                                       |
| `Server` type                | `export { type Server }` in upstream's ESM entry                                      | `src/types/ws.d.ts`, `src/index.ts`               | done   | `tests/types/consumer.ts`                                       |
| Type-only default            | `import type WebSocket from "ventijs"` mirrors `ws`                                   | `src/index.ts`                                    | done   | `tests/types/consumer.ts`                                       |
| Qualified names              | `WebSocket.RawData`, `WebSocket.ServerOptions`, ...                                   | `src/types/ws.d.ts`, `src/compat/constructors.ts` | done   | `tests/types/consumer.ts`                                       |
| Built declaration resolution | Resolves through `exports` as a Node ESM consumer, `skipLibCheck: false`              | `tsconfig.dist-types.json`, `tsdown`              | done   | `tests/declarations/consumer.ts`                                |
| Runtime values               | Default and named `WebSocket`, `WebSocketServer`, `createWebSocketStream`             | `src/compat/constructors.ts`, `src/index.ts`      | done   | `tests/compat/socket.test.ts`, `tests/declarations/consumer.ts` |

## Event system

| Surface                            | Contract                                                                                                                       | Owner                                   | Status | Evidence                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------ | ------------------------------ |
| Duplicate listeners                | `on` keeps duplicates, matching `EventEmitter`                                                                                 | `src/compat/events.ts`                  | done   | `tests/events.test.ts`         |
| Removal semantics                  | One occurrence removed per `unsubscribe`; previous registry untouched                                                          | `src/compat/events.ts`                  | done   | `tests/events.test.ts`         |
| Dispatch snapshot                  | Handlers added or removed mid-dispatch do not affect the in-flight run                                                         | `src/compat/events.ts`                  | done   | `tests/events.test.ts`         |
| Exception propagation              | A throwing handler propagates and skips the remaining handlers                                                                 | `src/compat/events.ts`                  | done   | `tests/events.test.ts`         |
| Listener counts and empty dispatch | `listenerCount` and `dispatch` return counts, zero included                                                                    | `src/compat/events.ts`                  | done   | `tests/events.test.ts`         |
| `this` binding                     | Listeners are invoked with the emitter as `this`                                                                               | `src/compat/{emitter,socket,server}.ts` | done   | `tests/compat/emitter.test.ts` |
| `error` with no listeners          | `emit("error")` throws the error; policy lives with the factories                                                              | `src/compat/{emitter,socket,server}.ts` | done   | `tests/compat/emitter.test.ts` |
| `once` and prepend variants        | `once`, `prependListener`, `prependOnceListener`                                                                               | `src/compat/emitter.ts`                 | done   | `tests/compat/emitter.test.ts` |
| Emitter introspection and teardown | `emit`, `removeAllListeners`, `listeners`, `rawListeners`, `eventNames`, `listenerCount`, `getMaxListeners`, `setMaxListeners` | `src/compat/{emitter,events}.ts`        | done   | `tests/compat/emitter.test.ts` |

## Socket API (server-side connection)

| Surface                   | Contract                                                                                  | Owner                                                                    | Status   | Evidence                            |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- | ----------------------------------- |
| Observable properties     | `binaryType`, `bufferedAmount`, `extensions`, `isPaused`, `protocol`, `readyState`, `url` | `src/compat/socket.ts`, `src/binding/socket.ts`, `src/engine/socket.zig` | partial  | `tests/compat/socket.test.ts`       |
| Ready-state constants     | `CONNECTING`/`OPEN`/`CLOSING`/`CLOSED` on the constructor and the instance                | `src/compat/{constructors,ready-state}.ts`                               | done     | `tests/compat/socket.test.ts`       |
| Send and frame methods    | `send(data, options?, cb?)`, `ping`, `pong`, `close`, `terminate`, `pause`, `resume`      | `src/compat/{socket-send,socket-lifecycle}.ts`, `src/binding/socket.ts`  | partial  | `tests/compat/socket.test.ts`       |
| Node events               | `open`, `message`, `close`, `error`, `ping`, `pong`                                       | `src/compat/{socket,event-objects}.ts`, `src/types/socket.ts`            | partial  | `tests/compat/socket.test.ts`       |
| Client-only socket events | `upgrade`, `redirect`, `unexpected-response`                                              | deferred (client scope, ADR)                                             | deferred | -                                   |
| DOM handlers              | `onopen`/`onerror`/`onclose`/`onmessage`, `addEventListener`, `removeEventListener`       | `src/compat/{event-target,event-objects}.ts`                             | done     | `tests/compat/event-target.test.ts` |
| Pause gating              | `pause()` stops event emission until `resume()`                                           | `src/compat/socket-lifecycle.ts`, `src/engine/socket.zig`                | partial  | `tests/compat/socket.test.ts`       |

Partial socket rows share one prerequisite: the engine-thread drain and the
message receiver are not wired yet. `send`, `close`, `pause`, and `resume`
stage through `src/binding/socket.ts` and callbacks fire when the payload is
staged, not when it is flushed; `ping`/`pong` validate arguments and report the
missing control-frame staging; `message` and `ping`/`pong` events await the
receiver; `terminate()` latches the facade and destroys an upgraded Node
stream; `url`, `protocol`, and `extensions` keep their server-side defaults.
The server's `perMessageDeflate` option is normalized but not negotiated, so a
client offering the extension still connects uncompressed.

## WebSocketServer

| Surface                         | Contract                                                                                                                                                                                                                 | Owner                                             | Status  | Evidence                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| Constructor and listen callback | `new WebSocketServer(options?, callback?)`                                                                                                                                                                               | `src/compat/server.ts`                            | done    | `tests/compat/server.test.ts`                                                                    |
| Options                         | `host`, `port`, `backlog`, `server`, `noServer`, `path`, `clientTracking`, `verifyClient`, `handleProtocols`, `perMessageDeflate`, `maxPayload`, `skipUTF8Validation`, `allowSynchronousEvents`, `autoPong`, `WebSocket` | `src/compat/{options,server-options}.ts`          | partial | `tests/compat/options.test.ts`, `tests/conformance/options.conformance.test.ts`                  |
| Observable properties           | `options`, `path`, `clients`                                                                                                                                                                                             | `src/compat/server.ts`, `src/types/server.ts`     | done    | `tests/compat/server.test.ts`                                                                    |
| Methods                         | `address()`, `close(cb?)`, `handleUpgrade()`, `shouldHandle()`                                                                                                                                                           | `src/compat/{server,server-close,upgrade}.ts`     | done    | `tests/compat/{server,upgrade}.test.ts`                                                          |
| Events                          | `connection`, `error`, `headers`, `close`, `listening`, `wsClientError`                                                                                                                                                  | `src/compat/{server,server-listeners,upgrade}.ts` | done    | `tests/compat/{server,upgrade}.test.ts`                                                          |
| HTTP server integration         | `noServer` routing, `server` option, `upgrade` wiring with the Node `http.Server`                                                                                                                                        | `src/compat/{upgrade,server-listeners}.ts`        | done    | `tests/compat/upgrade.test.ts`, `tests/conformance/upgrade.conformance.test.ts`                  |
| Handshake policy                | `verifyClient` sync/async, `handleProtocols`, origin/path checks                                                                                                                                                         | `src/compat/{upgrade,handshake}.ts`               | done    | `tests/compat/{upgrade,upgrade-policy}.test.ts`, `tests/conformance/upgrade.conformance.test.ts` |
| Rejections                      | `wsClientError` for handshake failures, destroy semantics                                                                                                                                                                | `src/compat/{handshake,upgrade}.ts`               | done    | `tests/compat/{upgrade,upgrade-policy}.test.ts`, `tests/conformance/upgrade.conformance.test.ts` |

## Stream and client

| Surface                 | Contract                                                                                      | Owner                          | Status   | Evidence                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `createWebSocketStream` | Duplex stream over an open socket                                                             | `src/compat/stream.ts`         | done     | `tests/conformance/stream.conformance.test.ts`, `tests/compat/stream.test.ts`   |
| Client construction     | `new WebSocket(address, protocols?, options?)`, redirects, `unexpected-response`              | `src/compat/client.ts`         | deferred | -                                                                               |
| Client options          | `followRedirects`, `maxRedirects`, `origin`, `headers`, `agent`, TLS options, `finishRequest` | `src/compat/client-options.ts` | partial  | `tests/compat/options.test.ts`, `tests/conformance/options.conformance.test.ts` |

## Boundary and lifetime invariants

| Invariant                  | Contract                                                                                            | Owner                                                                             | Status  | Evidence                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Retained inbound payloads  | Frames are copied into Node-owned buffers before handlers run                                       | `src/binding/socket.ts`, `src/engine/socket_io.zig`                               | todo    | -                                                                                 |
| Borrowed outbound buffers  | Buffers live only for the native call, then land in the bounded queue                               | `src/binding/socket.ts`, `src/engine/{payload,socket}.zig`                        | partial | `tests/binding/socket.test.ts`                                                    |
| Generation-checked handles | Stale handles produce typed errors, never crashes or use-after-free                                 | `src/binding/{handle,server,socket}.ts`, `src/engine/handles.zig`                 | partial | `tests/binding/server-lifecycle.test.ts`, `tests/binding/socket-boundary.test.ts` |
| Exactly-once close         | Terminal state is latched before `close` dispatch                                                   | `src/compat/socket-lifecycle.ts`, `src/engine/socket.zig`                         | partial | `tests/binding/socket-boundary.test.ts`, `tests/compat/socket.test.ts`            |
| Backpressure               | `bufferedAmount` growth plus send callbacks, bounded queues; `send` returns no value, matching `ws` | `src/protocol/backpressure.ts`, `src/binding/socket.ts`, `src/engine/payload.zig` | partial | `tests/binding/socket.test.ts`, `tests/compat/socket.test.ts`                     |
| Close code mapping         | `maxPayload` 1009, protocol errors 1002, policy rejections 1008                                     | `src/protocol/close-codes.ts`, `src/engine/{status,socket}.zig`                   | partial | `tests/protocol/close-codes.test.ts`                                              |
| Per-message deflate        | Option normalization in TS, codec in the engine                                                     | `src/compat/{options,server-options,client-options}.ts`, `src/engine/socket.zig`  | partial | `tests/compat/options.test.ts`                                                    |

## Error shape policy

ventijs throws `Error` instances that keep the `ws` constructor (`TypeError`,
`RangeError`, `SyntaxError`) and message text wherever `ws` defines one, and
adds a stable `ERR_*` code from `src/types/errors.ts` to every error. `ws` uses
`WS_ERR_*` codes internally and leaves many thrown errors uncoded. This
additive divergence follows the repository rule that errors carry a stable
string code; the compat factories must pin the class, message, and code of
every thrown error with tests as they land. The facade pins `ERR_BACKPRESSURE`
for a full staging ring, `ERR_SOCKET_NOT_OPEN` for sends before `open`, the
close-code and close-reason codes for `close()`, and `ERR_PROTOCOL` for
`wsClientError`; `tests/compat/{socket,upgrade-policy}.test.ts` assert them.

## Verification surface

| Suite                                                                | Purpose                                                                       | Status  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `tests/binding.test.ts`                                              | Native build, addon load, engine version round-trip                           | done    |
| `tests/binding/**`                                                   | Lifecycle, connection slab, and socket operation boundaries                   | done    |
| `tests/events.test.ts`                                               | Listener registry semantics                                                   | done    |
| `tests/protocol/**`                                                  | Close code, framing, and backpressure helpers                                 | done    |
| `tests/compat/**`                                                    | Facade units, option normalization, and coded error factories                 | done    |
| `tests/compat/emitter.test.ts`                                       | Listener surface parity with `EventEmitter`, `this` binding, unhandled errors | done    |
| `tests/compat/event-target.test.ts`                                  | DOM listeners, attributes, and event object shapes                            | done    |
| `tests/compat/{socket,server,upgrade,upgrade-policy,stream}.test.ts` | Facade lifecycle and HTTP upgrade policy                                      | done    |
| `tests/conformance/upgrade.conformance.test.ts`                      | Handshake responses compared byte-for-byte against `ws`                       | done    |
| `tests/conformance/stream.conformance.test.ts`                       | Duplex adapter behavior compared against `ws`                                 | done    |
| `tests/types/**`                                                     | Compile-time public surface, every event-map entry, state records             | done    |
| `tests/declarations/**`                                              | Built declarations through the package `exports` map                          | done    |
| `tests/conformance/**`                                               | The same scenario run against `ws` and ventijs, comparing observable behavior | partial |
| `bench/**`                                                           | Measured throughput and latency against `ws` on the same host                 | todo    |
| Autobahn (RFC 6455)                                                  | Protocol conformance report through the CI target                             | todo    |
