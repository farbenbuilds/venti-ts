//! Unit tests for `src/engine/channel/events.zig`.

const std = @import("std");
const events = @import("../../engine/channel/events.zig");

test "events default the connection fields to zero" {
    const event = events.Event{ .kind = .connection_open, .server = 3 };
    try std.testing.expectEqual(@as(u32, 0), event.index);
    try std.testing.expectEqual(@as(u32, 0), event.generation);
    try std.testing.expectEqual(@as(u32, 0), event.code);
}

test "kind ordinals stay pinned to the binding vocabulary" {
    // Reordering these silently changes the ABI; see ENGINE_EVENT_KINDS in
    // src/binding/native.ts.
    try std.testing.expectEqual(@as(u8, 0), @intFromEnum(events.Kind.listening));
    try std.testing.expectEqual(@as(u8, 1), @intFromEnum(events.Kind.connection_open));
    try std.testing.expectEqual(@as(u8, 2), @intFromEnum(events.Kind.connection_close));
    try std.testing.expectEqual(@as(u8, 3), @intFromEnum(events.Kind.engine_error));
    try std.testing.expectEqual(@as(u8, 4), @intFromEnum(events.Kind.server_closed));
    try std.testing.expectEqual(@as(usize, 5), @typeInfo(events.Kind).@"enum".fields.len);
}
