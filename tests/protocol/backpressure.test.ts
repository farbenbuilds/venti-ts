import { expect, test } from "vitest";
import {
  addBufferedAmount,
  drainBufferedAmount,
  shouldPauseWrites,
  shouldResumeWrites,
} from "../../src/protocol/backpressure";

test.each([
  [0, 10, 10],
  [10, 0, 10],
  [10, -5, 10],
  [10, Number.NaN, 10],
])("computes add(%i, %i) as %i", (current, added, expected) => {
  expect(addBufferedAmount(current, added)).toBe(expected);
});

test.each([
  [10, 4, 6],
  [10, 10, 0],
  [10, 99, 0],
  [10, -1, 10],
  [0, 5, 0],
])("computes drain(%i, %i) as %i", (current, drained, expected) => {
  expect(drainBufferedAmount(current, drained)).toBe(expected);
});

test.each([
  [99, 100, false],
  [100, 100, true],
  [101, 100, true],
  [0, 0, false],
  [100, Number.NaN, false],
])("pauses at buffered %i with high-water mark %s as %s", (buffered, mark, expected) => {
  expect(shouldPauseWrites(buffered, mark)).toBe(expected);
});

test.each([
  [49, 50, true],
  [50, 50, true],
  [51, 50, false],
  [0, 0, true],
  [0, -1, true],
  [0, Number.NaN, true],
])("resumes at buffered %i with low-water mark %s as %s", (buffered, mark, expected) => {
  expect(shouldResumeWrites(buffered, mark)).toBe(expected);
});
