const builtin = @import("builtin");
const std = @import("std");

/// Overrides for the C toolchain that builds the vendored libraries. A null
/// field leaves the upstream Zig C default in place.
pub const Compilers = struct {
    c: ?[]const u8 = null,
    cxx: ?[]const u8 = null,
    assembler: ?[]const u8 = null,
};

/// The vendored C libraries link into a shared addon, so they must be
/// position independent. Zig's C compiler defaults to PIC on glibc and macOS
/// but not on musl, so pin it with wrappers wherever the host can run them.
pub fn vendor_compilers(b: *std.Build, target: std.Build.ResolvedTarget) Compilers {
    if (builtin.os.tag == .windows or target.result.os.tag == .windows) return .{};
    return .{
        .c = b.pathFromRoot("scripts/zig-cc-pic"),
        .cxx = b.pathFromRoot("scripts/zig-cxx-pic"),
        .assembler = b.pathFromRoot("scripts/zig-cc-pic"),
    };
}
