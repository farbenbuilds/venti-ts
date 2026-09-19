export const CLOSE_NORMAL = 1000
export const CLOSE_GOING_AWAY = 1001
export const CLOSE_PROTOCOL_ERROR = 1002
export const CLOSE_UNSUPPORTED_DATA = 1003
export const CLOSE_RESERVED = 1004
export const CLOSE_NO_STATUS = 1005
export const CLOSE_ABNORMAL = 1006
export const CLOSE_INVALID_PAYLOAD = 1007
export const CLOSE_POLICY_VIOLATION = 1008
export const CLOSE_MESSAGE_TOO_BIG = 1009
export const CLOSE_MANDATORY_EXTENSION = 1010
export const CLOSE_INTERNAL_ERROR = 1011
export const CLOSE_SERVICE_RESTART = 1012
export const CLOSE_TRY_AGAIN_LATER = 1013
export const CLOSE_BAD_GATEWAY = 1014
export const CLOSE_TLS_HANDSHAKE = 1015

export const APPLICATION_CLOSE_MIN = 3000
export const APPLICATION_CLOSE_MAX = 4999
export const MAX_CLOSE_REASON_LENGTH = 123

export function isValidStatusCode(code: number): boolean {
  if (!Number.isInteger(code)) return false
  if (code >= APPLICATION_CLOSE_MIN && code <= APPLICATION_CLOSE_MAX) return true
  if (code < CLOSE_NORMAL || code > CLOSE_BAD_GATEWAY) return false
  return code !== CLOSE_RESERVED && code !== CLOSE_NO_STATUS && code !== CLOSE_ABNORMAL
}

export function isApplicationStatusCode(code: number): boolean {
  return Number.isInteger(code) && code >= APPLICATION_CLOSE_MIN && code <= APPLICATION_CLOSE_MAX
}

export function isReservedStatusCode(code: number): boolean {
  return code === CLOSE_RESERVED || code === CLOSE_NO_STATUS || code === CLOSE_ABNORMAL
}

export function isValidCloseReason(reason: string | Buffer): boolean {
  return Buffer.byteLength(reason) <= MAX_CLOSE_REASON_LENGTH
}
