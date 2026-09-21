//! N-API wrappers for the server lifecycle.
//!
//! Each wrapper validates the untrusted configuration or resolves the
//! generation-checked server handle before the lifecycle function runs. The
//! lifecycle itself stays in `server.zig`; this seam exists so the exported
//! surface has one small owner, mirroring `socket_io.zig`.

const napi = @import("napi-zig");
const instance = @import("../server/instance.zig");
const options = @import("../server/options.zig");
const server = @import("../server/server.zig");

pub fn create_server(env: napi.Env, raw: options.RawConfig, dispatch: napi.Callback) !u40 {
    const config = try options.trust(raw);
    return server.create(config, dispatch, env);
}

pub fn listen_server(env: napi.Env, raw: u40) !void {
    const target = instance.lookup(env, raw) orelse return error.UnknownServer;
    try server.listen(target);
}

pub fn close_server(env: napi.Env, raw: u40) !void {
    const target = instance.lookup(env, raw) orelse return error.UnknownServer;
    try server.close(target);
}

pub fn finalize_server(env: napi.Env, raw: u40) !void {
    const target = instance.lookup(env, raw) orelse return error.UnknownServer;
    try server.finalize(target);
}

/// Events the server channel could not queue because its ring was full. A
/// non-zero count means some dispatch was lost to a stalled consumer.
pub fn server_dropped_events(env: napi.Env, raw: u40) !u64 {
    const target = instance.lookup(env, raw) orelse return error.UnknownServer;
    return target.channel.dropped();
}
