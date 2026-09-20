//! Unit tests for `src/engine/callbacks.zig`.

const std = @import("std");
const callbacks = @import("../engine/callbacks.zig");

test "a fresh channel has no pending events" {
    var channel = callbacks.Channel{};
    try std.testing.expectEqual(@as(u64, 0), channel.pending());
}

test "the ring depth leaves lifecycle headroom above the connections" {
    try std.testing.expect(callbacks.capacity > 2 * @import("../engine/options.zig").connection_capacity);
    try std.testing.expect(std.math.isPowerOfTwo(callbacks.capacity));
}
