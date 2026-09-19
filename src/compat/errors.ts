import type { CodedError, ErrorCode } from "../types/errors"
import type { ErrorStatus, StatusErrorMap } from "../types/status"

export const STATUS_ERROR_CODES: StatusErrorMap = {
  closed: "ERR_SOCKET_CLOSED",
  "invalid-handle": "ERR_INVALID_HANDLE",
  "payload-too-large": "ERR_MAX_PAYLOAD",
  "protocol-error": "ERR_PROTOCOL",
  "policy-violation": "ERR_POLICY_VIOLATION",
}

export function createError(
  code: ErrorCode,
  message: string,
  constructor: ErrorConstructor = Error,
): CodedError {
  return Object.assign(new constructor(message), { code })
}

export function createStatusError(status: ErrorStatus, message: string): CodedError {
  return createError(STATUS_ERROR_CODES[status], message)
}

export function isCodedError(value: unknown): value is CodedError {
  if (!(value instanceof Error)) return false
  if (!("code" in value)) return false
  return typeof value.code === "string"
}
