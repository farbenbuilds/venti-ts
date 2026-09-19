export const MASK_LENGTH = 4
export const SMALL_FRAME_LIMIT = 125
export const MEDIUM_FRAME_LIMIT = 65_535
export const MAX_PAYLOAD_LENGTH = 9_007_199_254_740_991

export function isValidPayloadLength(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_PAYLOAD_LENGTH
}

export function frameHeaderLength(payloadLength: number, masked: boolean): number | undefined {
  if (!isValidPayloadLength(payloadLength)) return undefined
  let extended = 8
  if (payloadLength <= SMALL_FRAME_LIMIT) extended = 0
  else if (payloadLength <= MEDIUM_FRAME_LIMIT) extended = 2
  return 2 + extended + (masked ? MASK_LENGTH : 0)
}

export function applyMask(source: Uint8Array, mask: Uint8Array, target: Uint8Array): boolean {
  if (mask.length !== MASK_LENGTH) return false
  if (target.length < source.length) return false
  const length = source.length
  let index = 0
  while (index < length) {
    target[index] = source[index] ^ mask[index & 3]
    index += 1
  }
  return true
}
