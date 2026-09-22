import type { ErrorCode } from "../../src/types/errors";
import type {
  EngineStatus,
  ErrorStatus,
  NonErrorStatus,
  StatusErrorMap,
} from "../../src/types/status";

export const nonErrorStatuses: readonly NonErrorStatus[] = ["ok", "closing", "backpressure"];

export const engineStatuses: readonly EngineStatus[] = [
  "ok",
  "closing",
  "closed",
  "backpressure",
  "invalid-handle",
  "payload-too-large",
  "invalid-close-code",
  "invalid-close-reason",
  "protocol-error",
  "policy-violation",
];

export const statusErrors: StatusErrorMap = {
  closed: "ERR_SOCKET_CLOSED",
  "invalid-handle": "ERR_INVALID_HANDLE",
  "payload-too-large": "ERR_MAX_PAYLOAD",
  "invalid-close-code": "ERR_INVALID_CLOSE_CODE",
  "invalid-close-reason": "ERR_INVALID_CLOSE_REASON",
  "protocol-error": "ERR_PROTOCOL",
  "policy-violation": "ERR_POLICY_VIOLATION",
};

export function codeForStatus(status: ErrorStatus): ErrorCode {
  return statusErrors[status];
}
