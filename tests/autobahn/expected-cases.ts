/// The Autobahn report contract: how many cases the pinned suite produces for
/// groups 1-7 and 9-13, and which of them the pinned engine build cannot reach
/// because of its compiled-in message capacity.
///
/// The totals are the contract in `CI_CD_PIPELINE.md` ("all 517 cases with 514
/// `OK` and 3 `INFORMATIONAL` results"). The split is `behaviorClose`, which is
/// where the three `INFORMATIONAL` results live: 7.1.6, 7.13.1 and 7.13.2.
/// `fuzzingclient.json` also selects `11.*`, but the pinned suite defines no
/// group 11 cases, so the pattern contributes nothing and 517 already accounts
/// for it.
export const TOTAL_CASES = 517;
export const CLOSURE_OK_CASES = 514;
export const CLOSURE_INFORMATIONAL_CASES = 3;

/// `message_capacity` in `src/engine/server/capacities.zig` is compiled into the
/// addon as a Zig `comptime` constant, so the cap is a property of the build
/// and not something the harness can raise.
export const INBOUND_LIMIT_BYTES = 32 * 1024;

/// Groups 12 and 13 generate their cases from a cross product: five test
/// payloads for group 12 and seven deflate parameter sets for group 13, each
/// expanded over the rows of the suite's `MSG_SIZES` table. The two counts are
/// derived from that table rather than restated, so the arithmetic cannot drift
/// away from the sizes it is derived from.
export const COMPRESSION_SUBGROUPS = 12;

/// The payload-length column of the suite's `MSG_SIZES` table, in expansion
/// order, for case sub-ids `12.x.1` through `12.x.18` and `13.x.1` through
/// `13.x.18`.
export const COMPRESSION_SIZE_ROWS = [
  16, 64, 256, 1024, 4096, 8192, 16_384, 32_768, 65_536, 131_072, 8192, 16_384, 32_768, 65_536,
  131_072, 131_072, 131_072, 131_072,
] as const;

export const COMPRESSION_SIZES = COMPRESSION_SIZE_ROWS.length;
export const COMPRESSION_OVER_LIMIT_ROWS = COMPRESSION_SIZE_ROWS.filter(
  (size) => size > INBOUND_LIMIT_BYTES,
).length;

/// One entry of the suite's `Cases` expansion whose largest payload exceeds
/// `INBOUND_LIMIT_BYTES`, with the byte count the suite actually puts on the
/// wire. `prefix` matches a case id by string prefix, so "9.1" covers
/// 9.1.1 through 9.1.6.
export type CapacityRule = {
  readonly prefix: string;
  readonly payloadBytes: number;
  readonly caseCount: number;
  readonly origin: string;
};

export const CAPACITY_RULES = [
  { prefix: "7.1.6", payloadBytes: 256 * 1024, caseCount: 1, origin: "Case7_1_6.DATALEN" },
  { prefix: "9.1", payloadBytes: 64 * 1024, caseCount: 6, origin: "Case9_1_x.DATALEN" },
  { prefix: "9.2", payloadBytes: 64 * 1024, caseCount: 6, origin: "Case9_2_x.DATALEN" },
  { prefix: "9.3", payloadBytes: 4 * 1024 * 1024, caseCount: 9, origin: "Case9_3_x.DATALEN" },
  { prefix: "9.4", payloadBytes: 4 * 1024 * 1024, caseCount: 9, origin: "Case9_4_x.DATALEN" },
  { prefix: "9.5", payloadBytes: 1024 * 1024, caseCount: 6, origin: "Case9_5_x.DATALEN" },
  { prefix: "9.6", payloadBytes: 1024 * 1024, caseCount: 6, origin: "Case9_6_x.DATALEN" },
  { prefix: "10.1.1", payloadBytes: 65_536, caseCount: 1, origin: "Case10_1_1.payload" },
] as const satisfies readonly CapacityRule[];

export const SCALAR_CAPACITY_CASES = CAPACITY_RULES.reduce(
  (total, rule) => total + rule.caseCount,
  0,
);

export const COMPRESSION_CAPACITY_CASES = COMPRESSION_SUBGROUPS * COMPRESSION_OVER_LIMIT_ROWS;

/// 1 + 6 + 6 + 9 + 9 + 6 + 6 + 1 = 44, plus 12 * 7 = 84.
export const CAPACITY_CASES = SCALAR_CAPACITY_CASES + COMPRESSION_CAPACITY_CASES;

/// 517 - 128 = 389 cases the pinned engine build is expected to be able to
/// answer. The expected count is therefore a function of the categories in
/// play: 517 selected, 128 capacity-blocked, 389 evaluated.
export const EVALUATED_CASES = TOTAL_CASES - CAPACITY_CASES;

export function capacityRuleFor(caseId: string): CapacityRule | null {
  for (const rule of CAPACITY_RULES) {
    if (caseId === rule.prefix || caseId.startsWith(`${rule.prefix}.`)) return rule;
  }
  return null;
}

export function isCompressionCase(caseId: string): boolean {
  const parts = caseId.split(".");
  if (parts.length !== 3) return false;
  if (parts[0] !== "12" && parts[0] !== "13") return false;
  const row = Number(parts[2]);
  if (!Number.isInteger(row) || row < 1 || row > COMPRESSION_SIZES) return false;
  return COMPRESSION_SIZE_ROWS[row - 1] > INBOUND_LIMIT_BYTES;
}

export function exceedsInboundLimit(caseId: string): boolean {
  return capacityRuleFor(caseId) !== null || isCompressionCase(caseId);
}
