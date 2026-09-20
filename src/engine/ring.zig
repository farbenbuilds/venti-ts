//! Bounded single-producer/consumer event ring.
//!
//! The engine thread reserves a sequence and fills the slot; the Node main
//! thread completes it after copying the event out. `reserved - completed`
//! bounds the outstanding events, so a stalled consumer drops events instead
//! of growing memory.

const std = @import("std");
const events = @import("events.zig");

const default_event = events.Event{ .kind = .listening, .server = 0 };

/// Fixed-capacity ring of engine events.
pub fn event_ring(comptime capacity: usize) type {
    if (!std.math.isPowerOfTwo(capacity)) {
        @compileError("event ring capacity must be a power of two");
    }

    return struct {
        const Self = @This();

        pub const Slot = struct {
            event: events.Event = default_event,
            sequence: u64 = 0,
        };

        slots: [capacity]Slot = [_]Slot{.{}} ** capacity,
        /// Producer-owned sequence counter.
        reserved: std.atomic.Value(u64) = .init(0),
        /// Events that could not be queued or dispatched.
        dropped: std.atomic.Value(u64) = .init(0),
        /// Consumer-owned progress counter, padded onto its own cache line so
        /// the producer's CAS never ping-pongs with it.
        completed: std.atomic.Value(u64) align(std.atomic.cache_line) = .init(0),

        /// Claims the next sequence, or null when the ring is full. The CAS
        /// loop terminates because `reserved - completed` grows by one on
        /// every swap and the caller stops at `capacity`.
        pub fn reserve(ring: *Self) ?u64 {
            while (true) {
                const reserved = ring.reserved.load(.acquire);
                const completed = ring.completed.load(.acquire);
                if (reserved -% completed >= capacity) {
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

        /// Marks a claimed sequence dispatched. Safe to call from the consumer
        /// while the producer reserves later sequences.
        pub fn complete(ring: *Self, sequence: u64) void {
            ring.completed.store(sequence +% 1, .release);
        }

        /// Retires a sequence whose dispatch failed. Max keeps a concurrent
        /// consumer store monotonic.
        pub fn drop(ring: *Self, sequence: u64) void {
            _ = ring.dropped.fetchAdd(1, .monotonic);
            _ = @atomicRmw(u64, &ring.completed.raw, .Max, sequence +% 1, .release);
        }

        /// Reserved events that have not been dispatched yet.
        pub fn pending(ring: *Self) u64 {
            const reserved = ring.reserved.load(.acquire);
            const completed = ring.completed.load(.acquire);
            return reserved -% completed;
        }
    };
}
