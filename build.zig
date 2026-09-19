const std = @import("std");
const orchestrator = @import("src/builds/orchestrator.zig");

pub fn build(b: *std.Build) void {
    orchestrator.inject(b);
}
