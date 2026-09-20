import type WebSocketDefault from "ventijs";
import type {
  ClientOptions,
  CloseEvent,
  MessageEvent,
  PerMessageDeflateOptions,
  RawData,
  Server,
  ServerOptions,
  VerifyClientCallbackAsync,
  WebSocket,
  WebSocketServer,
} from "ventijs";

export type DefaultSocket = WebSocketDefault;
export type DefaultServer = Server;
export type CreateConnection = NonNullable<ClientOptions["createConnection"]>;
export type MessageHandler = (data: RawData, isBinary: boolean) => void;
export type QualifiedRawData = WebSocket.RawData;
export type QualifiedClientOptions = WebSocket.ClientOptions;

export const rawData: RawData = Buffer.from("payload");
export const textData: WebSocket.Data = "payload";
export const deflateOptions: PerMessageDeflateOptions = {
  threshold: 1024,
  serverNoContextTakeover: true,
};
export const clientOptions: ClientOptions = {
  perMessageDeflate: deflateOptions,
  handshakeTimeout: 5_000,
  maxPayload: 1_048_576,
};

export const verifyClient: VerifyClientCallbackAsync = (info, callback) => {
  callback(info.secure && info.origin.endsWith(".test"));
};

export const serverOptions: ServerOptions = {
  noServer: true,
  clientTracking: true,
  perMessageDeflate: deflateOptions,
  verifyClient,
};

export const serverClientCount = (server: WebSocketServer): number => server.clients.size;
export const closeCodeOf = (event: CloseEvent): number => event.code;
export const messageDataOf = (event: MessageEvent): WebSocket.Data => event.data;
export const binaryTypeOf = (socket: WebSocket): WebSocket["binaryType"] => socket.binaryType;
export const readyStateOf = (socket: WebSocket): WebSocket["readyState"] => socket.readyState;
