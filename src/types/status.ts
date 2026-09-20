import type { ErrorCode } from "./errors";

export type EngineStatus =
  | "ok"
  | "closing"
  | "closed"
  | "backpressure"
  | "invalid-handle"
  | "payload-too-large"
  | "invalid-close-code"
  | "invalid-close-reason"
  | "protocol-error"
  | "policy-violation";

export type ErrorStatus = Exclude<EngineStatus, "ok" | "closing" | "backpressure">;

export type StatusErrorMap = Readonly<Record<ErrorStatus, ErrorCode>>;
