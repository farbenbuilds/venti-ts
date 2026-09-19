import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    tsgo: true,
  },
  exports: true,
  copy: ['src-zig/zig-out/lib/venti-ts.node'],
})
