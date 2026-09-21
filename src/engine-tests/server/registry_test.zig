//! Unit tests for `src/engine/server/registry.zig`.

const std = @import("std");
const napi = @import("napi-zig");
const registry = @import("../../engine/server/registry.zig");

const c = napi.c;

/// Dummy non-null environments. The table only compares them; it never
/// dereferences them.
const env: c.napi_env = @ptrFromInt(0x1000);
const foreign_env: c.napi_env = @ptrFromInt(0x2000);

test "slot table hands out, publishes, and recycles slots" {
    const Table = registry.slot_table(4, u8);
    var table = Table{};
    var value: u8 = 7;

    const first = try table.claim();
    const second = try table.claim();
    try std.testing.expect(first.slot != second.slot);

    table.publish(first, &value, env);
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(first, env));
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(second, env));

    table.retire(first);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(first, env));
    const reclaimed = try table.claim();
    try std.testing.expectEqual(first.slot, reclaimed.slot);
    try std.testing.expect(first.generation != reclaimed.generation);
}

test "a stale generation never resolves a recycled slot" {
    const Table = registry.slot_table(2, u8);
    var table = Table{};
    var value: u8 = 1;

    const stale = try table.claim();
    table.publish(stale, &value, env);
    table.retire(stale);

    const recycled = try table.claim();
    table.publish(recycled, &value, env);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(stale, env));
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(recycled, env));
}

test "a lookup from another environment never reaches the instance" {
    const Table = registry.slot_table(2, u8);
    var table = Table{};
    var value: u8 = 1;

    const handle = try table.claim();
    table.publish(handle, &value, env);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(handle, foreign_env));
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(handle, env));

    table.retire(handle);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(handle, env));
}

test "publish ignores a handle whose slot is out of range" {
    const Table = registry.slot_table(2, u8);
    var table = Table{};
    var value: u8 = 1;

    table.publish(.{ .slot = 200, .generation = 1 }, &value, env);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(.{ .slot = 200, .generation = 1 }, env));
}

test "slot table reports exhaustion and reclaims" {
    const Table = registry.slot_table(1, u8);
    var table = Table{};
    var value: u8 = 1;
    const handle = try table.claim();
    try std.testing.expectError(error.CapacityExhausted, table.claim());
    table.publish(handle, &value, env);
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
        table.publish(handle, &value, env);
    }
    try std.testing.expectEqual(@as(u32, 0xFFFF_FFFF), seen);
    try std.testing.expectError(error.CapacityExhausted, table.claim());
}

test "handle integers keep generation above the slot byte" {
    const handle = registry.Handle{ .slot = 0x0000_00AB, .generation = 0x1234_5678 };
    try std.testing.expectEqual(@as(u40, 0x1234_5678_AB), handle.to_int());
    try std.testing.expectEqual(handle, registry.Handle.from_int(handle.to_int()));
}

test "retiring a stale generation leaves the live slot alone" {
    var table = registry.slot_table(2, u8){};
    var value: u8 = 1;
    const handle = try table.claim();
    table.publish(handle, &value, env);

    const stale = registry.Handle{ .slot = handle.slot, .generation = handle.generation +% 1 };
    table.retire(stale);
    try std.testing.expectEqual(@as(?*u8, &value), table.lookup(handle, env));

    table.retire(handle);
    try std.testing.expectEqual(@as(?*u8, null), table.lookup(handle, env));
}
