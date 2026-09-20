import { defineConfig } from "tsdown";

export default defineConfig({
  dts: {
    tsgo: true,
  },
  exports: true,
  copy: ["zig-out/lib/venti.node"],
});
