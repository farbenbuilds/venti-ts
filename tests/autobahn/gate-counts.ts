import {
  CAPACITY_CASES,
  CLOSURE_BEHAVIORS,
  EVALUATED_CASES,
  INBOUND_LIMIT_BYTES,
  TOTAL_CASES,
} from "./expected-cases.ts";
import type { CaseReport } from "./report-index.ts";
import type { GateCounts, Violation } from "./gate.ts";

export function countOutcomes(cases: readonly CaseReport[]): GateCounts {
  let passed = 0;
  let failed = 0;
  let capacity = 0;
  let nonStrict = 0;
  let closureOk = 0;
  let closureInformational = 0;
  for (const entry of cases) {
    switch (entry.outcome) {
      case "passed":
        passed += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "skipped-capacity":
        capacity += 1;
        break;
    }
    if (entry.behavior === "NON-STRICT" || entry.behaviorClose === "NON-STRICT") nonStrict += 1;
    if (entry.behaviorClose === "OK") closureOk += 1;
    if (entry.behaviorClose === "INFORMATIONAL") closureInformational += 1;
  }
  return {
    total: cases.length,
    passed,
    failed,
    capacity,
    nonStrict,
    closureOk,
    closureInformational,
  };
}

export function countViolations(counts: GateCounts): readonly Violation[] {
  const violations: Violation[] = [];
  // A total other than 517 means a case went missing or the suite grew, and
  // either way the per-case verdicts below cannot be trusted.
  if (counts.total !== TOTAL_CASES) {
    violations.push({
      kind: "count-total",
      detail: `expected ${TOTAL_CASES} cases, report has ${counts.total}`,
    });
  }
  if (counts.capacity !== CAPACITY_CASES) {
    violations.push({
      kind: "count-capacity",
      detail: `expected ${CAPACITY_CASES} capacity-blocked cases above ${INBOUND_LIMIT_BYTES} bytes, report has ${counts.capacity}`,
    });
  }
  const evaluated = counts.passed + counts.failed;
  if (evaluated !== EVALUATED_CASES) {
    violations.push({
      kind: "count-evaluated",
      detail: `expected ${EVALUATED_CASES} evaluated cases, report has ${evaluated}`,
    });
  }
  return violations;
}

/// Every case must carry a recognised close behavior.
///
/// This replaces an earlier check that demanded the `behaviorClose` split of a
/// fully conformant implementation, 514 `OK` and 3 `INFORMATIONAL`. Those numbers
/// come from the `ws` reference report, and holding ventijs to them would assert
/// that all 389 evaluated cases pass, which is the per-case gate's job and not a
/// property of the report's shape. A missing or unrecognised value is what
/// actually indicates a truncated or foreign report, so that is what this checks.
export function closeBehaviorViolations(cases: readonly CaseReport[]): readonly Violation[] {
  const violations: Violation[] = [];
  for (const entry of cases) {
    if (entry.behaviorClose === "") {
      violations.push({
        kind: "closure-unknown",
        detail: `${entry.id} reported no behaviorClose`,
      });
      continue;
    }
    if (CLOSURE_BEHAVIORS.has(entry.behaviorClose)) continue;
    violations.push({
      kind: "closure-unknown",
      detail: `${entry.id} reported unknown behaviorClose ${entry.behaviorClose}`,
    });
  }
  return violations;
}
