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

| Surface                      | Contract                                                                              | Owner                                             | Status | Evidence                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Named type exports           | Every `@types/ws` ESM named export, plus `WebSocketEventMap` as a documented superset | `src/types/ws.d.ts`, `src/index.ts`               | done   | `tests/types/consumer.ts`                                              |
| `Server` type                | `export { type Server }` in upstream's ESM entry                                      | `src/types/ws.d.ts`, `src/index.ts`               | done   | `tests/types/consumer.ts`                                              |
| Type-only default            | `import type WebSocket from "ventijs"` mirrors `ws`                                   | `src/index.ts`                                    | done   | `tests/types/consumer.ts`                                              |
| Qualified names              | `WebSocket.RawData`, `WebSocket.ServerOptions`, ...                                   | `src/types/ws.d.ts`, `src/compat/constructors.ts` | done   | `tests/types/consumer.ts`                                              |
| Built declaration resolution | Resolves through `exports` as a Node ESM consumer, `skipLibCheck: false`              | `tsconfig.dist-types.json`, `tsdown`              | done   | `tests/declarations/consumer.ts`                                       |
| Runtime values               | Default and named `WebSocket`, `WebSocketServer`, `createWebSocketStream`             | `src/compat/constructors.ts`, `src/index.ts`      | done   | `tests/compat/socket/socket.test.ts`, `tests/declarations/consumer.ts` |

## Event system

| Surface                            | Contract                                                                                                                       | Owner                                                        | Status | Evidence                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------ | -------------------------------------- |
| Duplicate listeners                | `on` keeps duplicates, matching `EventEmitter`                                                                                 | `src/compat/events/registry.ts`                              | done   | `tests/compat/events/registry.test.ts` |
| Removal semantics                  | One occurrence removed per `unsubscribe`; previous registry untouched                                                          | `src/compat/events/registry.ts`                              | done   | `tests/compat/events/registry.test.ts` |
| Dispatch snapshot                  | Handlers added or removed mid-dispatch do not affect the in-flight run                                                         | `src/compat/events/registry.ts`                              | done   | `tests/compat/events/registry.test.ts` |
| Exception propagation              | A throwing handler propagates and skips the remaining handlers                                                                 | `src/compat/events/registry.ts`                              | done   | `tests/compat/events/registry.test.ts` |
| Listener counts and empty dispatch | `listenerCount` and `dispatch` return counts, zero included                                                                    | `src/compat/events/registry.ts`                              | done   | `tests/compat/events/registry.test.ts` |
| `this` binding                     | Listeners are invoked with the emitter as `this`                                                                               | `src/compat/{events/emitter,socket/socket,server/server}.ts` | done   | `tests/compat/events/emitter.test.ts`  |
| `error` with no listeners          | `emit("error")` throws the error; policy lives with the factories                                                              | `src/compat/{events/emitter,socket/socket,server/server}.ts` | done   | `tests/compat/events/emitter.test.ts`  |
| `once` and prepend variants        | `once`, `prependListener`, `prependOnceListener`                                                                               | `src/compat/events/emitter.ts`                               | done   | `tests/compat/events/emitter.test.ts`  |
| Emitter introspection and teardown | `emit`, `removeAllListeners`, `listeners`, `rawListeners`, `eventNames`, `listenerCount`, `getMaxListeners`, `setMaxListeners` | `src/compat/{events/emitter,events/registry}.ts`             | done   | `tests/compat/events/emitter.test.ts`  |

## Socket API (server-side connection)

| Surface                   | Contract                                                                                  | Owner                                                                                   | Status   | Evidence                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| Observable properties     | `binaryType`, `bufferedAmount`, `extensions`, `isPaused`, `protocol`, `readyState`, `url` | `src/compat/socket/socket.ts`, `src/binding/socket.ts`, `src/engine/socket/socket.zig`  | partial  | `tests/compat/socket/socket.test.ts`          |
| Ready-state constants     | `CONNECTING`/`OPEN`/`CLOSING`/`CLOSED` on the constructor and the instance                | `src/compat/{constructors,ready-state}.ts`                                              | done     | `tests/compat/socket/socket.test.ts`          |
| Send and frame methods    | `send(data, options?, cb?)`, `ping`, `pong`, `close`, `terminate`, `pause`, `resume`      | `src/compat/socket/{send,lifecycle}.ts`, `src/binding/socket.ts`                        | partial  | `tests/compat/socket/socket.test.ts`          |
| Node events               | `open`, `message`, `close`, `error`, `ping`, `pong`                                       | `src/compat/socket/socket.ts`, `src/compat/events/dom-events.ts`, `src/types/socket.ts` | partial  | `tests/compat/socket/socket.test.ts`          |
| Client-only socket events | `upgrade`, `redirect`, `unexpected-response`                                              | deferred (client scope, ADR)                                                            | deferred | -                                             |
| DOM handlers              | `onopen`/`onerror`/`onclose`/`onmessage`, `addEventListener`, `removeEventListener`       | `src/compat/events/{dom-listeners,dom-events}.ts`                                       | done     | `tests/compat/events/dom-listeners.test.ts`   |
| Close reason handling     | `close(code, reason)` mirrors `ws`: string, `Uint8Array`, or absent reason                | `src/compat/socket/close-reason.ts`                                                     | partial  | `tests/conformance/close.conformance.test.ts` |
| Pause gating              | `pause()` stops event emission until `resume()`                                           | `src/compat/socket/lifecycle.ts`, `src/engine/socket/socket.zig`                        | partial  | `tests/compat/socket/socket.test.ts`          |

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

| Surface                         | Contract                                                                                                                                                                                                                 | Owner                                                | Status  | Evidence                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Constructor and listen callback | `new WebSocketServer(options?, callback?)`                                                                                                                                                                               | `src/compat/server/server.ts`                        | done    | `tests/compat/server/server.test.ts`                                                                    |
| Options                         | `host`, `port`, `backlog`, `server`, `noServer`, `path`, `clientTracking`, `verifyClient`, `handleProtocols`, `perMessageDeflate`, `maxPayload`, `skipUTF8Validation`, `allowSynchronousEvents`, `autoPong`, `WebSocket` | `src/compat/options/{shared,server}.ts`              | partial | `tests/compat/options/normalization.test.ts`, `tests/conformance/options.conformance.test.ts`           |
| Observable properties           | `options`, `path`, `clients`                                                                                                                                                                                             | `src/compat/server/server.ts`, `src/types/server.ts` | done    | `tests/compat/server/server.test.ts`                                                                    |
| Methods                         | `address()`, `close(cb?)`, `handleUpgrade()`, `shouldHandle()`                                                                                                                                                           | `src/compat/server/{server,close,upgrade}.ts`        | done    | `tests/compat/server/{server,upgrade}.test.ts`                                                          |
| Events                          | `connection`, `error`, `headers`, `close`, `listening`, `wsClientError`                                                                                                                                                  | `src/compat/server/{server,listeners,upgrade}.ts`    | done    | `tests/compat/server/{server,upgrade}.test.ts`                                                          |
| HTTP server integration         | `noServer` routing, `server` option, `upgrade` wiring with the Node `http.Server`                                                                                                                                        | `src/compat/server/{upgrade,listeners}.ts`           | done    | `tests/compat/server/upgrade.test.ts`, `tests/conformance/upgrade.conformance.test.ts`                  |
| Handshake policy                | `verifyClient` sync/async, `handleProtocols`, origin/path checks                                                                                                                                                         | `src/compat/server/{upgrade,handshake}.ts`           | done    | `tests/compat/server/{upgrade,upgrade-policy}.test.ts`, `tests/conformance/upgrade.conformance.test.ts` |
| Rejections                      | `wsClientError` for handshake failures, destroy semantics                                                                                                                                                                | `src/compat/server/{handshake,upgrade}.ts`           | done    | `tests/compat/server/{upgrade,upgrade-policy}.test.ts`, `tests/conformance/upgrade.conformance.test.ts` |

## Stream and client

| Surface                 | Contract                                                                                      | Owner                          | Status   | Evidence                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `createWebSocketStream` | Duplex stream over an open socket                                                             | `src/compat/stream.ts`         | done     | `tests/conformance/stream.conformance.test.ts`, `tests/compat/stream.test.ts`                 |
| Client construction     | `new WebSocket(address, protocols?, options?)`, redirects, `unexpected-response`              | `src/compat/client/client.ts`  | deferred | -                                                                                             |
| Client options          | `followRedirects`, `maxRedirects`, `origin`, `headers`, `agent`, TLS options, `finishRequest` | `src/compat/options/client.ts` | partial  | `tests/compat/options/normalization.test.ts`, `tests/conformance/options.conformance.test.ts` |

## Boundary and lifetime invariants

| Invariant                  | Contract                                                                                            | Owner                                                                                    | Status  | Evidence                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Retained inbound payloads  | Frames are copied into Node-owned buffers before handlers run                                       | `src/binding/socket.ts`, `src/engine/ffi/socket_io.zig`                                  | todo    | -                                                                                 |
| Borrowed outbound buffers  | Buffers live only for the native call, then land in the bounded queue                               | `src/binding/socket.ts`, `src/engine/socket/{payload,socket}.zig`                        | partial | `tests/binding/socket.test.ts`                                                    |
| Generation-checked handles | Stale handles produce typed errors, never crashes or use-after-free                                 | `src/binding/{handle,server,socket}.ts`, `src/engine/socket/handles.zig`                 | partial | `tests/binding/server-lifecycle.test.ts`, `tests/binding/socket-boundary.test.ts` |
| Exactly-once close         | Terminal state is latched before `close` dispatch                                                   | `src/compat/socket/lifecycle.ts`, `src/engine/socket/socket.zig`                         | partial | `tests/binding/socket-boundary.test.ts`, `tests/compat/socket/socket.test.ts`     |
| Backpressure               | `bufferedAmount` growth plus send callbacks, bounded queues; `send` returns no value, matching `ws` | `src/protocol/backpressure.ts`, `src/binding/socket.ts`, `src/engine/socket/payload.zig` | partial | `tests/binding/socket.test.ts`, `tests/compat/socket/socket.test.ts`              |
| Close code mapping         | `maxPayload` 1009, protocol errors 1002, policy rejections 1008                                     | `src/protocol/close-codes.ts`, `src/engine/socket/{status,socket}.zig`                   | partial | `tests/protocol/close-codes.test.ts`                                              |
| Per-message deflate        | Option normalization in TS, codec in the engine                                                     | `src/compat/options/{shared,server,client}.ts`, `src/engine/socket/socket.zig`           | partial | `tests/compat/options/normalization.test.ts`                                      |

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
`wsClientError`; `tests/compat/socket/socket.test.ts`, `tests/compat/server/upgrade-policy.test.ts` assert them.

`close(code, reason)` matches `ws` for every argument shape except one.
`src/compat/socket/close-reason.ts` refuses a reason that is neither a string
nor a `Uint8Array` once it carries data, which is the fix for the uninitialized
memory disclosure advisory GHSA-58qx-3vcg-4xpx: a differently typed array
reports a smaller element count than its `byteLength`, so accepting one would
size a close frame from bytes that are never written. The one divergence is
`reason === null`, which `ws` rejects with a V8-internal `TypeError` from reading
`.length` off it and ventijs treats as an absent reason.
`tests/conformance/close.conformance.test.ts` pins both against `ws`.

The handshake is hardened beyond `ws`: a `handleProtocols` result that is not a
token is refused instead of echoed into a response header, and control
characters in `verifyClient` headers or status codes are dropped before the
rejection is written. `ws` forwards those values verbatim.
`tests/compat/server/upgrade*.test.ts` cover both.

## Verification surface

| Suite                                                                                            | Purpose                                                                       | Status  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------- |
| `tests/binding/addon.test.ts`                                                                    | Native build, addon load, engine version round-trip                           | done    |
| `tests/binding/**`                                                                               | Lifecycle, connection slab, and socket operation boundaries                   | done    |
| `tests/compat/events/registry.test.ts`                                                           | Listener registry semantics                                                   | done    |
| `tests/protocol/**`                                                                              | Close code, framing, and backpressure helpers                                 | done    |
| `tests/compat/**`                                                                                | Facade units, option normalization, and coded error factories                 | done    |
| `tests/compat/events/emitter.test.ts`                                                            | Listener surface parity with `EventEmitter`, `this` binding, unhandled errors | done    |
| `tests/compat/events/dom-listeners.test.ts`                                                      | DOM listeners, attributes, and event object shapes                            | done    |
| `tests/compat/{socket/socket,server/server,server/upgrade,server/upgrade-policy,stream}.test.ts` | Facade lifecycle and HTTP upgrade policy                                      | done    |
| `tests/conformance/upgrade.conformance.test.ts`                                                  | Handshake responses compared byte-for-byte against `ws`                       | done    |
| `tests/conformance/stream.conformance.test.ts`                                                   | Duplex adapter behavior compared against `ws`                                 | done    |
| `tests/conformance/close.conformance.test.ts`                                                    | `close(code, reason)` argument handling compared against `ws`                 | done    |
| `tests/tooling/oxlint-plugin.test.ts`                                                            | Anti-OOP, enum, and emoji lint rules                                          | done    |
| `tests/types/**`                                                                                 | Compile-time public surface, every event-map entry, state records             | done    |
| `tests/declarations/**`                                                                          | Built declarations through the package `exports` map                          | done    |
| `tests/conformance/**`                                                                           | The same scenario run against `ws` and ventijs, comparing observable behavior | partial |
| `bench/**`                                                                                       | Measured throughput and latency against `ws` on the same host                 | todo    |
| Autobahn (RFC 6455)                                                                              | Protocol conformance report through the CI target                             | todo    |
