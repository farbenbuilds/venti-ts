export const ENGINE_EVENT_KINDS = [
  "listening",
  "connectionOpen",
  "connectionClose",
  "engineError",
  "serverClosed",
] as const;

export type EngineEventKind = (typeof ENGINE_EVENT_KINDS)[number];

export type EngineEvent = {
  readonly kind: EngineEventKind;
  readonly server: number;
  readonly index: number;
  readonly generation: number;
  readonly code: number;
};

export type NativeServerConfig = {
  readonly host?: string;
  readonly port: number;
  readonly backlog?: number;
  readonly path?: string;
  readonly maxConnections?: number;
  readonly maxMessageBytes?: number;
  readonly maxFrameBytes?: number;
};

export type EngineDispatch = (event: EngineEvent) => void;

/// Per-connection operation results mirrored from `socket.Status` in
/// `src/engine/status.zig`. The ABI carries the enum ordinal; this array is
/// the ordinal-to-name table and must keep the Zig declaration order.
export const NATIVE_SOCKET_STATUSES = [
  "ok",
  "closing",
  "closed",
  "backpressure",
  "invalidHandle",
  "payloadTooLarge",
  "invalidCloseCode",
  "invalidCloseReason",
  "protocolError",
  "policyViolation",
] as const;

export type NativeSocketStatus = (typeof NATIVE_SOCKET_STATUSES)[number];

export type VentiAddon = {
  engineVersion(): string;
  http3Available(): boolean;
  createServer(config: NativeServerConfig, dispatch: EngineDispatch): number;
  listenServer(server: number): void;
  closeServer(server: number): void;
  finalizeServer(server: number): void;
  /// Returns an ordinal into `NATIVE_SOCKET_STATUSES`; ordinals keep the
  /// per-message path free of string allocation.
  sendSocket(server: number, connection: bigint, data: Uint8Array, binary: boolean): number;
  closeSocket(server: number, connection: bigint, code: number, reason: Uint8Array): number;
  pauseSocket(server: number, connection: bigint): number;
  resumeSocket(server: number, connection: bigint): number;
  socketBufferedAmount(server: number, connection: bigint): number;
  /// Events the channel could not queue because its ring was full.
  serverDroppedEvents(server: number): bigint;
};
