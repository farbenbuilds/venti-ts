import type { ErrorCode } from "../../src/types/errors";
import type { EngineStatus, ErrorStatus, StatusErrorMap } from "../../src/types/status";

export const engineStatuses: readonly EngineStatus[] = [
  "ok",
  "closing",
  "closed",
  "backpressure",
  "invalid-handle",
  "payload-too-large",
  "protocol-error",
  "policy-violation",
];

export const statusErrors: StatusErrorMap = {
  closed: "ERR_SOCKET_CLOSED",
  "invalid-handle": "ERR_INVALID_HANDLE",
  "payload-too-large": "ERR_MAX_PAYLOAD",
  "protocol-error": "ERR_PROTOCOL",
  "policy-violation": "ERR_POLICY_VIOLATION",
};

export function codeForStatus(status: ErrorStatus): ErrorCode {
  return statusErrors[status];
}
