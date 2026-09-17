const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const module = b.addModule("venti", .{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    const addon = b.addLibrary(.{
        .name = "venti",
        .linkage = .dynamic,
        .root_module = module,
    });
    b.installArtifact(addon);

    const module_tests = b.addTest(.{
        .root_module = module,
    });

    const test_step = b.step("test", "Run Zig tests");
    test_step.dependOn(&b.addRunArtifact(module_tests).step);
}
