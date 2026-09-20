import { expect, test } from "vitest"
import { packConnectionHandle, unpackConnectionHandle } from "../../src/binding/handle"

const MAX_UINT32 = 0xffff_ffff

test("packs the index low and the generation high", () => {
  const handle = packConnectionHandle(0xdead_beef, 0x0102_0304)
  expect(handle).toBe(0x0102_0304_dead_beefn)
  expect(unpackConnectionHandle(handle)).toEqual({
    index: 0xdead_beef,
    generation: 0x0102_0304,
  })
})

test("round trips the maximum handle", () => {
  const handle = packConnectionHandle(MAX_UINT32, MAX_UINT32)
  expect(handle).toBe(0xffff_ffff_ffff_ffffn)
  expect(unpackConnectionHandle(handle)).toEqual({
    index: MAX_UINT32,
    generation: MAX_UINT32,
  })
})

test("rejects out-of-range handle parts", () => {
  expect(() => packConnectionHandle(-1, 0)).toThrow(RangeError)
  expect(() => packConnectionHandle(0, 2 ** 32)).toThrow(RangeError)
  expect(() => packConnectionHandle(2 ** 32, 0)).toThrow(RangeError)
  expect(() => unpackConnectionHandle(-1n)).toThrow(RangeError)
  expect(() => unpackConnectionHandle(1n << 64n)).toThrow(RangeError)
})
