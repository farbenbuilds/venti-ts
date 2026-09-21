//! Unit tests for `src/engine/server/options.zig`.

const std = @import("std");
const options = @import("../../engine/server/options.zig");

test "trust copies a valid configuration" {
    const config = try options.trust(.{ .host = "::1", .port = 8080, .path = "/ws" });
    try std.testing.expectEqualStrings("::1", config.listen.host_slice());
    try std.testing.expectEqualStrings("/ws", config.path_slice());
    try std.testing.expectEqual(@as(u16, 8080), config.listen.port);
    try std.testing.expectEqual(options.connection_capacity, config.limits.max_connections);
}

test "trust accepts the exact port and backlog bounds" {
    const max = try options.trust(.{ .port = options.max_port, .backlog = options.max_backlog });
    try std.testing.expectEqual(@as(u16, 65_535), max.listen.port);
    try std.testing.expectEqual(@as(u16, 65_535), max.listen.backlog);
}

test "trust rejects out-of-range ports and backlogs" {
    try std.testing.expectError(error.InvalidPort, options.trust(.{ .port = -1 }));
    try std.testing.expectError(error.InvalidPort, options.trust(.{ .port = 65_536 }));
    try std.testing.expectError(error.InvalidBacklog, options.trust(.{ .port = 1, .backlog = -1 }));
    try std.testing.expectError(
        error.InvalidBacklog,
        options.trust(.{ .port = 1, .backlog = 65_536 }),
    );
}

test "trust rejects values that would wrap a uint32" {
    try std.testing.expectError(
        error.InvalidPort,
        options.trust(.{ .port = 4_294_967_298 }),
    );
    try std.testing.expectError(
        error.InvalidConnectionCapacity,
        options.trust(.{ .port = 1, .max_connections = 4_294_967_298 }),
    );
}

test "trust rejects malformed text fields" {
    try std.testing.expectError(error.InvalidHost, options.trust(.{ .host = "", .port = 1 }));
    try std.testing.expectError(error.InvalidHost, options.trust(.{ .host = "a\x00b", .port = 1 }));
    try std.testing.expectError(error.InvalidPath, options.trust(.{ .port = 1, .path = "ws" }));
    try std.testing.expectError(error.InvalidPath, options.trust(.{ .port = 1, .path = "" }));
}

test "trust rejects limits beyond the compiled capacities" {
    try std.testing.expectError(
        error.InvalidConnectionCapacity,
        options.trust(.{ .port = 1, .max_connections = 0 }),
    );
    try std.testing.expectError(
        error.InvalidConnectionCapacity,
        options.trust(.{ .port = 1, .max_connections = options.connection_capacity + 1 }),
    );
    try std.testing.expectError(
        error.InvalidMessageCapacity,
        options.trust(.{ .port = 1, .max_message_bytes = 0 }),
    );
    try std.testing.expectError(
        error.InvalidMessageCapacity,
        options.trust(.{ .port = 1, .max_message_bytes = options.message_capacity + 1 }),
    );
    try std.testing.expectError(
        error.InvalidFrameCapacity,
        options.trust(.{ .port = 1, .max_frame_bytes = 0 }),
    );
    try std.testing.expectError(
        error.InvalidFrameCapacity,
        options.trust(.{ .port = 1, .max_message_bytes = 1_024, .max_frame_bytes = 2_048 }),
    );
}

test "trust accepts the exact text capacity boundaries" {
    const host_max = try options.trust(.{ .port = 1, .host = "h" ** (options.host_capacity - 1) });
    try std.testing.expectEqual(options.host_capacity - 1, host_max.listen.host_slice().len);
    try std.testing.expectError(
        error.InvalidHost,
        options.trust(.{ .port = 1, .host = "h" ** options.host_capacity }),
    );

    const path_max = try options.trust(.{ .port = 1, .path = "/" ++ "p" ** (options.path_capacity - 2) });
    try std.testing.expectEqual(options.path_capacity - 1, path_max.path_slice().len);
    try std.testing.expectError(
        error.InvalidPath,
        options.trust(.{ .port = 1, .path = "/" ++ "p" ** (options.path_capacity - 1) }),
    );
}

test "trust accepts a frame cap equal to the message cap" {
    const config = try options.trust(.{
        .port = 1,
        .max_message_bytes = options.message_capacity,
        .max_frame_bytes = options.message_capacity,
    });
    try std.testing.expectEqual(options.message_capacity, config.limits.max_frame_bytes);
}
