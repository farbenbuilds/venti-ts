//! Engine-to-JavaScript transport.
//!
//! This module is the only bridge an engine thread may use to reach
//! JavaScript. Events are written into a bounded per-server ring; the ring
//! slot travels through one threadsafe function and is rendered on the Node
//! main thread by `call_js`. Nothing here allocates on the engine thread, and
//! no payload outlives the callback that produced it.

const std = @import("std");
const napi = @import("napi-zig");
const events = @import("events.zig");
const options = @import("options.zig");
const ring_module = @import("ring.zig");

const c = napi.c;

pub const Event = events.Event;

/// Ring depth: two events per connection slot plus lifecycle headroom,
/// rounded up to the power of two the index mask needs.
pub const capacity: usize = std.math.ceilPowerOfTwo(
    usize,
    2 * options.connection_capacity + 32,
) catch unreachable;

const Ring = ring_module.event_ring(capacity);

/// Bounded bridge between one engine thread and the Node main thread. The
/// engine thread reserves a ring sequence and queues the slot pointer; the
/// main thread renders the event and completes the sequence.
pub const Channel = struct {
    tsfn: ?c.napi_threadsafe_function = null,
    ring: Ring = .{},

    /// Creates the threadsafe function. Runs on the Node main thread.
    pub fn open(channel: *Channel, env: napi.Env, dispatch: napi.Callback) !void {
        const name = try env.createString("venti-ts.server");
        var out: c.napi_threadsafe_function = undefined;
        try check(c.napi_create_threadsafe_function(
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
        ));
        channel.tsfn = out;
    }

    /// Acquires the channel for the calling engine thread.
    pub fn acquire(channel: *Channel) void {
        const tsfn = channel.tsfn orelse return;
        _ = c.napi_acquire_threadsafe_function(tsfn);
    }

    /// Releases the calling engine thread's acquisition.
    pub fn release(channel: *Channel) void {
        const tsfn = channel.tsfn orelse return;
        _ = c.napi_release_threadsafe_function(tsfn, .release);
    }

    /// Releases the creating thread's reference once the engine thread is
    /// gone. Safe to call from inside a `call_js` dispatch.
    pub fn close(channel: *Channel) void {
        const tsfn = channel.tsfn orelse return;
        channel.tsfn = null;
        _ = c.napi_release_threadsafe_function(tsfn, .release);
    }

    /// Reserved events that have not been dispatched yet.
    pub fn pending(channel: *Channel) u64 {
        return channel.ring.pending();
    }

    /// Queues one event without blocking. A full ring or a closing channel
    /// drops the event and returns false; the caller keeps running.
    pub fn emit(channel: *Channel, event: Event) bool {
        const tsfn = channel.tsfn orelse return false;
        const sequence = channel.ring.reserve() orelse return false;
        const slot = channel.ring.slot(sequence);
        slot.event = event;
        slot.sequence = sequence;
        if (c.napi_call_threadsafe_function(tsfn, slot, .non_blocking) != .ok) {
            channel.ring.drop(sequence);
            return false;
        }
        return true;
    }
};

/// Renders one event into JavaScript and invokes the dispatch function.
///
/// The event is copied out of the ring before the slot is released: once
/// `completed` advances, the engine thread may immediately reuse the slot.
/// The channel is not touched after the JavaScript handler runs because the
/// handler may finalize the server and destroy the channel.
fn call_js(
    raw_env: c.napi_env,
    js_callback: c.napi_value,
    context: ?*anyopaque,
    data: ?*anyopaque,
) callconv(.c) void {
    // Node drains a destroyed threadsafe function by calling this with null
    // env and callback; there is nothing to render in that case.
    if (@intFromPtr(raw_env) == 0 or @intFromPtr(js_callback) == 0) return;

    const slot: *Ring.Slot = @ptrCast(@alignCast(data orelse return));
    const channel: *Channel = @ptrCast(@alignCast(context orelse return));
    const event = slot.event;
    channel.ring.complete(slot.sequence);

    var arena = std.heap.ArenaAllocator.init(std.heap.smp_allocator);
    defer arena.deinit();
    const env = napi.Env{ .handle = raw_env, .arena = &arena };

    const value = env.toJs(event) catch return;
    var receiver: c.napi_value = undefined;
    if (c.napi_get_undefined(raw_env, &receiver) != .ok) return;
    var result: c.napi_value = undefined;
    _ = c.napi_call_function(raw_env, receiver, js_callback, 1, @ptrCast(&value.handle), &result);
}

fn check(status: c.napi_status) !void {
    if (status != .ok) return error.ThreadsafeFunctionUnavailable;
}
