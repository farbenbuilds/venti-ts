import { expect, test } from "vitest";
import {
  MASK_LENGTH,
  applyMask,
  frameHeaderLength,
  isValidPayloadLength,
} from "../../src/protocol/framing";

test.each([
  [0, false, 2],
  [125, false, 2],
  [126, false, 4],
  [65_535, false, 4],
  [65_536, false, 10],
  [0, true, 6],
  [125, true, 6],
  [126, true, 8],
  [65_535, true, 8],
  [65_536, true, 14],
] as const)("computes header length for %i masked=%s as %i", (length, masked, expected) => {
  expect(frameHeaderLength(length, masked)).toBe(expected);
});

test.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1] as const)(
  "rejects invalid payload length %s",
  (length) => {
    expect(isValidPayloadLength(length)).toBe(false);
    expect(frameHeaderLength(length, false)).toBeUndefined();
  },
);

test("applies and reverses the mask in place", () => {
  const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const mask = Uint8Array.from([0x12, 0x34, 0x56, 0x78]);
  expect(MASK_LENGTH).toBe(4);
  expect(applyMask(bytes, mask, bytes)).toBe(true);
  expect([...bytes]).toEqual([0x12, 0x35, 0x54, 0x7b, 0x16, 0x31, 0x50, 0x7f]);
  expect(applyMask(bytes, mask, bytes)).toBe(true);
  expect([...bytes]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

test("wraps the mask every four bytes", () => {
  const source = Uint8Array.from([1, 2, 3, 4, 5]);
  const target = new Uint8Array(5);
  expect(applyMask(source, Uint8Array.from([0xff, 0, 0, 0]), target)).toBe(true);
  expect([...target]).toEqual([254, 2, 3, 4, 250]);
});

test("writes into a caller-owned target and rejects invalid arguments", () => {
  const source = Uint8Array.from([1, 2, 3, 4]);
  const target = new Uint8Array(4);
  const mask = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);
  expect(applyMask(source, mask, target)).toBe(true);
  expect([...target]).toEqual([254, 253, 252, 251]);
  expect(applyMask(source, Uint8Array.from([1, 2, 3]), target)).toBe(false);
  expect([...target]).toEqual([254, 253, 252, 251]);
  expect(applyMask(source, mask, new Uint8Array(3))).toBe(false);
  const longer = new Uint8Array(6);
  expect(applyMask(source, mask, longer)).toBe(true);
  expect([...longer]).toEqual([254, 253, 252, 251, 0, 0]);
});
