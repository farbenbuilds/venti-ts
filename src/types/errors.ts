export type ErrorCode =
  | "ERR_INVALID_OPTION"
  | "ERR_INVALID_CLOSE_CODE"
  | "ERR_INVALID_CLOSE_REASON"
  | "ERR_SOCKET_NOT_OPEN"
  | "ERR_SOCKET_CLOSED"
  | "ERR_INVALID_HANDLE"
  | "ERR_MAX_PAYLOAD"
  | "ERR_PROTOCOL"
  | "ERR_POLICY_VIOLATION"

export type CodedError = Error & { readonly code: ErrorCode }
