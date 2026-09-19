import type { WebSocket } from "./ws"

export type ReadyState = WebSocket["readyState"]

export type ProtocolCloseCode =
  | 1000
  | 1001
  | 1002
  | 1003
  | 1005
  | 1006
  | 1007
  | 1008
  | 1009
  | 1010
  | 1011
  | 1012
  | 1013
  | 1014
  | 1015

export type CloseReason = Buffer
