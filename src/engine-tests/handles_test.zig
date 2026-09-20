//! Unit tests for `src/engine/handles.zig`.

const std = @import("std");
const handles = @import("../engine/handles.zig");

test "acquire and resolve hand out live slots" {
    const Slab = handles.connection_slab(4);
    var slab = Slab{};

    const first = try slab.acquire(2);
    try std.testing.expectEqual(@as(u32, 1), first.generation);
    try std.testing.expectEqual(@as(?u32, 2), slab.resolve(first));
    try std.testing.expectEqual(@as(u32, 1), slab.count_active());
}

test "release invalidates the previous generation" {
    const Slab = handles.connection_slab(4);
    var slab = Slab{};

    const first = try slab.acquire(1);
    const freed = slab.release(1).?;
    const second = try slab.acquire(1);

    try std.testing.expectEqual(first.generation, freed.generation);
    try std.testing.expect(first.generation != second.generation);
    try std.testing.expectEqual(@as(?u32, null), slab.resolve(first));
    try std.testing.expectEqual(@as(?u32, 1), slab.resolve(second));
}

test "busy slots and out-of-range indices are rejected" {
    const Slab = handles.connection_slab(2);
    var slab = Slab{};

    _ = try slab.acquire(0);
    try std.testing.expectError(error.SlotBusy, slab.acquire(0));
    try std.testing.expectError(error.SlotOutOfRange, slab.acquire(2));
    try std.testing.expectEqual(@as(?handles.Handle, null), slab.release(2));
    try std.testing.expectEqual(@as(?handles.Handle, null), slab.release(1));
}

test "handle integers pack index and generation" {
    const handle = handles.Handle{ .index = 0xDEADBEEF, .generation = 0x01020304 };
    try std.testing.expectEqual(@as(u64, 0x01020304DEADBEEF), handle.toInt());
    try std.testing.expectEqual(handle, handles.Handle.fromInt(handle.toInt()));
}
