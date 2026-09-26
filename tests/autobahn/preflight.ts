import { loadVentijsAddon } from "./addon.ts";

/// Loads the native addon and prints the engine version, then exits.
///
/// The conformance suite takes about 35 minutes, and the single most likely way
/// for it to fail before any protocol assertion is that the runtime cannot
/// `dlopen` the addon at all. This is that check on its own, so a broken ABI
/// fails the job in seconds with a one-line message instead of after a full
/// suite run.
///
/// It is also the check that proves the Deno runtime and the addon agree on the
/// C library. Deno publishes no musl build, so on a musl host a locally built
/// addon is musl and Deno is glibc, and this step is where that surfaces.
const addon = loadVentijsAddon();
process.stdout.write(
  `ventijs-preflight engine ${addon.engineVersion()} http3 ${String(addon.http3Available())}\n`,
);
