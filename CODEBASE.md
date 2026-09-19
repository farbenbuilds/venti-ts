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
│   ├── binding/
│   │   └── load.ts            # native addon resolution and typed loading
│   ├── compat/
│   │   └── pubsub.ts          # listener registry replacing EventEmitter
│   ├── types/
│   │   ├── ws.d.ts            # vendored DefinitelyTyped ws contract, ESM footer
│   │   ├── pubsub.ts          # event-map, handler, and registry types
│   │   ├── socket.ts          # SocketState and the socket event map
│   │   └── server.ts          # ServerState and the server event map
│   └── builds/
│       ├── orchestrator.zig   # build entry: addon, build options, tests
│       ├── vendor.zig         # engine dependency, version, C toolchain
│       ├── testing.zig        # Zig test module and test step
│       └── targets/
│           ├── default.zig    # default build target query
│           └── native.zig     # vendored C compiler overrides
├── tests/
│   ├── binding.test.ts        # native pipeline smoke test
│   ├── pubsub.test.ts         # listener registry behavior
│   ├── types/                 # fixtures checked by pnpm typecheck
│   └── declarations/          # fixtures checked by pnpm typecheck:dist
└── .github/                   # community templates, issue forms, lint workflows
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
│   └── options.ts             # option validation and normalization
├── protocol/                  # pure TypeScript helpers
│   ├── close-codes.ts         # RFC 6455 close code constants and predicates
│   ├── framing.ts             # length and mask helpers used by tests
│   └── backpressure.ts        # bufferedAmount and high-water policy
├── types/                     # public and internal type-only modules
├── server.zig                 # engine lifecycle as free functions
├── socket.zig                 # per-connection handles and state transitions
└── ...                        # further Zig modules split by one responsibility
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
compat/options.ts: validate and normalize
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
high-water mark, the native call reports it, `send` returns `false`, and
`socket.bufferedAmount` reflects the queued byte count, matching `ws`
semantics.

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

`feat/add-ws-types` layers the public type surface and the listener registry on
top of the merged build graph:

- `src/types/ws.d.ts` vendors the DefinitelyTyped `ws` contract (`@types/ws`
  8.18.1) with an ESM footer; `src/index.ts` re-exports it as type-only
  exports, including a type-only default so `import type WebSocket from
"venti-ts"` matches `ws`. No runtime `ws` surface exists yet.
- `src/types/{pubsub,socket,server}.ts` define the registry types,
  `SocketState`, `ServerState`, and the Node-style event maps extracted from
  the vendored contract. `src/compat/pubsub.ts` implements the registry:
  copy-on-write buckets, dispatch over the array captured at call time, no
  classes and no `this`. Event handlers receive payloads only; `this` binding,
  `once`, and the no-listener `error` policy belong to the compat factories.
- `pnpm typecheck` includes `tests/types`, whose fixtures pin the public
  consumer surface, every event-map entry, and state-record literals.
  `tsconfig.dist-types.json` checks `tests/declarations` against the built
  `dist/index.d.mts` through the package `exports` map with
  `skipLibCheck: false`; `pnpm build` ends with that check.
- `tests/pubsub.test.ts` covers duplicate handlers, removal and addition
  during dispatch, listener counts, exception propagation, and the deliberate
  no-listener `error` policy.

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
  `engineVersion()` and `http3Available()`. The engine's TLS surface
  (`App.init_https`, `TlsContext.init`) is reachable from the addon but not yet
  exposed to TypeScript.
- The engine's vendored C dependencies build once into
  `.zig-cache/vendor-build-v4/` through CMake and Ninja; non-Windows targets
  use the PIC compiler wrappers in `scripts/` because the vendored static
  libraries link into the shared addon.
- `napi-zig` was wired by hand following its manual setup guide, never with
  `napi-zig new`, so the existing tsdown, oxlint, and oxfmt configuration is
  not scaffolded over.
- `src/binding/load.ts` resolves the `.node` from `zig-out/` first and from
  `dist/` second, returning a typed `VentiAddon` record. Runtime values for the
  public surface land with `src/compat/`.
- `.oxlintrc.json` and `.oxfmtrc.json` encode
  [CODING_CONVENTION.md](CODING_CONVENTION.md); `lefthook.yml` runs them on
  every commit alongside `zig fmt`, typecheck, and the test suite.
- `flake.nix` pins Node.js, pnpm, Zig 0.16.0, zls, and TypeScript tooling;
  `.#musl` selects a musl dev shell on musl hosts.
- `tests/binding.test.ts` proves the Zig build, addon load, and version
  round-trip.

The `protocol/` tree, the `compat/` factories, and the engine modules beside
`src/lib.zig` are the next implementation milestones. The addon currently
exposes only the engine version; socket and server handles land next.
