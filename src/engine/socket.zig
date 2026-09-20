//! Per-connection operations and the exactly-once terminal latch.
//!
//! The socket slab mirrors the connection slab: one record per engine pool
//! slot, indexed by the same slot index the handle names. `send`, `close`,
//! `pause_dispatch`, and `resume_dispatch` are explicit transitions over that
//! record, and the record owns the bounded payload ring those operations stage
//! into. The terminal latch flips once per connection generation, so a close
//! race can never emit two terminal events.

const std = @import("std");
const payload = @import("payload.zig");
const status = @import("status.zig");

pub const State = status.State;
pub const Status = status.Status;
pub const valid_close_code = status.valid_close_code;

/// Fixed-capacity connection records. `PayloadRing` is the bounded staging
/// ring every record shares; its slot capacity is the payload cap.
pub fn socket_slab(comptime capacity: u32, comptime PayloadRing: type) type {
    if (capacity == 0) @compileError("socket slab capacity must be greater than zero");

    return struct {
        const Self = @This();

        pub const Slot = struct {
            state: std.atomic.Value(State) = .init(.open),
            terminal: std.atomic.Value(bool) = .init(false),
            buffered: std.atomic.Value(u32) = .init(0),
            paused: std.atomic.Value(bool) = .init(false),
            generation: u32 = 0,
        };

        ring: PayloadRing = .{},
        slots: [capacity]Slot = [_]Slot{.{}} ** capacity,

        /// Resets a slot for a freshly acquired connection generation.
        pub fn open(slab: *Self, index: u32, generation: u32) void {
            const slot = slab.slot_at(index) orelse return;
            slot.* = .{ .generation = generation };
        }

        /// Validates and stages one outbound text or binary message.
        pub fn send(slab: *Self, index: u32, kind: payload.Kind, data: []const u8) Status {
            const slot = slab.slot_at(index) orelse return .invalid_handle;
            if (open_status(slot)) |blocked| return blocked;
            slab.ring.stage(kind, index, slot.generation, data) catch |err| return switch (err) {
                error.PayloadTooLarge => .payload_too_large,
                error.QueueFull => .backpressure,
            };
            _ = slot.buffered.fetchAdd(@intCast(data.len), .monotonic);
            return .ok;
        }

        /// Validates a close code and reason, stages the close frame, and
        /// enters `closing`. A second close observes `closing`.
        pub fn close(slab: *Self, index: u32, code: u16, reason: []const u8) Status {
            const slot = slab.slot_at(index) orelse return .invalid_handle;
            if (open_status(slot)) |blocked| return blocked;
            if (!status.valid_close_code(code)) return .invalid_close_code;
            if (reason.len > status.max_close_reason_bytes) return .invalid_close_reason;
            if (!std.unicode.utf8ValidateSlice(reason)) return .invalid_close_reason;

            var frame: [2 + status.max_close_reason_bytes]u8 = undefined;
            std.mem.writeInt(u16, frame[0..2], code, .big);
            @memcpy(frame[2 .. 2 + reason.len], reason);
            slab.ring.stage(.close, index, slot.generation, frame[0 .. 2 + reason.len]) catch |err| {
                return switch (err) {
                    error.PayloadTooLarge => .invalid_close_reason,
                    error.QueueFull => .backpressure,
                };
            };
            if (slot.state.cmpxchgStrong(.open, .closing, .acq_rel, .acquire) != null) {
                return if (slot.state.load(.acquire) == .closed) .closed else .closing;
            }
            return .ok;
        }

        /// Suspends inbound message dispatch. Idempotent while open, matching
        /// `ws` where a second `pause` is a no-op.
        pub fn pause_dispatch(slab: *Self, index: u32) Status {
            const slot = slab.slot_at(index) orelse return .invalid_handle;
            if (open_status(slot)) |blocked| return blocked;
            slot.paused.store(true, .release);
            return .ok;
        }

        /// Resumes inbound message dispatch. Idempotent while open. `resume`
        /// is a Zig keyword, so the transition is named for what it resumes.
        pub fn resume_dispatch(slab: *Self, index: u32) Status {
            const slot = slab.slot_at(index) orelse return .invalid_handle;
            if (open_status(slot)) |blocked| return blocked;
            slot.paused.store(false, .release);
            return .ok;
        }

        /// Flips the terminal latch. Returns true for exactly one caller per
        /// connection generation; every other terminal path observes false.
        pub fn latch_terminal(slab: *Self, index: u32) bool {
            const slot = slab.slot_at(index) orelse return false;
            return slot.terminal.cmpxchgStrong(false, true, .acq_rel, .acquire) == null;
        }

        /// Latches the terminal transition and marks the slot closed. The
        /// winning caller owns the single close emission and slab release.
        pub fn finish(slab: *Self, index: u32) bool {
            if (!slab.latch_terminal(index)) return false;
            const slot = slab.slot_at(index) orelse return true;
            slot.state.store(.closed, .release);
            return true;
        }

        /// Accounts bytes the engine thread drained from the staging ring.
        pub fn note_drained(slab: *Self, index: u32, drained: u32) void {
            const slot = slab.slot_at(index) orelse return;
            _ = slot.buffered.fetchSub(@min(drained, slot.buffered.load(.acquire)), .monotonic);
        }

        pub fn buffered(slab: *const Self, index: u32) u32 {
            if (index >= capacity) return 0;
            return slab.slots[index].buffered.load(.acquire);
        }

        pub fn is_paused(slab: *const Self, index: u32) bool {
            if (index >= capacity) return false;
            return slab.slots[index].paused.load(.acquire);
        }

        pub fn state_of(slab: *const Self, index: u32) ?State {
            if (index >= capacity) return null;
            return slab.slots[index].state.load(.acquire);
        }

        fn slot_at(slab: *Self, index: u32) ?*Slot {
            if (index >= capacity) return null;
            return &slab.slots[index];
        }

        /// Returns the blocking status when the slot is not open, or null.
        fn open_status(slot: *Slot) ?Status {
            return switch (slot.state.load(.acquire)) {
                .open => null,
                .closing => .closing,
                .closed => .closed,
            };
        }
    };
}
