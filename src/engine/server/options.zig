//! Trusted server configuration.
//!
//! JavaScript values cross the boundary once, are validated against the
//! compile-time engine capacities, and are copied into fixed-capacity structs.
//! Every later native call takes the trusted record and performs no further
//! bounds work.

const std = @import("std");

/// Capacities compiled into the engine application type. The engine's
/// per-connection footprint is dominated by HTTP/2 session state, so the
/// connection count is the main memory knob; keep it deliberately modest.
pub const connection_capacity: u32 = 128;
pub const message_capacity: u32 = 32 * 1024;
pub const frame_capacity: u32 = message_capacity;
pub const write_queue_capacity: u32 = 32 * 1024;
/// Largest request body the engine accepts, on HTTP/1.1 and per HTTP/2 stream
/// alike. A WebSocket upgrade never carries one, so this only sizes the
/// engine's per-connection request buffer and the narrowed HTTP/2 stream.
pub const body_capacity: u32 = 4 * 1024;
/// Inactivity timeout the engine application type is compiled with. Zero
/// leaves the engine's connection sweeper unstarted, so a connection lives
/// until the peer or the application ends it. `ws` has no idle timeout, so
/// there is no engine-side default to match either.
pub const idle_timeout_ms: u64 = 0;

/// Fixed storage limits for host and route path. The extra byte holds the
/// NUL sentinel the engine's `[]const u8` listeners expect.
pub const host_capacity = 254;
pub const path_capacity = 256;
/// RFC 6455 section 5.5 caps every control frame at 125 bytes, so a close
/// frame must always fit inside the configured frame cap.
pub const min_frame_bytes: u32 = 125;
pub const max_port: u32 = 65_535;
pub const max_backlog: u32 = 65_535;

pub const Error = error{
    InvalidHost,
    InvalidPort,
    InvalidBacklog,
    InvalidPath,
    InvalidConnectionCapacity,
    InvalidMessageCapacity,
    InvalidFrameCapacity,
};

/// Exact JavaScript safe-integer width. Node-API reads this from a plain
/// number without wrapping; `u32` would silently truncate values above 2^32.
pub const JsInt = i53;

/// Untrusted values exactly as JavaScript passes them.
pub const RawConfig = struct {
    host: []const u8 = "127.0.0.1",
    port: JsInt,
    backlog: JsInt = 128,
    path: []const u8 = "/",
    max_connections: JsInt = connection_capacity,
    max_message_bytes: JsInt = message_capacity,
    max_frame_bytes: JsInt = frame_capacity,
};

/// Per-route limits handed to the engine WebSocket behavior.
pub const Limits = struct {
    max_connections: u32,
    max_message_bytes: u32,
    max_frame_bytes: u32,
};

/// Immutable listen address copied out of the JavaScript argument.
pub const ListenConfig = struct {
    host_len: u8,
    host: [host_capacity]u8,
    port: u16,
    backlog: u16,

    /// NUL-terminated host. The engine binds this address and port.
    pub fn host_slice(config: *const ListenConfig) [:0]const u8 {
        return config.host[0..config.host_len :0];
    }
};

/// The trusted record every engine call consumes. The engine ignores the
/// backlog, which is retained for transports that accept it later and for the
/// compatibility layer's `server.address()` bookkeeping.
pub const ServerConfig = struct {
    listen: ListenConfig,
    path_len: u8,
    path: [path_capacity]u8,
    limits: Limits,

    /// NUL-terminated route path the WebSocket upgrade is registered under.
    pub fn path_slice(config: *const ServerConfig) [:0]const u8 {
        return config.path[0..config.path_len :0];
    }
};

/// Validates untrusted values once and copies them into fixed storage.
pub fn trust(raw: RawConfig) Error!ServerConfig {
    if (raw.port < 0 or raw.port > max_port) return error.InvalidPort;
    if (raw.backlog < 0 or raw.backlog > max_backlog) return error.InvalidBacklog;

    var host: [host_capacity]u8 = undefined;
    const host_len = copy_text(host_capacity, &host, raw.host) orelse return error.InvalidHost;

    var path: [path_capacity]u8 = undefined;
    const path_len = copy_text(path_capacity, &path, raw.path) orelse return error.InvalidPath;
    if (path[0] != '/') return error.InvalidPath;

    const limits = try trust_limits(raw);
    return .{
        .listen = .{
            .host_len = host_len,
            .host = host,
            .port = @intCast(raw.port),
            .backlog = @intCast(raw.backlog),
        },
        .path_len = path_len,
        .path = path,
        .limits = limits,
    };
}

fn trust_limits(raw: RawConfig) Error!Limits {
    if (raw.max_connections <= 0 or raw.max_connections > connection_capacity) {
        return error.InvalidConnectionCapacity;
    }
    if (raw.max_message_bytes <= 0 or raw.max_message_bytes > message_capacity) {
        return error.InvalidMessageCapacity;
    }
    if (raw.max_frame_bytes < min_frame_bytes or raw.max_frame_bytes > raw.max_message_bytes) {
        return error.InvalidFrameCapacity;
    }
    return .{
        .max_connections = @intCast(raw.max_connections),
        .max_message_bytes = @intCast(raw.max_message_bytes),
        .max_frame_bytes = @intCast(raw.max_frame_bytes),
    };
}

/// Copies `value` and its NUL sentinel into `dest`, rejecting empties,
/// overflow, and embedded NUL bytes.
fn copy_text(comptime capacity: usize, dest: *[capacity]u8, value: []const u8) ?u8 {
    if (value.len == 0 or value.len >= capacity) return null;
    if (std.mem.indexOfScalar(u8, value, 0) != null) return null;
    @memcpy(dest[0..value.len], value);
    dest[value.len] = 0;
    return @intCast(value.len);
}
