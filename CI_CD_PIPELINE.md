# ventijs CI/CD Pipeline

The pipeline verifies formatting, type safety, `ws` compatibility, RFC 6455
protocol behavior, native addon builds for every supported target, and release
metadata. A passing pipeline is evidence for the tested configurations; it is
not a proof that all memory or security defects are absent.

## Current state

The pipeline is implemented incrementally. `ts-lint.yml`, `zig-lint.yml`,
`nix-lint.yml`, `ts-test.yml`, and `zig-test.yml` are wired; the workflows marked
planned below are the contract for the remaining changes. Until they land,
contributors run the same commands locally as described in
[CONTRIBUTE.md](CONTRIBUTE.md).

## Workflows

| Workflow        | State       | Trigger                                              | Purpose                                                       |
| --------------- | ----------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `ts-lint.yml`   | Implemented | pushes and pull requests to `main`, manual           | oxlint, oxfmt, typecheck                                      |
| `zig-lint.yml`  | Implemented | pushes and pull requests to `main`, manual           | `zig fmt` and the Zig build graph                             |
| `zig-test.yml`  | Implemented | pushes and pull requests to `main`, manual           | `zig build test` units and the binding lifecycle suite        |
| `nix-lint.yml`  | Implemented | pushes and pull requests to `main`, manual           | Nix formatting and flake checks                               |
| `ts-test.yml`   | Implemented | pushes and pull requests to `main`, manual           | vitest unit, boundary, and registry tests without the addon   |
| `native.yml`    | Planned     | pushes and pull requests to `main`, manual, reusable | Build and test the `napi-zig` addon on the native matrix      |
| `compat.yml`    | Planned     | pushes and pull requests to `main`, manual           | RFC 6455 Autobahn suite and `ws` behavioral conformance       |
| `benchmark.yml` | Planned     | pull requests to `main`, nightly, manual             | Regression guard against the `main` baseline and `ws`         |
| `publish.yml`   | Planned     | `v*` tag push                                        | Verification, prebuild packaging, npm release with provenance |

Every workflow runs against the Node.js version pinned in `flake.nix`. The
pnpm store and the Zig cache are cached per lockfile hash; caches are never
shared between the candidate and baseline benchmark jobs.

## Lint and type gates

```sh
pnpm lint
pnpm format:check
pnpm typecheck
zig fmt --check --exclude zig-pkg src build.zig
nix fmt --check
```

`oxlint` enforces the repository rules that are mechanically checkable: no
`class`, no `this`, no `extends`, no prototype mutation, no unchecked `any`,
and no import of a runtime dependency outside `napi-zig` and `uWebZockets`.
`oxfmt` formats TypeScript, JSON, and Markdown. `tsc --noEmit` runs in the
strict configuration in `tsconfig.json`; weakening a compiler option is a
review-blocking change. `zig fmt` is authoritative for all `.zig` files.

`scripts/check-conventions.mjs` complements the linters (it runs inside
`pnpm lint` and as a `lefthook` job): it rejects `src/` and `tests/` files above
the 150-line module budget, rejects `camelCase` Zig function names, rejects
non-kebab-case TypeScript file names, and rejects emoji code points. The
vendored `src/types/ws.d.ts` and non-text files are excluded.

## Unit and build verification

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

`pnpm build` proves the `tsdown` bundle and declaration output compile from a
clean checkout. Tests run in vitest and cover option normalization, close-code
mapping, event dispatch ordering, boundary lifetime rules, and capacity
exhaustion. The build job uploads `dist/` and the generated `.d.ts` bundle so
reviewers can inspect the published type surface without building locally.

`ts-test.yml` runs the pure suites (`tests/protocol`, `tests/compat`,
`tests/conformance`, `tests/tooling`) without the native toolchain, skipping
only the suites that adopt a native connection. `tests/binding/**` and the
addon-backed compat suites run through `pnpm test` in the planned native
workflow.

`zig-test.yml` runs two jobs with the same toolchain and cache: units
(`zig build test`, compiling `src/engine_tests.zig` and the per-module suites
under `src/engine-tests/`, mirroring the `src/engine/` planes) and the
addon-backed lifecycle suite
(`pnpm build:binding` then
`vitest tests/binding tests/compat/socket tests/compat/stream.test.ts`). Both
cache `.zig-cache` and `zig-pkg` between runs. Neither installs a vendor C
toolchain: the engine compiles BoringSSL, lsquic, libdeflate, and zlib itself
from pinned package sources.

## Native addon matrix

The native workflow builds the `napi-zig` addon with Zig 0.16.0 and runs the
integration suite against the compiled artifact. Cross-compilation is the
default; a target without a native runner is built and packaged, then executed
only where a runner exists.

| Target                | Runner             | Executed                    |
| --------------------- | ------------------ | --------------------------- |
| `x86_64-linux-gnu`    | `ubuntu-24.04`     | Yes                         |
| `aarch64-linux-gnu`   | `ubuntu-24.04-arm` | Yes                         |
| `x86_64-linux-musl`   | `ubuntu-24.04`     | Yes, in an Alpine container |
| `aarch64-linux-musl`  | `ubuntu-24.04-arm` | Yes, in an Alpine container |
| `x86_64-macos`        | `macos-14`         | Yes                         |
| `aarch64-macos`       | `macos-14`         | Yes                         |
| `x86_64-windows-msvc` | `windows-2025`     | Yes                         |

Each job runs the full vitest suite against the built addon, not a stub. A job
that cannot load its own artifact fails the workflow.

## `ws` behavioral conformance

The compatibility job installs the pinned `ws` version as a dev dependency and
executes the shared conformance suite twice: once against `ws` and once against
ventijs. The suite covers:

- server construction options and defaults;
- upgrade handling, accepted and rejected handshakes;
- text, binary, and fragmented messages, including empty payloads;
- `ping`/`pong` and automatic pong replies;
- close codes, reasons, and exactly-once `close` emission;
- `maxPayload` enforcement and `1009` behavior;
- `bufferedAmount` and `send` return values under backpressure;
- per-message deflate negotiation, including declined and malformed offers.

Both runs must produce the same normalized event transcript. A divergence is a
failure; an intentional divergence requires an explicit exclusion entry with a
linked issue and cannot be merged silently.

## Autobahn RFC 6455 compliance

The compatibility job builds the server example in release mode, waits for the
listener, and runs the digest-pinned
`crossbario/autobahn-testsuite:0.8.2@sha256:519915fb568b04c9383f70a1c405ae3ff44ab9e35835b085239c258b6fac3074`
container as the fuzzing client. The runner terminates the server on every
exit path and writes reports as the invoking POSIX user so repeated local runs
can replace them safely.

The configuration selects groups 1-7 and 9-13 with no exclusions. The report
gate requires all 517 cases with 514 `OK` and 3 `INFORMATIONAL` results. Any
failed, `NON-STRICT`, missing, additional, or reclassified case fails the job.
RFC 7692 groups 12 and 13 pass through negotiated no-context-takeover
per-message deflate. HTML/JSON reports are uploaded even when the gate fails.

## Benchmark

The benchmark job checks the pull request and its `main` base into separate
directories, builds both from their own working directory on the same runner,
and runs the versioned `ventijs-ws-compare` contract:

1. Start a `ws` echo server and the equivalent ventijs echo server.
2. Run the same bounded client workload against each: fixed connections,
   fixed message size, fixed duration, measured with a pinned tool.
3. Repeat three times, discard the warm-up, and compare medians.

The regression gate fails when the candidate falls below 90 percent of the
`main` baseline. The `ws` comparison is recorded as evidence, not as a
pass/fail threshold, because absolute numbers vary across runners. Raw reports
are uploaded as workflow artifacts; scheduled mainline runs append canonical
JSON plus raw evidence to the `benchmark-data` branch. Records include runner,
Node.js, pnpm, Zig, and lockfile provenance.

The tolerance accounts for shared-runner variance. Claims in documentation may
cite only retained runs and must state the runner and toolchain.

## Publishing

A `v*` tag gates the release:

1. The tag must be valid Semantic Versioning and match `package.json`, the
   lockfile, and the latest changelog heading.
2. Lint, typecheck, unit, native matrix, and conformance workflows run against
   the exact tagged commit. Release creation waits for all of them.
3. Each native target is packaged with its prebuilt `.node` artifact. The npm
   tarball contains `dist/`, the platform addons, `LICENSE`,
   `THIRD_PARTY_NOTICES.md`, and the license texts for shipped native
   dependencies.
4. The release job requires every expected platform artifact, writes
   `SHA256SUMS`, and publishes with npm provenance from the tagged commit.
5. Versions containing a hyphen are published as prereleases; stable versions
   are tagged latest.

Releases are idempotent: rerunning the tag workflow replaces assets with the
same names and updates notes.

## Release checklist

- Bump via `pnpm release` and confirm every versioned surface agrees.
- Run lint, format, typecheck, unit, and build on the release commit.
- Run the native matrix and load every built addon on a real runner.
- Run the `ws` conformance suite and Autobahn with no exclusions.
- Run the benchmark and retain the report.
- Verify dependency revisions and `THIRD_PARTY_NOTICES.md` against shipped
  artifacts.
- Create and push `v<version>` only after the release commit is final.
- Inspect the packed tarball and generated checksums before announcing.
