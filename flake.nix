{
  description = "venti-ts / A NodeJS WebSocket wrapper for µWebZockets";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-parts.url = "github:hercules-ci/flake-parts";
    zig-overlay.url = "github:mitchellh/zig-overlay";
    zon2nix.url = "github:jcollie/zon2nix";
  };

  outputs = inputs @ {
    self,
    flake-parts,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem = {
        pkgs,
        system,
        ...
      }: let
        lib = pkgs.lib;
        isLinux = pkgs.stdenv.hostPlatform.isLinux;
        pkgsMusl =
          if isLinux
          then pkgs.pkgsMusl
          else null;

        zig = inputs.zig-overlay.packages.${system}."0.16.0" or pkgs.zig;
        # zon2nix does not publish packages for every supported Darwin system.
        zon2nixPackage = (inputs.zon2nix.packages.${system} or {}).zon2nix or null;

        hostPackages = [
          zig
          pkgs.zls
          pkgs.typescript
          pkgs.typescript-language-server
        ];

        mkDevShell = packagePkgs: let
          supportsZon2nix =
            zon2nixPackage
            != null
            && isLinux
            && packagePkgs.stdenv.hostPlatform.isGnu;
        in
          packagePkgs.mkShell {
            packages =
              hostPackages
              ++ [
                packagePkgs.nodejs
                packagePkgs.pnpm
                packagePkgs.zlib
              ]
              ++ lib.optional supportsZon2nix zon2nixPackage;
          };
      in {
        formatter = pkgs.alejandra;

        devShells =
          {
            default = mkDevShell pkgs;
          }
          // lib.optionalAttrs isLinux {
            musl = mkDevShell pkgsMusl;
          };

        checks.format =
          pkgs.runCommand "check-format" {
            nativeBuildInputs = [pkgs.alejandra];
          } ''
            alejandra --check $(find ${./.} -name '*.nix')
            touch $out
          '';
      };
    };
}
