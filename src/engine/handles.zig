//! Generation-checked connection slots and the opaque handles that name them.
//!
//! One slab is allocated per server beside the engine connection pool. A slot
//! index maps one-to-one onto an engine pool slot; the generation rejects a
//! handle after its connection has closed, so a stale JavaScript call is a
//! typed error instead of a use-after-free.

/// Lifecycle of one connection slot.
pub const State = enum(u8) { free, active };

/// Opaque connection handle: 32 bit slot index and 32 bit generation.
///
/// The integer form is the only representation passed to JavaScript.
pub const Handle = struct {
    index: u32,
    generation: u32,

    pub fn toInt(handle: Handle) u64 {
        return (@as(u64, handle.generation) << 32) | @as(u64, handle.index);
    }

    pub fn fromInt(raw: u64) Handle {
        return .{ .index = @truncate(raw), .generation = @truncate(raw >> 32) };
    }
};

const Slot = struct {
    generation: u32 = 0,
    state: State = .free,
};

/// Builds a fixed-capacity connection slab. `capacity` must match the engine
/// pool capacity so every pool slot has exactly one slab slot.
pub fn connection_slab(comptime capacity: u32) type {
    if (capacity == 0) @compileError("connection slab capacity must be greater than zero");

    return struct {
        const Self = @This();

        slots: [capacity]Slot = [_]Slot{.{}} ** capacity,
        active: u32 = 0,

        /// Marks a pool slot active and returns a fresh handle for it.
        ///
        /// The generation advances on acquire, so a handle from the previous
        /// occupant of this slot can never resolve again.
        pub fn acquire(slab: *Self, index: u32) !Handle {
            if (index >= capacity) return error.SlotOutOfRange;
            const slot = &slab.slots[index];
            if (slot.state != .free) return error.SlotBusy;
            slot.generation +%= 1;
            slot.state = .active;
            slab.active += 1;
            return .{ .index = index, .generation = slot.generation };
        }

        /// Frees a pool slot and returns the handle that was live for it.
        pub fn release(slab: *Self, index: u32) ?Handle {
            if (index >= capacity) return null;
            const slot = &slab.slots[index];
            if (slot.state != .active) return null;
            slot.state = .free;
            slab.active -= 1;
            return .{ .index = index, .generation = slot.generation };
        }

        /// Resolves a handle to its slot index, or null when the handle is
        /// out of range, the slot is free, or the generation is stale.
        ///
        /// Callers on a different thread than the engine loop must serialize
        /// through the send path; the slab itself has no lock.
        pub fn resolve(slab: *const Self, handle: Handle) ?u32 {
            if (handle.index >= capacity) return null;
            const slot = slab.slots[handle.index];
            if (slot.state != .active) return null;
            if (slot.generation != handle.generation) return null;
            return handle.index;
        }

        pub fn count_active(slab: *const Self) u32 {
            return slab.active;
        }
    };
}
