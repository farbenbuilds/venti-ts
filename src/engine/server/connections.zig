//! Engine WebSocket route wiring: comptime trampolines and connection events.
//!
//! Each server slot gets its own tiny callback set, so the engine ABI needs no
//! user context. Handlers resolve the server through the instance table, map
//! the engine connection to a slab slot, and emit through the callback
//! channel. No other code runs on an engine thread.

const uwz = @import("uWebZockets");
const instance = @import("instance.zig");

/// Registers the WebSocket route on the worker with the trusted limits.
pub fn attach_route(target: *instance.Instance) !void {
    const app = target.cluster.worker(0) orelse return error.EngineWorkerMissing;
    switch (target.handle.slot) {
        inline 0...instance.server_capacity - 1 => |slot| {
            const Trampoline = trampolines(slot);
            _ = try app.ws(target.config.path_slice(), .{
                .open = Trampoline.open,
                .close = Trampoline.close,
                .max_frame_size = target.config.limits.max_frame_bytes,
                .max_message_size = target.config.limits.max_message_bytes,
            });
        },
        else => return error.ServerCapacityExhausted,
    }
}

fn trampolines(comptime slot: usize) type {
    return struct {
        fn open(ws: *uwz.WebSocket) void {
            on_open(slot, ws);
        }

        fn close(ws: *uwz.WebSocket) void {
            on_close(slot, ws);
        }
    };
}

fn on_open(slot: usize, ws: *uwz.WebSocket) void {
    const server = instance.lookup_slot(@intCast(slot)) orelse return;
    if (server.slab.count_active() >= server.config.limits.max_connections) {
        ws.terminate();
        return;
    }
    const index = connection_index(server, ws) orelse return;
    // The slab slot is already active, so the engine connection is a
    // duplicate. Terminate the refused connection instead of leaking it.
    const handle = server.slab.acquire(index) catch {
        ws.terminate();
        return;
    };
    server.sockets.open(index, handle.generation);
    _ = server.channel.emit(.{
        .kind = .connection_open,
        .server = server.handle.to_int(),
        .index = handle.index,
        .generation = handle.generation,
    });
}

fn on_close(slot: usize, ws: *uwz.WebSocket) void {
    const server = instance.lookup_slot(@intCast(slot)) orelse return;
    const index = connection_index(server, ws) orelse return;
    if (!server.sockets.finish(index)) return;
    const handle = server.slab.release(index) orelse return;
    _ = server.channel.emit_terminal(.{
        .kind = .connection_close,
        .server = server.handle.to_int(),
        .index = handle.index,
        .generation = handle.generation,
    });
}

fn connection_index(server: *instance.Instance, ws: *uwz.WebSocket) ?u32 {
    const app = server.cluster.worker(0) orelse return null;
    const index = app.pool.index_of(ws.conn) orelse return null;
    return @intCast(index);
}
