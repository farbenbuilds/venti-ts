//! Listener address introspection for the bound port.

const std = @import("std");

/// Reads the local port from a bound POSIX listener descriptor. Returns null
/// when the kernel rejects the query or the address family is not IP-based.
pub fn bound_port(fd: std.posix.socket_t) ?u16 {
    var storage: std.posix.sockaddr.storage = undefined;
    var length: std.posix.socklen_t = @sizeOf(std.posix.sockaddr.storage);
    const result = std.posix.system.getsockname(fd, @ptrCast(&storage), &length);
    if (std.posix.errno(result) != .SUCCESS) return null;
    return port_of(&storage);
}

/// Extracts the port from a raw socket address stored in network byte order.
pub fn port_of(storage: *const std.posix.sockaddr.storage) ?u16 {
    return switch (storage.family) {
        std.posix.AF.INET => std.mem.bigToNative(u16, ipv4(storage).port),
        std.posix.AF.INET6 => std.mem.bigToNative(u16, ipv6(storage).port),
        else => null,
    };
}

fn ipv4(storage: *const std.posix.sockaddr.storage) *const std.posix.sockaddr.in {
    return @ptrCast(storage);
}

fn ipv6(storage: *const std.posix.sockaddr.storage) *const std.posix.sockaddr.in6 {
    return @ptrCast(storage);
}
