import { expect, test } from "vitest"
import {
  STATUS_ERROR_CODES,
  createError,
  createStatusError,
  isCodedError,
} from "../../src/compat/errors"

test("creates coded errors with the requested constructor", () => {
  const error = createError("ERR_INVALID_OPTION", "bad option")
  expect(error).toBeInstanceOf(Error)
  expect(error.code).toBe("ERR_INVALID_OPTION")
  expect(error.message).toBe("bad option")
  const range = createError("ERR_INVALID_OPTION", "bad range", RangeError)
  expect(range).toBeInstanceOf(RangeError)
  expect(range.code).toBe("ERR_INVALID_OPTION")
})

test("maps every engine error status to a stable code", () => {
  expect(STATUS_ERROR_CODES).toEqual({
    closed: "ERR_SOCKET_CLOSED",
    "invalid-handle": "ERR_INVALID_HANDLE",
    "payload-too-large": "ERR_MAX_PAYLOAD",
    "protocol-error": "ERR_PROTOCOL",
    "policy-violation": "ERR_POLICY_VIOLATION",
  })
  expect(createStatusError("protocol-error", "bad frame").code).toBe("ERR_PROTOCOL")
})

test("recognizes coded errors at untrusted boundaries", () => {
  expect(isCodedError(createError("ERR_PROTOCOL", "bad frame"))).toBe(true)
  expect(isCodedError(new Error("plain"))).toBe(false)
  expect(isCodedError({ code: "ERR_PROTOCOL" })).toBe(false)
  expect(isCodedError(null)).toBe(false)
})
