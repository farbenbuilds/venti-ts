//! Engine-to-JavaScript transport: the only bridge an engine thread may use to
//! reach JavaScript. Events travel through one threadsafe function and are
//! rendered on the Node main thread by `call_js`; nothing allocates on the
//! engine thread.

const std = @import("std");
const napi = @import("napi-zig");
const events = @import("events.zig");
const options = @import("../server/options.zig");
const ring_module = @import("ring.zig");

const c = napi.c;

pub const Event = events.Event;

/// Slots held back for terminal events: one close per connection plus the pair.
pub const terminal_reserve: usize = options.connection_capacity + 2;

/// Ring depth rounded to the power of two the mask needs (comptime sum 288).
pub const capacity: usize = std.math.ceilPowerOfTwo(
    usize,
    2 * options.connection_capacity + 32,
) catch unreachable;

const Ring = ring_module.event_ring(capacity, terminal_reserve);

/// Bounded bridge between one engine thread and the Node main thread.
pub const Channel = struct {
    tsfn: ?c.napi_threadsafe_function = null,
    /// Latched when the tsfn is gone or closing, so no later call touches it.
    closing: std.atomic.Value(bool) = .init(false),
    ring: Ring = .{},

    /// Creates the threadsafe function. Runs on the Node main thread.
    pub fn open(channel: *Channel, env: napi.Env, dispatch: napi.Callback) !void {
        const name = try env.createString("ventijs.server");
        var out: c.napi_threadsafe_function = undefined;
        const status = c.napi_create_threadsafe_function(
            env.handle,
            dispatch.val.handle,
            null,
            name.handle,
            0,
            1,
            null,
            null,
            channel,
            call_js,
            &out,
        );
        if (status != .ok) return error.ThreadsafeFunctionUnavailable;
        channel.tsfn = out;
    }

    /// Acquires the channel. A refused acquire latches it and reports false,
    /// so the caller must not release.
    pub fn acquire(channel: *Channel) bool {
        const tsfn = channel.tsfn orelse return false;
        if (c.napi_acquire_threadsafe_function(tsfn) != .ok) {
            channel.closing.store(true, .release);
            return false;
        }
        return true;
    }

    /// Stops the channel so a thread about to be joined cannot queue again.
    pub fn stop(channel: *Channel) void {
        channel.closing.store(true, .release);
    }

    /// Releases the engine thread's acquisition; only call after `acquire`.
    pub fn release(channel: *Channel) void {
        const tsfn = channel.tsfn orelse return;
        _ = c.napi_release_threadsafe_function(tsfn, .release);
    }

    /// Releases the creating thread's reference after the engine thread stops.
    pub fn close(channel: *Channel) void {
        const tsfn = channel.tsfn orelse return;
        channel.tsfn = null;
        channel.closing.store(true, .release);
        _ = c.napi_release_threadsafe_function(tsfn, .release);
    }

    /// Queues one regular event; a full ring drops it and returns false.
    pub fn emit(channel: *Channel, event: Event) bool {
        return channel.publish(event, false);
    }

    /// Queues one terminal event, which may use the reserved tail.
    pub fn emit_terminal(channel: *Channel, event: Event) bool {
        return channel.publish(event, true);
    }

    fn publish(channel: *Channel, event: Event, terminal: bool) bool {
        if (channel.closing.load(.acquire)) return false;
        const tsfn = channel.tsfn orelse return false;
        const sequence = if (terminal) channel.ring.reserve_terminal() else channel.ring.reserve();
        const claimed = sequence orelse return false;
        const slot = channel.ring.slot(claimed);
        slot.event = event;
        slot.sequence = claimed;
        if (c.napi_call_threadsafe_function(tsfn, slot, .non_blocking) != .ok) {
            channel.ring.drop(claimed);
            channel.closing.store(true, .release);
            return false;
        }
        return true;
    }

    /// Reserved events not dispatched yet.
    pub fn pending(channel: *Channel) u64 {
        return channel.ring.pending();
    }

    /// Events reserved but never queued for dispatch.
    pub fn dropped(channel: *Channel) u64 {
        return channel.ring.dropped_count();
    }
};

/// Renders one event into JavaScript and invokes the dispatch function. The
/// stack-buffer arena keeps rendering allocation-free, and the channel is not
/// touched after the handler runs because the handler may destroy it.
fn call_js(
    raw_env: c.napi_env,
    js_callback: c.napi_value,
    context: ?*anyopaque,
    data: ?*anyopaque,
) callconv(.c) void {
    // Node drains a destroyed tsfn with a null env; nothing to render or touch.
    if (@intFromPtr(raw_env) == 0 or @intFromPtr(js_callback) == 0) return;

    const slot: *Ring.Slot = @ptrCast(@alignCast(data orelse return));
    const channel: *Channel = @ptrCast(@alignCast(context orelse return));
    const event = slot.event;
    channel.ring.complete(slot.sequence);

    var buffer: [2048]u8 = undefined;
    var fixed = std.heap.FixedBufferAllocator.init(&buffer);
    var arena = std.heap.ArenaAllocator.init(fixed.allocator());
    defer arena.deinit();
    const env = napi.Env{ .handle = raw_env, .arena = &arena };

    const value = env.toJs(event) catch return;
    var receiver: c.napi_value = undefined;
    if (c.napi_get_undefined(raw_env, &receiver) != .ok) return;
    var result: c.napi_value = undefined;
    _ = c.napi_call_function(raw_env, receiver, js_callback, 1, @ptrCast(&value.handle), &result);
}
