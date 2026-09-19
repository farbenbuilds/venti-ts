import type { ClientRequest, IncomingMessage } from 'node:http'
import type { Registry } from './pubsub'
import type { WebSocket } from './ws'

export type ReadyState = WebSocket['readyState']
export type BinaryType = WebSocket['binaryType']

export type SocketEventMap = {
  open: []
  message: [data: WebSocket.RawData, isBinary: boolean]
  close: [code: number, reason: Buffer]
  error: [error: Error]
  ping: [data: Buffer]
  pong: [data: Buffer]
  upgrade: [request: IncomingMessage]
  redirect: [url: string, request: ClientRequest]
  'unexpected-response': [request: ClientRequest, response: IncomingMessage]
}

export type SocketDomHandlers = Pick<WebSocket, 'onopen' | 'onerror' | 'onclose' | 'onmessage'>

export type SocketState = {
  readonly url: string
  readonly protocol: string
  readonly extensions: string
  binaryType: BinaryType
  readyState: ReadyState
  bufferedAmount: number
  isPaused: boolean
  readonly domHandlers: SocketDomHandlers
  listeners: Registry<SocketEventMap>
}
