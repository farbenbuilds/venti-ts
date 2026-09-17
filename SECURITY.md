# Security Policy

## Supported versions

Security fixes apply to the current development revision and the latest
published release. Older snapshots and unreleased local builds do not receive
backports.

| Version | Supported |
| --- | --- |
| Current development revision | Yes |
| Latest published release | Yes |
| Older tagged releases | No |

## Reporting a vulnerability

Do not open a public issue, pull request, or discussion that contains an
undisclosed vulnerability.

Send a private report to
[trananhquan1009@gmail.com](mailto:trananhquan1009@gmail.com) or
[noah1109.tran@gmail.com](mailto:noah1109.tran@gmail.com). Include:

- the affected revision, Node.js version, and target platform;
- a minimal reproducer, packet sequence, or frame hex dump;
- expected and observed behavior;
- impact and preconditions;
- logs with secrets removed; and
- any suggested mitigation.

The maintainers will acknowledge the report, reproduce and assess it, prepare a
fix and regression test, and coordinate disclosure. Response time depends on
severity and maintainer availability; no fixed service-level agreement is
offered.

## Threat model

The application embedding venti-ts is trusted. Network peers are untrusted. The
attacker-controlled surface is the same as a raw WebSocket server:

- the HTTP upgrade request, including headers, extensions, and path;
- every WebSocket frame, including fragmentation, control frames, masking keys,
  and claimed payload lengths;
- compressed payloads when per-message deflate is negotiated;
- connection churn, idle peers, and traffic volume.

Application code passing options to the constructors is trusted. Config values
are still validated explicitly, because accidental misconfiguration should
produce a clear error rather than undefined engine behavior.

## Security boundaries

The Zig engine parses and frames all untrusted bytes. It never exposes engine
slabs, pointers, or offsets to JavaScript. Inbound payloads are copied into
Node-owned `Buffer` instances before a handler runs; outbound buffers are
borrowed only for the duration of the native call and copied into the bounded
outbound queue before it returns. These two rules are the core memory-safety
contract at the FFI boundary, and tests assert them.

Every native handle carries a generation counter. A handle used after close, or
after its slot is reused, resolves to a typed error. Completion callbacks latch
terminal state before dispatch, so `close` fires exactly once even under
teardown races.

The public surface deliberately excludes features that would widen the attack
surface without a compatibility requirement:

- no synchronous extension callbacks that run arbitrary JavaScript from an
  engine thread;
- no runtime code loading, `eval`, or `new Function`;
- no remote artifact fetching. The native addon is resolved from the installed
  package layout only.

## Resource limits

Deployments must size the engine for their traffic and apply normal operating
system limits such as file descriptors and memory caps. The compatibility layer
maps `ws` options onto engine capacities:

- `maxPayload` bounds a single message. Oversized input closes the connection
  with code `1009`; it does not allocate a fallback buffer.
- Outbound queues are bounded. When a queue reaches its high-water mark, `send`
  returns `false` and `bufferedAmount` reflects the queued bytes, matching `ws`
  semantics. Producers that ignore backpressure cannot grow memory without
  bound.
- Idle connections are swept by a configurable timeout. Set an explicit value
  appropriate for the deployment; disabling the sweep is permitted but shifts
  full liveness responsibility to the application.
- Per-message deflate is opt-in. Negotiation requires no-context-takeover, and
  decompression is capped by the negotiated `maxPayload`, so a compressed
  expansion bomb cannot exceed the configured message capacity.

## Dependency policy

The published package has exactly two runtime dependencies: `napi-zig` and
`uWebZockets`. Both are pinned exactly. The engine vendors BoringSSL, lsquic,
zslay, libxev, libdeflate, and related components; their revisions and licenses
are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Engine updates
require a fresh native build, the full `ws` conformance suite, and the Autobahn
gate before release.

Do not add a runtime dependency for functionality the standard library or the
engine already provides. Development tooling is not shipped and is excluded
from the published tarball.

## Verification

CI builds and executes the addon on Linux, macOS, and Windows runners. The
compatibility suite runs the same scenarios against `ws` and venti-ts and
compares observable behavior, and the Autobahn suite validates RFC 6455 framing
with no exclusions. These controls reduce risk; they do not guarantee the
absence of defects. Consumers should pin an exact version, review the shipped
licenses, and load-test under their own workload before production deployment.

## Disclosure

Please allow a reasonable remediation and release window before publication.
Security advisories will credit reporters who request attribution and will
describe affected versions, impact, and upgrade guidance without exposing
unnecessary exploit detail before a fix is available.
