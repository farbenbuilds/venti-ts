import { expect, test } from "vitest";
import { loadAddon } from "../src/binding/load";

test("loads the native addon", () => {
  expect(typeof loadAddon().engineVersion).toBe("function");
});

test("reports the pinned uWebZockets release", () => {
  expect(loadAddon().engineVersion()).toBe("1.1.0");
});

test("reports HTTP/3 support from the linked engine", () => {
  expect(loadAddon().http3Available()).toBe(true);
});

test("exposes the server lifecycle surface", () => {
  const addon = loadAddon();
  expect(typeof addon.createServer).toBe("function");
  expect(typeof addon.listenServer).toBe("function");
  expect(typeof addon.closeServer).toBe("function");
  expect(typeof addon.finalizeServer).toBe("function");
});
