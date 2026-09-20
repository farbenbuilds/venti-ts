//! Unit tests for `src/lib.zig`.

const std = @import("std");
const lib = @import("../lib.zig");

test "engine version is a dotted release string" {
    const version = lib.engine_version();
    try std.testing.expect(version.len > 0);
    try std.testing.expect(std.mem.indexOfScalar(u8, version, '.') != null);
}

test "engine reports HTTP/3 support" {
    try std.testing.expect(lib.http3_available());
}
