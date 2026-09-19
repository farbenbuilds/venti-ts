const std = @import("std");
const native = @import("targets/native.zig");

const EngineManifest = struct {
    version: []const u8,
};

/// Configures the uWebZockets dependency with the build target, the vendored
/// C toolchain, and the zlib prefix the dev shell provides.
pub fn engine_dependency(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Dependency {
    const compilers = native.vendor_compilers(b, target);
    return b.dependency("uWebZockets", .{
        .target = target,
        .optimize = optimize,
        .@"zlib-prefix" = b.graph.environ_map.get("UWEBZOCKETS_ZLIB_PREFIX"),
        .@"c-compiler" = compilers.c,
        .@"cxx-compiler" = compilers.cxx,
        .@"asm-compiler" = compilers.assembler,
    });
}

/// Reads the pinned engine version from the dependency manifest.
pub fn engine_version(b: *std.Build, engine_dep: *std.Build.Dependency) []const u8 {
    const manifest_path = engine_dep.path("build.zig.zon").getPath(b);
    const source = std.Io.Dir.cwd().readFileAlloc(
        b.graph.io,
        manifest_path,
        b.allocator,
        .limited(64 * 1024),
    ) catch @panic("cannot read the uWebZockets manifest");
    const manifest = std.zon.parse.fromSliceAlloc(
        EngineManifest,
        b.allocator,
        b.allocator.dupeZ(u8, source) catch @panic("out of memory"),
        null,
        .{ .ignore_unknown_fields = true },
    ) catch @panic("cannot parse the uWebZockets manifest");
    return manifest.version;
}
