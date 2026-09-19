import type { ProtocolCloseCode, ReadyState } from "../../src/types/close"

export const readyStates: readonly ReadyState[] = [0, 1, 2, 3]

export const protocolCloseCodes: readonly ProtocolCloseCode[] = [
  1000, 1001, 1002, 1003, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015,
]

export function isTerminal(state: ReadyState): boolean {
  return state === 3
}
