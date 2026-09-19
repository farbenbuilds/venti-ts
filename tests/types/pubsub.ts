import { createRegistry, dispatch, subscribe } from '../../src/compat/pubsub'
import type { EventMap, Handler, Registry } from '../../src/types/pubsub'
import type { ServerEventMap, ServerState } from '../../src/types/server'
import type { SocketEventMap, SocketState } from '../../src/types/socket'
import type { WebSocket } from '../../src/types/ws'
import type { ClientRequest, IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

type HandlerTable<E extends EventMap> = {
  [K in keyof E]: Handler<E[K]>
}

export const socketHandlers: HandlerTable<SocketEventMap> = {
  open: (): void => {},
  message: (data: WebSocket.RawData, isBinary: boolean): void => {
    void data
    void isBinary
  },
  close: (code: number, reason: Buffer): void => {
    void code
    void reason
  },
  error: (error: Error): void => {
    void error
  },
  ping: (data: Buffer): void => {
    void data
  },
  pong: (data: Buffer): void => {
    void data
  },
  upgrade: (request: IncomingMessage): void => {
    void request
  },
  redirect: (url: string, request: ClientRequest): void => {
    void url
    void request
  },
  'unexpected-response': (request: ClientRequest, response: IncomingMessage): void => {
    void request
    void response
  },
}

export const serverHandlers: HandlerTable<ServerEventMap> = {
  connection: (socket: WebSocket, request: IncomingMessage): void => {
    void socket
    void request
  },
  error: (error: Error): void => {
    void error
  },
  headers: (headers: string[], request: IncomingMessage): void => {
    void headers
    void request
  },
  close: (): void => {},
  listening: (): void => {},
  wsClientError: (error: Error, socket: Duplex, request: IncomingMessage): void => {
    void error
    void socket
    void request
  },
}

export const socketState: SocketState = {
  url: 'ws://example.test',
  protocol: '',
  extensions: '',
  binaryType: 'nodebuffer',
  readyState: 0,
  bufferedAmount: 0,
  isPaused: false,
  domHandlers: { onopen: null, onerror: null, onclose: null, onmessage: null },
  listeners: createRegistry<SocketEventMap>(),
}

export const serverState: ServerState = {
  options: {},
  path: '/',
  clients: new Set<WebSocket>(),
  listeners: createRegistry<ServerEventMap>(),
}

export type SocketRegistry = Registry<SocketEventMap>
export type ServerRegistry = Registry<ServerEventMap>

export function registerMessage(
  socket: SocketState,
  handler: Handler<SocketEventMap['message']>,
): SocketState {
  return { ...socket, listeners: subscribe(socket.listeners, 'message', handler) }
}

export function announceClose(socket: SocketState): number {
  return dispatch(socket.listeners, 'close', 1000, Buffer.from('done'))
}

export function announceOpen(): number {
  return dispatch(createRegistry<SocketEventMap>(), 'open')
}
