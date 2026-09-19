import { expect, test } from "vitest"
import {
  MASK_LENGTH,
  applyMask,
  frameHeaderLength,
  isValidPayloadLength,
} from "../../src/protocol/framing"

test("computes the frame header length for every length class", () => {
  expect(frameHeaderLength(0, false)).toBe(2)
  expect(frameHeaderLength(125, false)).toBe(2)
  expect(frameHeaderLength(126, false)).toBe(4)
  expect(frameHeaderLength(65_535, false)).toBe(4)
  expect(frameHeaderLength(65_536, false)).toBe(10)
  expect(frameHeaderLength(126, true)).toBe(8)
  expect(frameHeaderLength(65_536, true)).toBe(14)
})

test("reports invalid payload lengths", () => {
  expect(isValidPayloadLength(-1)).toBe(false)
  expect(isValidPayloadLength(1.5)).toBe(false)
  expect(isValidPayloadLength(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
  expect(frameHeaderLength(-1, false)).toBeUndefined()
})

test("applies and reverses the mask in place", () => {
  const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])
  const mask = Uint8Array.from([0x12, 0x34, 0x56, 0x78])
  expect(MASK_LENGTH).toBe(4)
  expect(applyMask(bytes, mask, bytes)).toBe(true)
  expect([...bytes]).toEqual([0x12, 0x35, 0x54, 0x7b, 0x16, 0x31, 0x50, 0x7f])
  expect(applyMask(bytes, mask, bytes)).toBe(true)
  expect([...bytes]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
})

test("writes into a caller-owned target and rejects invalid arguments", () => {
  const source = Uint8Array.from([1, 2, 3, 4])
  const target = new Uint8Array(4)
  const mask = Uint8Array.from([0xff, 0xff, 0xff, 0xff])
  expect(applyMask(source, mask, target)).toBe(true)
  expect([...target]).toEqual([254, 253, 252, 251])
  expect(applyMask(source, Uint8Array.from([1, 2, 3]), target)).toBe(false)
  expect(applyMask(source, mask, new Uint8Array(3))).toBe(false)
})
