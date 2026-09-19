const std = @import("std");
const napi_zig = @import("napi_zig");

pub fn build(b: *std.Build) void {
    const default_target: std.Target.Query = if (b.graph.environ_map.get("UWEBZOCKETS_DEFAULT_TARGET")) |triple|
        std.Target.Query.parse(.{ .arch_os_abi = triple }) catch @panic("UWEBZOCKETS_DEFAULT_TARGET is not a valid Zig target")
    else
        .{};
    const target = b.standardTargetOptions(.{ .default_target = default_target });
    const optimize = b.standardOptimizeOption(.{});

    const napi_dep = b.dependency("napi_zig", .{});
    const engine_dep = if (target.result.abi.isMusl())
        // Zig defaults musl C compiles to non-PIC, which cannot link into the
        // dynamic addon; force PIC for the vendored C libraries.
        b.dependency("uWebZockets", .{
            .target = target,
            .optimize = optimize,
            .@"c-compiler" = b.pathFromRoot("scripts/zig-cc-pic"),
            .@"cxx-compiler" = b.pathFromRoot("scripts/zig-cxx-pic"),
            .@"asm-compiler" = b.pathFromRoot("scripts/zig-cc-pic"),
        })
    else
        b.dependency("uWebZockets", .{ .target = target, .optimize = optimize });
    const engine = engine_dep.module("uWebZockets");

    const build_options = b.addOptions();
    build_options.addOption([]const u8, "engine_version", read_engine_version(b, engine_dep));

    napi_zig.addLib(b, napi_dep, .{
        .name = "venti",
        .root = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{ .name = "uWebZockets", .module = engine },
            .{ .name = "build_options", .module = build_options.createModule() },
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
                .{ .name = "build_options", .module = build_options.createModule() },
            },
        }),
    });

    const test_step = b.step("test", "Run Zig tests");
    test_step.dependOn(&b.addRunArtifact(module_tests).step);
}

fn read_engine_version(b: *std.Build, engine_dep: *std.Build.Dependency) []const u8 {
    const manifest_path = engine_dep.path("build.zig.zon").getPath(b);
    const manifest = std.Io.Dir.cwd().readFileAlloc(
        b.graph.io,
        manifest_path,
        b.allocator,
        .limited(64 * 1024),
    ) catch @panic("cannot read the uWebZockets manifest");
    const marker = ".version = \"";
    const start = std.mem.indexOf(u8, manifest, marker) orelse
        @panic("the uWebZockets manifest has no version field");
    const rest = manifest[start + marker.len ..];
    const end = std.mem.indexOfScalar(u8, rest, '"') orelse
        @panic("the uWebZockets manifest has an unterminated version field");
    return rest[0..end];
}
