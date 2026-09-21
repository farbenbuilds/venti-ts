import { expect, test } from "vitest";
import { callNative, nativeError } from "../../src/binding/errors";

test("maps every native lifecycle error name to a stable code", () => {
  expect(nativeError(new Error("UnknownServer")).code).toBe("ERR_INVALID_HANDLE");
  expect(nativeError(new Error("InvalidServerState")).code).toBe("ERR_INVALID_STATE");
  expect(nativeError(new Error("ServerNotClosed")).code).toBe("ERR_INVALID_STATE");
  expect(nativeError(new Error("EventsPending")).code).toBe("ERR_INVALID_STATE");
  expect(nativeError(new Error("InvalidPort")).code).toBe("ERR_INVALID_OPTION");
  expect(nativeError(new Error("InvalidFrameCapacity")).code).toBe("ERR_INVALID_OPTION");
  expect(nativeError(new Error("ThreadsafeFunctionUnavailable")).code).toBe("ERR_PROTOCOL");
});

test("maps engine resource failures to state errors, not ABI mismatches", () => {
  for (const name of [
    "CapacityExhausted",
    "ServerCapacityExhausted",
    "EngineWorkerMissing",
    "AddressInUse",
    "SystemResources",
    "ThreadQuotaExceeded",
    "OutOfMemory",
  ]) {
    expect(nativeError(new Error(name)).code).toBe("ERR_INVALID_STATE");
  }
});

test("keeps the native name as the message", () => {
  expect(nativeError(new Error("UnknownServer")).message).toBe("UnknownServer");
});

test("an unknown native name is an ABI mismatch", () => {
  expect(nativeError(new Error("SomethingNew")).code).toBe("ERR_PROTOCOL");
  expect(nativeError("not an error").code).toBe("ERR_PROTOCOL");
});

test("callNative rethrows coded errors and passes values through", () => {
  expect(callNative(() => 42)).toBe(42);
  expect(() =>
    callNative(() => {
      throw new Error("InvalidPort");
    }),
  ).toThrow(expect.objectContaining({ code: "ERR_INVALID_OPTION" }));
});
