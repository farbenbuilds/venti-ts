//! Unit tests for `src/engine/socket.zig`.

const std = @import("std");
const payload = @import("../engine/payload.zig");
const socket = @import("../engine/socket.zig");

const Ring = payload.payload_ring(4, 16);
const Slab = socket.socket_slab(4, Ring);

test "send stages a record and accounts the buffered amount" {
    var slab = Slab{};
    slab.open(1, 42);

    try std.testing.expectEqual(socket.Status.ok, slab.send(1, .text, "hello"));
    try std.testing.expectEqual(@as(u32, 5), slab.buffered(1));

    const view = slab.ring.peek().?;
    try std.testing.expectEqual(@as(u32, 1), view.index);
    try std.testing.expectEqual(@as(u32, 42), view.generation);
    try std.testing.expectEqualStrings("hello", view.bytes);
}

test "send rejects oversized payloads and unknown slots" {
    var slab = Slab{};
    slab.open(0, 1);

    try std.testing.expectEqual(socket.Status.payload_too_large, slab.send(0, .binary, "0123456789abcdefg"));
    try std.testing.expectEqual(socket.Status.invalid_handle, slab.send(4, .binary, "x"));
    try std.testing.expectEqual(@as(u32, 0), slab.buffered(0));
}

test "close validates the code and reason" {
    var slab = Slab{};
    slab.open(0, 1);

    try std.testing.expectEqual(socket.Status.invalid_close_code, slab.close(0, 1005, ""));
    try std.testing.expectEqual(socket.Status.invalid_close_code, slab.close(0, 999, ""));
    try std.testing.expectEqual(socket.Status.invalid_close_reason, slab.close(0, 1000, "x" ** 124));
    try std.testing.expectEqual(socket.Status.invalid_close_reason, slab.close(0, 1000, "\xff\xfe"));
    try std.testing.expectEqual(socket.Status.ok, slab.close(0, 3001, "bye"));
    try std.testing.expectEqual(socket.Status.closing, slab.close(0, 1000, ""));

    const view = slab.ring.peek().?;
    try std.testing.expectEqual(payload.Kind.close, view.kind);
    try std.testing.expectEqualSlices(u8, &.{ 0x0b, 0xb9, 'b', 'y', 'e' }, view.bytes);
}

test "send is refused once closing and closed" {
    var slab = Slab{};
    slab.open(2, 7);

    try std.testing.expectEqual(socket.Status.ok, slab.close(2, 1000, ""));
    try std.testing.expectEqual(socket.Status.closing, slab.send(2, .text, "late"));
    try std.testing.expect(slab.finish(2));
    try std.testing.expectEqual(socket.Status.closed, slab.send(2, .text, "late"));
    try std.testing.expectEqual(socket.Status.closed, slab.close(2, 1000, ""));
    try std.testing.expectEqual(@as(?socket.State, .closed), slab.state_of(2));
}

test "pause and resume dispatch are idempotent while open" {
    var slab = Slab{};
    slab.open(0, 1);

    try std.testing.expectEqual(socket.Status.ok, slab.pause_dispatch(0));
    try std.testing.expectEqual(socket.Status.ok, slab.pause_dispatch(0));
    try std.testing.expect(slab.is_paused(0));
    try std.testing.expectEqual(socket.Status.ok, slab.resume_dispatch(0));
    try std.testing.expectEqual(socket.Status.ok, slab.resume_dispatch(0));
    try std.testing.expect(!slab.is_paused(0));

    try std.testing.expectEqual(socket.Status.ok, slab.close(0, 1000, ""));
    try std.testing.expectEqual(socket.Status.closing, slab.pause_dispatch(0));
    try std.testing.expectEqual(socket.Status.closing, slab.resume_dispatch(0));
}

test "the terminal latch flips exactly once per generation" {
    var slab = Slab{};
    slab.open(0, 5);

    try std.testing.expect(slab.latch_terminal(0));
    try std.testing.expect(!slab.latch_terminal(0));
    try std.testing.expect(!slab.finish(0));

    slab.open(0, 6);
    try std.testing.expect(slab.finish(0));
    try std.testing.expect(!slab.latch_terminal(0));
}

test "concurrent finishers observe a single terminal winner" {
    var slab = Slab{};
    slab.open(0, 1);

    var winners = std.atomic.Value(u32).init(0);
    const Runner = struct {
        fn run(target: *Slab, tally: *std.atomic.Value(u32)) void {
            if (target.finish(0)) _ = tally.fetchAdd(1, .monotonic);
        }
    };

    var threads: [4]std.Thread = undefined;
    for (&threads) |*thread| thread.* = try std.Thread.spawn(.{}, Runner.run, .{ &slab, &winners });
    for (threads) |thread| thread.join();

    try std.testing.expectEqual(@as(u32, 1), winners.load(.acquire));
}

test "draining saturates the buffered amount at zero" {
    var slab = Slab{};
    slab.open(0, 1);

    _ = slab.send(0, .binary, "abcd");
    slab.note_drained(0, 2);
    try std.testing.expectEqual(@as(u32, 2), slab.buffered(0));
    slab.note_drained(0, 9);
    try std.testing.expectEqual(@as(u32, 0), slab.buffered(0));
}

test "valid close codes mirror the compatibility contract" {
    try std.testing.expect(socket.valid_close_code(1000));
    try std.testing.expect(socket.valid_close_code(1014));
    try std.testing.expect(socket.valid_close_code(3000));
    try std.testing.expect(socket.valid_close_code(4999));
    try std.testing.expect(!socket.valid_close_code(1004));
    try std.testing.expect(!socket.valid_close_code(1005));
    try std.testing.expect(!socket.valid_close_code(1006));
    try std.testing.expect(!socket.valid_close_code(1015));
    try std.testing.expect(!socket.valid_close_code(2999));
    try std.testing.expect(!socket.valid_close_code(5000));
}
