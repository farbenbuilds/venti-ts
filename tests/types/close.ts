import type { ProtocolCloseCode, ReadyState } from "../../src/types/close";

export const readyStates: readonly ReadyState[] = [0, 1, 2, 3];

export const protocolCodeTable: Readonly<Record<ProtocolCloseCode, true>> = {
  1000: true,
  1001: true,
  1002: true,
  1003: true,
  1004: true,
  1005: true,
  1006: true,
  1007: true,
  1008: true,
  1009: true,
  1010: true,
  1011: true,
  1012: true,
  1013: true,
  1014: true,
  1015: true,
};

export function isTerminal(state: ReadyState): boolean {
  return state === 3;
}
