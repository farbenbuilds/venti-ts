const std = @import("std");
const napi = @import("napi-zig");
const uwz = @import("uWebZockets");
const build_options = @import("build_options");

comptime {
    napi.module(@This());
}

/// Version of the linked uWebZockets engine, for example "1.1.0".
pub fn engine_version() []const u8 {
    return build_options.engine_version;
}

/// Whether the linked engine includes the HTTP/3 transport.
pub fn http3_available() bool {
    return uwz.http3_available;
}

test "engine version is a dotted release string" {
    const version = engine_version();
    try std.testing.expect(version.len > 0);
    try std.testing.expect(std.mem.indexOfScalar(u8, version, '.') != null);
}

test "engine reports HTTP/3 support" {
    try std.testing.expect(http3_available());
}
