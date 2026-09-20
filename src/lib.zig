const napi = @import("napi-zig");
const uwz = @import("uWebZockets");
const build_options = @import("build_options");
const server = @import("engine/server.zig");
const socket_io = @import("engine/socket_io.zig");

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

/// Validates an untrusted configuration, builds an engine server around a
/// dispatch function, and returns a generation-checked server handle.
pub const create_server = server.create_server;
/// Binds the listener and starts the engine thread for a server handle.
pub const listen_server = server.listen_server;
/// Requests shutdown of a listening server.
pub const close_server = server.close_server;
/// Releases the native resources of a closed server after `serverClosed`.
pub const finalize_server = server.finalize_server;

/// Stages one outbound text or binary message behind a connection handle.
pub const send_socket = socket_io.send_socket;
/// Validates and stages the close frame behind a connection handle.
pub const close_socket = socket_io.close_socket;
/// Suspends outbound writes behind a connection handle.
pub const pause_socket = socket_io.pause_socket;
/// Resumes outbound writes behind a connection handle.
pub const resume_socket = socket_io.resume_socket;
/// Bytes staged behind a connection handle and not yet drained.
pub const socket_buffered_amount = socket_io.socket_buffered_amount;
