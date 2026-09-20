//! FFI-facing per-connection operations.
//!
//! Every entry point resolves the server through the instance table and the
//! connection through the generation-checked slab before touching a record, so
//! a call against a closed connection returns a typed status instead of
//! dereferencing a stale slot. Payload bytes are copied into the bounded
//! staging ring during the call; JavaScript memory is never retained.

const napi = @import("napi-zig");
const handles = @import("handles.zig");
const instance = @import("instance.zig");
const socket = @import("socket.zig");

pub const Status = socket.Status;

/// Stages one outbound text or binary message for a connection handle.
pub fn send_socket(
    env: napi.Env,
    server: u40,
    connection: u64,
    data: []const u8,
    binary: bool,
) !Status {
    const target = instance.lookup(env, server) orelse return error.UnknownServer;
    const index = connection_index(target, connection) orelse return .invalid_handle;
    return target.sockets.send(index, if (binary) .binary else .text, data);
}

/// Validates a close code and reason, stages the close frame, and enters
/// `closing` for a connection handle.
pub fn close_socket(
    env: napi.Env,
    server: u40,
    connection: u64,
    code: u16,
    reason: []const u8,
) !Status {
    const target = instance.lookup(env, server) orelse return error.UnknownServer;
    const index = connection_index(target, connection) orelse return .invalid_handle;
    return target.sockets.close(index, code, reason);
}

/// Suspends inbound message dispatch for a connection handle.
pub fn pause_socket(env: napi.Env, server: u40, connection: u64) !Status {
    const target = instance.lookup(env, server) orelse return error.UnknownServer;
    const index = connection_index(target, connection) orelse return .invalid_handle;
    return target.sockets.pause_dispatch(index);
}

/// Resumes inbound message dispatch for a connection handle.
pub fn resume_socket(env: napi.Env, server: u40, connection: u64) !Status {
    const target = instance.lookup(env, server) orelse return error.UnknownServer;
    const index = connection_index(target, connection) orelse return .invalid_handle;
    return target.sockets.resume_dispatch(index);
}

/// Bytes staged for a connection handle and not yet drained. A stale handle
/// reads zero, matching `ws` where a closed socket reports no buffered amount.
pub fn socket_buffered_amount(env: napi.Env, server: u40, connection: u64) !u32 {
    const target = instance.lookup(env, server) orelse return error.UnknownServer;
    const index = connection_index(target, connection) orelse return 0;
    return target.sockets.buffered(index);
}

fn connection_index(target: *instance.Instance, raw: u64) ?u32 {
    return target.slab.resolve(handles.Handle.fromInt(raw));
}
