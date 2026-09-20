import type { NormalizedClientOptions } from "../types/options";
import type { ClientOptions } from "../types/ws";
import {
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_MAX_REDIRECTS,
  invalidOption,
  normalizePerMessageDeflate,
} from "./options";

export function normalizeClientOptions(options?: ClientOptions): NormalizedClientOptions {
  const source = options ?? {};
  const protocolVersion = source.protocolVersion ?? 13;
  if (protocolVersion !== 8 && protocolVersion !== 13) {
    invalidOption(
      `Unsupported protocol version: ${protocolVersion} (supported versions: 8, 13)`,
      RangeError,
    );
  }
  return {
    protocolVersion,
    followRedirects: source.followRedirects ?? false,
    maxRedirects: source.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    handshakeTimeout: source.handshakeTimeout,
    maxPayload: source.maxPayload ?? DEFAULT_MAX_PAYLOAD,
    skipUTF8Validation: source.skipUTF8Validation ?? false,
    allowSynchronousEvents: source.allowSynchronousEvents ?? true,
    autoPong: source.autoPong ?? true,
    perMessageDeflate: normalizePerMessageDeflate(source.perMessageDeflate, true),
    origin: source.origin,
    headers: source.headers === undefined ? undefined : { ...source.headers },
  };
}
