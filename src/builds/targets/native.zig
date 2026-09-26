const std = @import("std");

/// Compiles every C and C++ archive the engine links into the addon as
/// position-independent code.
///
/// The addon is a shared library, but the engine builds its vendored BoringSSL,
/// lsquic, libdeflate, and zlib archives as separate static libraries, and Zig
/// compiles C sources non-PIC unless the owning module asks for it. A non-PIC
/// archive cannot be linked into a shared object: the linker rejects absolute
/// `R_X86_64_32` and `R_X86_64_32S` relocations and asks for `-fPIC`. The engine
/// stopped accepting compiler overrides in v1.2.0, so the flag is applied to the
/// archives through the build graph instead of through wrapper scripts.
/// Removing this walk breaks the addon link.
pub fn force_pic(engine_dep: *std.Build.Dependency) void {
    force_module_pic(engine_dep.module("uWebZockets"));
}

/// Marks the module and every static library it links as position independent.
fn force_module_pic(module: *std.Build.Module) void {
    if (module.pic == null) module.pic = true;
    for (module.link_objects.items) |object| {
        const step = switch (object) {
            .other_step => |other| other,
            else => continue,
        };
        force_compile_pic(step);
    }
}

/// Marks one compiled artifact as position independent. Zig and C++ sources are
/// already position independent when they end up in a shared library, so only
/// the presence of the flag is set; the linker decides the rest.
fn force_compile_pic(step: *std.Build.Step.Compile) void {
    const root = step.root_module;
    if (root.pic == null) root.pic = true;
    for (root.link_objects.items) |object| {
        switch (object) {
            .other_step => |other| force_compile_pic(other),
            else => {},
        }
    }
}
