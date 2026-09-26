//! Trusted engine application configuration.
//!
//! The engine application type is generated from the compile-time capacities in
//! `options.zig`, and the engine rejects a runtime configuration whose
//! connection, message, write-queue, idle-timeout, route-capture, and HTTP/3
//! capacities differ from the ones compiled into that type. The HTTP/2 and
//! router capacities below are outside that check, so this module owns them.

const uwz = @import("uWebZockets");
const options = @import("options.zig");

/// Capacities narrowed to what one WebSocket route needs.
///
/// The engine carves the HTTP/2 session region per connection and the radix
/// router region per application, unconditionally. Its defaults fill roughly
/// 82 percent of the per-server startup slab with a transport ventijs never
/// negotiates and a route table it never fills: the listener is plaintext with
/// no ALPN, so no HTTP/2 or HTTP/3 session is ever established, and
/// `connections.attach_route` registers exactly one route with no middleware.
/// Narrowing them to these bounds saves about 31 MB per server instance at the
/// configured 128 connections. Raising any of them is a deliberate change, not
/// a tuning knob.
const h2_header_block_size: usize = 1024;
const h2_response_header_size: usize = 1024;
/// HTTP/2 response fields one WebSocket upgrade response can carry.
const h2_response_header_count: usize = 8;
/// Radix nodes for the single registered route. One node holds one path
/// segment, so a root path plus its segments fits with room to spare.
const route_node_capacity: usize = 16;
/// Route path bytes the router registry keeps for introspection. The engine
/// requires at least one maximum-length route path, which is 2048 bytes.
const route_registry_capacity: usize = 4 * 1024;

/// Engine configuration the cluster is built from.
///
/// The development log stays off. The engine writes to the host process's
/// stderr, and a library must never write to the streams it does not own.
pub const EngineConfig = uwz.ServerConfig{
    .max_connections = options.connection_capacity,
    .max_ws_message_size = options.message_capacity,
    .write_queue_size = options.write_queue_capacity,
    .max_body_size = options.body_capacity,
    .idle_timeout_ms = options.idle_timeout_ms,
    .enable_dev_log = false,
    .max_h2_header_block_size = h2_header_block_size,
    .max_h2_body_size = options.body_capacity,
    .max_h2_response_header_size = h2_response_header_size,
    .max_h2_response_header_count = h2_response_header_count,
    .max_route_nodes = route_node_capacity,
    .max_pattern_routes = 0,
    .max_middleware = 0,
    .max_route_registry_size = route_registry_capacity,
};
