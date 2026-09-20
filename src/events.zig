//! Engine-to-JavaScript event vocabulary.
//!
//! Fixed-size records only: every field is a scalar so the channel can copy
//! an event into its ring without allocating and the TypeScript side can
//! rebuild connection handles from `index` and `generation`.

/// Event kinds mirrored by `ENGINE_EVENT_KINDS` in `src/binding/native.ts`.
/// Append new kinds; never reorder, because the ordinals cross the ABI.
pub const Kind = enum(u8) {
    listening,
    connection_open,
    connection_close,
    engine_error,
    server_closed,
};

/// One engine-thread event. `server` is the packed, generation-checked server
/// handle; `code` carries a status detail such as the requested port for
/// `listening`.
pub const Event = struct {
    kind: Kind,
    server: u40,
    index: u32 = 0,
    generation: u32 = 0,
    code: u32 = 0,
};
