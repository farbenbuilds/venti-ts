const std = @import("std");
const napi_zig = @import("napi_zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const napi_dep = b.dependency("napi_zig", .{});
    const uwebzockets = b.dependency("uWebZockets", .{});
    const engine_version = b.createModule(.{
        .root_source_file = uwebzockets.path("src/version.zig"),
    });

    napi_zig.addLib(b, napi_dep, .{
        .name = "venti",
        .root = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{ .name = "uwebzockets_version", .module = engine_version },
        },
    });

    const module_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "napi-zig", .module = napi_dep.module("napi") },
                .{ .name = "uwebzockets_version", .module = engine_version },
            },
        }),
    });

    const test_step = b.step("test", "Run Zig tests");
    test_step.dependOn(&b.addRunArtifact(module_tests).step);
}
