import type { ErrorCode } from "./errors";

/// Statuses that report progress rather than a failure.
export type NonErrorStatus = "ok" | "closing" | "backpressure";

/// Statuses that map to a coded error.
export type ErrorStatus =
  | "closed"
  | "invalid-handle"
  | "payload-too-large"
  | "invalid-close-code"
  | "invalid-close-reason"
  | "protocol-error"
  | "policy-violation";

export type EngineStatus = NonErrorStatus | ErrorStatus;

export type StatusErrorMap = Readonly<Record<ErrorStatus, ErrorCode>>;
