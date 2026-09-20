# venti-ts Codebase

## Scope

venti-ts is a Node.js native addon that exposes the
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
venti-ts/
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
│   │   └── server.zig         # server lifecycle free functions
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
│   │   └── instance_test.zig
│   ├── binding/
│   │   ├── load.ts            # native addon resolution and typed loading
│   │   ├── native.ts          # addon ABI types and engine event records
│   │   ├── handle.ts          # connection handle pack and unpack helpers
│   │   └── server.ts          # server create/listen/close/finalize wrappers
│   ├── compat/
│   │   ├── client-options.ts  # client option normalization and defaults
│   │   ├── errors.ts          # coded error factories and status mapping
│   │   ├── events.ts          # listener registry replacing EventEmitter
│   │   ├── options.ts         # shared normalization helpers and constants
│   │   └── server-options.ts  # server option normalization and defaults
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
│   ├── binding.test.ts        # native pipeline smoke test
│   ├── binding/               # binding lifecycle and handle tests
│   ├── compat/                # option normalization and error factory tests
│   ├── events.test.ts         # listener registry behavior
│   ├── protocol/              # close code, framing, and backpressure tests
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
│   ├── server.ts              # WebSocketServer constructor-shaped factory
│   ├── socket.ts              # WebSocket constructor-shaped factory
│   ├── events.ts              # explicit listener registry and dispatch
│   ├── options.ts             # shared option normalization helpers
│   ├── server-options.ts      # server option validation and normalization
│   ├── client-options.ts      # client option validation and normalization
│   └── errors.ts              # coded error factories and status mapping
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
bench/          # benchmark harness that runs venti-ts and ws side by side
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
compat/{options,server-options,client-options}.ts: validate and normalize
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
                     compat/events.ts dispatch                compat/events.ts dispatch
                               |                                     |
                               v                                     v
                        JS listener                           JS listener
```

Outbound path:

```text
JS: socket.send(data, options)
      |
      v
compat/socket.ts: validate data and options
      |
      v
binding/socket.ts: send(handle, slice, opcode, fin) ----> Zig outbound ring
                                                               |
                                                      bounded write queue
                                                               |
                                                      libxev non-blocking write
```

Backpressure flows the other way: when the outbound ring exceeds its
high-water mark, the native call reports it, queue growth stays visible through
`socket.bufferedAmount`, and pending sends drain through their callbacks.
`ws` does not return a boolean from `send`, so neither does venti-ts.

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

`feat/native-foundation` adds the native memory foundation, the server
lifecycle, and the only threadsafe path from an engine thread to JavaScript, on
top of the merged type surface, listener registry, and protocol and compat
leaves:

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
- `tests/binding.test.ts` proves the Zig build, addon load, version round-trip,
  and lifecycle surface; `tests/binding/` drives create, listen, a live
  WebSocket connection through the slab, close, and finalize.

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
- `tests/binding.test.ts` proves the Zig build, addon load, and version
  round-trip.

The `compat/` factories, the socket handles, and the message path are the next
implementation milestones. The addon currently exposes the engine version and
the server lifecycle; per-connection send/close/ping and the `ws` runtime
surface land next.
