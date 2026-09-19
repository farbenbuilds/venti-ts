const builtin = @import("builtin");
const std = @import("std");
const napi_zig = @import("napi_zig");

const EngineManifest = struct {
    version: []const u8,
};

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{ .default_target = default_target(b) });
    const optimize = b.standardOptimizeOption(.{});

    const napi_dep = b.dependency("napi_zig", .{});
    const engine_dep = engine_dependency(b, target, optimize);
    const engine = engine_dep.module("uWebZockets");

    const build_options = b.addOptions();
    build_options.addOption([]const u8, "engine_version", engine_version(b, engine_dep));
    const options_module = build_options.createModule();

    napi_zig.addLib(b, napi_dep, .{
        .name = "venti",
        .root = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{ .name = "uWebZockets", .module = engine },
            .{ .name = "build_options", .module = options_module },
        },
    });

    const module_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "napi-zig", .module = napi_dep.module("napi") },
                .{ .name = "uWebZockets", .module = engine },
                .{ .name = "build_options", .module = options_module },
            },
        }),
    });

    const test_step = b.step("test", "Run Zig tests");
    test_step.dependOn(&b.addRunArtifact(module_tests).step);
}

fn default_target(b: *std.Build) std.Target.Query {
    const triple = b.graph.environ_map.get("UWEBZOCKETS_DEFAULT_TARGET") orelse return .{};
    return std.Target.Query.parse(.{ .arch_os_abi = triple }) catch
        @panic("UWEBZOCKETS_DEFAULT_TARGET is not a valid Zig target");
}

/// The vendored C libraries link into a shared addon, so they must be
/// position independent. Zig's C compiler defaults to PIC on glibc and macOS
/// but not on musl, so pin it with wrappers on every non-Windows target.
fn engine_dependency(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Dependency {
    const zlib_prefix: ?[]const u8 = b.graph.environ_map.get("UWEBZOCKETS_ZLIB_PREFIX");
    if (builtin.os.tag == .windows or target.result.os.tag == .windows) {
        return b.dependency("uWebZockets", .{
            .target = target,
            .optimize = optimize,
            .@"zlib-prefix" = zlib_prefix,
        });
    }
    return b.dependency("uWebZockets", .{
        .target = target,
        .optimize = optimize,
        .@"zlib-prefix" = zlib_prefix,
        .@"c-compiler" = b.pathFromRoot("scripts/zig-cc-pic"),
        .@"cxx-compiler" = b.pathFromRoot("scripts/zig-cxx-pic"),
        .@"asm-compiler" = b.pathFromRoot("scripts/zig-cc-pic"),
    });
}

fn engine_version(b: *std.Build, engine_dep: *std.Build.Dependency) []const u8 {
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
