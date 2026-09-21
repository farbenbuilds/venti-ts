//! Bounded single-producer/consumer event ring.
//!
//! The engine thread reserves a sequence and fills the slot; the Node main
//! thread completes it after copying the event out. `reserved - completed`
//! bounds the outstanding events, so a stalled consumer drops events instead
//! of growing memory. A reserved tail is available only to terminal lifecycle
//! events, so a close or shutdown can never be lost to a burst of regular
//! events.

const std = @import("std");
const events = @import("events.zig");

const default_event = events.Event{ .kind = .listening, .server = 0 };

/// Fixed-capacity ring of engine events. `terminal_reserve` slots are held
/// back from `reserve` and are reachable only through `reserve_terminal`.
pub fn event_ring(comptime capacity: usize, comptime terminal_reserve: usize) type {
    if (!std.math.isPowerOfTwo(capacity)) {
        @compileError("event ring capacity must be a power of two");
    }
    if (terminal_reserve >= capacity) {
        @compileError("terminal reserve must leave room for regular events");
    }

    return struct {
        const Self = @This();

        pub const Slot = struct {
            event: events.Event = default_event,
            sequence: u64 = 0,
        };

        /// Kept off the producer/consumer counters' cache lines.
        slots: [capacity]Slot align(std.atomic.cache_line) = [_]Slot{.{}} ** capacity,
        /// Producer-owned sequence counter.
        reserved: std.atomic.Value(u64) = .init(0),
        /// Events that could not be queued or dispatched.
        dropped: std.atomic.Value(u64) = .init(0),
        /// Consumer-owned progress counter.
        completed: std.atomic.Value(u64) align(std.atomic.cache_line) = .init(0),

        /// Claims the next sequence for a regular event, or null when the
        /// ring is full or only the terminal reserve is left. The CAS loop
        /// terminates because `reserved - completed` grows by one on every
        /// swap and the caller stops at the limit.
        pub fn reserve(ring: *Self) ?u64 {
            return ring.claim(capacity - terminal_reserve);
        }

        /// Claims the next sequence for a terminal lifecycle event. Terminal
        /// events may use the reserved tail but never overwrite a live slot.
        pub fn reserve_terminal(ring: *Self) ?u64 {
            return ring.claim(capacity);
        }

        fn claim(ring: *Self, comptime limit: usize) ?u64 {
            while (true) {
                const reserved = ring.reserved.load(.acquire);
                const completed = ring.completed.load(.acquire);
                if (reserved -% completed >= limit) {
                    _ = ring.dropped.fetchAdd(1, .monotonic);
                    return null;
                }
                if (ring.reserved.cmpxchgWeak(reserved, reserved + 1, .acq_rel, .monotonic) == null) {
                    return reserved;
                }
            }
        }

        pub fn slot(ring: *Self, sequence: u64) *Slot {
            return &ring.slots[@intCast(sequence & (capacity - 1))];
        }

        /// Marks a claimed sequence dispatched. The consumer dispatches in
        /// order, so `sequence + 1` is the highest contiguous completion; the
        /// max keeps the counter monotonic if a drop was already counted.
        pub fn complete(ring: *Self, sequence: u64) void {
            _ = @atomicRmw(u64, &ring.completed.raw, .Max, sequence +% 1, .release);
        }

        /// Counts a reservation whose dispatch was never queued. The slot
        /// stays outstanding so the producer can never reuse it under a live
        /// consumer; a later in-order `complete` skips it.
        pub fn drop(ring: *Self, sequence: u64) void {
            _ = sequence;
            _ = ring.dropped.fetchAdd(1, .monotonic);
        }

        /// Reserved events that have not been dispatched yet.
        pub fn pending(ring: *Self) u64 {
            const reserved = ring.reserved.load(.acquire);
            const completed = ring.completed.load(.acquire);
            return reserved -% completed;
        }

        /// Events that were reserved but never queued for dispatch.
        pub fn dropped_count(ring: *Self) u64 {
            return ring.dropped.load(.acquire);
        }
    };
}
