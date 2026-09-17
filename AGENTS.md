# AGENTS.md

venti-ts is a pre-alpha Node.js native addon: a drop-in `ws` replacement whose
protocol engine is µWebZockets (Zig), reached through `napi-zig`. TypeScript
owns the public surface and types; Zig will own parsing, buffers, and
backpressure.

## Current state: docs describe the target, not the tree

- `src/index.ts` and `tests/index.test.ts` are tsdown-starter placeholders.
  `src-zig/` holds the `zig init` scaffold (a shared library with a test step);
  there is no `binding/`, `compat/`, `protocol/`, or `types/` tree, no
  `.github/workflows`, and no committed `pnpm-lock.yaml`.
- Root documents (`CODEBASE.md`, `CONTRIBUTE.md`, `CI_CD_PIPELINE.md`,
  `SKILL.md`) specify the intended architecture. When they disagree with
  `package.json`, `tsconfig.json`, `flake.nix`, or `src/`, trust the config
  and code.
- Documented scripts `lint`, `format`, `build:binding`, `test:compat`, and
  `bench` do not exist in `package.json`. Only `build`, `dev`, `test`,
  `typecheck`, `release`, and `prepublishOnly` are wired.
- `pnpm install --frozen-lockfile` fails because no lockfile is committed yet;
  use plain `pnpm install`.

## Commands

Use pnpm; do not invoke package binaries directly. The shell normally runs
inside `nix develop` (Node 24, pnpm 12, Zig 0.16.0, zls).

| Task | Command |
| --- | --- |
| Environment | `nix develop` (musl hosts: `nix develop .#musl`; `.envrc` selects it under direnv) |
| Install | `pnpm install` |
| Build bundle and declarations | `pnpm build` |
| Watch rebuild | `pnpm dev` |
| All tests (one-shot) | `pnpm exec vitest run` |
| All hooks | `pre-commit run --all-files` |
| Single test | `pnpm exec vitest run tests/index.test.ts -t 'fn'` |
| Typecheck | `pnpm typecheck` |
| Zig formatting | `zig fmt --check src-zig` |
| Version bump | `pnpm release` |

`pnpm typecheck` uses `tsconfig.json` `include: ["src"]`, so it does not check
`tests/`, and vitest strips types without checking them. Widen the include
temporarily or annotate explicitly when test types must be verified.

## Non-negotiable rules

- Zero OOP in both languages: no `class`, `this`, `extends`, or prototype
  mutation. Constructor-shaped exports are plain functions returning explicit
  state records.
- Guard clauses and early returns; `switch` over nested `if`/`else` ladders.
- Split by responsibility; keep source files near or below 150 lines.
- Naming: TS files `kebab-case`, TS identifiers `camelCase`; Zig files,
  functions, and variables `snake_case`; Zig types `PascalCase`. Zig is
  formatted by `zig fmt` (4 spaces).
- The published package may depend only on `napi-zig` and `uWebZockets`;
  everything else belongs in `devDependencies`.
- Hot paths allocate nothing. Capacities are fixed or `comptime`, and every
  peer-controlled length is capped.
- Generated `.d.ts` files are build output; never hand-edit them.
- No emojis in code, docs, issue forms, or commit messages.

## Read before changing a subsystem

- Ownership, target layout, boundary contracts: `CODEBASE.md`
- Style depth and anti-OOP patterns: `CODING_CONVENTION.md`
- Script contract, testing, PRs, release: `CONTRIBUTE.md`
- Target workflows and native matrix: `CI_CD_PIPELINE.md`
- Threat model and private reporting: `SECURITY.md`
- License obligations kept in sync with dependencies: `THIRD_PARTY_NOTICES.md`

## Workflow notes

- Commits follow Conventional Commits (`.github/COMMIT_CONVENTION.md`).
  Scopes in use: `compat`, `napi`/`binding`, `types`, `protocol`, `engine`,
  `build`, `deps`, `docs`, `ci`.
- `ws` behavior is the compatibility contract. When adding a surface, check
  what `ws` does and test both implementations once the conformance harness
  exists. `ws` may be a devDependency only, never a runtime dependency.
- `.agents/skills/**` is managed by `skills-lock.json`; do not hand-edit
  installed skills.
- `package.json` `files` currently ships only `dist/`. Native addon artifacts
  must be added to `files` before any real publish.
