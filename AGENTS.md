# AGENTS.md

venti-ts is a pre-alpha Node.js native addon: a drop-in `ws` replacement whose
protocol engine is µWebZockets (Zig), reached through `napi-zig`. TypeScript
owns the public surface and types; Zig will own parsing, buffers, and
backpressure.

## Current state: docs describe the target, not the tree

- `build.zig` calls `napi_zig.addLib` and `src/lib.zig` exposes `engineVersion()`,
  following the `napi-zig` layout: the Zig root module lives in `src/` next to
  the TypeScript sources. `src/binding/load.ts` resolves and loads the built
  `.node`; `src/index.ts` is still an empty public surface. There is no
  `compat/`, `protocol/`, or `types/` tree yet.
- Root documents (`CODEBASE.md`, `CONTRIBUTE.md`, `CI_CD_PIPELINE.md`,
  `SKILL.md`) specify the intended architecture. When they disagree with
  `package.json`, `tsconfig.json`, `flake.nix`, or `src/`, trust the config
  and code.
- Documented scripts `test:compat` and `bench` do not exist in `package.json`.
  `build`, `build:binding`, `dev`, `format`, `format:check`, `lint`, `lint:fix`,
  `test`, `test:watch`, `typecheck`, `release`, and `prepublishOnly` are wired.
- Git hooks are installed by `lefthook` during `pnpm install` (allowed through
  `pnpm-workspace.yaml`); `pnpm-lock.yaml` is committed.

## Commands

Use pnpm; do not invoke package binaries directly. The shell normally runs
inside `nix develop` (Node 24, pnpm 12, Zig 0.16.0, zls).

| Task                          | Command                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Environment                   | `nix develop` (musl hosts: `nix develop .#musl`; `.envrc` selects it under direnv) |
| Install                       | `pnpm install`                                                                     |
| Build native addon and bundle | `pnpm build`                                                                       |
| Build native addon only       | `pnpm build:binding`                                                               |
| Watch bundle rebuild          | `pnpm dev`                                                                         |
| Lint                          | `pnpm lint` (`pnpm lint:fix` to apply fixes)                                       |
| Check formatting              | `pnpm format:check` (`pnpm format` to write)                                       |
| All tests (one-shot)          | `pnpm test` (rebuilds the binding first)                                           |
| Watch tests                   | `pnpm test:watch`                                                                  |
| All hooks                     | `pnpm exec lefthook run pre-commit --all-files`                                    |
| Single test                   | `pnpm exec vitest run tests/binding.test.ts`                                       |
| Typecheck                     | `pnpm typecheck`                                                                   |
| Zig formatting                | `zig fmt --check --exclude zig-pkg src build.zig`                                  |
| Version bump                  | `pnpm release`                                                                     |

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

## Agent skills and plugins

- `.agents/skills/**` is the local skill pack pinned by `skills-lock.json`;
  never hand-edit installed skills, and commit the lockfile and skill tree
  together. `using-agent-skills` is the discovery meta-skill: route a task to
  its workflow skill before starting. `SKILL.md` maps the pack to this repo.
- The `addyosmani/agent-skills` lifecycle pack supplies `interview-me`,
  `idea-refine`, `spec-driven-development`, `constraint-driven-development`,
  `planning-and-task-breakdown`, `context-engineering`,
  `source-driven-development`, `incremental-implementation`,
  `doubt-driven-development`, `test-driven-development`,
  `debugging-and-error-recovery`, `code-review-and-quality`,
  `code-simplification`, `security-and-hardening`,
  `performance-optimization`, `api-and-interface-design`,
  `observability-and-instrumentation`, `git-workflow-and-versioning`,
  `ci-cd-and-automation`, `documentation-and-adrs`,
  `deprecation-and-migration`, and `shipping-and-launch`. UI and browser
  skills are not part of this pack; venti-ts is a Node.js package, not a UI
  project. `using-agent-skills` and `test-driven-development` carry local edits
  that strip their browser routing; a `skills update` may restore it, so
  re-remove any UI guidance it brings back.
- graphify is installed as a global opencode plugin. When
  `graphify-out/graph.json` exists, treat codebase and architecture questions
  as graph queries first: `graphify query "<question>"`, `graphify path A B`,
  `graphify explain X`; refresh with `/graphify --update`. `graphify-out/` is
  generated output, gitignored, and never edited or committed by hand.
- `.opencode/agents/**` is the sub-agent roster: compatibility conformance,
  data-oriented performance, native bridge, read-only refactor auditor,
  TypeScript API, and Zig protocol. Each agent inherits the rules here and
  loads the skills relevant to its ownership area.

## Workflow notes

- Commits follow Conventional Commits (`.github/COMMIT_CONVENTION.md`).
  Scopes in use: `compat`, `napi`/`binding`, `types`, `protocol`, `engine`,
  `build`, `deps`, `docs`, `ci`.
- `ws` behavior is the compatibility contract. When adding a surface, check
  what `ws` does and test both implementations once the conformance harness
  exists. `ws` may be a devDependency only, never a runtime dependency.
- `package.json` `files` ships only `dist/`; `tsdown` copies the host
  `.node` artifact into `dist/`, so the built package is self-contained for
  the build platform. Per-platform artifacts must land before any real
  publish.
