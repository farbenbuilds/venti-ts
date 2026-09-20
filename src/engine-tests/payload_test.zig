//! Unit tests for `src/engine/payload.zig`.

const std = @import("std");
const payload = @import("../engine/payload.zig");

test "stages records in order and releases them" {
    var ring = payload.payload_ring(2, 8){};

    try ring.stage(.text, 3, 9, "hello");
    try ring.stage(.binary, 4, 10, "world!");
    try std.testing.expectEqual(@as(usize, 2), ring.pending());

    const first = ring.peek().?;
    try std.testing.expectEqual(payload.Kind.text, first.kind);
    try std.testing.expectEqual(@as(u32, 3), first.index);
    try std.testing.expectEqual(@as(u32, 9), first.generation);
    try std.testing.expectEqualStrings("hello", first.bytes);
    ring.release(first);

    const second = ring.peek().?;
    try std.testing.expectEqual(payload.Kind.binary, second.kind);
    try std.testing.expectEqualStrings("world!", second.bytes);
    ring.release(second);

    try std.testing.expectEqual(@as(usize, 0), ring.pending());
    try std.testing.expectEqual(@as(?payload.View, null), ring.peek());
}

test "copies the source so caller memory is never retained" {
    var ring = payload.payload_ring(1, 8){};
    var source = [_]u8{ 1, 2, 3 };
    try ring.stage(.binary, 0, 1, &source);

    source = [_]u8{ 9, 9, 9 };
    try std.testing.expectEqualSlices(u8, &.{ 1, 2, 3 }, ring.peek().?.bytes);
}

test "rejects an oversized payload before copying" {
    var ring = payload.payload_ring(1, 4){};

    try std.testing.expectError(error.PayloadTooLarge, ring.stage(.text, 0, 1, "12345"));
    try std.testing.expectEqual(@as(usize, 0), ring.pending());
    try std.testing.expectEqual(@as(u64, 0), ring.dropped_count());
}

test "reports backpressure instead of growing" {
    var ring = payload.payload_ring(2, 4){};

    try ring.stage(.text, 0, 1, "aaaa");
    try ring.stage(.text, 0, 1, "bbbb");
    try std.testing.expectError(error.QueueFull, ring.stage(.text, 0, 1, "cccc"));
    try std.testing.expectEqual(@as(u64, 1), ring.dropped_count());
    try std.testing.expectEqual(@as(usize, 2), ring.pending());

    const view = ring.peek().?;
    ring.release(view);
    try ring.stage(.text, 0, 1, "cccc");
    try std.testing.expectEqual(@as(usize, 2), ring.pending());
}

test "a zero length record round trips" {
    var ring = payload.payload_ring(1, 4){};

    try ring.stage(.ping, 7, 2, "");
    const view = ring.peek().?;
    try std.testing.expectEqual(@as(usize, 0), view.bytes.len);
    try std.testing.expectEqual(payload.Kind.ping, view.kind);
}

test "a recycled slot refreshes every record field" {
    var ring = payload.payload_ring(2, 4){};

    try ring.stage(.text, 1, 1, "aaaa");
    try ring.stage(.binary, 2, 2, "bb");
    const first = ring.peek().?;
    ring.release(first);
    const second = ring.peek().?;
    ring.release(second);

    try ring.stage(.ping, 9, 7, "c");
    const refreshed = ring.peek().?;
    try std.testing.expectEqual(payload.Kind.ping, refreshed.kind);
    try std.testing.expectEqual(@as(u32, 9), refreshed.index);
    try std.testing.expectEqual(@as(u32, 7), refreshed.generation);
    try std.testing.expectEqualStrings("c", refreshed.bytes);
    try std.testing.expectEqual(@as(usize, 1), ring.pending());
}
