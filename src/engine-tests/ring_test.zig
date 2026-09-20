//! Unit tests for `src/engine/ring.zig`.

const std = @import("std");
const ring_module = @import("../engine/ring.zig");

const capacity = 8;
const Ring = ring_module.event_ring(capacity);

test "the ring refuses to overrun while the main thread lags" {
    var ring = Ring{};
    var reserved: u32 = 0;
    while (ring.reserve() != null) reserved += 1;
    try std.testing.expectEqual(@as(u32, capacity), reserved);
    try std.testing.expectEqual(@as(u64, 1), ring.dropped.load(.monotonic));
    try std.testing.expectEqual(@as(u64, capacity), ring.pending());
}

test "completing a reservation frees the slot for the next sequence" {
    var ring = Ring{};
    const first = ring.reserve().?;
    ring.complete(first);

    var reserved: u32 = 1;
    while (ring.reserve() != null) reserved += 1;
    try std.testing.expectEqual(@as(u32, capacity + 1), reserved);
    try std.testing.expectEqual(@as(u64, capacity), ring.pending());
}

test "a failed dispatch retires its reservation" {
    var ring = Ring{};
    const sequence = ring.reserve().?;
    ring.drop(sequence);
    try std.testing.expectEqual(@as(u64, 0), ring.pending());
    try std.testing.expectEqual(@as(u64, 1), ring.dropped.load(.monotonic));
}

test "sequence indexes wrap within the power-of-two ring" {
    var ring = Ring{};
    const first = ring.reserve().?;
    ring.complete(first);

    var last = first;
    while (ring.reserve()) |sequence| last = sequence;
    try std.testing.expectEqual(first + capacity, last);
    try std.testing.expectEqual(
        first & (capacity - 1),
        last & (capacity - 1),
    );
}
