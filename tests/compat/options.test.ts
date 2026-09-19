import { expect, test } from "vitest"
import { normalizeClientOptions } from "../../src/compat/client-options"
import { normalizeProtocols } from "../../src/compat/options"
import { normalizeServerOptions } from "../../src/compat/server-options"

function capture(fn: () => void): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

test("throws coded errors with the ws classes and messages", () => {
  expect(capture(() => normalizeServerOptions())).toMatchObject({
    message: 'One and only one of the "port", "server", or "noServer" options must be specified',
    code: "ERR_INVALID_OPTION",
  })
  expect(capture(() => normalizeClientOptions({ protocolVersion: 9 }))).toBeInstanceOf(RangeError)
  expect(capture(() => normalizeClientOptions({ protocolVersion: 9 }))).toMatchObject({
    message: "Unsupported protocol version: 9 (supported versions: 8, 13)",
    code: "ERR_INVALID_OPTION",
  })
  expect(capture(() => normalizeProtocols("bad protocol"))).toBeInstanceOf(SyntaxError)
  expect(capture(() => normalizeProtocols("bad protocol"))).toMatchObject({
    message: "An invalid or duplicated subprotocol was specified",
    code: "ERR_INVALID_OPTION",
  })
})

test("validates subprotocols against the ws token grammar", () => {
  expect(normalizeProtocols("chat")).toEqual(["chat"])
  expect(normalizeProtocols(["chat", "superchat"])).toEqual(["chat", "superchat"])
  expect(normalizeProtocols(undefined)).toEqual([])
  expect(() => normalizeProtocols("bad protocol")).toThrow(SyntaxError)
  expect(() => normalizeProtocols(["chat", "chat"])).toThrow(SyntaxError)
})

test("returns a copy of the caller's protocol array", () => {
  const input = ["chat"]
  const protocols = normalizeProtocols(input)
  expect(protocols).not.toBe(input)
  input.push("superchat")
  expect(protocols).toEqual(["chat"])
})
