import { expect, test } from "vitest"
import {
  addBufferedAmount,
  drainBufferedAmount,
  shouldPauseWrites,
  shouldResumeWrites,
} from "../../src/protocol/backpressure"

test("accumulates and drains buffered amounts without going negative", () => {
  expect(addBufferedAmount(0, 10)).toBe(10)
  expect(addBufferedAmount(10, 0)).toBe(10)
  expect(addBufferedAmount(10, -5)).toBe(10)
  expect(drainBufferedAmount(10, 4)).toBe(6)
  expect(drainBufferedAmount(10, 10)).toBe(0)
  expect(drainBufferedAmount(10, 99)).toBe(0)
  expect(drainBufferedAmount(10, -1)).toBe(10)
})

test("pauses at the high-water mark and resumes at the low-water mark", () => {
  expect(shouldPauseWrites(99, 100)).toBe(false)
  expect(shouldPauseWrites(100, 100)).toBe(true)
  expect(shouldPauseWrites(101, 100)).toBe(true)
  expect(shouldPauseWrites(0, 0)).toBe(false)
  expect(shouldResumeWrites(49, 50)).toBe(true)
  expect(shouldResumeWrites(50, 50)).toBe(true)
  expect(shouldResumeWrites(51, 50)).toBe(false)
})
