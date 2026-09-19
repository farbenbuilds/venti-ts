# Third-Party Notices

venti-ts ships a prebuilt native addon. The addon statically links the
µWebZockets engine and its vendored dependencies, so their license texts are
included in each published platform artifact.

## Runtime components

µWebZockets is a first-party engine by the same author as venti-ts and is
pinned in `build.zig.zon`. The remaining runtime component is:

| Component                                              | Version or revision       | License |
| ------------------------------------------------------ | ------------------------- | ------- |
| [napi-zig](https://github.com/yuku-toolchain/napi-zig) | pinned in `build.zig.zon` | MIT     |

## Components vendored by the engine

These are pinned by the uWebZockets revision selected in `build.zig.zon`.
The listed versions correspond to the engine's current pinned manifest.

| Component                   | Version or revision                      | License                            |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| zslay                       | 0.1.5                                    | MIT                                |
| libxev                      | 9ce8e8e6ff89e583258a7f8e7adeeeaeae8611bf | MIT                                |
| BoringSSL                   | 7c1efd8d6ffb36a57feba44e8c73cf674801f3cb | ISC-style and component licenses   |
| Fiat Crypto (via BoringSSL) | BoringSSL revision above                 | Apache-2.0                         |
| lsquic                      | 4.9.3                                    | MIT and bundled component licenses |
| ls-qpack                    | 2.7.0                                    | MIT                                |
| ls-hpack                    | 2.3.5                                    | MIT                                |
| libdeflate                  | 1.26                                     | MIT                                |
| zlib                        | provided by the target toolchain         | zlib License                       |

BoringSSL is distributed under an ISC-style license with additional component
licenses. lsquic bundles third-party code with its own notices. The complete
license texts are copied into `licenses/vendor` inside each published native
artifact and into the npm tarball. zlib is linked from the target toolchain
rather than vendored; downstream consumers remain responsible for its license
and linkage terms.

## Vendored type definitions

`src/types/ws.d.ts` is adapted from the DefinitelyTyped declarations for `ws`
(MIT) and is embedded in `dist/index.d.mts`. No `ws` runtime code is
incorporated.

| Component                                                                            | License |
| ------------------------------------------------------------------------------------ | ------- |
| [@types/ws](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/ws) | MIT     |

## Development-only tooling

The following are development dependencies. They are not shipped in the
published package and require no runtime attribution.

| Component   | License    |
| ----------- | ---------- |
| lefthook    | MIT        |
| oxfmt       | MIT        |
| oxlint      | MIT        |
| tsdown      | MIT        |
| vitest      | MIT        |
| TypeScript  | Apache-2.0 |
| bumpp       | MIT        |
| @types/node | MIT        |
| Node.js     | MIT        |
| pnpm        | MIT        |
| Zig         | MIT        |
| Nix         | LGPL-2.1   |

## Maintenance

Every dependency change updates the pinned revision in `build.zig.zon`
together with this file. Binary releases copy the license texts for all
statically linked components; a release is not published while any shipped
component lacks an attribution entry.
