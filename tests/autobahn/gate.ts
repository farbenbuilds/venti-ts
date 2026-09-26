import {
  CAPACITY_CASES,
  CLOSURE_INFORMATIONAL_CASES,
  CLOSURE_OK_CASES,
  EVALUATED_CASES,
  INBOUND_LIMIT_BYTES,
  TOTAL_CASES,
} from "./expected-cases.ts";
import type { CaseReport } from "./report-index.ts";
import { isTolerated } from "./report-index.ts";

export type ViolationKind =
  | "case-failed"
  | "closure-split"
  | "count-capacity"
  | "count-evaluated"
  | "count-total";

export type Violation = {
  readonly kind: ViolationKind;
  readonly detail: string;
};

export type GateCounts = {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly capacity: number;
  readonly nonStrict: number;
  readonly closureOk: number;
  readonly closureInformational: number;
};

export type GateResult = {
  readonly ok: boolean;
  readonly counts: GateCounts;
  readonly violations: readonly Violation[];
};

function countOutcomes(cases: readonly CaseReport[]): GateCounts {
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

function countViolations(counts: GateCounts): readonly Violation[] {
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
  if (counts.closureOk !== CLOSURE_OK_CASES) {
    violations.push({
      kind: "closure-split",
      detail: `expected ${CLOSURE_OK_CASES} behaviorClose OK, report has ${counts.closureOk}`,
    });
  }
  if (counts.closureInformational !== CLOSURE_INFORMATIONAL_CASES) {
    violations.push({
      kind: "closure-split",
      detail: `expected ${CLOSURE_INFORMATIONAL_CASES} behaviorClose INFORMATIONAL, report has ${counts.closureInformational}`,
    });
  }
  return violations;
}

function caseViolations(cases: readonly CaseReport[]): readonly Violation[] {
  const violations: Violation[] = [];
  for (const entry of cases) {
    if (entry.outcome === "skipped-capacity") continue;
    if (isTolerated(entry.behavior) && isTolerated(entry.behaviorClose)) continue;
    violations.push({
      kind: "case-failed",
      detail: `${entry.id} behavior=${entry.behavior} behaviorClose=${entry.behaviorClose}`,
    });
  }
  return violations;
}

/// A capacity-blocked case may carry any behavior string, because the whole
/// point of the category is that the engine could not complete the session. It
/// cannot hide behind that, so the count checks still apply to it; only a
/// genuine pass is expected to be absent.
export function evaluateGate(cases: readonly CaseReport[]): GateResult {
  const counts = countOutcomes(cases);
  const violations = [...countViolations(counts), ...caseViolations(cases)];
  return { ok: violations.length === 0, counts, violations };
}
