import { expect, test } from "vitest"
import {
  CLOSE_ABNORMAL,
  CLOSE_NO_STATUS,
  CLOSE_NORMAL,
  CLOSE_RESERVED,
  MAX_CLOSE_REASON_LENGTH,
  isApplicationStatusCode,
  isReservedStatusCode,
  isValidCloseReason,
  isValidStatusCode,
} from "../../src/protocol/close-codes"

test.each([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 3000, 4999])(
  "accepts sendable close code %i",
  (code) => {
    expect(isValidStatusCode(code)).toBe(true)
  },
)

test.each([999, 1004, 1005, 1006, 1015, 2999, 5000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects reserved or out-of-range close code %s",
  (code) => {
    expect(isValidStatusCode(code)).toBe(false)
  },
)

test("matches the ws range-only check for in-range non-integers", () => {
  expect(isValidStatusCode(1000.5)).toBe(true)
  expect(isValidStatusCode(3000.5)).toBe(true)
})

test("classifies application and reserved close codes", () => {
  expect(isApplicationStatusCode(3000)).toBe(true)
  expect(isApplicationStatusCode(4999)).toBe(true)
  expect(isApplicationStatusCode(2999)).toBe(false)
  expect(isApplicationStatusCode(5000)).toBe(false)
  expect(isApplicationStatusCode(3000.5)).toBe(false)
  expect(isReservedStatusCode(CLOSE_RESERVED)).toBe(true)
  expect(isReservedStatusCode(CLOSE_NO_STATUS)).toBe(true)
  expect(isReservedStatusCode(CLOSE_ABNORMAL)).toBe(true)
  expect(isReservedStatusCode(CLOSE_NORMAL)).toBe(false)
})

test("bounds the close reason at 123 bytes", () => {
  expect(MAX_CLOSE_REASON_LENGTH).toBe(123)
  expect(isValidCloseReason("")).toBe(true)
  expect(isValidCloseReason(Buffer.alloc(0))).toBe(true)
  expect(isValidCloseReason("a".repeat(123))).toBe(true)
  expect(isValidCloseReason("a".repeat(124))).toBe(false)
  expect(isValidCloseReason("€".repeat(41))).toBe(true)
  expect(isValidCloseReason("€".repeat(42))).toBe(false)
  expect(isValidCloseReason(Buffer.alloc(123))).toBe(true)
  expect(isValidCloseReason(Buffer.alloc(124))).toBe(false)
})
