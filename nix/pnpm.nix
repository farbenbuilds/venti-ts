{
  lib,
  stdenv,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
  version ? "12.4.2",
}: let
  platform = stdenvNoCC.hostPlatform;

  assetBySystem = {
    x86_64-linux = "linux-x64";
    aarch64-linux = "linux-arm64";
    x86_64-darwin = "darwin-x64";
    aarch64-darwin = "darwin-arm64";
  };

  asset =
    assetBySystem.${platform.system}
    + lib.optionalString (platform.isLinux && platform.isMusl) "-musl";

  hashes = {
    linux-x64 = "sha256-zh7WkP6cLwkdcmfhr76TgKuwi7V36VNI/aGUpBFH0uw=";
    linux-x64-musl = "sha256-WsIvbR2nVkgkkKELO+G5KaYvoQIqWwNLN4Vvq2CcvWw=";
    linux-arm64 = "sha256-3Eop2YSO8AW+w9NtSaroSxFew7GMEQo6fzPDf3/VIL8=";
    linux-arm64-musl = "sha256-v3WXgSyBQDDnWcIGkdq4ihsnH0lVdv28Ta5WhFg2cQU=";
    darwin-x64 = "sha256-X6PRmtGmN9QUvDWIcwZm+UdkKtowe/Uu7jmXGS8RXXU=";
    darwin-arm64 = "sha256-Wq6VqV8KmPk3Le59F5c4YBH6ZXGwa4JVTHx4R9IBMI4=";
  };
in
  stdenvNoCC.mkDerivation {
    pname = "pnpm";
    inherit version;

    src = fetchurl {
      url = "https://github.com/pnpm/pnpm/releases/download/v${version}/pnpm-${asset}.tar.gz";
      hash = hashes.${asset};
    };

    nativeBuildInputs = [makeWrapper] ++ lib.optionals platform.isLinux [autoPatchelfHook];
    buildInputs = lib.optionals (platform.isLinux && !platform.isMusl) [stdenv.cc.cc.lib stdenv.cc.libc];

    dontBuild = true;
    sourceRoot = ".";

    installPhase = ''
      runHook preInstall

      mkdir -p $out/bin
      cp pnpm $out/bin/pnpm
      chmod +x $out/bin/pnpm

      makeWrapper $out/bin/pnpm $out/bin/pnpx --add-flag dlx
      ln -s pnpm $out/bin/pn
      ln -s pnpx $out/bin/pnx

      runHook postInstall
    '';

    meta = {
      description = "Fast, disk space efficient package manager for JavaScript";
      homepage = "https://pnpm.io/";
      license = lib.licenses.mit;
      mainProgram = "pnpm";
      platforms = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
    };
  }
