import { defineConfig } from "tsdown";

export default defineConfig({
  dts: {
    generator: "tsgo",
  },
  exports: true,
  copy: ["zig-out/lib/ventijs.node"],
});
