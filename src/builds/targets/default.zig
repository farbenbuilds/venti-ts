const std = @import("std");

/// Resolves the default build target. The dev shell pins it through
/// UWEBZOCKETS_DEFAULT_TARGET when Zig cannot detect the host libc (the Nix
/// store) or when a cross target should be the default. An unset variable
/// falls back to Zig's native target detection.
pub fn query(b: *std.Build) std.Target.Query {
    const triple = b.graph.environ_map.get("UWEBZOCKETS_DEFAULT_TARGET") orelse return .{};
    return std.Target.Query.parse(.{ .arch_os_abi = triple }) catch
        @panic("UWEBZOCKETS_DEFAULT_TARGET is not a valid Zig target");
}
