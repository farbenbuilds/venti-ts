<p align="center">
  <img src="misc/venti_banner.png" alt="venti-ts banner" />
</p>

# venti-ts

A high-performance, drop-in replacement for [`ws`](https://github.com/websockets/ws),
implemented as a Node.js native addon. venti-ts wraps the zero-allocation
[µWebZockets](https://github.com/farbenbuilds/uWebZockets) Zig engine, built
for this project by the venti-ts author, through
[`napi-zig`](https://github.com/yuku-toolchain/napi-zig), keeping the hot path
inside Zig while the public surface stays idiomatic TypeScript.

## Project status

Pre-alpha. This branch ships the package scaffolding, the TypeScript toolchain
configuration (`pnpm`, `tsdown`, `oxlint`, `oxfmt`, `vitest`), the native build
environment (`flake.nix`, Zig 0.16.0), and a working `napi-zig` pipeline: the
host addon links the full µWebZockets engine, builds, loads, and reports the
pinned engine version and HTTP/3 capability. The `ws` compatibility layer and
the conformance suite are implemented in subsequent changes. No npm release
exists yet; do not deploy this in production.

## Design goals

- **Drop-in `ws` compatibility.** The server-side API mirrors `ws`: the same
  constructor options, events, message and close semantics, and per-message
  deflate behavior. Existing applications should migrate by changing the import
  specifier.
- **End-to-end type safety.** A single type model flows from Zig declarations
  through the `napi-zig` binding into the generated `.d.ts` bundle. There is no
  hand-maintained duplicate of the public types.
- **Data-oriented engine.** Connection pools, parser state, and frame buffers
  are contiguous slabs grouped by access pattern. Masking and UTF-8 validation
  use SIMD before handling scalar tails.
- **Pure functional and procedural code.** No classes, no `this` binding, no
  inheritance. State is explicit, functions are pure where practical, and I/O
  state is confined to the transport boundary.
- **Minimal runtime dependencies.** The published package depends only on
  `napi-zig` and `uWebZockets`, the first-party engine; linting, formatting,
  bundling, and testing live exclusively in the development toolchain.

## Architecture at a glance

```text
TypeScript public surface (ws-compatible, generated types)
        |
        v
typed N-API binding (napi-zig, free functions over explicit state)
        |
        v
Zig procedural engine (DOD slabs, SIMD transforms, guard-clause control flow)
        |
        v
µWebZockets core (libxev I/O, RFC 6455 state machine, bounded queues)
```

The TypeScript layer owns API shape, argument validation, and `.d.ts` surface.
The Zig layer owns buffer lifetime, parsing, framing, and backpressure. Nothing
crosses the boundary by pointer without an explicit borrow contract; see
[CODEBASE.md](CODEBASE.md).

## Install

Published usage, once the first release lands:

```sh
pnpm add venti-ts
```

From source on this branch:

```sh
git clone git@github.com:farbenbuilds/venti-ts.git
cd venti-ts
nix develop
pnpm install
pnpm build
```

## Quick start

The target surface is a drop-in replacement for `ws`:

```ts
import { WebSocketServer } from "venti-ts";

const server = new WebSocketServer({ port: 8080 });

server.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    socket.send(data, { binary: isBinary });
  });
});
```

Constructor-shaped exports are plain functions that return explicit state
records; they never use `class`, `this`, or prototype chains. See
[CODING_CONVENTION.md](CODING_CONVENTION.md).

## Compatibility targets

| Surface                                                 | Status               |
| ------------------------------------------------------- | -------------------- |
| Package scaffolding and toolchain                       | Scaffolded           |
| Native binding (`napi-zig` + Zig engine)                | Engine linked        |
| `WebSocketServer` construction and options              | Planned              |
| `connection`, `message`, `ping`, `pong`, `close` events | Planned              |
| Text, binary, and fragmented messages                   | Planned              |
| Close codes and reasons                                 | Planned              |
| Per-message deflate (RFC 7692)                          | Planned              |
| ESM and CJS entry points                                | Toolchain configured |
| `ws` behavioral conformance suite                       | Planned              |

## Performance

venti-ts makes no absolute throughput claims from a single machine. The CI
pipeline benchmarks the candidate against a `ws` baseline on the same runner
and fails on a statistically significant regression; see
[CI_CD_PIPELINE.md](CI_CD_PIPELINE.md). Measured results, methodology, and raw
artifacts are published with the run, not copied into marketing copy.

## Development

```sh
pnpm install        # install workspace dependencies
pnpm dev            # rebuild the TypeScript bundle in watch mode
pnpm build          # tsdown bundle plus generated declarations
pnpm test           # vitest unit and integration tests
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint
pnpm format         # oxfmt
pnpm format:check   # verify formatting without writing
```

The native binding is built with Zig 0.16.0 from the pinned `nix develop`
shell. The exact command contract is documented in
[CONTRIBUTE.md](CONTRIBUTE.md).

## Documentation

| Document                                         | Contents                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| [CODEBASE.md](CODEBASE.md)                       | Repository layout, binding architecture, data flow, ownership      |
| [CODING_CONVENTION.md](CODING_CONVENTION.md)     | TypeScript and Zig style, anti-OOP rules, naming                   |
| [CONTRIBUTE.md](CONTRIBUTE.md)                   | Environment setup, checks, testing, pull requests, release         |
| [CI_CD_PIPELINE.md](CI_CD_PIPELINE.md)           | Workflows, native build matrix, compliance, benchmarks, publishing |
| [COMPATIBILITY.md](COMPATIBILITY.md)             | ws parity status, surface ownership, and evidence                  |
| [SECURITY.md](SECURITY.md)                       | Threat model, reporting, supported versions                        |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Runtime and development dependency licenses                        |
| [SKILL.md](SKILL.md)                             | Agent workflow conventions for this repository                     |

## License

MIT. µWebZockets is the first-party MIT-licensed protocol engine, created for
venti-ts by the same author. The `ws` project is MIT-licensed and defines the
compatibility target; no `ws` source is incorporated. venti-ts is not
affiliated with the `ws` project.
