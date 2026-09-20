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
/// `src/engine/socket.zig`. The ABI carries enum names as camelCase strings.
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
  sendSocket(
    server: number,
    connection: bigint,
    data: Uint8Array,
    binary: boolean,
  ): NativeSocketStatus;
  closeSocket(
    server: number,
    connection: bigint,
    code: number,
    reason: Uint8Array,
  ): NativeSocketStatus;
  pauseSocket(server: number, connection: bigint): NativeSocketStatus;
  resumeSocket(server: number, connection: bigint): NativeSocketStatus;
  socketBufferedAmount(server: number, connection: bigint): number;
};
