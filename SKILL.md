---
name: venti-ts
description: Work on venti-ts, a pre-alpha TypeScript and Zig Node.js native addon that replaces the ws server API using the µWebZockets engine through napi-zig. Use for binding functions, the ws compatibility surface, Zig engine modules, tests, benchmarks, docs, and CI in this repository.
---

# venti-ts Engineering Skill

Load this when implementing or reviewing changes in this repository.
`AGENTS.md` holds the current branch state and exact commands; this skill holds
the working method and the non-obvious constraints.

## Mission

venti-ts is a drop-in `ws` replacement whose protocol engine is µWebZockets
(Zig) reached through `napi-zig`. The TypeScript layer owns API shape,
validation, and generated types. The Zig layer owns parsing, buffers, and
backpressure. Consumers should migrate by changing an import specifier and
observing identical behavior.

## Ground truth before writing code

- Read `AGENTS.md` first: parts of the tree (and several documented scripts) do
  not exist yet. Trust `package.json`, `tsconfig.json`, `flake.nix`, and `src/`
  over prose docs when they disagree.
- `ws` behavior is the compatibility contract. Before changing a public
  surface, determine what `ws` does for options, defaults, errors, event order,
  and close semantics, then mirror it.
- One change, one responsibility, one module. If a file approaches 150 lines,
  split it before adding more.
- Zero OOP is absolute in both languages. No `class`, `this`, `extends`, or
  prototype mutation. Constructor-shaped exports are plain functions returning
  explicit state records.

## Target architecture and ownership

| Area                      | Owns                                                              | Do not                                   |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `src/index.ts`            | Thin public re-export surface                                     | Put logic here                           |
| `src/binding/`            | Native addon loading, typed N-API calls, handle generation checks | Leak engine pointers or slabs            |
| `src/compat/`             | `ws`-shaped factories, event registry, option validation          | Use classes or hidden state              |
| `src/protocol/`           | Pure TS helpers (close codes, framing, backpressure policy)       | Allocate per call                        |
| `src/types/`              | Public and internal type-only modules                             | Duplicate a type that exists elsewhere   |
| `src-zig/src/binding.zig` | `napi-zig` exports as free functions                              | Call into JavaScript from engine threads |
| `src-zig/src/*`           | Parsers, framing, SIMD transforms, bounded queues                 | Allocate on hot paths                    |

## Boundary contract

- Inbound payloads that JavaScript can retain are copied into Node-owned
  `Buffer` instances before dispatch.
- Outbound buffers are borrowed only for the native call and copied into the
  bounded outbound queue before it returns.
- Handles are generation-checked. Stale access is a typed error, never a crash
  or use-after-free.
- `close` fires exactly once; terminal state is latched before dispatch.
- Backpressure surfaces as `send() === false` plus `bufferedAmount`, matching
  `ws`; queues are bounded and never grow without limit.
- `maxPayload` violations close with `1009`, protocol errors with `1002`,
  policy rejections with `1008`.

## Working method

1. Restate the `ws`-observable behavior being added or fixed, including edge
   cases.
2. Choose the smallest module boundary. Prefer pure functions over stateful
   helpers, and explicit parameters over captured state.
3. Implement Zig with fixed or `comptime` capacities, guard clauses, and
   `defer`/`errdefer` cleanup. Implement TypeScript with `strict` types,
   discriminated unions, and `import type` for type-only imports.
4. Add tests for the behavior and the boundaries: retained payloads, borrowed
   buffers, exactly-once close, stale handles, capacity exhaustion.
5. Run, in order: `pnpm build`, `pnpm typecheck`,
   `pnpm exec vitest run`, then `zig fmt --check zig src` for any Zig change.
   Do not invent `pnpm lint` or `pnpm format`; they are not wired yet.
6. Update `README.md`, `CODEBASE.md`, or `THIRD_PARTY_NOTICES.md` when the
   surface, limits, or dependencies change.

## Which installed skill to load

| Work                            | Load                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| Public types, strict API design | `typescript-expert`, `typescript-advanced-types`                          |
| Bundle, declarations            | `tsdown`                                                                  |
| Slabs, SoA, SIMD, cache layout  | `dod`                                                                     |
| Pure functions, explicit state  | `functional-programming-fundamentals`, `pragmatic-functional-programming` |
| Module splitting, review        | `separation-of-concerns`, `clean-code`                                    |
| Zig language and API changes    | `zig-0.16`, `zig-best-practices`                                          |
| Zig build graph                 | `zig-build-system`                                                        |
| Capacities and specialization   | `zig-comptime`                                                            |
| C interop at the FFI edge       | `zig-cinterop`                                                            |
| Native build matrix             | `zig-cross`, `nix-best-practices`                                         |
| Zig tests, fuzz corpora         | `zig-testing`                                                             |
| Zig failures                    | `zig-debugging`, `zig-compiler`                                           |
| Minimal correct solution        | `ponytail`                                                                |
| Dense commit and PR text        | `caveman`                                                                 |
| Docs                            | `documentation-writer`                                                    |
| API lookups                     | `context7`                                                                |

## Definition of done

- Observable behavior matches `ws`; any intentional divergence is documented
  with a linked issue.
- No new runtime dependency beyond `napi-zig` and `uWebZockets`.
- No file near or above 150 lines; no OOP constructs anywhere.
- `pnpm build`, `pnpm typecheck`, and `pnpm exec vitest run` pass.
- Boundary and capacity tests exist for every behavior change.
- Generated declarations are not hand-edited.
- Docs and `THIRD_PARTY_NOTICES.md` are current.
