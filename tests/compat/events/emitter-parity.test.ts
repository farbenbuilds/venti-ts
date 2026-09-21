import { expect, test } from "vitest";
import { target } from "./emitter-support";

test("registration methods return the emitter for chaining", () => {
  const { emitter, self } = target();
  const handler = (): void => {};
  expect(emitter.on("open", handler)).toBe(self);
  expect(emitter.addListener("open", handler)).toBe(self);
  expect(emitter.once("open", handler)).toBe(self);
  expect(emitter.prependListener("open", handler)).toBe(self);
  expect(emitter.prependOnceListener("open", handler)).toBe(self);
  expect(emitter.off("open", handler)).toBe(self);
  expect(emitter.removeListener("open", handler)).toBe(self);
  expect(emitter.removeAllListeners("open")).toBe(self);
  expect(emitter.setMaxListeners(4)).toBe(self);
});

test("setMaxListeners accepts undefined as Infinity", () => {
  const { emitter } = target();
  emitter.setMaxListeners(undefined as never);
  expect(emitter.getMaxListeners()).toBe(Infinity);
});

test("unhandled non-Error values are wrapped like Node", () => {
  const { emitter } = target();
  let thrown: unknown;
  try {
    emitter.emit("error", "boom" as never);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe("Unhandled error. ('boom')");
  expect((thrown as { context?: unknown }).context).toBe("boom");
});
