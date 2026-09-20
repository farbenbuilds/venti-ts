//! Zig unit test root.
//!
//! Every testable source module in `src/` has a matching `<module>_test.zig`
//! beside this file. `src/builds/testing.zig` compiles this root, so adding a
//! suite means adding one import below. The engine-coupled modules (`server`,
//! `connections`) keep their coverage in the binding tests instead, because
//! they need a live Node-API environment.

test {
    _ = @import("lib_test.zig");
    _ = @import("handles_test.zig");
    _ = @import("options_test.zig");
    _ = @import("registry_test.zig");
    _ = @import("events_test.zig");
    _ = @import("ring_test.zig");
    _ = @import("callbacks_test.zig");
    _ = @import("instance_test.zig");
}
