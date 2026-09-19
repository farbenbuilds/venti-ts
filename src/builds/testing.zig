const std = @import("std");

pub const Input = struct {
    napi: *std.Build.Dependency,
    engine: *std.Build.Module,
    options: *std.Build.Module,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
};

/// Builds src/lib.zig as a test root with the same imports as the addon and
/// registers the `zig build test` step.
pub fn inject(b: *std.Build, input: Input) void {
    const module_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = input.target,
            .optimize = input.optimize,
            .imports = &.{
                .{ .name = "napi-zig", .module = input.napi.module("napi") },
                .{ .name = "uWebZockets", .module = input.engine },
                .{ .name = "build_options", .module = input.options },
            },
        }),
    });

    const test_step = b.step("test", "Run Zig tests");
    test_step.dependOn(&b.addRunArtifact(module_tests).step);
}
