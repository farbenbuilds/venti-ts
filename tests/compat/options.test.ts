import { expect, test } from "vitest"
import { normalizeClientOptions } from "../../src/compat/client-options"
import { normalizeProtocols } from "../../src/compat/options"
import { normalizeServerOptions } from "../../src/compat/server-options"

test("fills the ws server defaults", () => {
  const options = normalizeServerOptions({ noServer: true })
  expect(options.noServer).toBe(true)
  expect(options.clientTracking).toBe(true)
  expect(options.allowSynchronousEvents).toBe(true)
  expect(options.autoPong).toBe(true)
  expect(options.maxPayload).toBe(100 * 1024 * 1024)
  expect(options.skipUTF8Validation).toBe(false)
  expect(options.perMessageDeflate).toBe(false)
  expect(options.host).toBeNull()
  expect(options.path).toBeNull()
})

test("requires exactly one listen target", () => {
  expect(() => normalizeServerOptions()).toThrow(/One and only one/)
  expect(() => normalizeServerOptions({ port: 0, noServer: true })).toThrow(TypeError)
  expect(normalizeServerOptions({ port: 0 }).port).toBe(0)
})

test("normalizes per-message deflate to its ws defaults", () => {
  const server = normalizeServerOptions({ noServer: true, perMessageDeflate: true })
  expect(server.perMessageDeflate).toEqual({
    serverNoContextTakeover: false,
    clientNoContextTakeover: false,
    threshold: 1024,
    concurrencyLimit: 10,
    zlibDeflateOptions: undefined,
    zlibInflateOptions: undefined,
  })
  const client = normalizeClientOptions()
  expect(client.perMessageDeflate).not.toBe(false)
})

test("keeps explicit per-message deflate settings", () => {
  const options = normalizeServerOptions({
    noServer: true,
    perMessageDeflate: { threshold: 512, serverNoContextTakeover: true },
  })
  expect(options.perMessageDeflate).toEqual({
    serverNoContextTakeover: true,
    clientNoContextTakeover: false,
    threshold: 512,
    concurrencyLimit: 10,
    zlibDeflateOptions: undefined,
    zlibInflateOptions: undefined,
  })
})

test("fills the ws client defaults", () => {
  const options = normalizeClientOptions()
  expect(options.protocolVersion).toBe(13)
  expect(options.followRedirects).toBe(false)
  expect(options.maxRedirects).toBe(10)
  expect(options.maxPayload).toBe(100 * 1024 * 1024)
  expect(options.skipUTF8Validation).toBe(false)
})

test("rejects unsupported protocol versions like ws", () => {
  expect(() => normalizeClientOptions({ protocolVersion: 9 })).toThrow(RangeError)
  expect(normalizeClientOptions({ protocolVersion: 8 }).protocolVersion).toBe(8)
})

test("validates subprotocols against the ws token grammar", () => {
  expect(normalizeProtocols("chat")).toEqual(["chat"])
  expect(normalizeProtocols(["chat", "superchat"])).toEqual(["chat", "superchat"])
  expect(normalizeProtocols(undefined)).toEqual([])
  expect(() => normalizeProtocols("bad protocol")).toThrow(SyntaxError)
  expect(() => normalizeProtocols(["chat", "chat"])).toThrow(SyntaxError)
})
