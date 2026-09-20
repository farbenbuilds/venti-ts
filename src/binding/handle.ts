export type ConnectionHandle = bigint;

const MAX_UINT32 = 0xffff_ffff;
const MAX_UINT32_BIG = 0xffff_ffffn;
const MAX_HANDLE_BIG = 0xffff_ffff_ffff_ffffn;

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new RangeError(`ventijs: connection handle ${label} must be a uint32, got ${value}`);
  }
}

export function packConnectionHandle(index: number, generation: number): ConnectionHandle {
  assertUint32(index, "index");
  assertUint32(generation, "generation");
  return (BigInt(generation) << 32n) | BigInt(index);
}

export function assertConnectionHandle(handle: ConnectionHandle): void {
  if (typeof handle !== "bigint" || handle < 0n || handle > MAX_HANDLE_BIG) {
    throw new RangeError(`ventijs: connection handle out of range: ${String(handle)}`);
  }
}

export function unpackConnectionHandle(handle: ConnectionHandle): {
  readonly index: number;
  readonly generation: number;
} {
  assertConnectionHandle(handle);
  return {
    index: Number(handle & MAX_UINT32_BIG),
    generation: Number((handle >> 32n) & MAX_UINT32_BIG),
  };
}
