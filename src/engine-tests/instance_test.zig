//! Unit tests for `src/engine/instance.zig`.

const std = @import("std");
const instance = @import("../engine/instance.zig");
const registry = @import("../engine/registry.zig");

test "engine lookup rejects out-of-range trampoline slots" {
    const out_of_range: u32 = @intCast(instance.server_capacity);
    try std.testing.expectEqual(@as(?*instance.Instance, null), instance.lookup_slot(out_of_range));
}

test "engine lookup reports unpopulated slots as null" {
    try std.testing.expectEqual(@as(?*instance.Instance, null), instance.lookup_slot(0));
}

test "packed server handles keep generation above the slot byte" {
    const handle = registry.Handle{ .slot = 7, .generation = 42 };
    try std.testing.expectEqual(handle, registry.Handle.from_int(handle.to_int()));
    try std.testing.expectEqual(@as(u40, 42 * 256 + 7), handle.to_int());
}
