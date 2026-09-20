import type { CodedError, ErrorCode } from "../types/errors";
import type { ErrorStatus, StatusErrorMap } from "../types/status";

export const STATUS_ERROR_CODES: StatusErrorMap = {
  closed: "ERR_SOCKET_CLOSED",
  "invalid-handle": "ERR_INVALID_HANDLE",
  "payload-too-large": "ERR_MAX_PAYLOAD",
  "invalid-close-code": "ERR_INVALID_CLOSE_CODE",
  "invalid-close-reason": "ERR_INVALID_CLOSE_REASON",
  "protocol-error": "ERR_PROTOCOL",
  "policy-violation": "ERR_POLICY_VIOLATION",
};

/// Exhaustive membership table: `Record<ErrorCode, true>` fails to compile if
/// a code is added to the union and not registered here.
const ERROR_CODE_LOOKUP: Readonly<Record<ErrorCode, true>> = {
  ERR_INVALID_OPTION: true,
  ERR_INVALID_CLOSE_CODE: true,
  ERR_INVALID_CLOSE_REASON: true,
  ERR_SOCKET_NOT_OPEN: true,
  ERR_SOCKET_CLOSED: true,
  ERR_INVALID_STATE: true,
  ERR_INVALID_HANDLE: true,
  ERR_MAX_PAYLOAD: true,
  ERR_PROTOCOL: true,
  ERR_POLICY_VIOLATION: true,
};

export function createError(
  code: ErrorCode,
  message: string,
  constructor: ErrorConstructor = Error,
): CodedError {
  return Object.assign(new constructor(message), { code });
}

export function createStatusError(status: ErrorStatus, message: string): CodedError {
  return createError(STATUS_ERROR_CODES[status], message);
}

/// Recognizes a coded error at an untrusted boundary. The `code` read is
/// guarded so a hostile getter cannot escape the predicate, and membership is
/// checked so a foreign code (for example ws's internal `WS_ERR_*`) is never
/// mistaken for a ventijs code.
export function isCodedError(value: unknown): value is CodedError {
  if (!(value instanceof Error)) return false;
  try {
    const code: unknown = (value as { readonly code?: unknown }).code;
    return typeof code === "string" && Object.hasOwn(ERROR_CODE_LOOKUP, code);
  } catch {
    return false;
  }
}
