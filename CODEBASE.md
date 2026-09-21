# ventijs Codebase

## Scope

ventijs is a Node.js native addon that exposes the
[µWebZockets](https://github.com/farbenbuilds/uWebZockets) first-party Zig
engine through a `ws`-compatible TypeScript surface. The repository contains two languages with
a single hard boundary between them: TypeScript owns the public API, argument
validation, and generated type surface; Zig owns buffer lifetime, protocol
parsing, framing, and backpressure.

This document describes the architecture the codebase is converging on, the
ownership rules that govern every cross-language call, and the exact state of
the current branch.

## Design rules

1. Data is grouped by access pattern. Connection pools, router tables, and
   frame queues are parallel arrays or contiguous slabs, not linked structures
   of objects.
2. Parsing and transforms are pure functions with explicit input and output
   state. Mutable I/O state stays at the transport boundary.
3. Hot paths have fixed capacity. Exhaustion returns a typed error or applies
   backpressure; it never triggers an unbounded allocation.
4. No object-oriented programming. No classes, no `this`, no inheritance, no
   hidden state. Constructor-shaped exports are plain functions returning
   explicit state records.
5. Modules are granular. A source file that approaches 150 lines is split by
   responsibility before it grows a second reason to change.
6. The published package has exactly two runtime dependencies: `napi-zig` and
   `uWebZockets`. Everything else is development tooling.

## Repository layout

Current tree on this branch:

```text
ventijs/
├── flake.nix                  # pinned Node.js, pnpm, Zig 0.16.0 dev shell
├── flake.lock                 # locked Nix inputs
├── lefthook.yml               # pre-commit hook contract
├── .oxlintrc.json             # oxlint rules for the TypeScript tree
├── .oxfmtrc.json              # oxfmt formatting rules
├── pnpm-workspace.yaml        # pnpm settings (lefthook build approval)
├── package.json               # package metadata, scripts, exports
├── tsconfig.json              # strict TypeScript configuration
├── tsconfig.dist-types.json   # built-declaration check through package exports
├── tsdown.config.ts           # bundle, declaration, and native artifact pipeline
├── build.zig                  # build entry, delegates to src/builds/orchestrator.zig
├── build.zig.zon              # pinned uWebZockets and napi-zig revisions
├── scripts/
│   ├── check-staged.sh        # staged-file hygiene checks
│   ├── oxlint-plugin.mjs      # local rules for the anti-OOP conventions
│   ├── zig-cc-pic             # PIC C compiler wrapper for vendored C builds
│   └── zig-cxx-pic            # PIC C++ compiler wrapper for vendored C builds
├── src/
│   ├── index.ts               # public export surface (type-only re-exports)
│   ├── lib.zig                # napi-zig root module declaration and exports
│   ├── engine_tests.zig       # Zig unit test entry point
│   ├── engine/                # native engine modules
│   │   ├── handles.zig        # generation-checked connection slot slab
│   │   ├── options.zig        # trusted listen configuration structs
│   │   ├── registry.zig       # bounded slot table for server instances
│   │   ├── events.zig         # engine event vocabulary
│   │   ├── ring.zig           # bounded SPSC event ring
│   │   ├── ports.zig          # listener bound-port introspection
│   │   ├── callbacks.zig      # threadsafe channel rendering events to JS
│   │   ├── instance.zig       # live server record and instance table
│   │   ├── connections.zig    # engine WebSocket route trampolines
│   │   ├── server.zig         # server lifecycle free functions
│   │   ├── payload.zig        # bounded outbound payload staging ring
│   │   ├── status.zig         # connection state and operation vocabulary
│   │   ├── socket.zig         # per-connection ops and terminal latch
│   │   └── socket_io.zig      # handle-resolving socket FFI free functions
│   ├── engine-tests/          # one Zig unit suite per testable module
│   │   ├── root.zig           # suite aggregator
│   │   ├── lib_test.zig
│   │   ├── handles_test.zig
│   │   ├── options_test.zig
│   │   ├── registry_test.zig
│   │   ├── events_test.zig
│   │   ├── ring_test.zig
│   │   ├── ports_test.zig
│   │   ├── callbacks_test.zig
│   │   ├── instance_test.zig
│   │   ├── payload_test.zig
│   │   └── socket_test.zig
│   ├── binding/
│   │   ├── load.ts            # native addon resolution and typed loading
│   │   ├── native.ts          # addon ABI types and engine event records
│   │   ├── handle.ts          # connection handle pack and unpack helpers
│   │   ├── server.ts          # server create/listen/close/finalize wrappers
│   │   └── socket.ts          # socket send/close/pause/resume wrappers
│   ├── compat/
│   │   ├── constructors.ts    # WebSocket/WebSocketServer runtime assembly
│   │   ├── errors.ts          # coded error factories and status mapping
│   │   ├── ready-state.ts     # CONNECTING/OPEN/CLOSING/CLOSED ordinals
│   │   ├── stream.ts          # createWebSocketStream duplex adapter
│   │   ├── events/
│   │   │   ├── registry.ts    # listener registry replacing EventEmitter
│   │   │   ├── emitter.ts     # EventEmitter-shaped surface over the registry
│   │   │   ├── dom-events.ts  # DOM event object factories
│   │   │   └── dom-listeners.ts # add/removeEventListener and on* attributes
│   │   ├── options/
│   │   │   ├── shared.ts      # shared normalization helpers and constants
│   │   │   ├── server.ts      # server option validation and normalization
│   │   │   └── client.ts      # client option validation and normalization
│   │   ├── socket/
│   │   │   ├── socket.ts      # WebSocket constructor-shaped factory
│   │   │   ├── state.ts       # socket record, brands, and defaults
│   │   │   ├── attach.ts      # native and upgraded-stream adoption
│   │   │   ├── send.ts        # send routing into the binding
│   │   │   ├── payload.ts     # payload normalization and status mapping
│   │   │   └── lifecycle.ts   # close/terminate/pause/resume and terminal latch
│   │   └── server/
│   │       ├── server.ts      # WebSocketServer constructor-shaped factory
│   │       ├── close.ts       # server close and address semantics
│   │       ├── listeners.ts   # Node HTTP server event wiring
│   │       ├── upgrade.ts     # handleUpgrade and shouldHandle
│   │       ├── handshake.ts   # accept key, rejections, subprotocol parsing
│   │       └── clients.ts     # clientTracking set maintenance
│   ├── protocol/
│   │   ├── backpressure.ts    # bufferedAmount math and water marks
│   │   ├── close-codes.ts     # RFC 6455 close codes and predicates
│   │   └── framing.ts         # frame header math and masking
│   ├── types/
│   │   ├── ws.d.ts            # vendored DefinitelyTyped ws contract, ESM footer
│   │   ├── close.ts           # ready-state and close-code unions
│   │   ├── errors.ts          # stable error codes and coded-error shape
│   │   ├── events.ts          # event-map, handler, and registry types
│   │   ├── options.ts         # normalized client and server option records
│   │   ├── server.ts          # ServerState and the server event map
│   │   ├── socket.ts          # SocketState and the socket event map
│   │   └── status.ts          # engine status to error-code mapping types
│   └── builds/
│       ├── orchestrator.zig   # build entry: addon, build options, tests
│       ├── vendor.zig         # engine dependency, version, C toolchain
│       ├── testing.zig        # Zig unit test module and test step
│       └── targets/
│           ├── default.zig    # default build target query
│           └── native.zig     # vendored C compiler overrides
├── tests/
│   ├── binding/
│   │   ├── addon.test.ts      # native pipeline smoke test
│   │   ├── server*.test.ts    # server lifecycle and limits
│   │   ├── socket*.test.ts    # connection slab and socket boundaries
│   │   └── support.ts         # fixtures shared by the binding suites
│   ├── compat/
│   │   ├── events/            # registry, emitter, and DOM listener tests
│   │   ├── options/           # option normalization tests
│   │   ├── socket/            # facade socket tests and the native fixture
│   │   ├── server/            # server, upgrade, and handshake policy tests
│   │   ├── errors.test.ts     # coded error factories
│   │   └── stream.test.ts     # duplex adapter over a native socket
│   ├── conformance/           # ws side-by-side scenario suites
│   ├── protocol/              # close code, framing, and backpressure tests
│   ├── tooling/               # lint plugin rule tests
│   ├── types/                 # fixtures checked by pnpm typecheck
│   └── declarations/          # fixtures checked by pnpm typecheck:dist
└── .github/                   # community templates, issue forms, CI workflows
```

Target layout as the binding lands:

```text
build.zig                      # build entry; delegates to src/builds/orchestrator.zig
build.zig.zon                  # pinned uWebZockets and napi-zig revisions
src/
├── index.ts                   # thin public re-export surface
├── lib.zig                    # napi-zig module declaration and exports
├── builds/                    # Zig build graph helpers, one concern per file
│   ├── orchestrator.zig       # build entry and wiring
│   ├── vendor.zig             # engine dependency and vendored C toolchain
│   ├── testing.zig            # Zig test module and test step
│   └── targets/               # target-specific build settings
│       ├── default.zig        # default build target query
│       └── native.zig         # vendored C compiler overrides
├── binding/                   # native addon loading and typed N-API calls
│   ├── load.ts                # platform/arch addon resolution, one error type
│   ├── server.ts              # server handle create/listen/close free functions
│   └── socket.ts              # socket handle send/close/ping free functions
├── compat/                    # ws API compatibility, one concern per module
│   ├── constructors.ts        # WebSocket/WebSocketServer runtime assembly
│   ├── errors.ts              # coded error factories and status mapping
│   ├── ready-state.ts         # ready-state ordinals for both facades
│   ├── stream.ts              # createWebSocketStream duplex adapter
│   ├── events/                # listener registry, emitter, and DOM handlers
│   ├── options/               # shared, server, and client normalization
│   ├── socket/                # socket factory, state, send, and lifecycle
│   └── server/                # server factory, upgrade, and handshake policy
├── protocol/                  # pure TypeScript helpers
│   ├── close-codes.ts         # RFC 6455 close code constants and predicates
│   ├── framing.ts             # length and mask helpers used by tests
│   └── backpressure.ts        # bufferedAmount and high-water policy
├── types/                     # public and internal type-only modules
├── engine_tests.zig           # Zig unit test entry point
├── engine-tests/              # per-module Zig unit suites, one file each
├── engine/                    # native engine modules, one responsibility each
│   ├── server.zig             # engine lifecycle as free functions
│   ├── socket.zig             # per-connection handles and state transitions
│   ├── payload.zig            # bounded outbound payload staging
│   ├── status.zig             # connection state and operation vocabulary
│   └── ...                    # further Zig modules split by one responsibility
└── ...                        # further entry points and build wiring
```

Zig and TypeScript share `src/`. `napi-zig` expects the addon root module at
`src/lib.zig`, `tsdown` expects the package entry at `src/index.ts`, and the
file extensions keep the two languages apart. `build.zig` and `build.zig.zon`
stay at the repository root so the `napi-zig` CLI runs there without a
working-directory flag. The build graph itself lives in `src/builds/`:
`build.zig` only delegates to the orchestrator, which wires the vendor
dependency, the build metadata, and the tests. Future Zig modules live beside
the TypeScript files in `src/` or in a dedicated subdirectory split by
responsibility.

Test and tooling directories:

```text
tests/          # vitest unit, integration, and boundary tests
bench/          # planned: benchmark harness that runs ventijs and ws side by side
```

## Language boundary and ownership

The boundary is a small set of free functions with primitive or slice
arguments. There is no shared mutable object graph across the boundary.

| Concern                          | Owner      | Rule                                                      |
| -------------------------------- | ---------- | --------------------------------------------------------- |
| Public API shape and defaults    | TypeScript | Mirrors `ws`; validated before any native call            |
| Option validation                | TypeScript | Explicit per-field checks; no coercion of untrusted input |
| Connection and parser state      | Zig        | Fixed-capacity slabs owned by the engine                  |
| Frame assembly, masking, UTF-8   | Zig        | SIMD fast paths with scalar tails                         |
| Outbound queues and backpressure | Zig        | Bounded; overflow reports backpressure to JS              |
| Message payloads observed by JS  | Node       | Copied into Node-owned `Buffer` at the boundary           |
| Event dispatch                   | TypeScript | Explicit listener arrays; no hidden emitter inheritance   |

Two lifetime rules are absolute:

1. Engine slabs are never exposed to JavaScript. Inbound frames are copied into
   Node-owned buffers before a handler runs, so retaining `data` after the
   callback is safe and behaves exactly like `ws`.
2. Buffers passed to `send`, `ping`, `pong`, or `close` are borrowed for the
   duration of the native call only. The engine copies them into its outbound
   queue before returning.

## End-to-end type pipeline

One type model flows in one direction:

```text
Zig declarations and comptime capacities
        |
        v
napi-zig ABI surface (validated at binding time)
        |
        v
TypeScript binding types (type-only modules, no runtime cost)
        |
        v
tsdown declaration bundle (dist/*.d.ts)
        |
        v
Consumer TypeScript project
```

Rules that keep the pipeline honest:

- Public types are declared once and re-exported, never redefined per module.
- The binding layer imports types with `import type` so no runtime graph is
  created for declarations.
- Generated declarations are treated as build output. The one hand-maintained
  declaration is `src/types/ws.d.ts`, the vendored `@types/ws` contract below.
- Numeric status codes crossing the boundary are mapped to stable unions in
  TypeScript and never leaked as magic integers.

### Vendored declarations

`src/types/ws.d.ts` is a vendored copy of the DefinitelyTyped `ws` declarations
(`@types/ws` 8.18.1, MIT) and the single source of the public type surface. Only
the footer is adapted, converting `export =` into ESM type exports so `tsdown`
can bundle it, and exporting `Server` to match upstream's ESM entry. The header
records the upstream version.

- `src/index.ts` re-exports the surface with `export type`; the only export not
  in upstream's ESM entry is `WebSocketEventMap`, a deliberate superset.
- The file is exempt from oxlint and oxfmt because upstream style violates the
  project rules; `pnpm typecheck:dist` still checks the bundled output with
  `skipLibCheck: false`.
- Attribution ships in `dist/index.d.mts` and is recorded in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Refresh procedure: re-download `@types/ws` `index.d.ts`, keep the header and
  footer adaptations, then run `pnpm build` and `pnpm test`.

## Runtime data flow

```text
JS: new WebSocketServer(options)
      |
      v
compat/options/{shared,server,client}.ts: validate and normalize
      |
      v
binding/server.ts: createServer(config) ----> Zig engine
                                                  |
                                      uWebZockets: accept, upgrade, parse
                                                  |
                               +------------------+------------------+
                               |                                     |
                     engine -> threadsafe fn                engine -> threadsafe fn
                     ("connection")                         ("message", "close", ...)
                               |                                     |
                               v                                     v
                     compat/events/registry.ts dispatch     compat/events/registry.ts dispatch
                               |                                     |
                               v                                     v
                        JS listener                           JS listener
```

Outbound path:

```text
JS: socket.send(data, options)
      |
      v
compat/socket/send.ts: validate data and options
      |
      v
binding/socket.ts: sendSocket(server, connection, data, binary)
      |
      v
engine/socket_io.zig: resolve server and connection handles
      |
      v
engine/socket.zig: state transition ----> engine/payload.zig: copy into the
                                                   bounded staging ring
                                                          |
                                                  (engine-thread drain lands
                                                   with the message pump)
                                                          |
                                                   libxev non-blocking write
```

Backpressure flows the other way: when the outbound ring exceeds its
high-water mark, the native call reports it, queue growth stays visible through
`socket.bufferedAmount`, and pending sends drain through their callbacks.
`ws` does not return a boolean from `send`, so neither does ventijs.

## Event loop model

- The µWebZockets engine runs its own event loop; it is not driven by the
  Node.js event loop.
- Native events are marshalled to the Node main thread through a single
  threadsafe-function channel per instance.
- Callbacks registered from JavaScript are stored in explicit arrays keyed by
  event name. Dispatch iterates a snapshot so a handler that removes another
  handler cannot corrupt iteration.
- `close` is emitted exactly once. The binding marks the handle terminal before
  dispatch so a teardown race cannot emit twice.
- Any API that touches a terminal handle is a no-op or resolves a typed error,
  never a crash.

## Capacity and failure model

Capacities are named configuration, not byte arithmetic. The compatibility
layer maps `ws` options such as `maxPayload` onto engine limits at server or
socket construction time. When a peer exceeds a limit, the engine applies the
same observable behavior a `ws` user expects: a close with code `1009` for
oversized payloads, `1002` for protocol errors, and `1008` for policy
rejections. A limit violation never allocates a fallback buffer.

Errors crossing the boundary use a small fixed set of named codes. JavaScript
receives `Error` instances with stable `code` values; Zig never throws through
the ABI.

## Module conventions

- TypeScript files use `kebab-case` and export free functions or const
  records. No default exports, except the type-only default re-export in
  `src/index.ts` that mirrors the `ws` entry point.
- Zig files use `snake_case`, functions and variables use `snake_case`, and
  types use `PascalCase`.
- A module owns one responsibility. If a module needs two sections to explain
  itself, it becomes two modules.
- Control flow follows the Linux kernel style: guard clauses first, early
  returns, no nested `if`/`else` ladders, no loop bodies that branch on mode
  flags. See [CODING_CONVENTION.md](CODING_CONVENTION.md).

## Current branch state

`feat/native-foundation` added the native memory foundation, the server
lifecycle, and the only threadsafe path from an engine thread to JavaScript.
`feat/socket-io` added the per-connection state machine, the bounded outbound
staging ring, and the socket FFI. `refactor/quality-hardening` closes the races
and lifetime gaps the audit found, optimizes the build, and adds the gates that
keep the rules enforced:

- `src/engine/handles.zig` holds the generation-checked connection slab. One slot maps
  one-to-one onto an engine pool slot; `acquire` bumps the generation and
  `resolve` rejects a stale handle, so a call against a closed connection
  surfaces as a typed error instead of a use-after-free.
- `src/engine/options.zig` trusts the JavaScript configuration once: it validates the
  host, port, backlog, route path, and per-route limits against the compiled
  capacities, reads every integer at the 53-bit safe width, and copies them
  into fixed-capacity `ListenConfig`, `Limits`, and `ServerConfig` records;
  `maxConnections` is enforced when a peer opens.
- `src/engine/registry.zig` is a fixed-capacity atomic slot table; `src/engine/instance.zig`
  holds the live `Instance` record and the bounded table that binds engine
  callbacks to server state; `src/engine/connections.zig` registers the comptime
  WebSocket trampolines that acquire and release slab slots.
- `src/engine/events.zig` defines the fixed-size event vocabulary and
  `src/engine/callbacks.zig` is the only bridge an engine thread may use to reach
  JavaScript: a bounded ring travels through one threadsafe function and is
  rendered on the Node main thread, allocating nothing on the engine thread.
- `src/engine/server.zig` exposes create/listen/close/finalize. Create builds the
  engine application through `AppType.cluster(1)`; listen binds the listener
  and starts the engine thread; close routes through the cluster wakeup; the
  `server_closed` event proves the loop has drained before finalize joins the
  thread and frees every resource. Finalize refuses to free while events are
  still queued (`EventsPending`), and every server handle carries a generation
  and a Node environment owner, so stale handles and cross-worker calls are
  typed errors. `listening` reports the bound port, so `port: 0` resolves to
  the ephemeral port the kernel assigned.
- `src/engine-tests/` holds one unit suite per testable module, aggregated by
  `root.zig` and entered through `src/engine_tests.zig`; `src/builds/testing.zig`
  compiles that entry for `zig build test`, and the `zig-test.yml` workflow runs
  it plus the addon-backed binding suite. `server` and `connections` are
  engine-coupled and are covered there instead of in the unit binary.
- `src/binding/{native,handle,server}.ts` declare the addon ABI, pack and
  unpack the 64-bit connection handle, and wrap the lifecycle calls;
  `src/binding/load.ts` keeps resolving the `.node` and now types the full
  `VentiAddon` record.
- `tests/binding/addon.test.ts` proves the Zig build, addon load, version
  round-trip, and lifecycle surface; `tests/binding/` drives create, listen, a
  live WebSocket connection through the slab, close, and finalize.
- `src/engine/payload.zig` is the outbound boundary. `stage` copies JavaScript
  bytes into a fixed-capacity structure-of-arrays ring before the call returns
  and publishes each record with a release store, so JavaScript memory is never
  retained and the engine thread only ever observes whole records. An
  oversized payload is rejected before any copy, and a full ring reports
  backpressure instead of allocating.
- `src/engine/status.zig` holds the connection lifecycle and operation
  vocabulary, including the `ws` close-code acceptance rule.
- `src/engine/socket.zig` is the per-connection slab: one record per engine
  pool slot, mirroring the handle index, with the bounded ring attached.
  `send`, `close`, `pause_dispatch`, and `resume_dispatch` are explicit
  transitions over that record; `finish` flips the terminal latch with one
  atomic compare-exchange per connection generation, so a close race can never
  emit two terminal events. `connections.zig` opens the record when a peer
  arrives and only emits `connectionClose` for the latch winner.
- `src/engine/socket_io.zig` is the FFI seam: every entry point resolves the
  server through the instance table and the connection through the
  generation-checked slab first, so a call against a closed connection returns
  `invalid-handle` instead of dereferencing a stale slot.
- `src/binding/socket.ts` mirrors that surface for TypeScript: `sendSocket`,
  `closeSocket`, `pauseSocket`, `resumeSocket`, and `socketBufferedAmount`
  validate handles, payloads, and close codes before the native call and map
  the camelCase ABI statuses onto `EngineStatus`. `EngineStatus` gained
  `invalid-close-code` and `invalid-close-reason`, and the coded-error map
  covers both.
- `src/engine-tests/{payload,socket}_test.zig` cover copy semantics, capacity
  limits, close validation, dispatch pause, buffered accounting, and the
  concurrent terminal latch; `tests/binding/socket*.test.ts` drive the ops
  through the addon against a live connection. The engine-thread drain that
  turns staged records into frames is the next milestone: the ring and the
  per-connection accounting are in place, but nothing consumes them yet.
- `src/engine/handles.zig` packs state and generation into one atomic word, so
  `resolve` answers both checks with a single acquire load and can never pair a
  fresh generation with a stale state. `src/engine/socket.zig` gives every
  record a spin lock; `open`, `finish`, and the FFI operations serialize on it,
  and each operation re-checks the generation it resolved against, so a
  recycled slot can never receive a stale send, close, or pause.
- `src/engine/socket_ops.zig` holds the outbound transitions; close stages its
  frame and enters `closing` under the lock, so two concurrent closes stage
  exactly one frame, and the close frame is counted in `bufferedAmount`.
- `src/engine/ring.zig` reserves the last `connection_capacity + 2` slots for
  terminal events, so a burst of regular events can never drop a close or
  `server_closed`. A dropped reservation is counted, never silently retired.
- `src/engine/callbacks.zig` latches a closing state before the engine thread
  is joined, uses a stack-buffer arena for rendering, and `server_cleanup.zig`
  registers an environment cleanup hook that stops the engine thread and frees
  a server a worker never finalized. `server_io.zig` keeps the N-API wrappers
  separate from the lifecycle, mirroring `socket_io.zig`.
- `pnpm build:binding` builds in ReleaseSafe: the addon drops from ~98 MB to
  ~9 MB and the engine's startup temporary no longer overflows a worker's
  default stack. `scripts/check-conventions.mjs` enforces the 150-line budget,
  Zig naming, filename case, and the emoji ban through `pnpm lint` and a
  `lefthook` job; CI also runs `typecheck:dist` after the addon build and the
  test job discovers new pure suites instead of enumerating directories.

The build-graph bullets below come from `refactor/build-orchestrator` and
remain current:

- `build.zig` only calls `orchestrator.inject(b)`. `src/builds/orchestrator.zig`
  resolves the target and optimize mode, wires the addon through
  `napi_zig.addLib`, and hands the test wiring to `src/builds/testing.zig`.
- `src/builds/vendor.zig` configures the uWebZockets dependency and reads its
  pinned version; `src/builds/targets/` holds the default target query and the
  vendored C compiler overrides.
- `package.json` defines the package scripts (`build`, `build:binding`, `dev`,
  `format`, `format:check`, `lint`, `lint:fix`, `test`, `test:watch`,
  `typecheck`, `typecheck:dist`, `release`, `prepublishOnly`) and development
  dependencies, including the `napi-zig` CLI.
- `tsdown.config.ts` enables bundled declaration output and copies the host
  `.node` artifact into `dist/`, so `pnpm build` produces a self-contained
  package for the current platform.
- The addon links the full `uWebZockets` engine module; `src/lib.zig` exposes
  `engineVersion()`, `http3Available()`, and the server lifecycle functions.
  The engine's TLS surface (`App.init_https`, `TlsContext.init`) is reachable
  from the addon but not yet exposed to TypeScript.
- The engine's vendored C dependencies build once into
  `.zig-cache/vendor-build-v4/` through CMake and Ninja; non-Windows targets
  use the PIC compiler wrappers in `scripts/` because the vendored static
  libraries link into the shared addon.
- `napi-zig` was wired by hand following its manual setup guide, never with
  `napi-zig new`, so the existing tsdown, oxlint, and oxfmt configuration is
  not scaffolded over.
- `src/binding/load.ts` resolves the `.node` from `zig-out/` first and from
  `dist/` second, returning the typed `VentiAddon` record declared in
  `src/binding/native.ts`.
- `.oxlintrc.json` and `.oxfmtrc.json` encode
  [CODING_CONVENTION.md](CODING_CONVENTION.md); `lefthook.yml` runs them on
  every commit alongside `zig fmt`, typecheck, and the test suite.
- `flake.nix` pins Node.js, pnpm, Zig 0.16.0, zls, and TypeScript tooling;
  `.#musl` selects a musl dev shell on musl hosts.
- `tests/binding/addon.test.ts` proves the Zig build, addon load, and version
  round-trip.

The `compat/` factories and the engine-thread drain that flushes the staging
ring are the next implementation milestones. The addon exposes the engine
version, the server lifecycle, and the per-connection socket operations; the
`ws` runtime surface sits on top of them, with the drain and receiver pending.
