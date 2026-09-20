const napi = @import("napi-zig");
const uwz = @import("uWebZockets");
const build_options = @import("build_options");
const server = @import("server.zig");

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
