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

export type VentiAddon = {
  engineVersion(): string;
  http3Available(): boolean;
  createServer(config: NativeServerConfig, dispatch: EngineDispatch): number;
  listenServer(server: number): void;
  closeServer(server: number): void;
  finalizeServer(server: number): void;
};
