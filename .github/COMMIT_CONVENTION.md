# Git Commit Message Convention

ventijs follows the [Conventional Commits](https://www.conventionalcommits.org/)
format, adapted from
[Angular's commit convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular).
The convention keeps the changelog and release notes mechanical.

## Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

The header is mandatory. The scope is optional. The body and footer are
optional, but any breaking change requires a footer.

## Types

| Type       | Use for                                                  |
| ---------- | -------------------------------------------------------- |
| `feat`     | A new user-visible capability                            |
| `fix`      | A behavior fix, including `ws` compatibility corrections |
| `perf`     | A measured performance change                            |
| `refactor` | A restructure with no behavior change                    |
| `test`     | Test additions or corrections                            |
| `docs`     | Documentation only                                       |
| `build`    | Build graph, packaging, or native artifact changes       |
| `ci`       | Workflow and pipeline changes                            |
| `chore`    | Maintenance that fits no other type                      |
| `revert`   | Reverts a previous commit                                |

`feat`, `fix`, and `perf` appear in the changelog. Any commit containing
`BREAKING CHANGE:` appears regardless of type.

## Scopes

Use the module or boundary being changed:

- `compat` for the `ws`-compatible surface;
- `napi` or `binding` for the native binding layer;
- `types` for the public type surface;
- `protocol` for pure helpers such as close codes and framing;
- `engine` for Zig-side protocol work;
- `build`, `deps`, `docs`, or `ci` for their respective areas.

## Examples

A compatibility fix that closes an issue:

```text
fix(compat): emit close exactly once during teardown races

Closes #42
```

A measured engine improvement:

```text
perf(engine): unmask payloads with SIMD before the scalar tail

Reduces per-frame CPU time on 16 KiB messages by 38 percent, measured
with pnpm bench on the pinned CI runner.
```

A dependency update:

```text
build(deps): pin uWebZockets to the 1.0.9 engine revision

BREAKING CHANGE: the engine now rejects 8-bit server compression
windows. Consumers relying on that negotiation must update.
```

A revert:

```text
revert: feat(compat): add per-message deflate negotiation

This reverts commit 667ecc1654a317a13331b17617d973392f415f02.
```

## Subject rules

- Use the imperative, present tense: `add`, not `added` or `adds`.
- Do not capitalize the first letter.
- Do not end with a period.
- Keep the subject under 72 characters.

## Body rules

- Use the imperative, present tense.
- Explain the motivation and contrast the new behavior with the old.
- State measured numbers for `perf` commits and name the benchmark used.
- Reference issues and pull requests where useful.

## Footer rules

- Breaking changes start with `BREAKING CHANGE:` followed by a description of
  the impact and required migration.
- Closed issues use `Closes #<number>`.
- Release-relevant limitations must be stated in the footer, not omitted.

Details on the contribution process are in
[CONTRIBUTING.md](../CONTRIBUTE.md).
