# Third-Party Notices

ventijs ships a prebuilt native addon. The addon statically links the
µWebZockets engine and its vendored dependencies, so their license texts are
included in each published platform artifact.

## Runtime components

µWebZockets is the first-party engine created for ventijs by the same author
and is pinned in `build.zig.zon`. The remaining runtime component is:

| Component                                              | Version or revision       | License |
| ------------------------------------------------------ | ------------------------- | ------- |
| [napi-zig](https://github.com/yuku-toolchain/napi-zig) | pinned in `build.zig.zon` | MIT     |

## Components vendored by the engine

These are pinned by the uWebZockets revision selected in `build.zig.zon`.
Each entry is the version or revision the engine's pinned manifest records.

| Component                   | Version or revision                      | License                            |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| zslay                       | 0.2.1                                    | MIT                                |
| libxev                      | 9ce8e8e6ff89e583258a7f8e7adeeeaeae8611bf | MIT                                |
| BoringSSL                   | 5fbad2285b096858fc9afa3e4c949fde39452070 | ISC-style and component licenses   |
| Fiat Crypto (via BoringSSL) | BoringSSL revision above                 | Apache-2.0                         |
| lsquic                      | 4.10.0                                   | MIT and bundled component licenses |
| ls-qpack                    | 2.7.0                                    | MIT                                |
| ls-hpack                    | 38ceca78054d4175ba3f6411b1b83ac5c485e542 | MIT                                |
| libdeflate                  | 1.26 (92e6a0d)                           | MIT                                |
| zlib                        | 1.3.2                                    | zlib License                       |

BoringSSL is distributed under an ISC-style license with additional component
licenses. lsquic bundles third-party code with its own notices. The complete
license texts are copied into `licenses/vendor` inside each published native
artifact and into the npm tarball. Every one of these libraries is compiled
into the addon from its pinned package sources, so none of them is resolved
from the host toolchain at build or run time.

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
| vite        | MIT        |
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
