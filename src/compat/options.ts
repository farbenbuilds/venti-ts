import type { NormalizedPerMessageDeflate } from "../types/options"
import type { PerMessageDeflateOptions } from "../types/ws"
import { createError } from "./errors"

export const DEFAULT_MAX_PAYLOAD = 100 * 1024 * 1024
export const DEFAULT_MAX_REDIRECTS = 10
export const DEFAULT_THRESHOLD = 1024
export const DEFAULT_CONCURRENCY_LIMIT = 10

const SUBPROTOCOL_PATTERN = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/

export function invalidOption(message: string, constructor: ErrorConstructor = TypeError): never {
  throw createError("ERR_INVALID_OPTION", message, constructor)
}

export function normalizeProtocols(protocols: string | string[] | undefined): readonly string[] {
  if (protocols === undefined) return []
  const list = typeof protocols === "string" ? [protocols] : protocols
  const seen = new Set<string>()
  let index = 0
  while (index < list.length) {
    const protocol = list[index]
    if (typeof protocol !== "string" || !SUBPROTOCOL_PATTERN.test(protocol) || seen.has(protocol)) {
      invalidOption("An invalid or duplicated subprotocol was specified", SyntaxError)
    }
    seen.add(protocol)
    index += 1
  }
  return list
}

export function normalizePerMessageDeflate(
  value: boolean | PerMessageDeflateOptions | undefined,
  fallback: boolean,
): false | NormalizedPerMessageDeflate {
  const resolved = value ?? fallback
  if (resolved === false) return false
  const options: PerMessageDeflateOptions = resolved === true ? {} : resolved
  return {
    serverNoContextTakeover: options.serverNoContextTakeover ?? false,
    clientNoContextTakeover: options.clientNoContextTakeover ?? false,
    threshold: options.threshold ?? DEFAULT_THRESHOLD,
    concurrencyLimit: options.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT,
    zlibDeflateOptions: options.zlibDeflateOptions,
    zlibInflateOptions: options.zlibInflateOptions,
  }
}
