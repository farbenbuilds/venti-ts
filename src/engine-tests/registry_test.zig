//! Unit tests for `src/registry.zig`.

const std = @import("std");
const registry = @import("../registry.zig");

test "slot table hands out, publishes, and recycles slots" {
    const Table = registry.slot_table(4, u8);
    var table = Table{};
    var value: u8 = 7;

    const first = try table.claim();
    const second = try table.claim();
    try std.testing.expect(first.slot != second.slot);

    table.publish(first, &value);
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(first));
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(second));

    table.retire(first);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(first));
    const reclaimed = try table.claim();
    try std.testing.expectEqual(first.slot, reclaimed.slot);
    try std.testing.expect(first.generation != reclaimed.generation);
}

test "a stale generation never resolves a recycled slot" {
    const Table = registry.slot_table(2, u8);
    var table = Table{};
    var value: u8 = 1;

    const stale = try table.claim();
    table.publish(stale, &value);
    table.retire(stale);

    const recycled = try table.claim();
    table.publish(recycled, &value);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(stale));
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(recycled));
}

test "slot table reports exhaustion and reclaims" {
    const Table = registry.slot_table(1, u8);
    var table = Table{};
    var value: u8 = 1;
    const handle = try table.claim();
    try std.testing.expectError(error.CapacityExhausted, table.claim());
    table.publish(handle, &value);
    table.retire(handle);
    try std.testing.expectEqual(handle.slot, (try table.claim()).slot);
}

test "a full 32-slot table exhausts exactly once" {
    const Table = registry.slot_table(32, u8);
    var table = Table{};
    var value: u8 = 1;

    var seen: u32 = 0;
    for (0..32) |_| {
        const handle = try table.claim();
        seen |= @as(u32, 1) << @intCast(handle.slot);
        table.publish(handle, &value);
    }
    try std.testing.expectEqual(@as(u32, 0xFFFF_FFFF), seen);
    try std.testing.expectError(error.CapacityExhausted, table.claim());
}

test "handle integers keep generation above the slot byte" {
    const handle = registry.Handle{ .slot = 0x0000_00AB, .generation = 0x1234_5678 };
    try std.testing.expectEqual(@as(u40, 0x1234_5678_AB), handle.toInt());
    try std.testing.expectEqual(handle, registry.Handle.fromInt(handle.toInt()));
}
