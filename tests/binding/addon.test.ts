import { expect, test } from "vitest";
import { loadAddon } from "../../src/binding/load";

test("loads the native addon", () => {
  expect(typeof loadAddon().engineVersion).toBe("function");
});

test("reports the pinned uWebZockets release", () => {
  expect(loadAddon().engineVersion()).toBe("1.7.0");
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

test("exposes the per-connection socket surface", () => {
  const addon = loadAddon();
  expect(typeof addon.sendSocket).toBe("function");
  expect(typeof addon.closeSocket).toBe("function");
  expect(typeof addon.pauseSocket).toBe("function");
  expect(typeof addon.resumeSocket).toBe("function");
  expect(typeof addon.socketBufferedAmount).toBe("function");
  expect(typeof addon.serverDroppedEvents).toBe("function");
});
