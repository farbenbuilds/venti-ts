//! Unit tests for `src/engine/channel/ring.zig`.

const std = @import("std");
const ring_module = @import("../../engine/channel/ring.zig");

const capacity = 8;
const terminal_reserve = 2;
const Ring = ring_module.event_ring(capacity, terminal_reserve);

test "the ring refuses to overrun while the main thread lags" {
    var ring = Ring{};
    var reserved: u32 = 0;
    while (ring.reserve() != null) reserved += 1;
    try std.testing.expectEqual(@as(u32, capacity - terminal_reserve), reserved);
    try std.testing.expectEqual(@as(u64, 1), ring.dropped_count());
    try std.testing.expectEqual(@as(u64, capacity - terminal_reserve), ring.pending());
}

test "terminal events may use the reserved tail" {
    var ring = Ring{};
    while (ring.reserve() != null) {}
    try std.testing.expect(ring.reserve_terminal() != null);
    try std.testing.expect(ring.reserve_terminal() != null);
    try std.testing.expectEqual(@as(?u64, null), ring.reserve_terminal());
    try std.testing.expectEqual(@as(u64, capacity), ring.pending());
}

test "completing a reservation frees the slot for the next sequence" {
    var ring = Ring{};
    const first = ring.reserve().?;
    ring.complete(first);

    var reserved: u32 = 1;
    while (ring.reserve() != null) reserved += 1;
    try std.testing.expectEqual(@as(u32, capacity - terminal_reserve + 1), reserved);
    try std.testing.expectEqual(@as(u64, capacity - terminal_reserve), ring.pending());
}

test "a dropped reservation stays outstanding until a later completion skips it" {
    var ring = Ring{};
    const dropped = ring.reserve().?;
    ring.drop(dropped);
    try std.testing.expectEqual(@as(u64, 1), ring.pending());
    try std.testing.expectEqual(@as(u64, 1), ring.dropped_count());

    const next = ring.reserve().?;
    ring.complete(next);
    try std.testing.expectEqual(@as(u64, 0), ring.pending());
}

test "completion is monotonic" {
    var ring = Ring{};
    for (0..4) |_| {
        const sequence = ring.reserve().?;
        ring.complete(sequence);
    }
    const completed = ring.completed.load(.acquire);
    ring.complete(0);
    try std.testing.expectEqual(completed, ring.completed.load(.acquire));
}

test "sequence indexes wrap within the power-of-two ring" {
    var ring = Ring{};
    var last: u64 = 0;
    for (0..capacity) |_| {
        const sequence = ring.reserve().?;
        last = sequence;
        ring.complete(sequence);
    }
    try std.testing.expectEqual(@as(u64, capacity - 1), last);

    const wrapped = ring.reserve().?;
    try std.testing.expectEqual(@as(u64, capacity), wrapped);
    try std.testing.expectEqual(@as(u64, 0), wrapped & (capacity - 1));
}
