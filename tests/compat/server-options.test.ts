import { expect, test } from "vitest";
import { normalizeServerOptions } from "../../src/compat/server-options";

test("fills the ws server defaults", () => {
  const options = normalizeServerOptions({ noServer: true });
  expect(options.noServer).toBe(true);
  expect(options.clientTracking).toBe(true);
  expect(options.allowSynchronousEvents).toBe(true);
  expect(options.autoPong).toBe(true);
  expect(options.maxPayload).toBe(100 * 1024 * 1024);
  expect(options.skipUTF8Validation).toBe(false);
  expect(options.perMessageDeflate).toBe(false);
  expect(options.host).toBeNull();
  expect(options.path).toBeNull();
});

test("requires exactly one listen target", () => {
  expect(() => normalizeServerOptions()).toThrow(/One and only one/);
  expect(() => normalizeServerOptions({ port: 0, noServer: true })).toThrow(TypeError);
  expect(normalizeServerOptions({ port: 0 }).port).toBe(0);
});

test("preserves explicit falsy and zero server values", () => {
  const options = normalizeServerOptions({
    noServer: true,
    clientTracking: false,
    allowSynchronousEvents: false,
    autoPong: false,
    maxPayload: 0,
    skipUTF8Validation: true,
  });
  expect(options.clientTracking).toBe(false);
  expect(options.allowSynchronousEvents).toBe(false);
  expect(options.autoPong).toBe(false);
  expect(options.maxPayload).toBe(0);
  expect(options.skipUTF8Validation).toBe(true);
});

test("normalizes per-message deflate to its ws defaults", () => {
  expect(normalizeServerOptions({ noServer: true, perMessageDeflate: true })).toMatchObject({
    perMessageDeflate: {
      serverNoContextTakeover: undefined,
      clientNoContextTakeover: undefined,
      serverMaxWindowBits: undefined,
      clientMaxWindowBits: undefined,
      threshold: 1024,
      concurrencyLimit: 10,
      zlibDeflateOptions: undefined,
      zlibInflateOptions: undefined,
    },
  });
});

test("keeps explicit per-message deflate settings", () => {
  const options = normalizeServerOptions({
    noServer: true,
    perMessageDeflate: {
      threshold: 512,
      serverNoContextTakeover: false,
      serverMaxWindowBits: 10,
      clientMaxWindowBits: 12,
    },
  });
  expect(options.perMessageDeflate).toEqual({
    serverNoContextTakeover: false,
    clientNoContextTakeover: undefined,
    serverMaxWindowBits: 10,
    clientMaxWindowBits: 12,
    threshold: 512,
    concurrencyLimit: 10,
    zlibDeflateOptions: undefined,
    zlibInflateOptions: undefined,
  });
});
