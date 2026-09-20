import type { CodedError, ErrorCode } from "../../src/types/errors";

export const errorCodes: readonly ErrorCode[] = [
  "ERR_INVALID_OPTION",
  "ERR_INVALID_CLOSE_CODE",
  "ERR_INVALID_CLOSE_REASON",
  "ERR_SOCKET_NOT_OPEN",
  "ERR_SOCKET_CLOSED",
  "ERR_INVALID_STATE",
  "ERR_INVALID_HANDLE",
  "ERR_MAX_PAYLOAD",
  "ERR_PROTOCOL",
  "ERR_POLICY_VIOLATION",
];

export function readErrorCode(error: CodedError): ErrorCode {
  return error.code;
}
