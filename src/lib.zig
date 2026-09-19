const std = @import("std");
const napi = @import("napi-zig");
const uwz = @import("uwebzockets_version");

comptime {
    napi.module(@This());
}

/// Version of the linked uWebZockets engine, for example "1.1.0".
pub fn engine_version() []const u8 {
    return uwz.string;
}

test "engine version matches the linked uWebZockets release" {
    try std.testing.expectEqualStrings(uwz.string, engine_version());
}
