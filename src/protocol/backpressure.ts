export function addBufferedAmount(current: number, added: number): number {
  if (!(added > 0)) return current
  return current + added
}

export function drainBufferedAmount(current: number, drained: number): number {
  if (!(drained > 0)) return current
  if (drained >= current) return 0
  return current - drained
}

export function shouldPauseWrites(bufferedAmount: number, highWaterMark: number): boolean {
  if (!(highWaterMark > 0)) return false
  return bufferedAmount >= highWaterMark
}

export function shouldResumeWrites(bufferedAmount: number, lowWaterMark: number): boolean {
  if (!(lowWaterMark >= 0)) return true
  return bufferedAmount <= lowWaterMark
}
